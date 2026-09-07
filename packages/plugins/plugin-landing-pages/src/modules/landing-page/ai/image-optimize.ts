import sharp from 'sharp';

/**
 * Convierte una imagen (PNG/JPEG de la IA) a WebP optimizado en peso y tamaño.
 * Hero = banner ancho (1600px), ImageBlock = imagen de contenido (1200px). No se
 * fuerza alto/crop para no distorsionar lo que devuelve el modelo (que ya viene
 * con el aspect ratio pedido). Si el WebP supera `maxKb`, se reintenta UNA vez
 * bajando la calidad; si aún excede, se devuelve igual (mejor que fallar).
 *
 * Devuelve base64 CRUDO (sin prefijo data:) listo para `fileModule.createFiles`.
 */
export type SlotKind = 'hero' | 'imageBlock';

export type OptimizedImage = {
  base64: string;
  mimeType: 'image/webp';
  bytes: number;
  width: number;
  height: number;
};

const TARGET_WIDTH: Record<SlotKind, number> = {
  hero: 1600,
  imageBlock: 1200,
};

export async function optimizeToWebp(
  input: Buffer,
  kind: SlotKind,
  opts: { quality: number; maxKb: number },
): Promise<OptimizedImage> {
  const width = TARGET_WIDTH[kind];
  const quality = Math.min(Math.max(Math.round(opts.quality), 40), 90);

  const encode = (q: number) =>
    sharp(input)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: q, effort: 4 })
      .toBuffer({ resolveWithObject: true });

  let { data, info } = await encode(quality);

  // Un solo step-down si nos pasamos del peso objetivo.
  if (data.length > opts.maxKb * 1024) {
    const lower = Math.max(quality - 15, 50);
    if (lower < quality) {
      const retry = await encode(lower);
      data = retry.data;
      info = retry.info;
    }
    if (data.length > opts.maxKb * 1024) {
      console.warn(
        `[landing-image] WebP ${kind} quedó en ${Math.round(data.length / 1024)}KB ` +
          `(objetivo ${opts.maxKb}KB).`,
      );
    }
  }

  return {
    base64: data.toString('base64'),
    mimeType: 'image/webp',
    bytes: data.length,
    width: info.width,
    height: info.height,
  };
}
