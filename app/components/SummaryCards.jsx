export default function SummaryCards({
  totalNeedsRestock,
  totalSoldToday,
  lowInventoryCount,
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "14px",
      }}
    >
      <SummaryCard
        label="Needs Restock"
        value={totalNeedsRestock}
        description="Units waiting to go out"
        accentColor="#005bd3"
      />

      <SummaryCard
        label="Sold Today"
        value={totalSoldToday}
        description="Units sold since 9:00 AM"
        accentColor="#008060"
      />

      <SummaryCard
        label="Low Inventory"
        value={lowInventoryCount}
        description="Products with 3 or fewer left"
        accentColor="#d89b00"
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  description,
  accentColor,
}) {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        minHeight: "118px",
        padding: "18px",
        border: "1px solid #d8d8d8",
        borderRadius: "12px",
        background: "#ffffff",
        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "4px",
          background: accentColor,
        }}
      />

      <div
        style={{
          color: "#616161",
          fontSize: "13px",
          fontWeight: "600",
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "8px",
          color: "#202223",
          fontSize: "32px",
          fontWeight: "700",
          lineHeight: 1,
        }}
      >
        {value}
      </div>

      <div
        style={{
          marginTop: "10px",
          color: "#6d7175",
          fontSize: "12px",
        }}
      >
        {description}
      </div>
    </div>
  );
}