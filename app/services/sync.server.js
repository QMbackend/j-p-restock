import db from "../db.server";

const RECENT_ORDERS_QUERY = `#graphql
  query RecentPaidOrders {
    orders(
      first: 50
      reverse: true
      sortKey: CREATED_AT
      query: "financial_status:paid"
    ) {
      nodes {
        id
        createdAt

        lineItems(first: 100) {
          nodes {
            id
            title
            variantTitle
            quantity

            variant {
              id
              inventoryQuantity

              media(first: 1) {
                nodes {
                  ... on MediaImage {
                    image {
                      url
                      altText
                    }
                  }
                }
              }

              product {
                featuredImage {
                  url
                  altText
                }
              }
            }
          }
        }
      }
    }
  }
`;

const RESTOCK_VARIANTS_QUERY = `#graphql
  query RestockVariants($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on ProductVariant {
        id
        title
        inventoryQuantity

        media(first: 1) {
          nodes {
            ... on MediaImage {
              image {
                url
                altText
              }
            }
          }
        }

        product {
          title

          featuredImage {
            url
            altText
          }
        }
      }
    }
  }
`;

export async function syncRecentOrders(admin, shop) {
  const response = await admin.graphql(RECENT_ORDERS_QUERY);
  const result = await response.json();

  if (result.errors) {
    throw new Error(
      result.errors.map((error) => error.message).join(", "),
    );
  }

  let importedLineItems = 0;

  for (const order of result.data.orders.nodes) {
    for (const item of order.lineItems.nodes) {
      if (!item.variant?.id) {
        continue;
      }

      const existingLineItem =
        await db.processedLineItem.findFirst({
          where: {
            shop,
            shopifyLineItemId: item.id,
          },
        });

      if (existingLineItem) {
        continue;
      }

      await db.$transaction([
        db.processedLineItem.create({
          data: {
            shop,
            shopifyLineItemId: item.id,
            shopifyOrderId: order.id,
            shopifyVariantId: item.variant.id,
            quantity: item.quantity,
            soldAt: new Date(order.createdAt),
          },
        }),

        db.restockItem.upsert({
          where: {
            shop_shopifyVariantId: {
              shop,
              shopifyVariantId: item.variant.id,
            },
          },

          create: {
            shop,
            shopifyVariantId: item.variant.id,
            productTitle: item.title,
            variantTitle: item.variantTitle || null,

            imageURL:
              item.variant.media.nodes[0]?.image?.url ??
              item.variant.product.featuredImage?.url ??
              null,

            needsRestock: item.quantity,
            inventoryQuantity:
              item.variant.inventoryQuantity ?? 0,
            lastSaleAt: new Date(order.createdAt),
          },

          update: {
            shop,
            productTitle: item.title,
            variantTitle: item.variantTitle || null,

            imageURL:
              item.variant.media.nodes[0]?.image?.url ??
              item.variant.product.featuredImage?.url ??
              null,

            needsRestock: {
              increment: item.quantity,
            },

            inventoryQuantity:
              item.variant.inventoryQuantity ?? 0,
            lastSaleAt: new Date(order.createdAt),
          },
        }),
      ]);

      importedLineItems += 1;
    }
  }

  const refreshedVariants =
    await refreshRestockInventory(admin, shop);

  return {
    success: true,
    intent: "sync",
    importedLineItems,
    refreshedVariants,
  };
}

async function refreshRestockInventory(admin, shop) {
  const activeRestockItems = await db.restockItem.findMany({
    where: {
      shop,
      needsRestock: {
        gt: 0,
      },
    },

    select: {
      shopifyVariantId: true,
    },
  });

  if (activeRestockItems.length === 0) {
    return 0;
  }

  const variantIds = activeRestockItems.map(
    (item) => item.shopifyVariantId,
  );

  let refreshedVariants = 0;

  /*
   * Process the IDs in smaller batches so this continues
   * working if the restock queue becomes large.
   */
  for (let index = 0; index < variantIds.length; index += 100) {
    const batch = variantIds.slice(index, index + 100);

    const response = await admin.graphql(
      RESTOCK_VARIANTS_QUERY,
      {
        variables: {
          ids: batch,
        },
      },
    );

    const result = await response.json();

    if (result.errors) {
      throw new Error(
        result.errors
          .map((error) => error.message)
          .join(", "),
      );
    }

    for (const variant of result.data.nodes) {
      /*
       * Shopify returns null if a variant no longer exists.
       */
      if (!variant?.id) {
        continue;
      }

      await db.restockItem.update({
        where: {
          shop_shopifyVariantId: {
            shop,
            shopifyVariantId: variant.id,
          },
        },

        data: {
          productTitle: variant.product.title,

          variantTitle:
            variant.title === "Default Title"
              ? null
              : variant.title,

          inventoryQuantity:
            variant.inventoryQuantity ?? 0,

          imageURL:
            variant.media.nodes[0]?.image?.url ??
            variant.product.featuredImage?.url ??
            null,
        },
      });

      refreshedVariants += 1;
    }
  }

  return refreshedVariants;
}