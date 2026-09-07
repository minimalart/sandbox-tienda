import { Text } from '@medusajs/ui';
import type { Banner } from '../../../hooks/api/banners';
import type { PreviewKind } from './placement-config';

/**
 * Pure preview components, visually aligned with the storefront renderers
 * (topbar: compact horizontal bar; banner_1: hero with media; banner_2+:
 * card with card_color). They only read values — no data fetching.
 */

export type BannerPreviewData = {
  title?: string;
  subtitle?: string;
  body?: string;
  mediaUrl?: string;
  ctaUrl?: string;
  ctaLabel?: string;
  icon?: string;
  cardColor?: string;
  iconColor?: string;
  textColor?: string;
  showLogo?: boolean;
  splashBg?: 'color' | 'image';
  links?: Array<{ url?: string; image?: string }>;
};

export function bannerToPreviewData(banner: Banner): BannerPreviewData {
  return {
    title: banner.content?.title ?? undefined,
    subtitle: banner.content?.subtitle ?? undefined,
    body: banner.content?.body ?? undefined,
    mediaUrl: banner.media?.url ?? undefined,
    ctaUrl: banner.cta?.url ?? undefined,
    ctaLabel: banner.cta?.label ?? undefined,
    icon: (banner.metadata?.icon as string | null) ?? undefined,
    cardColor: (banner.metadata?.card_color as string | null) ?? undefined,
    iconColor: (banner.metadata?.icon_color as string | null) ?? undefined,
    textColor: (banner.metadata?.color_font as string | null) ?? undefined,
    showLogo:
      banner.metadata?.show_logo === true ||
      banner.metadata?.show_logo === 'true',
    splashBg:
      banner.metadata?.splash_bg === 'image' ? 'image' : 'color',
    links: Array.isArray(banner.metadata?.links)
      ? (banner.metadata.links as Array<{ url?: string; image?: string }>)
      : undefined,
  };
}

const CtaChip = ({ label }: { label?: string }) =>
  label ? (
    <span className="inline-flex shrink-0 items-center rounded-md bg-white px-2.5 py-1 text-xs font-medium text-zinc-900">
      {label}
    </span>
  ) : null;

export const TopBarPreview = ({ data }: { data: BannerPreviewData }) => (
  <div
    className="flex h-10 w-full items-center justify-center gap-2 overflow-hidden rounded-md border border-ui-border-base px-4"
    style={{
      backgroundColor: data.cardColor || '#ffffff',
      color: data.textColor || '#2e7d32',
    }}
  >
    <span
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/70 text-[10px] font-semibold"
      style={{ color: data.iconColor || data.textColor || '#2e7d32' }}
      aria-hidden="true"
    >
      {(data.icon || 'credit-card').slice(0, 1).toUpperCase()}
    </span>
    <Text size="small" className="truncate text-inherit">
      {data.title || data.body || '—'}
    </Text>
  </div>
);

export const HeroPreview = ({ data }: { data: BannerPreviewData }) => (
  <div className="relative aspect-[21/9] w-full overflow-hidden rounded-lg bg-zinc-800">
    {data.mediaUrl ? (
      <img src={data.mediaUrl} className="absolute inset-0 h-full w-full object-cover" />
    ) : null}
    <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/25 to-transparent" />
    <div className="absolute inset-0 flex flex-col justify-center gap-1.5 p-6">
      {data.title ? (
        <span className="max-w-[70%] text-xl font-bold leading-tight text-white">
          {data.title}
        </span>
      ) : null}
      {data.subtitle ? (
        <span className="max-w-[70%] text-sm font-medium text-white/90">{data.subtitle}</span>
      ) : null}
      {data.body ? (
        <span className="line-clamp-2 max-w-[60%] text-xs text-white/75">{data.body}</span>
      ) : null}
      {data.ctaUrl ? (
        <div className="mt-2">
          <CtaChip label={data.ctaLabel || data.ctaUrl} />
        </div>
      ) : null}
    </div>
  </div>
);

export const CardPreview = ({ data }: { data: BannerPreviewData }) => (
  <div
    className="flex w-full flex-col overflow-hidden rounded-lg border border-ui-border-base"
    style={{ backgroundColor: data.cardColor || undefined }}
  >
    {data.mediaUrl ? (
      <img src={data.mediaUrl} className="aspect-[16/7] w-full object-cover" />
    ) : (
      <div className="aspect-[16/7] w-full bg-ui-bg-subtle" />
    )}
    <div className="flex flex-col gap-1 p-4">
      {data.title ? (
        <span className="text-sm font-semibold text-ui-fg-base">{data.title}</span>
      ) : null}
      {data.subtitle ? (
        <span className="text-xs font-medium text-ui-fg-subtle">{data.subtitle}</span>
      ) : null}
      {data.body ? (
        <span className="line-clamp-2 text-xs text-ui-fg-muted">{data.body}</span>
      ) : null}
      {data.ctaUrl ? (
        <div className="mt-1.5">
          <span className="inline-flex items-center rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white">
            {data.ctaLabel || data.ctaUrl}
          </span>
        </div>
      ) : null}
    </div>
  </div>
);

export const SplashPreview = ({ data }: { data: BannerPreviewData }) => {
  const bg = data.cardColor || '#0b1437';
  const fg = data.textColor || '#ffffff';
  const isImageBg = data.splashBg === 'image';

  // Modo imagen: la imagen ocupa TODO el splash (object-cover). Logo/título/
  // subtítulo se superponen como overlays opcionales.
  if (isImageBg) {
    return (
      <div
        className="relative mx-auto flex aspect-[9/16] w-[200px] max-w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl px-4 py-6 text-center"
        style={{ backgroundColor: bg, color: fg }}
      >
        {data.mediaUrl ? (
          <img
            src={data.mediaUrl}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-white/10 text-xs text-white/70">
            imagen de fondo
          </div>
        )}
        <div className="relative z-10 flex flex-col items-center gap-2">
          {data.showLogo ? (
            <span className="flex h-7 items-center rounded-lg bg-white px-2 font-semibold text-[10px] text-zinc-700 shadow">
              logo
            </span>
          ) : null}
          {data.title ? (
            <span
              className="text-center font-bold text-base leading-tight drop-shadow"
              style={{ color: fg }}
            >
              {data.title}
            </span>
          ) : null}
          {data.subtitle ? (
            <span
              className="text-center text-xs opacity-90 drop-shadow"
              style={{ color: fg }}
            >
              {data.subtitle}
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className="mx-auto flex aspect-[9/16] w-[200px] max-w-full flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl px-4 py-6"
      style={{ backgroundColor: bg, color: fg }}
    >
      {data.showLogo ? (
        <span className="flex h-7 items-center rounded-lg bg-white px-2 font-semibold text-[10px] text-zinc-700 shadow">
          logo
        </span>
      ) : null}
      {data.title ? (
        <span
          className="text-center font-bold text-base leading-tight"
          style={{ color: fg }}
        >
          {data.title}
        </span>
      ) : null}
      {data.mediaUrl ? (
        <img
          src={data.mediaUrl}
          className="h-[40%] w-auto max-w-full object-contain"
        />
      ) : (
        <div
          className="flex h-[40%] w-3/4 items-center justify-center rounded-lg bg-white/10 text-xs"
          style={{ color: fg }}
        >
          imagen
        </div>
      )}
      {data.subtitle ? (
        <span className="text-center text-xs opacity-80" style={{ color: fg }}>
          {data.subtitle}
        </span>
      ) : null}
    </div>
  );
};

export const StickyPreview = ({ data }: { data: BannerPreviewData }) => {
  // Igual que el storefront real: barra compacta, ancho acotado (max-w-3xl),
  // hasta 4 logos y botón (CTA) opcional. Si no hay nada cargado, muestra 4
  // placeholders. Default sin color: degradé índigo.
  const fg = data.textColor || '#ffffff';
  const useGradient = !data.cardColor;
  const links = (data.links ?? []).filter((l) => l?.image || l?.url).slice(0, 4);
  const hasLinks = links.length > 0;
  const ctaLabel = data.ctaLabel || (data.ctaUrl ? 'Ver todas →' : undefined);
  const cells: Array<{ image?: string }> = hasLinks
    ? links
    : ctaLabel
      ? []
      : [{}, {}, {}, {}];

  return (
    <div
      className={`mx-auto flex w-full max-w-3xl items-center gap-3 overflow-hidden rounded-2xl px-4 py-2.5 shadow-lg ${
        useGradient ? 'bg-gradient-to-r from-[#1a1a4e] via-[#2d2d7b] to-[#1a1a4e]' : ''
      }`}
      style={useGradient ? { color: fg } : { backgroundColor: data.cardColor, color: fg }}
    >
      {(data.title || data.subtitle) && (
        <div className="hidden shrink-0 flex-col sm:flex" style={{ color: fg }}>
          {data.title ? <span className="font-semibold text-sm">{data.title}</span> : null}
          {data.subtitle ? <span className="text-xs opacity-80">{data.subtitle}</span> : null}
        </div>
      )}
      {cells.length > 0 ? (
        <div className="flex flex-1 items-center gap-2 overflow-hidden">
          {cells.map((l, i) => (
            <div
              key={i}
              className="flex h-[34px] min-w-[60px] items-center justify-center rounded-md bg-white px-2"
            >
              {l.image ? (
                <img src={l.image} className="h-full w-full object-contain py-1" />
              ) : (
                <span className="text-[10px] text-zinc-400">logo</span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1" />
      )}
      {ctaLabel ? (
        <span
          className="shrink-0 rounded-full bg-white px-3 py-1 font-semibold text-xs"
          style={{ color: data.cardColor || '#1a1a4e' }}
        >
          {ctaLabel}
        </span>
      ) : null}
    </div>
  );
};

export const BannerPreview = ({
  kind,
  data,
}: {
  kind: PreviewKind;
  data: BannerPreviewData;
}) => {
  switch (kind) {
    case 'topbar':
      return <TopBarPreview data={data} />;
    case 'hero':
      return <HeroPreview data={data} />;
    case 'splash':
      return <SplashPreview data={data} />;
    case 'sticky':
      return <StickyPreview data={data} />;
    default:
      return <CardPreview data={data} />;
  }
};
