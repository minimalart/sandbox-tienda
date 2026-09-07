import {AbsoluteFill, Easing, interpolate, interpolateColors, spring, useCurrentFrame, useVideoConfig} from "remotion";
import {AnimatedCursor} from "./components/AnimatedCursor";
import {FeatureCallout} from "./components/FeatureCallout";
import {FloatingBrowserFrame} from "./components/FloatingBrowserFrame";
import {MetricBadge} from "./components/MetricBadge";
import {ProductListScene} from "./components/ProductListScene";
import {products} from "./data/products";

const ease = Easing.bezier(0.16, 1, 0.3, 1);

export const ProductListVideo = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const seconds = frame / fps;
  const tableIntro = spring({frame: frame - 115, fps, config: {damping: 22, stiffness: 95}});
  const bgShift = interpolate(frame, [0, 1350], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
  const background = interpolateColors(bgShift, [0, 0.5, 1], ["#05070b", "#071016", "#090b12"]);
  const zoom = getTableZoom(seconds);
  const cursor = getCursor(seconds);

  return (
    <AbsoluteFill
      style={{
        background,
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        overflow: "hidden",
      }}
    >
      <AmbientBackground />

      <div
        style={{
          position: "absolute",
          left: 110,
          top: 88,
          width: 760,
          opacity: fade(seconds, 0.3, 4.8) * fadeOut(seconds, 4.6, 5.4),
          transform: `translateY(${interpolate(frame, [0, 42], [18, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: ease,
          })}px)`,
        }}
      >
        <div style={{color: "#85f2cd", fontSize: 18, fontWeight: 820, letterSpacing: 2.4, textTransform: "uppercase"}}>
          Mercatto Product List
        </div>
        <h1 style={{margin: "20px 0 0", color: "#ffffff", fontSize: 76, lineHeight: 0.98, fontWeight: 820}}>
          Manage thousands of products without losing control.
        </h1>
        <p style={{margin: "24px 0 0", color: "rgba(235,244,255,0.68)", fontSize: 27, lineHeight: 1.34, fontWeight: 520}}>
          Mercatto centralizes your catalog, variants, prices and channels in one place.
        </p>
      </div>

      <div
        style={{
          position: "absolute",
          left: 265,
          top: 172,
          transform: `scale(${0.76 + tableIntro * 0.24}) translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})`,
          transformOrigin: "center center",
        }}
      >
        <FloatingBrowserFrame opacity={tableIntro} translateY={(1 - tableIntro) * 42}>
          <ProductListScene
            products={getSceneProducts(seconds)}
            searchTerm={seconds >= 12 ? "Electrolux" : ""}
            showMetric={seconds >= 5 && seconds < 12}
            filtersActive={seconds >= 12 && seconds < 20}
            highlightedId={getHighlightedProduct(seconds)}
            expandedId={seconds >= 20 && seconds < 29 ? "freidora-electrolux" : undefined}
            variantsId={seconds >= 29 && seconds < 38 ? "remera-basica" : undefined}
            startFrame={seconds >= 12 && seconds < 20 ? 380 : 145}
            callout={getCallout(seconds)}
          />
        </FloatingBrowserFrame>
      </div>

      <OverlayCopy seconds={seconds} />

      {seconds >= 12 && seconds < 19.2 ? (
        <AnimatedCursor x={cursor.x} y={cursor.y} opacity={cursor.opacity} scale={cursor.scale} />
      ) : null}
    </AbsoluteFill>
  );
};

const AmbientBackground = () => (
  <>
    <div
      style={{
        position: "absolute",
        inset: 0,
        background:
          "radial-gradient(circle at 18% 20%, rgba(67,216,170,0.18), transparent 30%), radial-gradient(circle at 78% 18%, rgba(100,214,255,0.12), transparent 30%), linear-gradient(135deg, rgba(255,255,255,0.04), transparent 45%)",
      }}
    />
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
        backgroundSize: "72px 72px",
        maskImage: "linear-gradient(to bottom, transparent, black 18%, black 75%, transparent)",
        opacity: 0.24,
      }}
    />
  </>
);

const OverlayCopy = ({seconds}: {seconds: number}) => {
  if (seconds >= 38) {
    const p = fade(seconds, 38.2, 39.4);

    return (
      <div
        style={{
          position: "absolute",
          left: 116,
          bottom: 92,
          width: 680,
          opacity: p,
          transform: `translateY(${(1 - p) * 22}px)`,
        }}
      >
        <div style={{fontSize: 20, fontWeight: 820, color: "#85f2cd", letterSpacing: 2.6, textTransform: "uppercase"}}>
          Mercatto Product List
        </div>
        <div style={{marginTop: 18, color: "#ffffff", fontSize: 56, lineHeight: 1.03, fontWeight: 820}}>
          From messy catalogs to operational clarity.
        </div>
        <div style={{marginTop: 18, color: "rgba(235,244,255,0.72)", fontSize: 24, lineHeight: 1.34}}>
          Launch, sync and manage your catalog faster.
        </div>
      </div>
    );
  }

  if (seconds >= 29 && seconds < 38) {
    const p = fade(seconds, 29.1, 30.2);

    return (
      <div style={{position: "absolute", right: 105, top: 132, opacity: p}}>
        <FeatureCallout
          eyebrow="Connected operations"
          title="Variants, pricing and channels stay connected"
          body="Sizes, colors, ARS/USD prices and sales channels remain part of the same product workflow."
          progress={p}
          align="right"
        />
      </div>
    );
  }

  if (seconds >= 20 && seconds < 29) {
    const p = fade(seconds, 20.1, 21.2);

    return (
      <div style={{position: "absolute", right: 115, bottom: 120}}>
        <FeatureCallout
          eyebrow="Product intelligence"
          title="Every product keeps its commercial context"
          body="EAN, source, status, images and metadata travel with each catalog item."
          progress={p}
          align="right"
        />
      </div>
    );
  }

  if (seconds >= 12 && seconds < 20) {
    const p = fade(seconds, 13, 14.2);

    return (
      <div style={{position: "absolute", right: 118, bottom: 116}}>
        <FeatureCallout
          eyebrow="Search and filters"
          title="Find any product instantly"
          body="Filter by brand, source, status or channel across large catalogs."
          progress={p}
          align="right"
        />
      </div>
    );
  }

  if (seconds >= 5 && seconds < 12) {
    const p = fade(seconds, 6, 7);

    return (
      <div style={{position: "absolute", right: 118, bottom: 116, display: "flex", flexDirection: "column", gap: 18}}>
        <MetricBadge value="5,000+" label="products ready to manage" progress={p} />
        <FeatureCallout
          eyebrow="Catalog overview"
          title="Built for large, multi-source catalogs"
          body="See product status, brand, price, source and channels in one operational view."
          progress={p}
          align="right"
        />
      </div>
    );
  }

  return null;
};

const getSceneProducts = (seconds: number) => {
  if (seconds >= 15.4 && seconds < 20) {
    return products.filter((product) => product.id === "freidora-electrolux");
  }

  if (seconds >= 29 && seconds < 38) {
    return products.filter((product) =>
      ["remera-basica", "freidora-electrolux", "smart-tv-tcl", "impresora-hp"].includes(product.id),
    );
  }

  return products;
};

const getHighlightedProduct = (seconds: number) => {
  if (seconds >= 15.4 && seconds < 29) {
    return "freidora-electrolux";
  }

  if (seconds >= 29 && seconds < 38) {
    return "remera-basica";
  }

  return undefined;
};

const getCallout = (seconds: number) => {
  if (seconds >= 5 && seconds < 12) {
    return {
      eyebrow: "Catalog scale",
      title: "Built for large, multi-source catalogs",
      body: "Imported products, manual SKUs and channel-ready inventory in one list.",
    };
  }

  return undefined;
};

const getTableZoom = (seconds: number) => {
  if (seconds >= 20 && seconds < 29) {
    return {scale: 1.11, x: -70, y: -42};
  }

  if (seconds >= 29 && seconds < 38) {
    return {scale: 1.08, x: -38, y: -20};
  }

  if (seconds >= 38) {
    return {scale: 0.78, x: 420, y: -24};
  }

  return {scale: 1, x: 0, y: 0};
};

const getCursor = (seconds: number) => {
  const x = interpolate(seconds, [12, 13.1, 15.2, 18.5], [1188, 1126, 1126, 1240], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  const y = interpolate(seconds, [12, 13.1, 15.2, 18.5], [290, 265, 265, 355], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  const clickPulse = Math.sin(Math.max(0, seconds - 13.05) * Math.PI * 8);

  return {
    x,
    y,
    opacity: fade(seconds, 12.2, 12.8) * fadeOut(seconds, 18.7, 19.2),
    scale: seconds > 13 && seconds < 13.35 ? 0.92 + Math.max(clickPulse, 0) * 0.08 : 1,
  };
};

const fade = (seconds: number, start: number, end: number) =>
  interpolate(seconds, [start, end], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });

const fadeOut = (seconds: number, start: number, end: number) =>
  interpolate(seconds, [start, end], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });
