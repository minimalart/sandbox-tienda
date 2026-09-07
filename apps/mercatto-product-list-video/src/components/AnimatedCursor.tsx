export const AnimatedCursor = ({
  x,
  y,
  opacity = 1,
  scale = 1,
}: {
  x: number;
  y: number;
  opacity?: number;
  scale?: number;
}) => {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 34,
        height: 34,
        opacity,
        transform: `scale(${scale})`,
        filter: "drop-shadow(0 14px 22px rgba(0,0,0,0.45))",
        zIndex: 30,
      }}
    >
      <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
        <path d="M7 3L28 21.2L17.7 22.5L12.3 31L7 3Z" fill="#f8fbff" />
        <path d="M7 3L28 21.2L17.7 22.5L12.3 31L7 3Z" stroke="#0b0f17" strokeWidth="2" />
      </svg>
    </div>
  );
};
