import {Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from "remotion";
import {ChannelBadge} from "./ChannelBadge";
import type {Product} from "../data/products";

export const ProductRow = ({
  product,
  index,
  highlighted = false,
  expanded = false,
  variantsOpen = false,
  dimmed = false,
  startFrame = 0,
}: {
  product: Product;
  index: number;
  highlighted?: boolean;
  expanded?: boolean;
  variantsOpen?: boolean;
  dimmed?: boolean;
  startFrame?: number;
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const rowEnter = spring({
    frame: frame - startFrame - index * 5,
    fps,
    config: {damping: 22, stiffness: 110, mass: 0.8},
  });
  const detailsProgress = interpolate(frame, [startFrame + 8, startFrame + 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const opacity = dimmed ? 0.2 : rowEnter;

  return (
    <div
      style={{
        borderRadius: 18,
        border: `1px solid ${highlighted ? "rgba(100,214,255,0.48)" : "rgba(255,255,255,0.075)"}`,
        background: highlighted
          ? "linear-gradient(135deg, rgba(35, 78, 105, 0.68), rgba(16, 23, 34, 0.94))"
          : "rgba(255,255,255,0.035)",
        boxShadow: highlighted ? "0 26px 80px rgba(45, 181, 255, 0.16)" : "none",
        opacity,
        transform: `translateY(${(1 - rowEnter) * 24}px) scale(${highlighted ? 1.01 : 1})`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.55fr 0.58fr 0.55fr 0.68fr 0.64fr 1fr",
          gap: 18,
          alignItems: "center",
          minHeight: 88,
          padding: "0 20px",
        }}
      >
        <div style={{display: "flex", alignItems: "center", gap: 15, minWidth: 0}}>
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: 14,
              background: `linear-gradient(135deg, ${product.swatch}, rgba(100,214,255,0.22))`,
              border: "1px solid rgba(255,255,255,0.18)",
              display: "grid",
              placeItems: "center",
              color: product.swatch === "#0d1117" ? "#f8fbff" : "#111827",
              fontSize: 18,
              fontWeight: 900,
            }}
          >
            {product.brand.slice(0, 2).toUpperCase()}
          </div>
          <div style={{minWidth: 0}}>
            <div
              style={{
                color: "#f8fbff",
                fontSize: 21,
                fontWeight: 730,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {product.name}
            </div>
            <div style={{marginTop: 5, color: "rgba(235,244,255,0.48)", fontSize: 15, fontWeight: 600}}>
              SKU {product.sku}
            </div>
          </div>
        </div>
        <StatusBadge status={product.status} />
        <Cell primary={product.brand} secondary="brand" />
        <Cell primary={product.priceArs} secondary={product.priceUsd ?? product.source} />
        <Cell primary={product.source} secondary={`${product.imageCount} images`} />
        <div style={{display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end"}}>
          {(variantsOpen || expanded ? product.channels : product.channels.slice(0, 2)).map((channel) => (
            <ChannelBadge key={channel} channel={channel} compact />
          ))}
        </div>
      </div>

      {expanded ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 14,
            padding: "0 20px 20px",
            opacity: detailsProgress,
            transform: `translateY(${(1 - detailsProgress) * -8}px)`,
          }}
        >
          <Detail label="EAN / barcode" value={product.ean ?? "mapped per variant"} />
          <Detail label="Source" value={product.source} />
          <Detail label="Status" value={product.status} tone="green" />
          <Detail label="Images" value={`${product.imageCount} product images`} />
          <Detail label="Metadata" value={product.metadata.join(" · ")} wide />
        </div>
      ) : null}

      {variantsOpen && product.variants ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            padding: "0 20px 22px",
          }}
        >
          <VariantGroup title="Sizes" values={product.variants.sizes} frameOffset={startFrame + 10} />
          <VariantGroup title="Colors" values={product.variants.colors} frameOffset={startFrame + 22} />
        </div>
      ) : null}
    </div>
  );
};

const Cell = ({primary, secondary}: {primary: string; secondary: string}) => (
  <div style={{minWidth: 0}}>
    <div
      style={{
        color: "rgba(248,251,255,0.92)",
        fontSize: 18,
        fontWeight: 700,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {primary}
    </div>
    <div style={{marginTop: 5, color: "rgba(235,244,255,0.43)", fontSize: 14, fontWeight: 600}}>{secondary}</div>
  </div>
);

const StatusBadge = ({status}: {status: Product["status"]}) => (
  <span
    style={{
      justifySelf: "start",
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      height: 31,
      padding: "0 12px",
      borderRadius: 999,
      border: "1px solid rgba(133,242,205,0.28)",
      background: "rgba(67,216,170,0.12)",
      color: "#9af6d5",
      fontSize: 15,
      fontWeight: 760,
    }}
  >
    <span style={{width: 7, height: 7, borderRadius: 999, background: "#85f2cd"}} />
    {status}
  </span>
);

const Detail = ({label, value, tone, wide = false}: {label: string; value: string; tone?: "green"; wide?: boolean}) => (
  <div
    style={{
      gridColumn: wide ? "span 2" : undefined,
      minHeight: 84,
      borderRadius: 16,
      border: "1px solid rgba(255,255,255,0.09)",
      background: "rgba(255,255,255,0.045)",
      padding: "15px 16px",
    }}
  >
    <div style={{color: "rgba(235,244,255,0.44)", fontSize: 14, fontWeight: 760, textTransform: "uppercase"}}>
      {label}
    </div>
    <div style={{marginTop: 8, color: tone === "green" ? "#9af6d5" : "#f8fbff", fontSize: 19, fontWeight: 720}}>
      {value}
    </div>
  </div>
);

const VariantGroup = ({title, values, frameOffset}: {title: string; values: string[]; frameOffset: number}) => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.09)",
        background: "rgba(255,255,255,0.045)",
        padding: "16px",
      }}
    >
      <div style={{color: "rgba(235,244,255,0.5)", fontSize: 15, fontWeight: 760, marginBottom: 12}}>{title}</div>
      <div style={{display: "flex", gap: 10, flexWrap: "wrap"}}>
        {values.map((value, index) => {
          const progress = interpolate(frame, [frameOffset + index * 5, frameOffset + index * 5 + 14], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.34, 1.56, 0.64, 1),
          });

          return (
            <span
              key={value}
              style={{
                minWidth: 48,
                height: 38,
                padding: "0 14px",
                borderRadius: 999,
                display: "inline-grid",
                placeItems: "center",
                border: "1px solid rgba(255,255,255,0.16)",
                background: "rgba(255,255,255,0.07)",
                color: "#ffffff",
                fontSize: 17,
                fontWeight: 760,
                opacity: progress,
                transform: `scale(${0.78 + progress * 0.22})`,
              }}
            >
              {value}
            </span>
          );
        })}
      </div>
    </div>
  );
};
