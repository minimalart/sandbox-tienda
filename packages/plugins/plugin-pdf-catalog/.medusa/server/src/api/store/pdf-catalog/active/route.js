"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const utils_1 = require("@medusajs/framework/utils");
const utils_2 = require("@medusajs/utils");
const pdf_catalog_1 = require("../../../../modules/pdf-catalog");
/**
 * Soft dependency: el módulo de store-config vive en el host. Se resuelve por
 * string en runtime y si no está registrado se trata como "feature apagada".
 * Es la misma semántica que tenía la extensión cuando el toggle era falsy.
 */
const STORE_CONFIG_MODULE = 'store_config';
const PDF_CATALOG_ENABLED_KEY = 'pdf_catalog_enabled';
const stockOf = (v) => {
    if (v.manage_inventory === false)
        return 999999;
    return (v.inventory_items ?? []).reduce((acc, it) => {
        const levels = it.inventory?.location_levels ?? [];
        return acc + levels.reduce((a, l) => a + (l.available_quantity || 0), 0);
    }, 0);
};
/**
 * GET /store/pdf-catalog/active — el catálogo PDF activo para el canal actual.
 *
 * Query: `sales_channel_id` (obligatorio para resolver el activo), `region_id`
 * (para el precio de los hotspots de producto).
 * - Si el toggle global está apagado → { catalog: null }.
 * - Si el canal no tiene catálogo activo o el activo no está publicado → { catalog: null }.
 * - Enriquece hotspots de producto con precio (según región) y stock.
 */
async function GET(req, res) {
    const salesChannelId = typeof req.query.sales_channel_id === 'string' ? req.query.sales_channel_id : undefined;
    const regionId = typeof req.query.region_id === 'string' ? req.query.region_id : undefined;
    // Toggle global — la feature está apagada por defecto y si el módulo de
    // store-config no está instalado tampoco hay flag que preguntar.
    let storeConfig = null;
    try {
        storeConfig = req.scope.resolve(STORE_CONFIG_MODULE);
    }
    catch {
        storeConfig = null;
    }
    const enabled = storeConfig?.getBooleanSetting
        ? await storeConfig.getBooleanSetting(PDF_CATALOG_ENABLED_KEY, false)
        : false;
    if (!enabled || !salesChannelId) {
        res.json({ catalog: null });
        return;
    }
    const service = req.scope.resolve(pdf_catalog_1.PDF_CATALOG_MODULE);
    // Fila de activación del canal → catálogo.
    const [channel] = await service.listPdfCatalogChannels({
        sales_channel_id: salesChannelId,
    });
    if (!channel) {
        res.json({ catalog: null });
        return;
    }
    const catalog = (await service.retrievePdfCatalog(channel.catalog_id, {
        relations: ['hotspots'],
    }));
    if (!catalog || !catalog.published) {
        res.json({ catalog: null });
        return;
    }
    const hotspots = (catalog.hotspots ?? [])
        .slice()
        .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
    // Enriquecer productos referenciados por hotspots de tipo product.
    const query = req.scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const { data: regions } = await query.graph({
        entity: 'region',
        fields: ['id', 'currency_code'],
        ...(regionId ? { filters: { id: regionId } } : {}),
    });
    const region = regions[0];
    const priceContext = (0, utils_2.QueryContext)({
        currency_code: region?.currency_code ?? 'ars',
        region_id: region?.id,
    });
    const productIds = Array.from(new Set(hotspots
        .filter((h) => h.type === 'product' && h.product_id)
        .map((h) => h.product_id)));
    let productMap = new Map();
    if (productIds.length) {
        const { data: products } = (await query.graph({
            entity: 'product',
            fields: [
                'id',
                'title',
                'handle',
                'thumbnail',
                'status',
                'variants.id',
                'variants.title',
                'variants.manage_inventory',
                'variants.options.value',
                'variants.options.option.id',
                'variants.options.option.title',
                'variants.calculated_price.calculated_amount',
                'variants.calculated_price.currency_code',
                'variants.inventory_items.inventory.location_levels.available_quantity',
            ],
            filters: { id: productIds, status: 'published' },
            context: { variants: { calculated_price: priceContext } },
        }));
        productMap = new Map(products.map((p) => [p.id, p]));
    }
    const enrichedHotspots = hotspots
        .map((h) => {
        const base = {
            id: h.id,
            type: h.type,
            page_index: Number(h.page_index ?? 0),
            pos_x: Number(h.pos_x ?? 50),
            pos_y: Number(h.pos_y ?? 50),
        };
        if (h.type === 'video' || h.type === 'text') {
            return { ...base, data: h.data ?? {} };
        }
        // product
        const product = productMap.get(h.product_id);
        if (!product)
            return null; // borrado / no publicado → se oculta
        const variants = (product.variants ?? []).map((v) => ({
            id: v.id,
            title: v.title,
            calculated_amount: v.calculated_price?.calculated_amount ?? null,
            currency_code: v.calculated_price?.currency_code ?? region?.currency_code ?? null,
            available: stockOf(v),
            options: (v.options ?? []).map((o) => ({
                value: o.value,
                option_id: o.option?.id,
                option_title: o.option?.title,
            })),
        }));
        const configuredVariantId = h.variant_id ?? null;
        const inStock = configuredVariantId
            ? (variants.find((v) => v.id === configuredVariantId)?.available ?? 0) > 0
            : variants.some((v) => v.available > 0);
        if (!inStock)
            return null;
        return {
            ...base,
            product: {
                product_id: product.id,
                variant_id: configuredVariantId,
                title: product.title,
                handle: product.handle,
                thumbnail: product.thumbnail ?? null,
                variants,
            },
        };
    })
        .filter(Boolean);
    res.json({
        catalog: {
            id: catalog.id,
            name: catalog.name,
            pdf_url: catalog.pdf_url,
            pages: Number(catalog.pages ?? 0),
            hotspots: enrichedHotspots,
        },
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL3BkZi1jYXRhbG9nL2FjdGl2ZS9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQXNEQSxrQkEwSkM7QUEvTUQscURBQXNFO0FBQ3RFLDJDQUErQztBQUMvQyxpRUFBcUU7QUFHckU7Ozs7R0FJRztBQUNILE1BQU0sbUJBQW1CLEdBQUcsY0FBYyxDQUFDO0FBQzNDLE1BQU0sdUJBQXVCLEdBQUcscUJBQXFCLENBQUM7QUF5QnRELE1BQU0sT0FBTyxHQUFHLENBQUMsQ0FBYSxFQUFVLEVBQUU7SUFDeEMsSUFBSSxDQUFDLENBQUMsZ0JBQWdCLEtBQUssS0FBSztRQUFFLE9BQU8sTUFBTSxDQUFDO0lBQ2hELE9BQU8sQ0FBQyxDQUFDLENBQUMsZUFBZSxJQUFJLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLEVBQUUsRUFBRTtRQUNsRCxNQUFNLE1BQU0sR0FBRyxFQUFFLENBQUMsU0FBUyxFQUFFLGVBQWUsSUFBSSxFQUFFLENBQUM7UUFDbkQsT0FBTyxHQUFHLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxrQkFBa0IsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUMzRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDUixDQUFDLENBQUM7QUFFRjs7Ozs7Ozs7R0FRRztBQUNJLEtBQUssVUFBVSxHQUFHLENBQUMsR0FBa0IsRUFBRSxHQUFtQjtJQUMvRCxNQUFNLGNBQWMsR0FDbEIsT0FBTyxHQUFHLENBQUMsS0FBSyxDQUFDLGdCQUFnQixLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENB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