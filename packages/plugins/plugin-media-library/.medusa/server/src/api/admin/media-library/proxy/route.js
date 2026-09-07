"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
/**
 * Proxy same-origin para el editor de imágenes: descarga un asset (S3/CDN) y lo
 * re-sirve desde el mismo origen del admin, así el <canvas> no queda "tainted"
 * por CORS al hacer toBlob() sobre imágenes de S3 sin headers CORS.
 *
 * GET /admin/media-library/proxy?url=<asset_url>
 */
async function GET(req, res) {
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
    }
    catch (error) {
        res.status(502).json({ message: `Error al proxyear el asset: ${error.message}` });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL21lZGlhLWxpYnJhcnkvcHJveHkvcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFTQSxrQkFvQkM7QUEzQkQ7Ozs7OztHQU1HO0FBQ0ksS0FBSyxVQUFVLEdBQUcsQ0FBQyxHQUFrQixFQUFFLEdBQW1CO0lBQy9ELE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO0lBQ3ZELElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7UUFDdkMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLEVBQUUsY0FBYyxFQUFFLENBQUMsQ0FBQztRQUNsRCxPQUFPO0lBQ1QsQ0FBQztJQUNELElBQUksQ0FBQztRQUNILE1BQU0sUUFBUSxHQUFHLE1BQU0sS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ2xDLElBQUksQ0FBQyxRQUFRLENBQUMsRUFBRSxFQUFFLENBQUM7WUFDakIsR0FBRyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLGdDQUFnQyxRQUFRLENBQUMsTUFBTSxHQUFHLEVBQUUsQ0FBQyxDQUFDO1lBQ2xHLE9BQU87UUFDVCxDQUFDO1FBQ0QsTUFBTSxXQUFXLEdBQUcsUUFBUSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLElBQUksMEJBQTBCLENBQUM7UUFDdkYsTUFBTSxHQUFHLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLFFBQVEsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDO1FBQ3RELEdBQUcsQ0FBQyxTQUFTLENBQUMsY0FBYyxFQUFFLFdBQVcsQ0FBQyxDQUFDO1FBQzNDLEdBQUcsQ0FBQyxTQUFTLENBQUMsZUFBZSxFQUFFLHNCQUFzQixDQUFDLENBQUM7UUFDdkQsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDNUIsQ0FBQztJQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7UUFDZixHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSwrQkFBZ0MsS0FBZSxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsQ0FBQztJQUMvRixDQUFDO0FBQ0gsQ0FBQyJ9