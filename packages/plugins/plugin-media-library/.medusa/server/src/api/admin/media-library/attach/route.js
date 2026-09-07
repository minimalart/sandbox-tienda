"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const utils_1 = require("@medusajs/framework/utils");
const media_library_1 = require("../../../../modules/media-library");
const validators_1 = require("../validators");
/**
 * Agrega imágenes de la Biblioteca a un producto: mergea con las actuales,
 * dedup por URL (no agrega las que ya tiene), mantiene las existentes.
 */
async function POST(req, res) {
    const parsed = validators_1.PostAttach.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Datos inválidos' });
        return;
    }
    const { product_id, asset_ids } = parsed.data;
    const library = req.scope.resolve(media_library_1.MEDIA_LIBRARY_MODULE);
    const assets = await library.listMediaAssets({ id: asset_ids });
    if (!assets.length) {
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_FOUND, 'No se encontraron assets.');
    }
    const productService = req.scope.resolve(utils_1.Modules.PRODUCT);
    const product = await productService.retrieveProduct(product_id, {
        relations: ['images'],
    });
    const current = (product.images ?? []);
    const currentUrls = new Set(current.map((i) => i.url));
    const toAdd = assets
        .map((a) => a.url)
        .filter((url) => url && !currentUrls.has(url));
    if (toAdd.length === 0) {
        res.json({ added: 0, total: current.length, message: 'Ya estaban todas en el producto.' });
        return;
    }
    // Preservar las actuales (con id) + agregar las nuevas (solo url).
    const images = [
        ...current.map((i) => ({ id: i.id, url: i.url })),
        ...toAdd.map((url) => ({ url })),
    ];
    await productService.updateProducts(product_id, { images });
    res.json({ added: toAdd.length, total: images.length });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL21lZGlhLWxpYnJhcnkvYXR0YWNoL3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBVUEsb0JBd0NDO0FBakRELHFEQUFpRTtBQUNqRSxxRUFBeUU7QUFFekUsOENBQTJDO0FBRTNDOzs7R0FHRztBQUNJLEtBQUssVUFBVSxJQUFJLENBQUMsR0FBa0IsRUFBRSxHQUFtQjtJQUNoRSxNQUFNLE1BQU0sR0FBRyx1QkFBVSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDOUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUNwQixHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxNQUFNLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxPQUFPLElBQUksaUJBQWlCLEVBQUUsQ0FBQyxDQUFDO1FBQ3hGLE9BQU87SUFDVCxDQUFDO0lBQ0QsTUFBTSxFQUFFLFVBQVUsRUFBRSxTQUFTLEVBQUUsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDO0lBRTlDLE1BQU0sT0FBTyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUE0QixvQ0FBb0IsQ0FBQyxDQUFDO0lBQ25GLE1BQU0sTUFBTSxHQUFHLE1BQU0sT0FBTyxDQUFDLGVBQWUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDO0lBQ2hFLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDbkIsTUFBTSxJQUFJLG1CQUFXLENBQUMsbUJBQVcsQ0FBQyxLQUFLLENBQUMsU0FBUyxFQUFFLDJCQUEyQixDQUFDLENBQUM7SUFDbEYsQ0FBQztJQUVELE1BQU0sY0FBYyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLGVBQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUMxRCxNQUFNLE9BQU8sR0FBRyxNQUFNLGNBQWMsQ0FBQyxlQUFlLENBQUMsVUFBVSxFQUFFO1FBQy9ELFNBQVMsRUFBRSxDQUFDLFFBQVEsQ0FBQztLQUN0QixDQUFDLENBQUM7SUFFSCxNQUFNLE9BQU8sR0FBRyxDQUFDLE9BQU8sQ0FBQyxNQUFNLElBQUksRUFBRSxDQUF1QyxDQUFDO0lBQzdFLE1BQU0sV0FBVyxHQUFHLElBQUksR0FBRyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBRXZELE1BQU0sS0FBSyxHQUFHLE1BQU07U0FDakIsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBYSxDQUFDO1NBQzNCLE1BQU0sQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBRWpELElBQUksS0FBSyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztRQUN2QixHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDLE1BQU0sRUFBRSxPQUFPLEVBQUUsa0NBQWtDLEVBQUUsQ0FBQyxDQUFDO1FBQzNGLE9BQU87SUFDVCxDQUFDO0lBRUQsbUVBQW1FO0lBQ25FLE1BQU0sTUFBTSxHQUFHO1FBQ2IsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO1FBQ2pELEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUM7S0FDakMsQ0FBQztJQUVGLE1BQU0sY0FBYyxDQUFDLGNBQWMsQ0FBQyxVQUFVLEVBQUUsRUFBRSxNQUFNLEVBQVMsQ0FBQyxDQUFDO0lBRW5FLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7QUFDMUQsQ0FBQyJ9