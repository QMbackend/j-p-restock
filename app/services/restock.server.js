import db from "../db.server";

export async function restockVariant({
  shop,
  variantId,
  quantityValue,
  removeFromQueue = false,
}) {
  if (!variantId || typeof variantId !== "string") {
    return {
      success: false,
      intent: "restock",
      message: "Missing variant ID.",
    };
  }

  const restockItem = await db.restockItem.findUnique({
    where: {
      shop_shopifyVariantId: {
        shop,
        shopifyVariantId: variantId,
      },
    },
  });

  if (!restockItem) {
    return {
      success: false,
      intent: "restock",
      message: "Restock item not found.",
    };
  }

  if (removeFromQueue) {
    await db.restockItem.update({
      where: {
        shop_shopifyVariantId: {
        shop,
          shopifyVariantId: variantId,
        },
      },
      data: {
        needsRestock: 0,
      },
    });

    return {
      success: true,
      intent: "removeFromQueue",
    };
  }

  const quantity = Number(quantityValue);

  if (!Number.isInteger(quantity) || quantity < 1) {
    return {
      success: false,
      intent: "restock",
      message: "Enter a valid restock quantity.",
    };
  }

  if (restockItem.inventoryQuantity <= 0) {
    return {
      success: false,
      intent: "restock",
      message: "No inventory available to restock.",
    };
  }

  if (quantity > restockItem.inventoryQuantity) {
    return {
      success: false,
      intent: "restock",
      message: `Only ${restockItem.inventoryQuantity} item(s) available to restock.`,
    };
  }

  if (quantity > restockItem.needsRestock) {
    return {
      success: false,
      intent: "restock",
      message: `Restock quantity cannot be greater than ${restockItem.needsRestock}.`,
    };
  }

  const remainingQuantity =
    restockItem.needsRestock - quantity;

  await db.$transaction([
    db.restockItem.update({
      where: {
        shop_shopifyVariantId: {
          shop,
          shopifyVariantId: variantId,
        },
      },
      data: {
        needsRestock: remainingQuantity,
      },
    }),

    db.restockEvent.create({
      data: {
        shop,
        shopifyVariantId: variantId,
        quantity,
      },
    }),
  ]);

  return {
    success: true,
    intent: "restock",
    remainingQuantity,
  };
}