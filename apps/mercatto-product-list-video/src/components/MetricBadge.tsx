export const MetricBadge = ({
  value,
  label,
  progress = 1,
}: {
  value: string;
  label: string;
  progress?: number;
}) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "15px 18px",
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,0.14)",
        background: "linear-gradient(135deg, rgba(255,255,255,0.14), rgba(255,255,255,0.055))",
        boxShadow: "0 24px 80px rgba(0,0,0,0.26)",
        opacity: progress,
        transform: `translateY(${(1 - progress) * 16}px) scale(${0.96 + progress * 0.04})`,
      }}
    >
      <span
        style={{
          width: 42,
          height: 42,
          borderRadius: 14,
          background: "rgba(67, 216, 170, 0.16)",
          border: "1px solid rgba(133, 242, 205, 0.24)",
          color: "#85f2cd",
          display: "grid",
          placeItems: "center",
          fontWeight: 800,
          fontSize: 20,
        }}
      >
        #
      </span>
      <span style={{display: "flex", flexDirection: "column", gap: 2}}>
        <strong style={{fontSize: 30, lineHeight: 1, color: "#ffffff"}}>{value}</strong>
        <span style={{fontSize: 15, color: "rgba(233, 240, 255, 0.66)", fontWeight: 600}}>{label}</span>
      </span>
    </div>
  );
};
