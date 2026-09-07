import type {SalesChannel} from "../data/products";

const channelStyles: Record<SalesChannel, {background: string; color: string; border: string}> = {
  B2C: {
    background: "rgba(67, 216, 170, 0.12)",
    color: "#85f2cd",
    border: "rgba(133, 242, 205, 0.28)",
  },
  Wholesale: {
    background: "rgba(126, 152, 255, 0.13)",
    color: "#b7c4ff",
    border: "rgba(183, 196, 255, 0.28)",
  },
  "Presencial supermercado": {
    background: "rgba(255, 196, 87, 0.12)",
    color: "#ffd98b",
    border: "rgba(255, 217, 139, 0.28)",
  },
};

export const ChannelBadge = ({channel, compact = false}: {channel: SalesChannel; compact?: boolean}) => {
  const style = channelStyles[channel];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: compact ? 26 : 32,
        padding: compact ? "0 10px" : "0 14px",
        borderRadius: 999,
        border: `1px solid ${style.border}`,
        background: style.background,
        color: style.color,
        fontSize: compact ? 15 : 18,
        fontWeight: 650,
        whiteSpace: "nowrap",
      }}
    >
      {channel}
    </span>
  );
};
