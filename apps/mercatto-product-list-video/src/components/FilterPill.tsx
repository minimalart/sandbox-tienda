export const FilterPill = ({
  label,
  active = false,
  delayProgress = 1,
}: {
  label: string;
  active?: boolean;
  delayProgress?: number;
}) => {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        height: 38,
        padding: "0 15px",
        borderRadius: 999,
        border: `1px solid ${active ? "rgba(100, 214, 255, 0.42)" : "rgba(255,255,255,0.12)"}`,
        background: active ? "rgba(67, 166, 255, 0.13)" : "rgba(255,255,255,0.045)",
        color: active ? "#dff7ff" : "rgba(235, 244, 255, 0.72)",
        fontSize: 17,
        fontWeight: 650,
        opacity: delayProgress,
        transform: `translateY(${(1 - delayProgress) * 12}px)`,
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: 999,
          background: active ? "#64d6ff" : "rgba(235, 244, 255, 0.35)",
          boxShadow: active ? "0 0 18px rgba(100, 214, 255, 0.65)" : "none",
        }}
      />
      {label}
    </span>
  );
};
