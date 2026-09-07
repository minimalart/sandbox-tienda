"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
exports.DELETE = DELETE;
const gift_card_experience_1 = require("../../../../../modules/gift-card-experience");
const request_1 = require("../../../../../lib/multistore/request");
const scope_1 = require("../../../../../lib/multistore/scope");
const site_scope_1 = require("../../../../../modules/gift-card-experience/site-scope");
/**
 * `assertIdInSite` y no `assertRowInSite`: ninguno de los dos handlers lee la fila antes
 * de mutarla —los dos van derecho al `update`—, así que el de fila obligaría a agregar
 * un `retrieve` sólo para tener qué chequear. Al mismo costo, el subselect reusa
 * LITERALMENTE el predicado del listado (`siteFilter` con el mismo descriptor), y por
 * construcción no puede driftear de él.
 *
 * Residual conocido, y se deja a propósito: `GIFT_CARD_DESIGN_SITE_SCOPE` declara
 * `empty: 'all'`, así que el diseño GLOBAL —hoy sólo el `brand-default` que siembra
 * `ensureDefaultDesign`— se ve desde toda tienda y por lo tanto también se puede
 * archivar desde cualquiera, y ese archivado lo saca de TODAS (el reseed chequea
 * existencia por `public_id`, no `active`, así que no lo restaura).
 *
 * La alternativa era endurecer el guard a `'unassigned'` acá nomás. Se descartó: le
 * daría a la mutación un predicado MÁS ESTRICTO que el del listado, y el modo de falla
 * de eso es un operador que ve el diseño en su pantalla y come un 404 al tocarlo, sin
 * ninguna pista de por qué. Proteger una fila sembrada de su propio borrado es un
 * problema del módulo —no tiene nada que ver con qué tienda la mira— y se arregla en el
 * servicio, no torciendo el eje de tienda hasta que tape otra cosa.
 */
async function POST(req, res) {
    // El guard va en TODOS los handlers, no sólo en el GET: filtrar el listado y dejar la
    // mutación abierta esconde el diseño de la otra tienda pero deja reescribirle las
    // imágenes con sólo saber el id.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.GIFT_CARD_DESIGN_SITE_SCOPE, req.params.id);
    const service = req.scope.resolve(gift_card_experience_1.GIFT_CARD_EXPERIENCE_MODULE);
    const design = await service.updateGiftCardDesigns({ id: req.params.id, ...req.validatedBody });
    res.json({ design });
}
/** Designs are archived, never physically deleted. */
async function DELETE(req, res) {
    // Archivar es una mutación como cualquier otra: que no borre la fila no la hace menos
    // destructiva desde la vereda del cliente, porque el diseño deja de ofrecerse.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.GIFT_CARD_DESIGN_SITE_SCOPE, req.params.id);
    const service = req.scope.resolve(gift_card_experience_1.GIFT_CARD_EXPERIENCE_MODULE);
    const design = await service.updateGiftCardDesigns({ id: req.params.id, active: false });
    res.json({ design });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2dpZnQtY2FyZC1leHBlcmllbmNlL2Rlc2lnbnMvW2lkXS9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQStCQSxvQkFjQztBQUdELHdCQWFDO0FBM0RELHNGQUEwRjtBQUUxRixtRUFBd0U7QUFDeEUsK0RBQXFFO0FBQ3JFLHVGQUFxRztBQUtyRzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQW1CRztBQUNJLEtBQUssVUFBVSxJQUFJLENBQUMsR0FBeUIsRUFBRSxHQUFtQjtJQUN2RSxzRkFBc0Y7SUFDdEYsa0ZBQWtGO0lBQ2xGLGlDQUFpQztJQUNqQyxNQUFNLElBQUEsc0JBQWMsRUFDbEIsR0FBRyxDQUFDLEtBQUssRUFDVCxNQUFNLElBQUEseUJBQWUsRUFBQyxHQUFHLENBQUMsRUFDMUIsd0NBQTJCLEVBQzNCLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBWSxDQUN4QixDQUFDO0lBRUYsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQWtDLGtEQUEyQixDQUFDLENBQUM7SUFDaEcsTUFBTSxNQUFNLEdBQUcsTUFBTSxPQUFPLENBQUMscUJBQXFCLENBQUMsRUFBRSxFQUFFLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFFLEVBQUUsR0FBSSxHQUFHLENBQUMsYUFBdUIsRUFBRSxDQUFDLENBQUM7SUFDM0csR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUM7QUFDdkIsQ0FBQztBQUVELHNEQUFzRDtBQUMvQyxLQUFLLFVBQVUsTUFBTSxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDbEUsc0ZBQXNGO0lBQ3RGLCtFQUErRTtJQUMvRSxNQUFNLElBQUEsc0JBQWMsRUFDbEIsR0FBRyxDQUFDLEtBQUssRUFDVCxNQUFNLElBQUEseUJBQWUsRUFBQyxHQUFHLENBQUMsRUFDMUIsd0NBQTJCLEVBQzNCLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBWSxDQUN4QixDQUFDO0lBRUYsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQWtDLGtEQUEyQixDQUFDLENBQUM7SUFDaEcsTUFBTSxNQUFNLEdBQUcsTUFBTSxPQUFPLENBQUMscUJBQXFCLENBQUMsRUFBRSxFQUFFLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFFLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUM7SUFDekYsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUM7QUFDdkIsQ0FBQyJ9