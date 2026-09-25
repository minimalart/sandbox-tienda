/**
 * La conversión a jpeg que WhatsApp sí acepta. Aparte de la ruta para poder probarla
 * sin levantar el servidor, y aparte de `image-proxy.ts` porque eso es una decisión
 * (qué se descarga) y esto es un cómputo (cómo se convierte).
 */

import sharp from 'sharp';

/** Meta corta en 5 MB. 1600px de lado largo deja la card nítida y muy por debajo. */
const MAX_SIDE = 1600;
const QUALITY = 82;

/**
 * Convierte cualquier imagen que sharp sepa decodificar a un jpeg enviable.
 *
 * `animated: false` a propósito: de un webp animado se queda con el primer cuadro,
 * que es exactamente lo que hay que mandar. Antes ese archivo se descartaba entero y
 * el producto viajaba sin foto.
 *
 * `flatten` sobre BLANCO porque el jpeg no tiene canal alfa: sin esto, un png o un
 * webp con transparencia —la mitad de las fotos de producto recortadas— sale con el
 * fondo NEGRO. Blanco y no gris porque es el fondo del que ya vienen recortadas.
 */
export async function toWhatsappJpeg(input: Buffer): Promise<Buffer> {
  return sharp(input, { animated: false })
    // `rotate()` sin argumentos aplica la orientación EXIF; las fotos sacadas con
    // celular llegan acostadas si no.
    .rotate()
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: QUALITY, mozjpeg: true })
    .toBuffer();
}
