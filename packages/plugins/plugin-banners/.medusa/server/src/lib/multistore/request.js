"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.siteHintOf = exports.attachSiteHint = exports.ALL_SITES = exports.SITE_SLUG_HEADER = exports.SITE_ID_HEADER = void 0;
exports.siteFromRequest = siteFromRequest;
const resolve_site_1 = require("./resolve-site");
/**
 * Puente entre una request HTTP y el seam multitienda.
 *
 * El middleware NO hace I/O: sólo parsea headers y cuelga las pistas. El lookup es
 * perezoso —lo dispara la primera ruta que pregunte— y memoizado por request, así
 * cinco helpers en el mismo handler no producen cinco queries.
 */
/** Se memoiza la PROMESA, no el valor: si no, dos llamadas concurrentes hacen dos queries. */
const HINT = Symbol.for('multistore.hint');
const PENDING = Symbol.for('multistore.pending');
/** El admin manda el id, que es inmutable. El slug se acepta sólo para debug con curl. */
exports.SITE_ID_HEADER = 'x-site-id';
exports.SITE_SLUG_HEADER = 'x-site-slug';
/** Valor explícito para "todas las tiendas". Ver la nota de abajo. */
exports.ALL_SITES = '*';
const headerValue = (req, name) => {
    const raw = req.headers?.[name];
    const value = Array.isArray(raw) ? raw[0] : raw;
    const trimmed = typeof value === 'string' ? value.trim() : '';
    return trimmed.length > 0 ? trimmed : null;
};
/**
 * Cuelga las pistas de la request. Registrado para `/admin/*`.
 *
 * `x-site-id: *` es explícito y NO es lo mismo que no mandar el header, aunque hoy
 * los dos resuelvan a `allSites`: distinguirlos es lo que va a permitir prender
 * fail-closed más adelante sin romper a quien todavía no manda nada.
 *
 * `allowMainFallback` es SIEMPRE false en el admin: "sin tienda elegida" significa
 * "todas", no "la principal". Un operador de tres tiendas que ve sólo la principal
 * sin haberlo pedido está viendo un tercio de su data sin ninguna señal.
 */
const attachSiteHint = (req, _res, next) => {
    const rawId = headerValue(req, exports.SITE_ID_HEADER);
    const carrier = req;
    carrier[HINT] = {
        siteId: rawId === exports.ALL_SITES ? null : rawId,
        slug: headerValue(req, exports.SITE_SLUG_HEADER),
        allowMainFallback: false,
    };
    return next();
};
exports.attachSiteHint = attachSiteHint;
/**
 * La tienda de esta request. Perezoso y memoizado.
 *
 * Deliberadamente NO deriva de `orderId`/`cartId` en el admin: eso haría que una
 * pantalla de detalle "esté de acuerdo" con la fila que muestra en vez de con lo que
 * el operador eligió, y escondería justo el caso que querés ver — una orden que
 * pertenece a otra tienda.
 */
function siteFromRequest(req) {
    const carrier = req;
    const pending = carrier[PENDING];
    if (pending)
        return pending;
    const hint = carrier[HINT] ?? { allowMainFallback: false };
    const promise = (0, resolve_site_1.resolveSite)(req.scope, hint);
    carrier[PENDING] = promise;
    return promise;
}
/** Sólo para tests: leer las pistas sin disparar el lookup. */
const siteHintOf = (req) => req[HINT];
exports.siteHintOf = siteHintOf;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVxdWVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9saWIvbXVsdGlzdG9yZS9yZXF1ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQXVFQSwwQ0FTQztBQS9FRCxpREFBNkM7QUFHN0M7Ozs7OztHQU1HO0FBRUgsOEZBQThGO0FBQzlGLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsaUJBQWlCLENBQUMsQ0FBQztBQUMzQyxNQUFNLE9BQU8sR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLG9CQUFvQixDQUFDLENBQUM7QUFPakQsMEZBQTBGO0FBQzdFLFFBQUEsY0FBYyxHQUFHLFdBQVcsQ0FBQztBQUM3QixRQUFBLGdCQUFnQixHQUFHLGFBQWEsQ0FBQztBQUU5QyxzRUFBc0U7QUFDekQsUUFBQSxTQUFTLEdBQUcsR0FBRyxDQUFDO0FBRTdCLE1BQU0sV0FBVyxHQUFHLENBQUMsR0FBa0IsRUFBRSxJQUFZLEVBQWlCLEVBQUU7SUFDdEUsTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLE9BQU8sRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ2hDLE1BQU0sS0FBSyxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDO0lBQ2hELE1BQU0sT0FBTyxHQUFHLE9BQU8sS0FBSyxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7SUFDOUQsT0FBTyxPQUFPLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7QUFDN0MsQ0FBQyxDQUFDO0FBRUY7Ozs7Ozs7Ozs7R0FVRztBQUNJLE1BQU0sY0FBYyxHQUFHLENBQzVCLEdBQWtCLEVBQ2xCLElBQW9CLEVBQ3BCLElBQXdCLEVBQ3hCLEVBQUU7SUFDRixNQUFNLEtBQUssR0FBRyxXQUFXLENBQUMsR0FBRyxFQUFFLHNCQUFjLENBQUMsQ0FBQztJQUMvQyxNQUFNLE9BQU8sR0FBRyxHQUF5QixDQUFDO0lBRTFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRztRQUNkLE1BQU0sRUFBRSxLQUFLLEtBQUssaUJBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLO1FBQzFDLElBQUksRUFBRSxXQUFXLENBQUMsR0FBRyxFQUFFLHdCQUFnQixDQUFDO1FBQ3hDLGlCQUFpQixFQUFFLEtBQUs7S0FDekIsQ0FBQztJQUVGLE9BQU8sSUFBSSxFQUFFLENBQUM7QUFDaEIsQ0FBQyxDQUFDO0FBZlcsUUFBQSxjQUFjLGtCQWV6QjtBQUVGOzs7Ozs7O0dBT0c7QUFDSCxTQUFnQixlQUFlLENBQUMsR0FBa0I7SUFDaEQsTUFBTSxPQUFPLEdBQUcsR0FBeUIsQ0FBQztJQUMxQyxNQUFNLE9BQU8sR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDakMsSUFBSSxPQUFPO1FBQUUsT0FBTyxPQUFPLENBQUM7SUFFNUIsTUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsaUJBQWlCLEVBQUUsS0FBSyxFQUFFLENBQUM7SUFDM0QsTUFBTSxPQUFPLEdBQUcsSUFBQSwwQkFBVyxFQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDN0MsT0FBTyxDQUFDLE9BQU8sQ0FBQyxHQUFHLE9BQU8sQ0FBQztJQUMzQixPQUFPLE9BQU8sQ0FBQztBQUNqQixDQUFDO0FBRUQsK0RBQStEO0FBQ3hELE1BQU0sVUFBVSxHQUFHLENBQUMsR0FBa0IsRUFBd0IsRUFBRSxDQUNwRSxHQUEwQixDQUFDLElBQUksQ0FBQyxDQUFDO0FBRHZCLFFBQUEsVUFBVSxjQUNhIn0=