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
