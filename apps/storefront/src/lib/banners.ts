export type RawApiBanner = {
	id: string;
	internal_name?: string;
	handle?: string;
	type?: string;
	device_type?: string;
	placement: string;
	status?: string;
	priority?: number;
	content?: {
		title?: string;
		subtitle?: string;
		body?: string;
	} | null;
	media?: {
		url: string;
		type?: string;
		aspect_ratio?: string;
	} | null;
	cta?: {
		url: string;
		label?: string;
		target?: string;
	} | null;
	metadata?: {
		card_color?: string | null;
		color_font?: string | null;
		cta_color_font?: string | null;
		icon?: string | null;
		icon_color?: string | null;
		[key: string]: unknown;
	} | null;
	start_at?: string | null;
	end_at?: string | null;
	created_at?: string;
	updated_at?: string;
	deleted_at?: string | null;
};

/**
 * Anexa un cache-buster (`?v=<updated_at>`) a la URL de la imagen del banner.
 *
 * Cuando se re-sube una imagen con el MISMO nombre/URL, el navegador, el CDN y
 * el optimizador de `next/image` siguen sirviendo el asset viejo porque la URL
 * no cambió. Versionar la URL con el `updated_at` del banner fuerza la recarga
 * en cada edición sin invalidar las imágenes que no cambiaron.
 */
function withImageVersion(
	url: string | undefined,
	updatedAt: string | undefined,
): string | undefined {
	if (!url) return url;
	const ts = updatedAt ? Date.parse(updatedAt) : Number.NaN;
	if (!Number.isFinite(ts)) return url;
	const sep = url.includes('?') ? '&' : '?';
	return `${url}${sep}v=${ts}`;
}

export function normalizeApiBanner(raw: RawApiBanner): ApiBanner {
	const cardColor = raw.metadata?.card_color ?? undefined;
	const textColor = raw.metadata?.color_font ?? undefined;
	const ctaTextColor = raw.metadata?.cta_color_font ?? undefined;
	const versionedImage = withImageVersion(raw.media?.url, raw.updated_at);
	return {
		id: raw.id,
		placement: raw.placement,
		device: raw.device_type,
		priority: raw.priority,
		title: raw.content?.title,
		subtitle: raw.content?.subtitle,
		text: raw.content?.body ?? raw.content?.title,
		icon: raw.metadata?.icon ?? undefined,
		image: versionedImage,
		product_image: versionedImage,
		cta_text: raw.cta?.label,
		cta_href: raw.cta?.url,
		href: raw.cta?.url,
		gradient: cardColor,
		card_color: cardColor,
		color_font: textColor,
		cta_color_font: ctaTextColor,
		icon_color: raw.metadata?.icon_color ?? undefined,
		countdown_seconds:
			raw.metadata?.countdown_seconds != null
				? Number(raw.metadata.countdown_seconds)
				: undefined,
		show_logo:
			raw.metadata?.show_logo === true || raw.metadata?.show_logo === 'true',
		splash_bg: raw.metadata?.splash_bg === 'image' ? 'image' : 'color',
		links: Array.isArray(raw.metadata?.links)
			? (raw.metadata.links as Array<{ url?: string; image?: string }>)
			: undefined,
	};
}

export const HOME_BANNER_PLACEMENTS = [
	'top_bar',
	'banner_1',
	'banner_2',
	'banner_3',
	'banner_4',
	'banner_5',
	'banner_6',
	'sticky_footer',
	'welcome_splash',
] as const;

export type HomeBannerPlacement = (typeof HOME_BANNER_PLACEMENTS)[number];

export type ApiBanner = {
	id: string;
	placement: string;
	device?: string;
	text?: string;
	icon?: string;
	title?: string;
	subtitle?: string;
	image?: string;
	cta_text?: string;
	cta_href?: string;
	gradient?: string;
	badge_bg?: string;
	product_image?: string;
	href?: string;
	color_font?: string;
	/**
	 * Color del texto DEL BOTÓN CTA, separado del `color_font` general del
	 * banner. Sin esto ambos textos (título/subtítulo del banner y label del
	 * CTA) compartían color: seteabas oscuro para arreglar el CTA sobre
	 * card_color claro y el título quedaba invisible sobre la imagen.
	 */
	cta_color_font?: string;
	icon_color?: string;
	mobile_title?: string;
	mobile_subtitle?: string;
	card_color?: string;
	priority?: number;
	countdown_seconds?: number;
	show_logo?: boolean;
	/**
	 * Splash background mode: `color` (default — plain color + centered
	 * contained image) or `image` (the media_url fills the whole screen as a
	 * full-bleed background, the rest of the elements become optional overlays).
	 */
	splash_bg?: 'color' | 'image';
	links?: Array<{ url?: string; image?: string }>;
};

export function sortBannersByPriority<T extends { priority?: number }>(banners: T[]): T[] {
	return [...banners].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

export function getBannersForPlacement(banners: ApiBanner[], placement: string): ApiBanner[] {
	return sortBannersByPriority(banners.filter((banner) => banner.placement === placement));
}

export function getFirstBannerForPlacement(banners: ApiBanner[], placement: string): ApiBanner | undefined {
	return getBannersForPlacement(banners, placement)[0];
}
