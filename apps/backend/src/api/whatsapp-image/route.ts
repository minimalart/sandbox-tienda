import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { readJpegTarget } from '../../lib/whatsapp/image-proxy';
import { toWhatsappJpeg } from '../../lib/whatsapp/to-jpeg';

/**
 * GET /whatsapp-image?u=…&s=… — la misma imagen del catálogo, en jpeg.
 *
 * Quien la descarga es META, no un navegador nuestro: cuando le mandamos un carrusel
 * o una imagen, Meta se baja cada URL y la valida. Por eso la ruta vive en la raíz y
 * no bajo `/store` (que exige la publishable key, que Meta no manda) ni `/admin`.
 *
 * Es pública pero no es un proxy abierto: `readJpegTarget` sólo devuelve una URL si
 * la firma la puso este backend. Ver `lib/whatsapp/image-proxy.ts`.
 *
 * Los errores devuelven 502 pelado y no redirigen al placeholder: si Meta no puede
 * bajar la imagen, rechaza el mensaje igual, y tapar el fallo con otra foto haría
 * que el carrusel saliera con la imagen equivocada en vez de avisar.
 */

/** Tope de descarga. Una foto de producto no llega ni cerca; una bomba de zip sí. */
const MAX_BYTES = 25 * 1024 * 1024;
const TIMEOUT_MS = 8_000;

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const target = readJpegTarget(req.query as { u?: unknown; s?: unknown });
  if (!target) {
    res.status(403).send('Firma inválida.');
    return;
  }

  try {
    const upstream = await fetch(target, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!upstream.ok) {
      res.status(502).send('No se pudo descargar la imagen original.');
      return;
    }
    const declared = Number(upstream.headers.get('content-length') ?? 0);
    if (declared > MAX_BYTES) {
      res.status(502).send('La imagen original es demasiado grande.');
      return;
    }
    const input = Buffer.from(await upstream.arrayBuffer());
    if (input.byteLength > MAX_BYTES) {
      res.status(502).send('La imagen original es demasiado grande.');
      return;
    }

    const jpeg = await toWhatsappJpeg(input);
    res.setHeader('Content-Type', 'image/jpeg');
    // La URL es inmutable: lleva la del archivo original, que es de contenido fijo
    // (el file module nombra cada subida con un id nuevo). Así Meta y cualquier CDN
    // del medio la cachean y la conversión se paga una vez.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(jpeg);
  } catch (error) {
    console.warn(
      `[WhatsApp imagen] No se pudo convertir ${target}: ${(error as Error)?.message ?? error}`,
    );
    res.status(502).send('No se pudo convertir la imagen.');
  }
}
