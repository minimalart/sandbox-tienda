import {Easing, interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import {FeatureCallout} from "./FeatureCallout";
import {FilterPill} from "./FilterPill";
import {MetricBadge} from "./MetricBadge";
import {ProductRow} from "./ProductRow";
import {SearchBarAnimation} from "./SearchBarAnimation";
import type {Product} from "../data/products";

export const ProductListScene = ({
  products,
  searchTerm = "",
  showMetric = false,
  callout,
  highlightedId,
  expandedId,
  variantsId,
  filtersActive = false,
  startFrame = 0,
}: {
  products: Product[];
  searchTerm?: string;
  showMetric?: boolean;
  callout?: {
    eyebrow?: string;
    title: string;
    body?: string;
  };
  highlightedId?: string;
  expandedId?: string;
  variantsId?: string;
  filtersActive?: boolean;
  startFrame?: number;
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const typedChars = Math.floor(
    interpolate(frame, [12 * fps, 15.3 * fps], [0, searchTerm.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.45, 0, 0.55, 1),
    }),
  );
  const visibleSearch = searchTerm.slice(0, typedChars);
  const searchActive = frame >= 12 * fps && frame <= 20 * fps;
  const metricProgress = interpolate(frame, [6 * fps, 7 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const calloutProgress = interpolate(frame, [7.2 * fps, 8.3 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <div style={{position: "relative", padding: "28px 30px 34px"}}>
      <div style={{display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24}}>
        <div>
          <div style={{color: "#ffffff", fontSize: 30, fontWeight: 780}}>Products</div>
          <div style={{marginTop: 5, color: "rgba(235,244,255,0.48)", fontSize: 17, fontWeight: 600}}>
            Catalog operations across sources, prices and channels
          </div>
        </div>
        <SearchBarAnimation value={visibleSearch} active={searchActive} progress={typedChars / Math.max(searchTerm.length, 1)} />
      </div>

      <div style={{display: "flex", gap: 10, marginBottom: 20}}>
        {["Brand", "Source", "Status", "Channel"].map((filter, index) => {
          const progress = interpolate(frame, [13 * fps + index * 5, 13.8 * fps + index * 5], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          });

          return <FilterPill key={filter} label={filter} active={filtersActive} delayProgress={filtersActive ? progress : 1} />;
        })}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.55fr 0.58fr 0.55fr 0.68fr 0.64fr 1fr",
          gap: 18,
          padding: "0 20px 12px",
          color: "rgba(235,244,255,0.42)",
          fontSize: 13,
          fontWeight: 780,
          textTransform: "uppercase",
        }}
      >
        <span>Product</span>
        <span>Status</span>
        <span>Brand</span>
        <span>Price</span>
        <span>Source</span>
        <span style={{textAlign: "right"}}>Channels</span>
      </div>

      <div style={{display: "flex", flexDirection: "column", gap: 10}}>
        {products.map((product, index) => (
          <ProductRow
            key={product.id}
            product={product}
            index={index}
            startFrame={startFrame}
            highlighted={product.id === highlightedId}
            expanded={product.id === expandedId}
            variantsOpen={product.id === variantsId}
            dimmed={Boolean(highlightedId) && product.id !== highlightedId}
          />
        ))}
      </div>

      {showMetric ? (
        <div style={{position: "absolute", right: 38, top: 128}}>
          <MetricBadge value="5,000+" label="products indexed" progress={metricProgress} />
        </div>
      ) : null}

      {callout ? (
        <div style={{position: "absolute", left: -230, bottom: 62}}>
          <FeatureCallout {...callout} progress={calloutProgress} />
        </div>
      ) : null}
    </div>
  );
};
