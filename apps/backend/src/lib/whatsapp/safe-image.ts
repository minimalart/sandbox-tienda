/**
 * ¿Esta imagen la acepta WhatsApp?
 *
 * Meta admite **JPEG y PNG, y nada más**, en las cards del carrusel y en las imágenes
 * sueltas; el webp existe en su API sólo para stickers. Si UNA sola card trae algo
 * que no puede decodificar, rechaza el mensaje COMPLETO con el error 131053 ("Media
 * upload error / Image is invalid") y el cliente no recibe nada — ni las cards buenas.
 *
 * Y lo hace DESPUÉS de devolvernos el id del mensaje, así que el backend registra
 * "carrusel enviado" y nadie se entera de nada: no queda ni un renglón rojo.
 *
 * ── Las dos veces que esto dejó mudo al bot ──────────────────────────────────────
 *
 * El 2026-08-04, `REVESTA_4040-…JPG`: se llama `.JPG`, el CDN la sirve como
 * `image/jpeg` y por dentro es un **WebP ANIMADO** (RIFF/WEBP, chunk VP8X con el flag
 * ANIM). De ahí sale la regla de mirar los BYTES y no la extensión ni el
 * `content-type`.
 *
 * El 2026-09-17, el catálogo ENTERO: 2721 productos con el thumbnail en webp estático
 * (`norm-*.webp`). Ese arreglo de agosto dio por buenos los webp estáticos —"Meta los
 * acepta"— y es falso: acepta jpeg y png. Con el catálogo en webp, ninguna búsqueda
 * del bot llegaba a destino.
 *
 * Por eso lo que no es jpeg ni png no se descarta: se manda a convertir a jpeg al
 * vuelo (ver `image-proxy.ts`). Descartarlo dejaría al catálogo sin fotos, y el webp
 * es lo correcto para la tienda.
 *
 * La verificación vive en el emisor y no en cada llamador: así la cubre cualquier
 * carrusel, presente o futuro.
 */

import { buildJpegUrl } from './image-proxy';

/** Cómo llegó la imagen. Sólo `jpeg` y `png` viajan tal cual; el resto se convierte. */
export type ImageVerdict = 'jpeg' | 'png' | 'webp_static' | 'animated_webp' | 'unsupported';

const startsWith = (bytes: Uint8Array, ...prefix: number[]): boolean =>
  prefix.every((byte, i) => bytes[i] === byte);

/**
 * Clasifica una imagen por su cabecera. PURA y sin red: se testea con fixtures de
 * bytes. Con menos de 16 bytes no se puede decidir nada → `unsupported`.
 */
export function classifyImageHead(head: Uint8Array): ImageVerdict {
  if (head.length < 16) return 'unsupported';

  // JPEG: SOI (FF D8 FF).
  if (startsWith(head, 0xff, 0xd8, 0xff)) return 'jpeg';

  // PNG: \x89PNG\r\n\x1a\n
  if (startsWith(head, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'png';

  // WebP: "RIFF" …4 bytes de tamaño… "WEBP" + chunk.
  const riff = String.fromCharCode(...head.slice(0, 4));
  const form = String.fromCharCode(...head.slice(8, 12));
  if (riff === 'RIFF' && form === 'WEBP') {
    const chunk = String.fromCharCode(...head.slice(12, 16));
    // VP8 (lossy) y VP8L (lossless) son siempre estáticos. VP8X es el extendido: el
    // bit 0x02 de sus flags marca ANIMACIÓN, y eso Meta no lo acepta.
    if (chunk === 'VP8 ' || chunk === 'VP8L') return 'webp_static';
    if (chunk === 'VP8X') {
      const flags = head[16] ?? 0;
      return (flags & 0x02) !== 0 ? 'animated_webp' : 'webp_static';
    }
    return 'unsupported';
  }

  // GIF, SVG, HTML de error, AVIF, TIFF… todo lo demás.
  return 'unsupported';
}

/** Los dos formatos que Meta decodifica. El webp NO está, por más estático que sea. */
export const isSendableVerdict = (verdict: ImageVerdict): boolean =>
  verdict === 'jpeg' || verdict === 'png';

/**
 * Lo que no sirve como está pero sharp sí sabe leer, así que vale convertirlo.
 *
 * El webp animado entra: de ahí se toma el primer cuadro. Lo que no se pudo
 * clasificar (`unsupported`) queda afuera porque bien puede ser un HTML de error del
 * CDN, y mandarlo al conversor sería pagar una descarga para fallar igual.
 */
export const isConvertibleVerdict = (verdict: ImageVerdict): boolean =>
  verdict === 'webp_static' || verdict === 'animated_webp';

/** Cuántos bytes alcanzan para clasificar (VP8X necesita llegar al byte 16). */
const HEAD_BYTES = 32;
const FETCH_TIMEOUT_MS = 2_500;

/**
 * Cache por URL. Las imágenes del catálogo se repiten muchísimo entre turnos y
 * clientes, y el veredicto de una URL no cambia: sin cache pagaríamos un request por
 * card en cada carrusel.
 */
const verdicts = new Map<string, ImageVerdict | null>();

/** Sólo para los tests: limpia el cache entre casos. */
export function resetImageVerdictCache(): void {
  verdicts.clear();
}

/**
 * Descarga los primeros bytes y clasifica. `null` = no se pudo determinar (timeout,
 * 404, CDN caído).
 *
 * Ojo con el `null`: NO se trata como "no enviable". Si la red nos falla a nosotros,
 * Meta igual puede descargar la imagen sin problema, y descartarla por nuestra
 * flakiness sería cambiar un fallo raro por uno seguro. Sólo se descarta lo que se
 * comprobó que Meta NO acepta.
 */
export async function classifyImageUrl(url: string): Promise<ImageVerdict | null> {
  if (!url) return null;
  const cached = verdicts.get(url);
  if (cached !== undefined) return cached;

  let verdict: ImageVerdict | null = null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: { Range: `bytes=0-${HEAD_BYTES - 1}` },
        signal: controller.signal,
      });
      if (res.ok || res.status === 206) {
        const buffer = await res.arrayBuffer();
        verdict = classifyImageHead(new Uint8Array(buffer));
      }
    } finally {
      clearTimeout(timer);
    }
  } catch {
    verdict = null;
  }

  verdicts.set(url, verdict);
  return verdict;
}

/**
 * URL usable para una card, o `null` si no hay ninguna.
 *
 * El orden de las salidas, de mejor a peor:
 *
 *   1. jpeg o png → la URL original, sin tocar nada.
 *   2. webp → la URL del conversor, que la sirve en jpeg (`image-proxy.ts`).
 *   3. lo que no se pudo convertir → el placeholder configurado
 *      (`WHATSAPP_PLACEHOLDER_IMAGE_URL`), que es exactamente para lo que existe, y
 *      que pasa por esta misma escalera.
 *   4. nada → `null`, y el llamador cae a la lista sin fotos: mostrar los productos
 *      sin imagen es infinitamente mejor que no mostrar nada.
 *
 * El escalón 2 puede no estar disponible (una instalación sin URL pública del backend
 * o sin secreto): ahí se sigue de largo al placeholder. La degradación es la misma que
 * ya existía, nunca un mensaje que no llega.
 */
export async function pickSendableImageUrl(
  imageUrl: string | null | undefined,
  placeholderUrl?: string | null,
): Promise<string | null> {
  const candidates = [imageUrl, placeholderUrl].filter(
    (url): url is string => typeof url === 'string' && url.trim().length > 0,
  );
  for (const candidate of candidates) {
    const verdict = await classifyImageUrl(candidate);
    // `null` (indeterminado) se deja pasar a propósito: ver `classifyImageUrl`.
    if (verdict === null || isSendableVerdict(verdict)) return candidate;
    if (isConvertibleVerdict(verdict)) {
      const converted = buildJpegUrl(candidate);
      if (converted) return converted;
    }
  }
  return null;
}
