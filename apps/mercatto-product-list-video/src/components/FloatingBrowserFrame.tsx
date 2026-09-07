import type {ReactNode} from "react";

export const FloatingBrowserFrame = ({
  children,
  title = "Mercatto Admin",
  opacity = 1,
  scale = 1,
  translateY = 0,
}: {
  children: ReactNode;
  title?: string;
  opacity?: number;
  scale?: number;
  translateY?: number;
}) => {
  return (
    <div
      style={{
        width: 1390,
        minHeight: 760,
        borderRadius: 28,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(11, 15, 23, 0.92)",
        boxShadow: "0 46px 140px rgba(0,0,0,0.52), 0 0 0 1px rgba(255,255,255,0.045) inset",
        opacity,
        transform: `translateY(${translateY}px) scale(${scale})`,
        transformOrigin: "center center",
      }}
    >
      <div
        style={{
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 22px",
          borderBottom: "1px solid rgba(255,255,255,0.09)",
          background: "rgba(255,255,255,0.035)",
        }}
      >
        <div style={{display: "flex", alignItems: "center", gap: 10}}>
          {["#ff6b6b", "#ffd166", "#43d8aa"].map((color) => (
            <span key={color} style={{width: 13, height: 13, borderRadius: 999, background: color}} />
          ))}
        </div>
        <div
          style={{
            height: 34,
            minWidth: 460,
            display: "grid",
            placeItems: "center",
            borderRadius: 999,
            background: "rgba(255,255,255,0.055)",
            color: "rgba(235,244,255,0.58)",
            fontSize: 15,
            fontWeight: 650,
          }}
        >
          {title}
        </div>
        <div style={{width: 82, color: "rgba(235,244,255,0.38)", fontSize: 15, textAlign: "right"}}>live</div>
      </div>
      {children}
    </div>
  );
};
