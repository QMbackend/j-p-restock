import { useState } from "react";
import { Link, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  const events = await db.restockEvent.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take: 500,
  });

  const variantIds = [
    ...new Set(
      events.map((event) => event.shopifyVariantId),
    ),
  ];

  const restockItems = await db.restockItem.findMany({
    where: {
      shopifyVariantId: {
        in: variantIds,
      },
    },
    select: {
      shopifyVariantId: true,
      productTitle: true,
      variantTitle: true,
      imageURL: true,
    },
  });

  const itemByVariantId = new Map(
    restockItems.map((item) => [
      item.shopifyVariantId,
      item,
    ]),
  );

  const history = events.map((event) => {
    const item = itemByVariantId.get(
      event.shopifyVariantId,
    );

    return {
      id: event.id,
      quantity: event.quantity,
      createdAt: event.createdAt,
      product:
        item?.productTitle ?? "Unknown product",
      variant: item?.variantTitle ?? "",
      imageURL: item?.imageURL ?? null,
    };
  });

  return {
    history,
  };
};

export default function RestockHistory() {
  const { history = [] } = useLoaderData();
  const [period, setPeriod] = useState("today");
  const [search, setSearch] = useState("");

  const now = new Date();

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - 6);
  startOfWeek.setHours(0, 0, 0, 0);

  const searchTerm = search.trim().toLowerCase();

  const filteredHistory = history.filter((event) => {
    const eventDate = new Date(event.createdAt);

    if (
      period === "today" &&
      eventDate < startOfToday
    ) {
      return false;
    }

    if (
      period === "week" &&
      eventDate < startOfWeek
    ) {
      return false;
    }

    if (!searchTerm) {
      return true;
    }

    return (
      event.product
        .toLowerCase()
        .includes(searchTerm) ||
      event.variant
        .toLowerCase()
        .includes(searchTerm)
    );
  });

  const totalUnits = filteredHistory.reduce(
    (sum, event) => sum + event.quantity,
    0,
  );

  return (
    <s-page heading="Restock History">
      <s-section>
        <div
          style={{
            display: "grid",
            gap: "20px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: "650",
                }}
              >
                Completed Restocks
              </div>

              <div
                style={{
                  marginTop: "4px",
                  color: "#6d7175",
                  fontSize: "13px",
                }}
              >
                Review products previously returned
                to the floor.
              </div>
            </div>

            <Link
              to="/app"
              style={{
                textDecoration: "none",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  minHeight: "36px",
                  padding: "0 14px",
                  border: "1px solid #8c9196",
                  borderRadius: "8px",
                  background: "#ffffff",
                  color: "#202223",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                Back to Restock Queue
              </span>
            </Link>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "14px",
            }}
          >
            <HistorySummary
              label="Restock Actions"
              value={filteredHistory.length}
            />

            <HistorySummary
              label="Units Restocked"
              value={totalUnits}
            />
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "end",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "6px",
                padding: "4px",
                borderRadius: "10px",
                background: "#f1f2f3",
              }}
            >
              <FilterButton
                active={period === "today"}
                onClick={() => setPeriod("today")}
              >
                Today
              </FilterButton>

              <FilterButton
                active={period === "week"}
                onClick={() => setPeriod("week")}
              >
                Last 7 Days
              </FilterButton>

              <FilterButton
                active={period === "all"}
                onClick={() => setPeriod("all")}
              >
                All History
              </FilterButton>
            </div>

            <label
              style={{
                display: "grid",
                gap: "6px",
                width: "300px",
                maxWidth: "100%",
              }}
            >
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: "600",
                }}
              >
                Search History
              </span>

              <input
                type="text"
                placeholder="Search product or variant..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                style={{
                  minHeight: "42px",
                  padding: "0 12px",
                  border: "1px solid #c9cccf",
                  borderRadius: "8px",
                  background: "#ffffff",
                  fontSize: "14px",
                }}
              />
            </label>
          </div>

          {filteredHistory.length === 0 ? (
            <div
              style={{
                padding: "36px 20px",
                border: "1px solid #d8d8d8",
                borderRadius: "12px",
                background: "#ffffff",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: "17px",
                  fontWeight: "650",
                }}
              >
                No restocks found
              </div>

              <div
                style={{
                  marginTop: "6px",
                  color: "#6d7175",
                  fontSize: "14px",
                }}
              >
                Try another date range or search.
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gap: "12px",
              }}
            >
              {filteredHistory.map((event) => (
                <HistoryItem
                  key={event.id}
                  event={event}
                />
              ))}
            </div>
          )}
        </div>
      </s-section>
    </s-page>
  );
}

function HistorySummary({ label, value }) {
  return (
    <div
      style={{
        padding: "18px",
        border: "1px solid #d8d8d8",
        borderRadius: "12px",
        background: "#ffffff",
      }}
    >
      <div
        style={{
          color: "#6d7175",
          fontSize: "13px",
          fontWeight: "600",
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "8px",
          fontSize: "28px",
          fontWeight: "700",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        minHeight: "34px",
        padding: "0 12px",
        border: "none",
        borderRadius: "7px",
        background: active
          ? "#ffffff"
          : "transparent",
        color: "#202223",
        fontSize: "13px",
        fontWeight: active ? "650" : "500",
        boxShadow: active
          ? "0 1px 2px rgba(0, 0, 0, 0.12)"
          : "none",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function HistoryItem({ event }) {
  const eventDate = new Date(event.createdAt);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "14px",
        padding: "16px",
        border: "1px solid #d8d8d8",
        borderRadius: "12px",
        background: "#ffffff",
      }}
    >
      {event.imageURL ? (
        <img
          src={event.imageURL}
          alt={event.product}
          width={52}
          height={52}
          style={{
            width: "52px",
            height: "52px",
            objectFit: "cover",
            borderRadius: "8px",
            border: "1px solid #e1e1e1",
            flexShrink: 0,
          }}
        />
      ) : (
        <div
          style={{
            width: "52px",
            height: "52px",
            borderRadius: "8px",
            background: "#f1f1f1",
            flexShrink: 0,
          }}
        />
      )}

      <div
        style={{
          flex: 1,
          minWidth: 0,
        }}
      >
        <div
          style={{
            fontSize: "15px",
            fontWeight: "650",
          }}
        >
          {event.product}
        </div>

        {event.variant && (
          <div
            style={{
              marginTop: "2px",
              color: "#616161",
              fontSize: "13px",
            }}
          >
            {event.variant}
          </div>
        )}

        <div
          style={{
            marginTop: "6px",
            color: "#6d7175",
            fontSize: "13px",
          }}
        >
          {eventDate.toLocaleDateString([], {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
          {" at "}
          {eventDate.toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          })}
        </div>
      </div>

      <div
        style={{
          minWidth: "80px",
          textAlign: "right",
        }}
      >
        <div
          style={{
            fontSize: "22px",
            fontWeight: "700",
          }}
        >
          {event.quantity}
        </div>

        <div
          style={{
            marginTop: "2px",
            color: "#6d7175",
            fontSize: "12px",
          }}
        >
          Restocked
        </div>
      </div>
    </div>
  );
}