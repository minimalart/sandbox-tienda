export const SearchBarAnimation = ({
  value,
  active,
  progress = 1,
}: {
  value: string;
  active?: boolean;
  progress?: number;
}) => {
  return (
    <div
      style={{
        height: 54,
        width: 420,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "0 18px",
        borderRadius: 16,
        border: `1px solid ${active ? "rgba(100, 214, 255, 0.42)" : "rgba(255,255,255,0.11)"}`,
        background: active ? "rgba(15, 32, 48, 0.88)" : "rgba(255,255,255,0.055)",
        boxShadow: active ? "0 0 0 4px rgba(100, 214, 255, 0.08)" : "none",
        color: value ? "#f8fbff" : "rgba(235,244,255,0.42)",
        fontSize: 19,
        fontWeight: 600,
      }}
    >
      <span
        style={{
          width: 17,
          height: 17,
          border: "2px solid rgba(235,244,255,0.52)",
          borderRadius: 999,
          position: "relative",
          display: "inline-block",
        }}
      >
        <span
          style={{
            position: "absolute",
            width: 8,
            height: 2,
            right: -7,
            bottom: -4,
            background: "rgba(235,244,255,0.52)",
            transform: "rotate(45deg)",
            borderRadius: 2,
          }}
        />
      </span>
      <span>{value || "Search products, SKU, EAN or brand"}</span>
      {active && progress < 1 ? (
        <span
          style={{
            width: 2,
            height: 24,
            background: "#64d6ff",
            opacity: progress > 0.15 ? 1 : 0,
          }}
        />
      ) : null}
    </div>
  );
};
