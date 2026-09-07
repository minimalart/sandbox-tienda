"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const utils_1 = require("@medusajs/framework/utils");
const media_library_1 = require("../../../../modules/media-library");
const filenameFromUrl = (url) => {
    try {
        const path = new URL(url).pathname;
        const seg = path.split('/').filter(Boolean).pop();
        return decodeURIComponent(seg || url);
    }
    catch {
        return url.split('/').pop() || url;
    }
};
// POST /admin/media-library/backfill — importa las imágenes actuales de los
// productos al catálogo (dedup por URL). Idempotente.
async function POST(req, res) {
    const query = req.scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const service = req.scope.resolve(media_library_1.MEDIA_LIBRARY_MODULE);
    const urls = new Set();
    const PAGE = 200;
    let offset = 0;
    for (;;) {
        const { data: products } = (await query.graph({
            entity: 'product',
            fields: ['id', 'images.url'],
            pagination: { skip: offset, take: PAGE },
        }));
        if (products.length === 0)
            break;
        for (const p of products) {
            for (const img of p.images ?? []) {
                if (img.url)
                    urls.add(img.url);
            }
        }
        offset += products.length;
        if (products.length < PAGE)
            break;
    }
    const allUrls = [...urls];
    const existing = await service.existingUrls(allUrls);
    let imported = 0;
    for (const url of allUrls) {
        if (existing.has(url))
            continue;
        await service.registerAsset({
            url,
            filename: filenameFromUrl(url),
            source: 'backfill:product',
        });
        imported++;
    }
    res.json({ imported, skipped: allUrls.length - imported, total: allUrls.length });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL21lZGlhLWxpYnJhcnkvYmFja2ZpbGwvcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFpQkEsb0JBcUNDO0FBckRELHFEQUFzRTtBQUN0RSxxRUFBeUU7QUFHekUsTUFBTSxlQUFlLEdBQUcsQ0FBQyxHQUFXLEVBQVUsRUFBRTtJQUM5QyxJQUFJLENBQUM7UUFDSCxNQUFNLElBQUksR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxRQUFRLENBQUM7UUFDbkMsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUM7UUFDbEQsT0FBTyxrQkFBa0IsQ0FBQyxHQUFHLElBQUksR0FBRyxDQUFDLENBQUM7SUFDeEMsQ0FBQztJQUFDLE1BQU0sQ0FBQztRQUNQLE9BQU8sR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUUsSUFBSSxHQUFHLENBQUM7SUFDckMsQ0FBQztBQUNILENBQUMsQ0FBQztBQUVGLDRFQUE0RTtBQUM1RSxzREFBc0Q7QUFDL0MsS0FBSyxVQUFVLElBQUksQ0FBQyxHQUFrQixFQUFFLEdBQW1CO0lBQ2hFLE1BQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLGlDQUF5QixDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ2pFLE1BQU0sT0FBTyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUE0QixvQ0FBb0IsQ0FBQyxDQUFDO0lBRW5GLE1BQU0sSUFBSSxHQUFHLElBQUksR0FBRyxFQUFVLENBQUM7SUFDL0IsTUFBTSxJQUFJLEdBQUcsR0FBRyxDQUFDO0lBQ2pCLElBQUksTUFBTSxHQUFHLENBQUMsQ0FBQztJQUNmLFNBQVMsQ0FBQztRQUNSLE1BQU0sRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLEdBQUcsQ0FBQyxNQUFNLEtBQUssQ0FBQyxLQUFLLENBQUM7WUFDNUMsTUFBTSxFQUFFLFNBQVM7WUFDakIsTUFBTSxFQUFFLENBQUMsSUFBSSxFQUFFLFlBQVksQ0FBQztZQUM1QixVQUFVLEVBQUUsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUU7U0FDekMsQ0FBQyxDQUFzRSxDQUFDO1FBQ3pFLElBQUksUUFBUSxDQUFDLE1BQU0sS0FBSyxDQUFDO1lBQUUsTUFBTTtRQUNqQyxLQUFLLE1BQU0sQ0FBQyxJQUFJLFFBQVEsRUFBRSxDQUFDO1lBQ3pCLEtBQUssTUFBTSxHQUFHLElBQUksQ0FBQyxDQUFDLE1BQU0sSUFBSSxFQUFFLEVBQUUsQ0FBQztnQkFDakMsSUFBSSxHQUFHLENBQUMsR0FBRztvQkFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUNqQyxDQUFDO1FBQ0gsQ0FBQztRQUNELE1BQU0sSUFBSSxRQUFRLENBQUMsTUFBTSxDQUFDO1FBQzFCLElBQUksUUFBUSxDQUFDLE1BQU0sR0FBRyxJQUFJO1lBQUUsTUFBTTtJQUNwQyxDQUFDO0lBRUQsTUFBTSxPQUFPLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDO0lBQzFCLE1BQU0sUUFBUSxHQUFHLE1BQU0sT0FBTyxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUNyRCxJQUFJLFFBQVEsR0FBRyxDQUFDLENBQUM7SUFDakIsS0FBSyxNQUFNLEdBQUcsSUFBSSxPQUFPLEVBQUUsQ0FBQztRQUMxQixJQUFJLFFBQVEsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDO1lBQUUsU0FBUztRQUNoQyxNQUFNLE9BQU8sQ0FBQyxhQUFhLENBQUM7WUFDMUIsR0FBRztZQUNILFFBQVEsRUFBRSxlQUFlLENBQUMsR0FBRyxDQUFDO1lBQzlCLE1BQU0sRUFBRSxrQkFBa0I7U0FDM0IsQ0FBQyxDQUFDO1FBQ0gsUUFBUSxFQUFFLENBQUM7SUFDYixDQUFDO0lBRUQsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsT0FBTyxDQUFDLE1BQU0sR0FBRyxRQUFRLEVBQUUsS0FBSyxFQUFFLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO0FBQ3BGLENBQUMifQ==