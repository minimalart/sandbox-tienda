/**
 * EL PUENTE ENTRE UN CATÁLOGO EN WEBP Y UN WHATSAPP QUE SÓLO LEE JPEG.
 *
 * Meta acepta `image/jpeg` e `image/png` en los mensajes de imagen, y NADA MÁS: el
 * webp existe en su API sólo para stickers. Un catálogo servido en webp —que es lo
 * correcto para la tienda, donde pesa la mitad— deja al bot sin una sola foto
 * enviable, y el síntoma es el peor de todos: Meta valida la imagen DESPUÉS de
 * devolvernos el id del mensaje, así que el backend registra "carrusel enviado" y el
 * cliente no recibe nada.
 *
 * La salida no es convertir el catálogo —la tienda quiere su webp— sino servir una
 * DERIVADA jpeg para WhatsApp. Se hace al vuelo y no al importar porque:
 *
 *   • no hace falta migrar las imágenes que ya están (son miles),
 *   • cubre cualquier origen —ERP, catalogador, carga manual, copia entre
 *     instancias— sin que cada uno tenga que acordarse,
 *   • no duplica almacenamiento ni abre la puerta a que las dos copias diverjan.
 *
 * ── Por qué la URL va FIRMADA ────────────────────────────────────────────────────
 *
 * El conversor recibe una URL y la descarga desde el servidor. Sin firma sería un
 * proxy abierto: cualquiera podría pedirle que baje `http://169.254.169.254/…` o
 * cualquier host interno y usarlo de puente. La firma la genera el backend con un
 * secreto que ya tiene, así que sólo son convertibles las imágenes que el backend
 * mismo decidió mandar, y no hace falta mantener una lista de dominios permitidos
 * que se desactualiza cada vez que un cliente cambia de CDN.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

/** El path público del conversor. Vive fuera de `/store` y `/admin`: lo descarga Meta. */
export const WA_IMAGE_PATH = '/whatsapp-image';

/**
 * El secreto de la firma.
 *
 * Se reusan los que la instalación ya tiene en vez de pedir uno nuevo: una variable
 * más es una variable más que en una instalación vieja va a faltar, y el efecto de
 * que falte sería que el bot deja de mandar fotos sin que nadie sepa por qué.
 */
function signingSecret(): string | null {
  return process.env.JWT_SECRET || process.env.COOKIE_SECRET || null;
}

/**
 * De dónde cuelga la URL pública del backend. Es la misma que usa el webhook de
 * Mercado Pago para su `notification_url`: si no está, no hay dirección propia que
 * darle a Meta.
 */
function publicBaseUrl(): string | null {
  const raw = (process.env.BACKEND_URL || process.env.MEDUSA_BACKEND_URL || '').trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, '');
}

const toBase64Url = (value: string): string =>
  Buffer.from(value, 'utf8').toString('base64url');

const fromBase64Url = (value: string): string | null => {
  try {
    const decoded = Buffer.from(value, 'base64url').toString('utf8');
    // Ida y vuelta: base64url acepta basura que decodifica a algo distinto de lo que
    // firmamos, y comparar acá es más barato que confiar.
    return toBase64Url(decoded) === value ? decoded : null;
  } catch {
    return null;
  }
};

/** HMAC del payload ya codificado. 32 hex = 128 bits, de sobra para esto. */
function sign(encoded: string, secret: string): string {
  return createHmac('sha256', secret).update(encoded).digest('hex').slice(0, 32);
}

/**
 * La URL del conversor para una imagen, o `null` si esta instalación no puede
 * convertir (sin URL pública o sin secreto). `null` NO es un error: el llamador cae
 * al placeholder y, si tampoco hay, a la lista sin fotos.
 */
export function buildJpegUrl(imageUrl: string): string | null {
  const base = publicBaseUrl();
  const secret = signingSecret();
  if (!base || !secret) return null;
  // Sólo http(s): un `file://` o un `data:` acá sería una lectura del disco del
  // servidor disfrazada de imagen de producto.
  if (!/^https?:\/\//i.test(imageUrl)) return null;

  const encoded = toBase64Url(imageUrl);
  return `${base}${WA_IMAGE_PATH}?u=${encoded}&s=${sign(encoded, secret)}`;
}

/**
 * La URL original de un pedido al conversor, o `null` si la firma no cierra.
 *
 * Es el único lugar donde se decide QUÉ se descarga, así que es puro a propósito: se
 * prueba con una tabla de casos y sin levantar el servidor.
 */
export function readJpegTarget(query: {
  u?: unknown;
  s?: unknown;
}): string | null {
  const secret = signingSecret();
  if (!secret) return null;
  const encoded = typeof query.u === 'string' ? query.u : null;
  const given = typeof query.s === 'string' ? query.s : null;
  if (!encoded || !given) return null;

  const expected = sign(encoded, secret);
  // Comparación de tiempo constante: la firma es un secreto derivado y compararla
  // con `===` filtra, byte a byte, cuánto se acertó.
  if (given.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(given), Buffer.from(expected))) return null;

  const url = fromBase64Url(encoded);
  if (!url || !/^https?:\/\//i.test(url)) return null;
  return url;
}
