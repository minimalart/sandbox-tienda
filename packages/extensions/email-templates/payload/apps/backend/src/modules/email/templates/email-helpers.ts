import { getEmailTemplateSettings } from '../settings';

/** Iconos kit CDE + timeline de seguimiento (bucket: …/email-icons/) */
const ALLOWED_ICON_FILES = [
  // Iconos legacy (pre-rediseño orden notification)
  'icon-local.png',
  'icon-location.png',
  'icon-phone.png',
  'check-icon.png',
  'dollar-sign.png',
  'preparation-icon.png',
  'truck-icon.png',
  'delivered-icon.png',
  // Iconos nuevos (rediseño orden notification — provistos por diseño)
  'card.png',
  'email.png',
  'truck.png',
  'user.png',
  'heroicons-map-pin.png',
  'heroicons-phone.png',
  'heroicons-building-storefront.png',
];

/**
 * Returns the public S3 URL for an email icon.
 *
 * The base URL comes from `app-settings` (`EMAIL_ICONS_BASE_URL`, DB row > env),
 * resolved on every call instead of once at import time: these templates are
 * rendered inside a long-lived process, so a module-level const would keep
 * serving the old bucket until the next deploy.
 */
export function getIconSrc(filename: string): string {
  const base = getEmailTemplateSettings().iconsBaseUrl;
  if (!base) return '';
  if (!filename || !ALLOWED_ICON_FILES.includes(filename)) return '';
  return `${base}/${filename}`;
}

/**
 * Returns an <img> tag for an icon using S3 URL (prod) or base64 (dev local).
 */
export function getIconTag(filename: string, alt = '', width = 20, height = 20): string {
  const src = getIconSrc(filename);
  if (!src) return '';
  return `<img src="${src}" alt="${alt}" width="${width}" height="${height}" style="display: block; -ms-interpolation-mode: bicubic; border: 0; line-height: 100%; outline: none; text-decoration: none;">`;
}

/** @deprecated use getIconSrc */
export const getIconBase64 = getIconSrc;

/**
 * Renderiza el precio de una línea de pedido en el email. Si el valor formateado
 * representa 0 (porque un descuento dejó el item en cero), devuelve "Gratis" en
 * lugar de "$ 0" — más claro para el cliente.
 *
 * Recibe el string ya formateado por `formatPrice` del shared (ej. "10.000", "0",
 * "0,00", "4.400,50"). Para "—" (sin dato) conserva el guion.
 */
export function formatLineTotalForEmail(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '—';
  const str = String(value).trim();
  if (str === '' || str === '—') return '—';
  if (str === '0' || str === '0,00' || str === '0.00') return 'Gratis';
  return `$ ${str}`;
}

/**
 * Converts a hex color to rgba() string with the given opacity.
 * Falls back to the fallback color if the hex is invalid.
 * @example hexToRgba('#2e7d32', 0.1) => 'rgba(46,125,50,0.1)'
 */
export function hexToRgba(hex: string, opacity: number, fallback = '#2e7d32'): string {
  const clean = (hex || fallback).trim().replace(/^#/, '');
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean;
  const num = parseInt(full.slice(0, 6), 16);
  if (isNaN(num)) return hexToRgba(fallback, opacity, '#2e7d32');
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r},${g},${b},${opacity})`;
}

/**
 * ── EL NOMBRE DE LA TIENDA EN LOS MAILS, Y POR QUÉ NUNCA ES UNA MARCA ───────
 *
 * Diez plantillas resolvían su nombre visible con
 * `(data.cde_display_name || data.sales_channel_name || 'Mercatto')` y armaban el
 * asunto con `channelName ? \`[${channelName}] …\` : \`[Mercatto] …\``.
 *
 * Ese literal NO es un detalle de estilo: `cdeDisplayName` se muestra como el
 * título grande cuando la tienda no tiene logo, va en el `alt` del logo y firma
 * el pie (`© 2026 X. Todos los derechos reservados.`). Una tienda a la que le
 * falte el dato le mandaba a SUS clientes un mail encabezado y firmado con la
 * marca de otra, y con `[Mercatto]` en el asunto — lo único que se ve en la
 * bandeja antes de abrirlo.
 *
 * Y el camino del fallback no es teórico: ya tuvimos el asunto del reseteo de
 * contraseña mal armado en producción por `sales_channel_name` sin poblar.
 *
 * La regla de acá es una sola: **si no sabemos de qué tienda es, no se dice
 * ninguna.** Un corchete vacío o un pie sin firma son molestos; la marca de otro
 * cliente en el mail de un cliente es un error que no se puede explicar.
 */

type StoreNamedData = {
  cde_display_name?: string;
  sales_channel_name?: string;
  organization_name?: string;
  [key: string]: unknown;
};

/**
 * El nombre de la tienda, o `''` si no se sabe. NUNCA una marca por defecto.
 *
 * El `.replace()` saca el sufijo del canal (`-b2c`, ` b2b`): el canal se llama
 * "Desde el sur-b2c" y el cliente no tiene por qué leer eso.
 */
export function storeDisplayName(data: StoreNamedData): string {
  const raw = data.cde_display_name || data.sales_channel_name || data.organization_name || '';
  return String(raw)
    .trim()
    .replace(/[-\s]b2[cb]$/i, '')
    .trim();
}

/**
 * El asunto con el prefijo de la tienda. Sin tienda conocida, va el asunto
 * pelado: mejor "Confirmación de registro" que "[Mercatto] Confirmación de
 * registro" en la casilla de un cliente que nunca oyó hablar de Mercatto.
 */
export function subjectWithStore(subject: string, data: StoreNamedData): string {
  const name = data.sales_channel_name?.trim() || storeDisplayName(data);
  return name ? `[${name}] ${subject}` : subject;
}

/**
 * El pie de página, sin firmar cuando no sabemos de quién es.
 *
 * El literal `© ${year} ${name}. Todos los derechos reservados.` estaba
 * repetido en nueve plantillas, y con `name` vacío rendereaba
 * `© 2026 . Todos los derechos reservados.` — con el espacio colgando antes
 * del punto. Acá el nombre entra sólo si existe.
 */
export function copyrightLine(year: number | string, name: string): string {
  const store = String(name || '').trim();
  return store
    ? `© ${year} ${store}. Todos los derechos reservados.`
    : `© ${year}. Todos los derechos reservados.`;
}
