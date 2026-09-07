"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const brand_1 = require("../../../modules/brand");
async function GET(req, res) {
    const brandService = req.scope.resolve(brand_1.BRAND_MODULE);
    const salesChannelId = typeof req.query.sales_channel_id === 'string' ? req.query.sales_channel_id : undefined;
    const strict = req.query.strict === '1' || req.query.strict === 'true';
    const allBrands = await brandService.listBrands({
        is_active: true,
    });
    // Visibilidad por canal (misma regla que el blog, ver isPostInSalesChannel):
    // `sales_channel_ids` vacío = global (visible en todos, incl. store principal);
    // no vacío = solo en esos canales; `strict` (contexto demo) además oculta los
    // globales para que una demo muestre solo lo suyo.
    const inScope = (brand) => {
        if (!salesChannelId)
            return true;
        const ids = brand.sales_channel_ids;
        const scoped = Array.isArray(ids) && ids.length > 0;
        if (scoped)
            return ids.includes(salesChannelId);
        return !strict;
    };
    const brands = allBrands.filter(inScope);
    if (brands.length === 0) {
        res.status(200).json({ brands: [] });
        return;
    }
    // Adjuntamos las imágenes inline en UNA sola query. Antes el storefront hacía
    // un fetch por marca a /store/brands/:id/images: con ~870 marcas seedeadas eso
    // son ~870 requests por render, que bajo carga fallan parcialmente y hacían que
    // "solo aparezca 1 marca" en la home. brand_image no es relación navegable
    // desde brand (sólo guarda brand_id), así que las traemos por separado y las
    // agrupamos por brand_id.
    const query = req.scope.resolve('query');
    const { data: brandImages } = await query.graph({
        entity: 'brand_image',
        fields: ['id', 'url', 'file_id', 'type', 'brand_id'],
        filters: { brand_id: brands.map((brand) => brand.id) },
    });
    const imagesByBrand = new Map();
    for (const image of brandImages) {
        const list = imagesByBrand.get(image.brand_id) ?? [];
        list.push(image);
        imagesByBrand.set(image.brand_id, list);
    }
    const brandsWithImages = brands.map((brand) => ({
        ...brand,
        images: imagesByBrand.get(brand.id) ?? [],
    }));
    res.status(200).json({ brands: brandsWithImages });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL2JyYW5kcy9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUlBLGtCQXVEQztBQTFERCxrREFBc0Q7QUFHL0MsS0FBSyxVQUFVLEdBQUcsQ0FBQyxHQUFrQixFQUFFLEdBQW1CO0lBQy9ELE1BQU0sWUFBWSxHQUF1QixHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxvQkFBWSxDQUFDLENBQUM7SUFFekUsTUFBTSxjQUFjLEdBQ2xCLE9BQU8sR0FBRyxDQUFDLEtBQUssQ0FBQyxnQkFBZ0IsS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztJQUMxRixNQUFNLE1BQU0sR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLE1BQU0sS0FBSyxHQUFHLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxNQUFNLEtBQUssTUFBTSxDQUFDO0lBRXZFLE1BQU0sU0FBUyxHQUFHLE1BQU0sWUFBWSxDQUFDLFVBQVUsQ0FBQztRQUM5QyxTQUFTLEVBQUUsSUFBSTtLQUNoQixDQUFDLENBQUM7SUFFSCw2RUFBNkU7SUFDN0UsZ0ZBQWdGO0lBQ2hGLDhFQUE4RTtJQUM5RSxtREFBbUQ7SUFDbkQsTUFBTSxPQUFPLEdBQUcsQ0FBQyxLQUEwQixFQUFXLEVBQUU7UUFDdEQsSUFBSSxDQUFDLGNBQWM7WUFBRSxPQUFPLElBQUksQ0FBQztRQUNqQyxNQUFNLEdBQUcsR0FBSSxLQUFhLENBQUMsaUJBQWlCLENBQUM7UUFDN0MsTUFBTSxNQUFNLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxHQUFHLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztRQUNwRCxJQUFJLE1BQU07WUFBRSxPQUFRLEdBQWdCLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQzlELE9BQU8sQ0FBQyxNQUFNLENBQUM7SUFDakIsQ0FBQyxDQUFDO0lBQ0YsTUFBTSxNQUFNLEdBQUcsU0FBUyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUV6QyxJQUFJLE1BQU0sQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7UUFDeEIsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxNQUFNLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUNyQyxPQUFPO0lBQ1QsQ0FBQztJQUVELDhFQUE4RTtJQUM5RSwrRUFBK0U7SUFDL0UsZ0ZBQWdGO0lBQ2hGLDJFQUEyRTtJQUMzRSw2RUFBNkU7SUFDN0UsMEJBQTBCO0lBQzFCLE1BQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ3pDLE1BQU0sRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFLEdBQUcsTUFBTSxLQUFLLENBQUMsS0FBSyxDQUFDO1FBQzlDLE1BQU0sRUFBRSxhQUFhO1FBQ3JCLE1BQU0sRUFBRSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxVQUFVLENBQUM7UUFDcEQsT0FBTyxFQUFFLEVBQUUsUUFBUSxFQUFFLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsRUFBRTtLQUN2RCxDQUFDLENBQUM7SUFFSCxNQUFNLGFBQWEsR0FBRyxJQUFJLEdBQUcsRUFBOEIsQ0FBQztJQUM1RCxLQUFLLE1BQU0sS0FBSyxJQUFJLFdBQVcsRUFBRSxDQUFDO1FBQ2hDLE1BQU0sSUFBSSxHQUFHLGFBQWEsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNyRCxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ2pCLGFBQWEsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUMxQyxDQUFDO0lBRUQsTUFBTSxnQkFBZ0IsR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQzlDLEdBQUcsS0FBSztRQUNSLE1BQU0sRUFBRSxhQUFhLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFO0tBQzFDLENBQUMsQ0FBQyxDQUFDO0lBRUosR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxNQUFNLEVBQUUsZ0JBQWdCLEVBQUUsQ0FBQyxDQUFDO0FBQ3JELENBQUMifQ==