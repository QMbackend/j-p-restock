import { useEffect, useState } from "react";
import { DateTime } from "luxon";
import { useAppBridge } from "@shopify/app-bridge-react";
import {
  Link,
  useFetcher,
  useLoaderData,
} from "react-router";

import { authenticate } from "../shopify.server";
import db from "../db.server";
import { syncRecentOrders } from "../services/sync.server";
import { restockVariant } from "../services/restock.server";
import RestockCard from "../components/RestockCard";
import SummaryCards from "../components/SummaryCards";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const shopResponse = await admin.graphql(
    `#graphql
      query ShopTimezone {
        shop {
          ianaTimezone
        }
      }
    `,
  );

  const shopResult = await shopResponse.json();

  if (shopResult.errors) {
    throw new Error(
      shopResult.errors
        .map((error) => error.message)
        .join(", "),
    );
  }

  const storeTimezone =
    shopResult.data.shop.ianaTimezone;

  const items = await db.restockItem.findMany({
    where: {
      needsRestock: {
        gt: 0,
      },
    },
    orderBy: {
      lastSaleAt: "desc",
    },
  });

  const nowInStoreTimezone =
    DateTime.now().setZone(storeTimezone);

  let storeDayStart =
    nowInStoreTimezone.startOf("day").set({
      hour: 9,
      minute: 0,
      second: 0,
      millisecond: 0,
    });

  if (nowInStoreTimezone < storeDayStart) {
    storeDayStart = storeDayStart.minus({
      days: 1,
    });
  }

  const storeDayStartDate =
    storeDayStart.toJSDate();

  const todaySales =
    await db.processedLineItem.groupBy({
      by: ["shopifyVariantId"],
      where: {
        soldAt: {
          gte: storeDayStartDate,
        },
      },
      _sum: {
        quantity: true,
      },
    });

  const soldTodayByVariant = new Map(
    todaySales.map((sale) => [
      sale.shopifyVariantId,
      sale._sum.quantity ?? 0,
    ]),
  );

  const restockQueue = items.map((item) => ({
    id: item.id,
    shopifyVariantId: item.shopifyVariantId,
    product: item.productTitle,
    variant: item.variantTitle ?? "",
    imageURL: item.imageURL,
    needsRestock: item.needsRestock,
    soldToday:
      soldTodayByVariant.get(
        item.shopifyVariantId,
      ) ?? 0,
    inventory: item.inventoryQuantity,
    lastSaleAt: item.lastSaleAt,
  }));

  const lowInventoryCount =
    restockQueue.filter(
      (item) => item.inventory <= 3,
    ).length;

  const totalNeedsRestock =
    restockQueue.reduce(
      (sum, item) =>
        sum + item.needsRestock,
      0,
    );

  const totalSoldToday =
    todaySales.reduce(
      (sum, sale) =>
        sum + (sale._sum.quantity ?? 0),
      0,
    );

  return {
    restockQueue,
    syncedAt: new Date().toISOString(),
    lowInventoryCount,
    totalNeedsRestock,
    totalSoldToday,
  };
};

export const action = async ({ request }) => {
  const { admin } =
    await authenticate.admin(request);

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "removeFromQueue") {
    return restockVariant({
      variantId: formData.get("variantId"),
      removeFromQueue: true,
    });
  }

  if (intent === "restock") {
    return restockVariant({
      variantId: formData.get("variantId"),
      quantityValue: formData.get("quantity"),
    });
  }

  if (intent === "sync") {
    const result =
      await syncRecentOrders(admin);

    return {
      ...result,
      source:
        formData.get("source") ?? "manual",
    };
  }

  return {
    success: false,
    message: "Unknown action.",
  };
};

export default function RestockDashboard() {
  const {
    restockQueue = [],
    syncedAt,
    lowInventoryCount,
    totalNeedsRestock,
    totalSoldToday,
  } = useLoaderData();

  const syncFetcher = useFetcher();
  const shopify = useAppBridge();

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] =
    useState("recent");

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (syncFetcher.state === "idle") {
        syncFetcher.submit(
          {
            intent: "sync",
            source: "automatic",
          },
          {
            method: "post",
          },
        );
      }
    }, 60_000);

    return () =>
      clearInterval(intervalId);
  }, [syncFetcher]);

  useEffect(() => {
    if (
      !syncFetcher.data ||
      syncFetcher.data.intent !== "sync" ||
      !syncFetcher.data.success ||
      syncFetcher.data.source !== "manual"
    ) {
      return;
    }

    const imported =
      syncFetcher.data
        .importedLineItems ?? 0;

    const message =
      imported === 0
        ? "Sync complete.\n\nNo new sales found."
        : `Sync complete.\n\n${imported} new ${
            imported === 1
              ? "sale"
              : "sales"
          } imported.`;

    shopify.toast.show(message, {
      duration: 3500,
    });
  }, [syncFetcher.data, shopify]);

  const term =
    search.trim().toLowerCase();

  const filteredQueue = restockQueue
    .filter((item) => {
      if (!term) {
        return true;
      }

      return (
        item.product
          .toLowerCase()
          .includes(term) ||
        item.variant
          .toLowerCase()
          .includes(term)
      );
    })
    .sort((a, b) => {
      if (sortBy === "recent") {
        return (
          new Date(
            b.lastSaleAt,
          ).getTime() -
          new Date(
            a.lastSaleAt,
          ).getTime()
        );
      }

      if (
        sortBy === "inventoryPriority"
      ) {
        const getPriority = (
          inventory,
        ) => {
          if (inventory <= 0) {
            return 0;
          }

          if (inventory <= 3) {
            return 1;
          }

          return 2;
        };

        const priorityDifference =
          getPriority(a.inventory) -
          getPriority(b.inventory);

        if (
          priorityDifference !== 0
        ) {
          return priorityDifference;
        }

        return (
          new Date(
            b.lastSaleAt,
          ).getTime() -
          new Date(
            a.lastSaleAt,
          ).getTime()
        );
      }

      if (
        sortBy === "needsRestock"
      ) {
        return (
          b.needsRestock -
          a.needsRestock
        );
      }

      if (sortBy === "soldToday") {
        return (
          b.soldToday -
          a.soldToday
        );
      }

      return 0;
    });

  const isSyncing =
    syncFetcher.state !== "idle";

  return (
    <s-page heading="J&P Restock">
    <s-section>
      <div
        style={{
          display: "grid",
          gap: "18px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(0, 1fr) minmax(320px, auto)",
            gap: "20px",
            alignItems: "end",
          }}
        >
          <div
            style={{
              display: "grid",
              gap: "12px",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: "650",
                }}
              >
                Restock Dashboard
              </div>

              <div
                style={{
                  marginTop: "4px",
                  color: "#6d7175",
                  fontSize: "13px",
                }}
              >
                Last synced at{" "}
                {new Date(syncedAt).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              <syncFetcher.Form method="post">
                <input
                  type="hidden"
                  name="intent"
                  value="sync"
                />

                <input
                  type="hidden"
                  name="source"
                  value="manual"
                />

                <s-button
                  type="submit"
                  variant="primary"
                  disabled={isSyncing}
                >
                  {isSyncing
                    ? "Syncing..."
                    : "Sync Recent Orders"}
                </s-button>
              </syncFetcher.Form>

              <Link
                to="/app/history"
                style={{
                  textDecoration: "none",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    minHeight: "32px",
                    padding: "0 11px",
                    border: "1px solid #c9cccf",
                    borderRadius: "7px",
                    background: "#ffffff",
                    color: "#202223",
                    fontSize: "13px",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  History
                </span>
              </Link>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "end",
              justifyContent: "flex-end",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <label
              style={{
                display: "grid",
                gap: "6px",
                width: "280px",
                maxWidth: "100%",
              }}
            >
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: "600",
                }}
              >
                Search Products
              </span>

              <input
                type="text"
                placeholder="Search product or variant..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                style={{
                  minHeight: "40px",
                  padding: "0 12px",
                  border: "1px solid #c9cccf",
                  borderRadius: "8px",
                  background: "#ffffff",
                  fontSize: "14px",
                }}
              />
            </label>

            <label
              style={{
                display: "grid",
                gap: "6px",
                width: "190px",
                maxWidth: "100%",
              }}
            >
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: "600",
                }}
              >
                Sort By
              </span>

              <select
                value={sortBy}
                onChange={(event) =>
                  setSortBy(event.target.value)
                }
                style={{
                  minHeight: "40px",
                  padding: "0 12px",
                  border: "1px solid #c9cccf",
                  borderRadius: "8px",
                  background: "#ffffff",
                  fontSize: "14px",
                }}
              >
                <option value="recent">
                  Most Recent Sales
                </option>

                <option value="inventoryPriority">
                  Inventory Priority
                </option>

                <option value="needsRestock">
                  Largest Restocks
                </option>

                <option value="soldToday">
                  Most Sold Today
                </option>
              </select>
            </label>
          </div>
        </div>

        {search && (
          <div
            style={{
              color: "#6d7175",
              fontSize: "13px",
              textAlign: "right",
            }}
          >
            Showing {filteredQueue.length} of{" "}
            {restockQueue.length} products
          </div>
        )}

        <SummaryCards
          totalNeedsRestock={totalNeedsRestock}
          totalSoldToday={totalSoldToday}
          lowInventoryCount={lowInventoryCount}
        />
      </div>
    </s-section>

      <s-section
        heading={`Needs Restock (${filteredQueue.length})`}
      >
        {filteredQueue.length === 0 ? (
          <s-box
            padding="large"
            borderWidth="base"
            borderRadius="base"
            background="subdued"
          >
            <s-stack gap="small">
              <s-heading>
                {search
                  ? "No matching products"
                  : "Nothing needs restocking"}
              </s-heading>

              <s-text>
                {search
                  ? "Try a different product or variant name."
                  : "New paid orders will appear after syncing."}
              </s-text>
            </s-stack>
          </s-box>
        ) : (
          <s-stack gap="base">
            {filteredQueue.map(
              (item) => (
                <RestockCard
                  key={item.id}
                  item={item}
                />
              ),
            )}
          </s-stack>
        )}
      </s-section>
    </s-page>
  );
}