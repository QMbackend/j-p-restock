import { useEffect } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useFetcher } from "react-router";

function getInventoryStatus(inventory) {
  if (inventory <= 0) {
    return {
      label: "Out of stock",
      symbol: "🔴",
      accentColor: "#d72c0d",
    };
  }

  if (inventory <= 3) {
    return {
      label: "Low inventory",
      symbol: "🟡",
      accentColor: "#ffbb00",
    };
  }

  return {
    label: "Available",
    symbol: "🟢",
    accentColor: "#008060",
  };
}

function formatLastSold(lastSaleAt) {
  if (!lastSaleAt) {
    return "Unknown";
  }

  const saleDate = new Date(lastSaleAt);
  const now = new Date();

  const differenceInMinutes = Math.floor(
    (now.getTime() - saleDate.getTime()) / 60_000,
  );

  if (differenceInMinutes < 1) {
    return "Just now";
  }

  if (differenceInMinutes === 1) {
    return "1 minute ago";
  }

  if (differenceInMinutes < 60) {
    return `${differenceInMinutes} minutes ago`;
  }

  const saleDay = new Date(saleDate);
  saleDay.setHours(0, 0, 0, 0);

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const time = saleDate.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  if (saleDay.getTime() === today.getTime()) {
    return time;
  }

  if (saleDay.getTime() === yesterday.getTime()) {
    return `Yesterday at ${time}`;
  }

  const date = saleDate.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });

  return `${date} at ${time}`;
}

export default function RestockCard({
  item,
  onBeforeAction,
}) {
  const shopify = useAppBridge();
  const restockFetcher = useFetcher();
  const isRestocking = restockFetcher.state !== "idle";

  const status = getInventoryStatus(item.inventory);
  const canRestock = item.inventory > 0;

  const availableToRestock = Math.min(
    item.needsRestock,
    item.inventory,
  );

  const lastSoldText = formatLastSold(item.lastSaleAt);

  useEffect(() => {
    if (!restockFetcher.data) {
      return;
    }

    if (restockFetcher.data.success) {
      shopify.toast.show(
        `${item.product} restock updated.`,
        {
          duration: 3000,
        },
      );

      return;
    }

    if (restockFetcher.data.message) {
      shopify.toast.show(
        restockFetcher.data.message,
        {
          duration: 4000,
          isError: true,
        },
      );
    }
  }, [restockFetcher.data, item.product, shopify]);

  return (
    <div
      style={{
        border: "1px solid #d8d8d8",
        borderLeft: `6px solid ${status.accentColor}`,
        borderRadius: "12px",
        background: "#ffffff",
        padding: "20px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "14px",
          marginBottom: "20px",
        }}
      >
        {item.imageURL ? (
          <img
            src={item.imageURL}
            alt={item.product}
            width={56}
            height={56}
            style={{
              width: "56px",
              height: "56px",
              objectFit: "cover",
              borderRadius: "8px",
              border: "1px solid #e1e1e1",
            }}
          />
        ) : (
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "8px",
              background: "#f1f1f1",
            }}
          />
        )}

        <div>
          <div
            style={{
              fontSize: "16px",
              fontWeight: "650",
              lineHeight: "1.3",
            }}
          >
            {item.product}
          </div>

          {item.variant && (
            <div
              style={{
                marginTop: "3px",
                fontSize: "14px",
                color: "#616161",
              }}
            >
              {item.variant}
            </div>
          )}

          <div
            style={{
              marginTop: "5px",
              fontSize: "13px",
              color: "#616161",
            }}
          >
            {status.symbol} {status.label}
          </div>

          <div
            style={{
              marginTop: "4px",
              fontSize: "13px",
              color: "#616161",
            }}
          >
            Last sold {lastSoldText}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        <Metric
          label="Needs Restock"
          value={item.needsRestock}
        />

        <Metric
          label="Sold Today"
          value={item.soldToday}
        />

        <Metric
          label="Inventory"
          value={item.inventory}
        />
      </div>

    {canRestock ? (
      <restockFetcher.Form
  method="post"
  onSubmit={onBeforeAction}
>
        <input
          type="hidden"
          name="intent"
          value="restock"
        />

        <input
          type="hidden"
          name="variantId"
          value={item.shopifyVariantId}
        />

        <div
          style={{
            display: "flex",
            alignItems: "end",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <label
            style={{
              display: "grid",
              gap: "6px",
              fontSize: "13px",
              fontWeight: "600",
            }}
          >
            Restock quantity

            <input
              type="number"
              name="quantity"
              min="1"
              max={Math.min(
                item.needsRestock,
                item.inventory,
              )}
              defaultValue={Math.min(
                item.needsRestock,
                item.inventory,
              )}
              required
              style={{
                width: "90px",
                minHeight: "36px",
                border: "1px solid #8a8a8a",
                borderRadius: "8px",
                padding: "6px 10px",
                fontSize: "15px",
              }}
            />
          </label>

          <s-button
            type="submit"
            variant="primary"
            disabled={isRestocking}
          >
            {isRestocking
              ? "Restocking..."
              : "Confirm Restock"}
          </s-button>
        </div>
      </restockFetcher.Form>
    ) : (
      <restockFetcher.Form
  method="post"
  onSubmit={onBeforeAction}
>
        <input
          type="hidden"
          name="intent"
          value="removeFromQueue"
        />

        <input
          type="hidden"
          name="variantId"
          value={item.shopifyVariantId}
        />

        <div
          style={{
            display: "grid",
            gap: "10px",
          }}
        >
          <div
            style={{
              color: "#6d7175",
              fontSize: "14px",
            }}
          >
            No inventory available to restock.
          </div>

          <s-button
            type="submit"
            variant="secondary"
          >
            Remove from Queue
          </s-button>
        </div>
      </restockFetcher.Form>
    )}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div
      style={{
        borderRadius: "8px",
        background: "#f6f6f7",
        padding: "12px",
      }}
    >
      <div
        style={{
          fontSize: "12px",
          color: "#616161",
          marginBottom: "4px",
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: "20px",
          fontWeight: "650",
        }}
      >
        {value}
      </div>
    </div>
  );
}