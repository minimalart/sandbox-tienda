import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

/**
 * Proxy same-origin para el editor de imágenes: descarga un asset (S3/CDN) y lo
 * re-sirve desde el mismo origen del admin, así el <canvas> no queda "tainted"
 * por CORS al hacer toBlob() sobre imágenes de S3 sin headers CORS.
 *
 * GET /admin/media-library/proxy?url=<asset_url>
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const url = req.query.url ? String(req.query.url) : '';
  if (!url || !/^https?:\/\//i.test(url)) {
    res.status(400).json({ message: 'url inválida' });
    return;
  }
  try {
    const upstream = await fetch(url);
    if (!upstream.ok) {
      res.status(upstream.status).json({ message: `No se pudo obtener el asset (${upstream.status})` });
      return;
    }
    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.status(200).send(buf);
  } catch (error) {
    res.status(502).json({ message: `Error al proxyear el asset: ${(error as Error).message}` });
  }
}
