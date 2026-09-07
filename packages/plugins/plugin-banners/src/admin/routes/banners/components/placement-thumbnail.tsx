import type { PreviewKind } from './placement-config';

/**
 * Schematic wireframe thumbnails per placement type — like the block/component
 * previews you see in a UI kit. They represent the *shape* of each banner type,
 * not its live content, so a placement always looks recognizable even when empty.
 *
 * Monochrome via `currentColor` + opacity so they adapt to the admin light/dark
 * theme: the wrapper sets the base text color and a subtle framed background,
 * strong shapes read as "content", faint ones as "container".
 */

const VIEWBOX = '0 0 320 180';

const TopBarShapes = () => (
  <>
    {/* page body below the bar */}
    <rect x={16} y={56} width={288} height={108} rx={10} fill="currentColor" fillOpacity={0.05} />
    {/* the announcement bar, full width at the top */}
    <rect x={16} y={16} width={288} height={28} rx={8} fill="currentColor" fillOpacity={0.16} />
    {/* centered icon + message */}
    <circle cx={126} cy={30} r={5} fill="currentColor" fillOpacity={0.7} />
    <rect x={140} y={27} width={54} height={6} rx={3} fill="currentColor" fillOpacity={0.45} />
  </>
);

const HeroShapes = () => (
  <>
    {/* full-bleed media */}
    <rect x={16} y={16} width={288} height={148} rx={12} fill="currentColor" fillOpacity={0.09} />
    {/* eyebrow + headline + subtitle + CTA, left aligned */}
    <rect x={40} y={58} width={54} height={6} rx={3} fill="currentColor" fillOpacity={0.35} />
    <rect x={40} y={74} width={150} height={13} rx={4} fill="currentColor" fillOpacity={0.8} />
    <rect x={40} y={93} width={112} height={13} rx={4} fill="currentColor" fillOpacity={0.8} />
    <rect x={40} y={114} width={132} height={6} rx={3} fill="currentColor" fillOpacity={0.28} />
    <rect x={40} y={130} width={66} height={18} rx={9} fill="currentColor" fillOpacity={0.85} />
  </>
);

const CardShapes = () => (
  <>
    {/* a single content card, centered */}
    <rect x={76} y={18} width={168} height={144} rx={12} fill="currentColor" fillOpacity={0.09} />
    {/* image */}
    <rect x={90} y={30} width={140} height={52} rx={7} fill="currentColor" fillOpacity={0.16} />
    {/* title + body + button */}
    <rect x={90} y={94} width={104} height={9} rx={4} fill="currentColor" fillOpacity={0.8} />
    <rect x={90} y={109} width={140} height={5} rx={2.5} fill="currentColor" fillOpacity={0.28} />
    <rect x={90} y={120} width={116} height={5} rx={2.5} fill="currentColor" fillOpacity={0.28} />
    <rect x={90} y={134} width={56} height={14} rx={7} fill="currentColor" fillOpacity={0.85} />
  </>
);

const SplashShapes = () => (
  <>
    {/* mobile phone frame */}
    <rect
      x={118}
      y={12}
      width={84}
      height={156}
      rx={14}
      fill="currentColor"
      fillOpacity={0.05}
      stroke="currentColor"
      strokeOpacity={0.22}
      strokeWidth={2.5}
    />
    {/* logo + title + image + subtitle, stacked and centered */}
    <rect x={150} y={26} width={20} height={8} rx={4} fill="currentColor" fillOpacity={0.55} />
    <rect x={134} y={42} width={52} height={8} rx={4} fill="currentColor" fillOpacity={0.8} />
    <rect x={142} y={54} width={36} height={8} rx={4} fill="currentColor" fillOpacity={0.8} />
    <rect x={134} y={72} width={52} height={48} rx={8} fill="currentColor" fillOpacity={0.16} />
    <rect x={138} y={132} width={44} height={5} rx={2.5} fill="currentColor" fillOpacity={0.28} />
  </>
);

const StickyShapes = () => (
  <>
    {/* page above */}
    <rect x={16} y={14} width={288} height={98} rx={10} fill="currentColor" fillOpacity={0.05} />
    {/* pinned footer bar with brand logos + CTA */}
    <rect x={24} y={122} width={272} height={42} rx={14} fill="currentColor" fillOpacity={0.15} />
    <rect x={40} y={134} width={40} height={18} rx={4} fill="currentColor" fillOpacity={0.6} />
    <rect x={88} y={134} width={40} height={18} rx={4} fill="currentColor" fillOpacity={0.6} />
    <rect x={136} y={134} width={40} height={18} rx={4} fill="currentColor" fillOpacity={0.6} />
    <rect x={226} y={136} width={54} height={14} rx={7} fill="currentColor" fillOpacity={0.85} />
  </>
);

const SHAPES: Record<PreviewKind, () => JSX.Element> = {
  topbar: TopBarShapes,
  hero: HeroShapes,
  card: CardShapes,
  splash: SplashShapes,
  sticky: StickyShapes,
};

/**
 * Framed schematic preview of a placement type. Fills its parent width and
 * keeps a 16:9 box; drop it at the top of a placement card.
 */
export const PlacementThumbnail = ({ kind }: { kind: PreviewKind }) => {
  const Shapes = SHAPES[kind] ?? CardShapes;
  return (
    <div className="flex aspect-[16/9] w-full items-center justify-center overflow-hidden rounded-lg border border-ui-border-base bg-ui-bg-subtle text-ui-fg-base">
      <svg viewBox={VIEWBOX} className="h-full w-full" role="img" aria-hidden="true">
        <Shapes />
      </svg>
    </div>
  );
};
