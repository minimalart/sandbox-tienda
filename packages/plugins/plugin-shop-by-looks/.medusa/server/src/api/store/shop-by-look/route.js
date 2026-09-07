"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const utils_1 = require("@medusajs/framework/utils");
const utils_2 = require("@medusajs/utils");
const shop_by_look_1 = require("../../../modules/shop-by-look");
const foreign_modules_1 = require("../../../lib/foreign-modules");
const multistore_1 = require("../../../lib/multistore");
const stockOf = (v) => {
    if (v.manage_inventory === false)
        return 999999;
    return (v.inventory_items ?? []).reduce((acc, it) => {
        const levels = it.inventory?.location_levels ?? [];
        return acc + levels.reduce((a, l) => a + (l.available_quantity || 0), 0);
    }, 0);
};
const asIdArray = (value) => {
    if (!Array.isArray(value))
        return [];
    return value.filter((v) => typeof v === 'string' && v.length > 0);
};
/**
 * Un look aplica al contexto si su scope está vacío (global) o incluye el valor.
 * `strict` (contexto demo) descarta los globales: un look sin canal deja de verse
 * dentro de una demo para que muestre solo lo suyo (misma regla que el blog).
 */
const scopeMatches = (scope, current, strict = false) => {
    const ids = asIdArray(scope);
    if (ids.length === 0)
        return !strict;
    if (!current)
        return false;
    return ids.includes(current);
};
/**
 * GET /store/shop-by-look — looks activos para el canal/región actuales.
 *
 * Query: `sales_channel_id`, `region_id` (los manda el storefront).
 * - Si el toggle global está apagado → { looks: [] }.
 * - Filtra por segmentación (canal/región), enriquece productos con precio (según
 *   región) y stock, oculta productos sin stock / inexistentes, y descarta looks
 *   que se quedan sin productos válidos.
 */
async function GET(req, res) {
    const salesChannelId = typeof req.query.sales_channel_id === 'string' ? req.query.sales_channel_id : undefined;
    const regionId = typeof req.query.region_id === 'string' ? req.query.region_id : undefined;
    const strict = req.query.strict === '1' || req.query.strict === 'true';
    // El toggle de LA TIENDA, con fallback al global (`readSetting` es precedencia).
    // Sin `siteId` una tienda que apagó la sección la seguía viendo publicada porque
    // mandaba la fila de la instancia: el operador apaga, mira su sitio, y sigue ahí.
    //
    // OJO: el `sales_channel_id` de arriba, el que decide QUÉ looks se ven, sigue
    // saliendo del query param —lo declara el cliente— y eso NO se cierra acá. El
    // storefront lo pisa con la key confiable; migrar acá es un cambio pendiente y
    // está documentado en el host multistore (`store-routes.ts`).
    const storeConfig = req.scope.resolve(foreign_modules_1.STORE_CONFIG_MODULE);
    const enabled = await storeConfig.getBooleanSetting(foreign_modules_1.STORE_SETTING_KEYS.SHOP_BY_LOOK_ENABLED, false, await (0, multistore_1.siteIdFromPublishableKey)(req));
    if (!enabled) {
        res.json({ looks: [] });
        return;
    }
    const service = req.scope.resolve(shop_by_look_1.SHOP_BY_LOOK_MODULE);
    const looks = await service.listShopByLooks({ is_active: true }, { relations: ['products'], order: { sort_order: 'ASC', created_at: 'DESC' } });
    const applicable = looks.filter((look) => scopeMatches(look.sales_channel_ids, salesChannelId, strict) &&
        scopeMatches(look.region_ids, regionId));
    if (applicable.length === 0) {
        res.json({ looks: [] });
        return;
    }
    const query = req.scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    // Moneda para el contexto de precios (según región solicitada, con fallback).
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
    // Junta todos los product_id de todos los looks para una sola consulta.
    const allProductIds = Array.from(new Set(applicable.flatMap((look) => (look.products ?? []).map((p) => p.product_id))));
    let productMap = new Map();
    if (allProductIds.length) {
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
                'variants.options.id',
                'variants.options.value',
                'variants.options.option.id',
                'variants.options.option.title',
                'variants.calculated_price.calculated_amount',
                'variants.calculated_price.currency_code',
                'variants.inventory_items.inventory.location_levels.available_quantity',
            ],
            filters: { id: allProductIds, status: 'published' },
            context: { variants: { calculated_price: priceContext } },
        }));
        productMap = new Map(products.map((p) => [p.id, p]));
    }
    const enriched = applicable
        .map((look) => {
        const hotspots = (look.products ?? [])
            .slice()
            .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
        const products = hotspots
            .map((hs) => {
            const product = productMap.get(hs.product_id);
            if (!product)
                return null; // producto borrado / no publicado
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
            const configuredVariantId = hs.variant_id ?? null;
            // Stock: si hay variante configurada, mira esa; si no, cualquier variante con stock.
            const inStock = configuredVariantId
                ? (variants.find((v) => v.id === configuredVariantId)?.available ?? 0) > 0
                : variants.some((v) => v.available > 0);
            if (!inStock)
                return null; // PRD: productos sin stock se ocultan
            return {
                product_id: product.id,
                variant_id: configuredVariantId,
                pos_x: Number(hs.pos_x ?? 50),
                pos_y: Number(hs.pos_y ?? 50),
                title: product.title,
                handle: product.handle,
                thumbnail: product.thumbnail ?? null,
                variants,
            };
        })
            .filter(Boolean);
        return {
            id: look.id,
            title: look.title,
            subtitle: look.subtitle ?? null,
            cta_label: look.cta_label ?? null,
            image_url: look.image_url,
            image_alt: look.image_alt ?? null,
            placement: look.placement ?? 'after_featured',
            products,
        };
    })
        // PRD: un look sin productos válidos no se muestra.
        .filter((look) => look.products.length > 0);
    res.json({ looks: enriched });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL3Nob3AtYnktbG9vay9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQXFFQSxrQkF5SkM7QUE3TkQscURBQXNFO0FBQ3RFLDJDQUErQztBQUMvQyxnRUFBb0U7QUFFcEUsa0VBSXNDO0FBQ3RDLHdEQUFtRTtBQXFCbkUsTUFBTSxPQUFPLEdBQUcsQ0FBQyxDQUFhLEVBQVUsRUFBRTtJQUN4QyxJQUFJLENBQUMsQ0FBQyxnQkFBZ0IsS0FBSyxLQUFLO1FBQUUsT0FBTyxNQUFNLENBQUM7SUFDaEQsT0FBTyxDQUFDLENBQUMsQ0FBQyxlQUFlLElBQUksRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUUsRUFBRSxFQUFFO1FBQ2xELE1BQU0sTUFBTSxHQUFHLEVBQUUsQ0FBQyxTQUFTLEVBQUUsZUFBZSxJQUFJLEVBQUUsQ0FBQztRQUNuRCxPQUFPLEdBQUcsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLGtCQUFrQixJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQzNFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUNSLENBQUMsQ0FBQztBQUVGLE1BQU0sU0FBUyxHQUFHLENBQUMsS0FBYyxFQUFZLEVBQUU7SUFDN0MsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDO1FBQUUsT0FBTyxFQUFFLENBQUM7SUFDckMsT0FBTyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFlLEVBQUUsQ0FBQyxPQUFPLENBQUMsS0FBSyxRQUFRLElBQUksQ0FBQyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztBQUNqRixDQUFDLENBQUM7QUFFRjs7OztHQUlHO0FBQ0gsTUFBTSxZQUFZLEdBQUcsQ0FDbkIsS0FBYyxFQUNkLE9BQTJCLEVBQzNCLE1BQU0sR0FBRyxLQUFLLEVBQ0wsRUFBRTtJQUNYLE1BQU0sR0FBRyxHQUFHLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUM3QixJQUFJLEdBQUcsQ0FBQyxNQUFNLEtBQUssQ0FBQztRQUFFLE9BQU8sQ0FBQyxNQUFNLENBQUM7SUFDckMsSUFBSSxDQUFDLE9BQU87UUFBRSxPQUFPLEtBQUssQ0FBQztJQUMzQixPQUFPLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUM7QUFDL0IsQ0FBQyxDQUFDO0FBRUY7Ozs7Ozs7O0dBUUc7QUFDSSxLQUFLLFVBQVUsR0FBRyxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDL0QsTUFBTSxjQUFjLEdBQ2xCLE9BQU8sR0FBRyxDQUFDLEtBQUssQ0FBQyxnQkFBZ0IsS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztJQUMxRixNQUFNLFFBQVEsR0FBRyxPQUFPLEdBQUcsQ0FBQyxLQUFLLENBQUMsU0FBUyxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztJQUMzRixNQUFNLE1BQU0sR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLE1BQU0sS0FBSyxHQUFHLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxNQUFNLEtBQUssTUFBTSxDQUFDO0lBRXZFLGlGQUFpRjtJQUNqRixpRkFBaUY7SUFDakYsa0ZBQWtGO0lBQ2xGLEVBQUU7SUFDRiw4RUFBOEU7SUFDOUUsOEVBQThFO0lBQzlFLCtFQUErRTtJQUMvRSw4REFBOEQ7SUFDOUQsTUFBTSxXQUFXLEdBQW9CLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLHFDQUFtQixDQUFDLENBQUM7SUFDNUUsTUFBTSxPQUFPLEdBQUcsTUFBTSxXQUFXLENBQUMsaUJBQWlCLENBQ2pELG9DQUFrQixDQUFDLG9CQUFvQixFQUN2QyxLQUFLLEVBQ0wsTUFBTSxJQUFBLHFDQUF3QixFQUFDLEdBQUcsQ0FBQyxDQUNwQyxDQUFDO0lBQ0YsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ2IsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQ3hCLE9BQU87SUFDVCxDQUFDO0lBRUQsTUFBTSxPQUFPLEdBQTRCLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLGtDQUFtQixDQUFDLENBQUM7SUFDaEYsTUFBTSxLQUFLLEdBQUcsTUFBTSxPQUFPLENBQUMsZUFBZSxDQUN6QyxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsRUFDbkIsRUFBRSxTQUFTLEVBQUUsQ0FBQyxVQUFVLENBQUMsRUFBRSxLQUFLLEVBQUUsRUFBRSxVQUFVLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBRSxNQUFNLEVBQUUsRUFBRSxDQUM5RSxDQUFDO0lBRUYsTUFBTSxVQUFVLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FDN0IsQ0FBQyxJQUE2QixFQUFFLEVBQUUsQ0FDaEMsWUFBWSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxjQUFjLEVBQUUsTUFBTSxDQUFDO1FBQzVELFlBQVksQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLFFBQVEsQ0FBQyxDQUMxQyxDQUFDO0lBRUYsSUFBSSxVQUFVLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1FBQzVCLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUN4QixPQUFPO0lBQ1QsQ0FBQztJQUVELE1BQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLGlDQUF5QixDQUFDLEtBQUssQ0FBQyxDQUFDO0lBRWpFLDhFQUE4RTtJQUM5RSxNQUFNLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxHQUFHLE1BQU0sS0FBSyxDQUFDLEtBQUssQ0FBQztRQUMxQyxNQUFNLEVBQUUsUUFBUTtRQUNoQixNQUFNLEVBQUUsQ0FBQyxJQUFJLEVBQUUsZUFBZSxDQUFDO1FBQy9CLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLEVBQUUsT0FBTyxFQUFFLEVBQUUsRUFBRSxFQUFFLFFBQVEsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztLQUNuRCxDQUFDLENBQUM7SUFDSCxNQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFFMUIsTUFBTSxZQUFZLEdBQUcsSUFBQSxvQkFBWSxFQUFDO1FBQ2hDLGFBQWEsRUFBRSxNQUFNLEVBQUUsYUFBYSxJQUFJLEtBQUs7UUFDN0MsU0FBUyxFQUFFLE1BQU0sRUFBRSxFQUFFO0tBQ3RCLENBQUMsQ0FBQztJQUVILHdFQUF3RTtJQUN4RSxNQUFNLGFBQWEsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUM5QixJQUFJLEdBQUcsQ0FDTCxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBNkIsRUFBRSxFQUFFLENBQ25ELENBQUUsSUFBSSxDQUFDLFFBQTBDLElBQUksRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQ2xGLENBQ0YsQ0FDRixDQUFDO0lBRUYsSUFBSSxVQUFVLEdBQUcsSUFBSSxHQUFHLEVBQXNCLENBQUM7SUFDL0MsSUFBSSxhQUFhLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDekIsTUFBTSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsR0FBRyxDQUFDLE1BQU0sS0FBSyxDQUFDLEtBQUssQ0FBQztZQUM1QyxNQUFNLEVBQUUsU0FBUztZQUNqQixNQUFNLEVBQUU7Z0JBQ04sSUFBSTtnQkFDSixPQUFPO2dCQUNQLFFBQVE7Z0JBQ1IsV0FBVztnQkFDWCxRQUFRO2dCQUNSLGFBQWE7Z0JBQ2IsZ0JBQWdCO2dCQUNoQiwyQkFBMkI7Z0JBQzNCLHFCQUFxQjtnQkFDckIsd0JBQXdCO2dCQUN4Qiw0QkFBNEI7Z0JBQzVCLCtCQUErQjtnQkFDL0IsNkNBQTZDO2dCQUM3Qyx5Q0FBeUM7Z0JBQ3pDLHVFQUF1RTthQUN4RTtZQUNELE9BQU8sRUFBRSxFQUFFLEVBQUUsRUFBRSxhQUFhLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRTtZQUNuRCxPQUFPLEVBQUUsRUFBRSxRQUFRLEVBQUUsRUFBRSxnQkFBZ0IsRUFBRSxZQUFZLEVBQUUsRUFBRTtTQUMxRCxDQUFDLENBQTJCLENBQUM7UUFDOUIsVUFBVSxHQUFHLElBQUksR0FBRyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDdkQsQ0FBQztJQUVELE1BQU0sUUFBUSxHQUFHLFVBQVU7U0FDeEIsR0FBRyxDQUFDLENBQUMsSUFBNkIsRUFBRSxFQUFFO1FBQ3JDLE1BQU0sUUFBUSxHQUFHLENBQUUsSUFBSSxDQUFDLFFBQTJDLElBQUksRUFBRSxDQUFDO2FBQ3ZFLEtBQUssRUFBRTthQUNQLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsVUFBVSxJQUFJLENBQUMsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsVUFBVSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFekUsTUFBTSxRQUFRLEdBQUcsUUFBUTthQUN0QixHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRTtZQUNWLE1BQU0sT0FBTyxHQUFHLFVBQVUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLFVBQW9CLENBQUMsQ0FBQztZQUN4RCxJQUFJLENBQUMsT0FBTztnQkFBRSxPQUFPLElBQUksQ0FBQyxDQUFDLGtDQUFrQztZQUU3RCxNQUFNLFFBQVEsR0FBRyxDQUFDLE9BQU8sQ0FBQyxRQUFRLElBQUksRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO2dCQUNwRCxFQUFFLEVBQUUsQ0FBQyxDQUFDLEVBQUU7Z0JBQ1IsS0FBSyxFQUFFLENBQUMsQ0FBQyxLQUFLO2dCQUNkLGlCQUFpQixFQUFFLENBQUMsQ0FBQyxnQkFBZ0IsRUFBRSxpQkFBaUIsSUFBSSxJQUFJO2dCQUNoRSxhQUFhLEVBQUUsQ0FBQyxDQUFDLGdCQUFnQixFQUFFLGFBQWEsSUFBSSxNQUFNLEVBQUUsYUFBYSxJQUFJLElBQUk7Z0JBQ2pGLFNBQVMsRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDO2dCQUNyQixPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztvQkFDckMsS0FBSyxFQUFFLENBQUMsQ0FBQyxLQUFLO29CQUNkLFNBQVMsRUFBRSxDQUFDLENBQUMsTUFBTSxFQUFFLEVBQUU7b0JBQ3ZCLFlBQVksRUFBRSxDQUFDLENBQUMsTUFBTSxFQUFFLEtBQUs7aUJBQzlCLENBQUMsQ0FBQzthQUNKLENBQUMsQ0FBQyxDQUFDO1lBRUosTUFBTSxtQkFBbUIsR0FBSSxFQUFFLENBQUMsVUFBNEIsSUFBSSxJQUFJLENBQUM7WUFFckUscUZBQXFGO1lBQ3JGLE1BQU0sT0FBTyxHQUFHLG1CQUFtQjtnQkFDakMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxtQkFBbUIsQ0FBQyxFQUFFLFNBQVMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDO2dCQUMxRSxDQUFDLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUMsQ0FBQztZQUMxQyxJQUFJLENBQUMsT0FBTztnQkFBRSxPQUFPLElBQUksQ0FBQyxDQUFDLHNDQUFzQztZQUVqRSxPQUFPO2dCQUNMLFVBQVUsRUFBRSxPQUFPLENBQUMsRUFBRTtnQkFDdEIsVUFBVSxFQUFFLG1CQUFtQjtnQkFDL0IsS0FBSyxFQUFFLE1BQU0sQ0FBQyxFQUFFLENBQUMsS0FBSyxJQUFJLEVBQUUsQ0FBQztnQkFDN0IsS0FBSyxFQUFFLE1BQU0sQ0FBQyxFQUFFLENBQUMsS0FBSyxJQUFJLEVBQUUsQ0FBQztnQkFDN0IsS0FBSyxFQUFFLE9BQU8sQ0FBQyxLQUFLO2dCQUNwQixNQUFNLEVBQUUsT0FBTyxDQUFDLE1BQU07Z0JBQ3RCLFNBQVMsRUFBRSxPQUFPLENBQUMsU0FBUyxJQUFJLElBQUk7Z0JBQ3BDLFFBQVE7YUFDVCxDQUFDO1FBQ0osQ0FBQyxDQUFDO2FBQ0QsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBRW5CLE9BQU87WUFDTCxFQUFFLEVBQUUsSUFBSSxDQUFDLEVBQUU7WUFDWCxLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUs7WUFDakIsUUFBUSxFQUFFLElBQUksQ0FBQyxRQUFRLElBQUksSUFBSTtZQUMvQixTQUFTLEVBQUUsSUFBSSxDQUFDLFNBQVMsSUFBSSxJQUFJO1lBQ2pDLFNBQVMsRUFBRSxJQUFJLENBQUMsU0FBUztZQUN6QixTQUFTLEVBQUUsSUFBSSxDQUFDLFNBQVMsSUFBSSxJQUFJO1lBQ2pDLFNBQVMsRUFBRSxJQUFJLENBQUMsU0FBUyxJQUFJLGdCQUFnQjtZQUM3QyxRQUFRO1NBQ1QsQ0FBQztJQUNKLENBQUMsQ0FBQztRQUNGLG9EQUFvRDtTQUNuRCxNQUFNLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBRTlDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFLENBQUMsQ0FBQztBQUNoQyxDQUFDIn0=