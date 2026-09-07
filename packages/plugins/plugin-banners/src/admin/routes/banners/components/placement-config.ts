import type { Banner } from '../../../hooks/api/banners';

/**
 * Local UI configuration: the admin treats each placement as an editable
 * container of items. No model/API changes — grouping and field visibility
 * are resolved client-side from the existing banner fields.
 */

export type BannerFieldId =
  | 'internal_name'
  | 'status'
  | 'device_type'
  | 'type'
  | 'priority'
  | 'content_title'
  | 'content_subtitle'
  | 'content_body'
  | 'media_url'
  | 'cta_url'
  | 'cta_label'
  | 'cta_target'
  | 'icon'
  | 'card_color'
  | 'icon_color'
  | 'text_color'
  | 'splash_bg'
  | 'countdown_seconds'
  | 'show_logo'
  | 'sticky_links'
  | 'start_at'
  | 'end_at'
  | 'customer_group_ids';

export type PreviewKind = 'topbar' | 'hero' | 'card' | 'splash' | 'sticky';

export type PlacementConfig = {
  id: string;
  /** i18n key (banners ns) for the placement display name */
  labelKey: string;
  /** i18n key for the singular item name (Mensaje / Slide / Card) */
  itemLabelKey: string;
  /** i18n key for the plural item name */
  itemLabelPluralKey: string;
  preview: PreviewKind;
  visibleFields: BannerFieldId[];
};

export const ALL_FIELDS: BannerFieldId[] = [
  'internal_name',
  'status',
  'device_type',
  'type',
  'priority',
  'content_title',
  'content_subtitle',
  'content_body',
  'media_url',
  'cta_url',
  'cta_label',
  'cta_target',
  'card_color',
  'start_at',
  'end_at',
];

const TOP_BAR_FIELDS: BannerFieldId[] = [
  'internal_name',
  'status',
  'device_type',
  'type',
  'priority',
  'content_title',
  'content_body',
  'icon',
  'card_color',
  'icon_color',
  'text_color',
  'start_at',
  'end_at',
];

const cardPlacement = (n: number): PlacementConfig => ({
  id: `banner_${n}`,
  labelKey: `PLACEMENT_BANNER_${n}`,
  itemLabelKey: 'ITEM_CARD',
  itemLabelPluralKey: 'ITEM_CARD_PLURAL',
  preview: 'card',
  visibleFields: ALL_FIELDS,
});

// Footer sticky de marcas: UN banner = el footer completo. Color de fondo,
// título (+color) y subtítulo opcional, y una lista de enlaces (link + imagen
// c/u, de 1 a N). Default visual: barra estilo Disney con logos de marca.
const STICKY_FOOTER_FIELDS: BannerFieldId[] = [
  'internal_name',
  'status',
  'priority',
  'content_title',
  'content_subtitle',
  'card_color',
  'text_color',
  'sticky_links',
  // CTA opcional: si no hay enlaces, es obligatorio (botón + link).
  'cta_label',
  'cta_url',
  'cta_target',
  'start_at',
  'end_at',
];

// Splash de bienvenida (siempre mobile): tipo de fondo (color o imagen a
// pantalla completa), título, imagen, color de fondo y de texto + countdown de
// autocierre. Sin CTA/botón y sin selector de dispositivo.
const WELCOME_SPLASH_FIELDS: BannerFieldId[] = [
  'internal_name',
  'status',
  'priority',
  'content_title',
  'content_subtitle',
  'splash_bg',
  'media_url',
  'card_color',
  'text_color',
  'show_logo',
  'countdown_seconds',
  'start_at',
  'end_at',
];

export const PLACEMENT_CONFIG: Record<string, PlacementConfig> = {
  top_bar: {
    id: 'top_bar',
    labelKey: 'PLACEMENT_TOP_BAR',
    itemLabelKey: 'ITEM_MESSAGE',
    itemLabelPluralKey: 'ITEM_MESSAGE_PLURAL',
    preview: 'topbar',
    visibleFields: TOP_BAR_FIELDS,
  },
  banner_1: {
    id: 'banner_1',
    labelKey: 'PLACEMENT_BANNER_1',
    itemLabelKey: 'ITEM_SLIDE',
    itemLabelPluralKey: 'ITEM_SLIDE_PLURAL',
    preview: 'hero',
    visibleFields: ALL_FIELDS,
  },
  banner_2: cardPlacement(2),
  banner_3: cardPlacement(3),
  banner_4: cardPlacement(4),
  banner_5: cardPlacement(5),
  banner_6: cardPlacement(6),
  sticky_footer: {
    id: 'sticky_footer',
    labelKey: 'PLACEMENT_STICKY_FOOTER',
    itemLabelKey: 'ITEM_HIGHLIGHT',
    itemLabelPluralKey: 'ITEM_HIGHLIGHT_PLURAL',
    preview: 'sticky',
    visibleFields: STICKY_FOOTER_FIELDS,
  },
  welcome_splash: {
    id: 'welcome_splash',
    labelKey: 'PLACEMENT_WELCOME_SPLASH',
    itemLabelKey: 'ITEM_SPLASH',
    itemLabelPluralKey: 'ITEM_SPLASH_PLURAL',
    preview: 'splash',
    visibleFields: WELCOME_SPLASH_FIELDS,
  },
};

export const PLACEMENT_IDS = Object.keys(PLACEMENT_CONFIG);

export function getPlacementConfig(placement: string): PlacementConfig {
  return PLACEMENT_CONFIG[placement] ?? cardPlacement(0);
}

// ─── Status helpers (inferred from existing fields, no new states) ───────────

export function isScheduled(banner: Banner, now: Date = new Date()): boolean {
  return banner.status === 'published' && !!banner.start_at && new Date(banner.start_at) > now;
}

export function isExpired(banner: Banner, now: Date = new Date()): boolean {
  return !!banner.end_at && new Date(banner.end_at) < now;
}

/** Published, inside its date window (what the storefront shows). */
export function isLive(banner: Banner, now: Date = new Date()): boolean {
  return banner.status === 'published' && !isScheduled(banner, now) && !isExpired(banner, now);
}

/** Priority DESC (storefront order), then created_at ASC as tiebreaker. */
export function sortBanners(a: Banner, b: Banner): number {
  const prio = (b.priority ?? 0) - (a.priority ?? 0);
  if (prio !== 0) return prio;
  return (a.created_at ?? '').localeCompare(b.created_at ?? '');
}

export function groupByPlacement(banners: Banner[]): Record<string, Banner[]> {
  const groups: Record<string, Banner[]> = {};
  for (const banner of banners) {
    (groups[banner.placement] ??= []).push(banner);
  }
  for (const key of Object.keys(groups)) {
    groups[key]!.sort(sortBanners);
  }
  return groups;
}

/** Earliest upcoming start among published banners of a placement, if any. */
export function nextScheduledAt(banners: Banner[], now: Date = new Date()): string | null {
  const upcoming = banners
    .filter((b) => isScheduled(b, now))
    .map((b) => b.start_at as string)
    .sort();
  return upcoming[0] ?? null;
}
