export const FeatureCallout = ({
  eyebrow,
  title,
  body,
  progress = 1,
  align = "left",
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  progress?: number;
  align?: "left" | "right";
}) => {
  return (
    <div
      style={{
        width: 430,
        padding: "24px 26px",
        borderRadius: 22,
        border: "1px solid rgba(255,255,255,0.13)",
        background: "rgba(10, 14, 22, 0.72)",
        boxShadow: "0 28px 90px rgba(0,0,0,0.34)",
        backdropFilter: "blur(20px)",
        opacity: progress,
        transform: `translateX(${(1 - progress) * (align === "left" ? -24 : 24)}px)`,
      }}
    >
      {eyebrow ? (
        <div
          style={{
            marginBottom: 12,
            color: "#88f4cf",
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: 1.8,
            textTransform: "uppercase",
          }}
        >
          {eyebrow}
        </div>
      ) : null}
      <div style={{color: "#ffffff", fontSize: 30, lineHeight: 1.12, fontWeight: 760}}>{title}</div>
      {body ? (
        <div style={{marginTop: 12, color: "rgba(235,244,255,0.68)", fontSize: 18, lineHeight: 1.42}}>
          {body}
        </div>
      ) : null}
    </div>
  );
};
