"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toSiteRef = void 0;
exports.resolveSite = resolveSite;
exports.siteIdOfChannel = siteIdOfChannel;
exports.listSites = listSites;
const module_key_1 = require("./module-key");
/** Postgres: `relation "..." does not exist`. La tabla puede no existir todavía. */
const UNDEFINED_TABLE = '42P01';
const isUndefinedTable = (error) => typeof error === 'object' && error !== null && error.code === UNDEFINED_TABLE;
const toSiteRef = (row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    is_main: Boolean(row.is_main),
    // Los DOS canales. Ver la nota de `SiteRef.channel_ids` en types.ts.
    channel_ids: [...new Set([row.sales_channel_id, row.b2b_sales_channel_id].filter(Boolean))],
    region_id: row.region_id ?? null,
    stock_location_id: row.stock_location_id ?? null,
});
exports.toSiteRef = toSiteRef;
/** Resuelve el módulo por string literal. Ver `module-key.ts`. */
function resolveService(container) {
    try {
        return container.resolve(module_key_1.SITE_REGISTRY_MODULE);
    }
    catch {
        return null;
    }
}
async function findOne(service, filters) {
    try {
        const rows = await service.listDemoStores(filters, { take: 1 });
        return rows?.[0] ?? null;
    }
    catch (error) {
        if (isUndefinedTable(error))
            return 'table-missing';
        throw error;
    }
}
/** Deriva el canal de una orden o un carrito, best-effort. */
async function channelOfEntity(container, hint) {
    const { Modules } = await import('@medusajs/framework/utils');
    try {
        if (hint.orderId) {
            const orders = container.resolve(Modules.ORDER);
            const order = await orders.retrieveOrder(hint.orderId, { select: ['sales_channel_id'] });
            return order?.sales_channel_id ?? null;
        }
        if (hint.cartId) {
            const carts = container.resolve(Modules.CART);
            const cart = await carts.retrieveCart(hint.cartId, { select: ['sales_channel_id'] });
            return cart?.sales_channel_id ?? null;
        }
    }
    catch {
        // Entidad inexistente o módulo ausente: la pista no aporta, se sigue.
    }
    return null;
}
/**
 * Resuelve la tienda a partir de las pistas disponibles.
 *
 * Orden: `siteId` → `slug` → `salesChannelId` (matcheando AMBAS columnas de canal)
 * → `orderId`/`cartId` → `is_main` (sólo con `allowMainFallback`) → `allSites`.
 *
 * Nunca tira por una pista que no matchea un formato esperado: la única forma de
 * terminar en `unknownSite` es haber pedido una tienda concreta que no existe.
 */
async function resolveSite(container, hint = {}) {
    const service = resolveService(container);
    if (!service)
        return { status: 'registryAbsent', reason: 'module' };
    const asked = Boolean(hint.siteId || hint.slug);
    const lookups = [];
    if (hint.siteId)
        lookups.push({ id: hint.siteId });
    if (hint.slug)
        lookups.push({ slug: hint.slug });
    if (hint.salesChannelId) {
        // Ambas columnas: una tienda B2B tiene dos canales.
        lookups.push({
            $or: [{ sales_channel_id: hint.salesChannelId }, { b2b_sales_channel_id: hint.salesChannelId }],
        });
    }
    for (const filters of lookups) {
        const row = await findOne(service, filters);
        if (row === 'table-missing')
            return { status: 'registryAbsent', reason: 'table' };
        if (row)
            return { status: 'site', site: (0, exports.toSiteRef)(row) };
    }
    // Pistas indirectas: sólo si no pidieron una tienda concreta.
    if (!asked) {
        const channelId = await channelOfEntity(container, hint);
        if (channelId) {
            const row = await findOne(service, {
                $or: [{ sales_channel_id: channelId }, { b2b_sales_channel_id: channelId }],
            });
            if (row === 'table-missing')
                return { status: 'registryAbsent', reason: 'table' };
            if (row)
                return { status: 'site', site: (0, exports.toSiteRef)(row) };
        }
    }
    // Cuántas tiendas hay: distingue "registro vacío" de "una sola" de "no matcheó".
    let all;
    try {
        all = (await service.listDemoStores({}, { take: 2 })) ?? [];
    }
    catch (error) {
        if (isUndefinedTable(error))
            return { status: 'registryAbsent', reason: 'table' };
        throw error;
    }
    if (all.length === 0)
        return { status: 'registryAbsent', reason: 'empty' };
    // Pidieron una tienda concreta y no existe (o fue borrada): romper, no degradar.
    if (asked)
        return { status: 'unknownSite', hint };
    if (all.length === 1)
        return { status: 'singleSite', site: (0, exports.toSiteRef)(all[0]) };
    if (hint.allowMainFallback) {
        const row = await findOne(service, { is_main: true });
        if (row && row !== 'table-missing')
            return { status: 'site', site: (0, exports.toSiteRef)(row) };
    }
    return { status: 'allSites' };
}
/**
 * El `site_id` de un canal, o `null` si no hay eje de tienda que aplicar.
 *
 * Es el puente que necesita todo el trabajo SIN request: un `order.placed` trae
 * `sales_channel_id`, pero las tablas que llevan tienda propia —`loyalty_program`,
 * `gift_card_settings`— se filtran por `site_id`. Traducir a mano en cada call site
 * es exactamente cómo aparecen las variantes: una que colapsa `singleSite` en la
 * tienda y otra que no, y las dos "funcionan" hasta que hay dos tiendas.
 *
 * `null` significa LA FILA GLOBAL (`site_id IS NULL`), no "la principal". Se llega
 * ahí con `singleSite`, `allSites` y `registryAbsent`, y es deliberado: con una sola
 * tienda —o sin registro— la global no es "la de otra", es la única que hay. Es el
 * mismo criterio que `pickBySitePrecedence` con `inherit-global`, y el que ya usan
 * `siteOf(req)` en el admin y `store/gift-card-experience/designs`.
 *
 * `unknownSite` también cae en `null` y NO rompe: acá no hay operador que eligió mal
 * una tienda —hay una orden ya cobrada— y abortar el earn o la emisión por un canal
 * huérfano sería castigar al cliente por una fila del registro.
 */
async function siteIdOfChannel(container, salesChannelId) {
    if (!salesChannelId)
        return null;
    const resolution = await resolveSite(container, { salesChannelId });
    return resolution.status === 'site' ? resolution.site.id : null;
}
/** Todas las tiendas. Lo usan los jobs que hacen fan-out. */
async function listSites(container, options = {}) {
    const service = resolveService(container);
    if (!service)
        return [];
    try {
        const rows = (await service.listDemoStores({}, {})) ?? [];
        const refs = rows.map(exports.toSiteRef);
        return options.includeMain === false ? refs.filter((site) => !site.is_main) : refs;
    }
    catch (error) {
        if (isUndefinedTable(error))
            return [];
        throw error;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb2x2ZS1zaXRlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL2xpYi9tdWx0aXN0b3JlL3Jlc29sdmUtc2l0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFrR0Esa0NBMkRDO0FBcUJELDBDQU9DO0FBR0QsOEJBY0M7QUF6TUQsNkNBQW9EO0FBc0JwRCxvRkFBb0Y7QUFDcEYsTUFBTSxlQUFlLEdBQUcsT0FBTyxDQUFDO0FBRWhDLE1BQU0sZ0JBQWdCLEdBQUcsQ0FBQyxLQUFjLEVBQVcsRUFBRSxDQUNuRCxPQUFPLEtBQUssS0FBSyxRQUFRLElBQUksS0FBSyxLQUFLLElBQUksSUFBSyxLQUEyQixDQUFDLElBQUksS0FBSyxlQUFlLENBQUM7QUFFaEcsTUFBTSxTQUFTLEdBQUcsQ0FBQyxHQUFZLEVBQVcsRUFBRSxDQUFDLENBQUM7SUFDbkQsRUFBRSxFQUFFLEdBQUcsQ0FBQyxFQUFFO0lBQ1YsSUFBSSxFQUFFLEdBQUcsQ0FBQyxJQUFJO0lBQ2QsSUFBSSxFQUFFLEdBQUcsQ0FBQyxJQUFJO0lBQ2QsT0FBTyxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDO0lBQzdCLHFFQUFxRTtJQUNyRSxXQUFXLEVBQUUsQ0FBQyxHQUFHLElBQUksR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLGdCQUFnQixFQUFFLEdBQUcsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFhO0lBQ3ZHLFNBQVMsRUFBRSxHQUFHLENBQUMsU0FBUyxJQUFJLElBQUk7SUFDaEMsaUJBQWlCLEVBQUUsR0FBRyxDQUFDLGlCQUFpQixJQUFJLElBQUk7Q0FDakQsQ0FBQyxDQUFDO0FBVFUsUUFBQSxTQUFTLGFBU25CO0FBTUgsa0VBQWtFO0FBQ2xFLFNBQVMsY0FBYyxDQUFDLFNBQTBCO0lBQ2hELElBQUksQ0FBQztRQUNILE9BQU8sU0FBUyxDQUFDLE9BQU8sQ0FBQyxpQ0FB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