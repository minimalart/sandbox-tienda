import sharp from 'sharp';

/**
 * Descarga imágenes de producto (URLs de S3/CDN) y las normaliza a data URLs
 * JPEG listas para mandar como REFERENCIA al modelo de imagen (nano banana).
 * Se achican a 768px (suficiente para que el modelo "entienda" el producto sin
 * inflar el payload) y se aplanan sobre blanco por si vienen con transparencia.
 *
 * Es best-effort: una imagen que no baja o no decodifica se saltea (no rompe la
 * generación). Devuelve como mucho `max` referencias.
 */
const FETCH_TIMEOUT_MS = 12_000;

export async function toReferenceDataUrls(
  imageUrls: Array<string | null | undefined>,
  max = 4,
): Promise<string[]> {
  const urls = imageUrls
    .filter((u): u is string => typeof u === 'string' && /^https?:\/\//i.test(u))
    .slice(0, max);

  const out: string[] = [];
  for (const url of urls) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) continue;
      const input = Buffer.from(await res.arrayBuffer());
      const normalized = await sharp(input)
        .flatten({ background: '#ffffff' })
        .resize({ width: 768, height: 768, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
      out.push(`data:image/jpeg;base64,${normalized.toString('base64')}`);
    } catch {
      /* imagen inaccesible o no decodificable: se saltea */
    } finally {
      clearTimeout(timeout);
    }
  }
  return out;
}
