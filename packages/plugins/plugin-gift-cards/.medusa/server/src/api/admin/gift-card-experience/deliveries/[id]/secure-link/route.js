"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const request_1 = require("../../../../../../lib/multistore/request");
const scope_1 = require("../../../../../../lib/multistore/scope");
const site_scope_1 = require("../../../../../../modules/gift-card-experience/site-scope");
const crypto_1 = require("../../../../../../modules/gift-card-experience/crypto");
const gift_card_experience_1 = require("../../../../../../modules/gift-card-experience");
async function POST(req, res) {
    // Mismo guard que el detalle, y acá pesa más que en ninguna otra ruta del
    // recurso: el detalle se cuida de NO devolver `token_encrypted`, y este handler
    // lo desencripta y lo devuelve dentro de la URL del storefront. O sea que sin el
    // guard el id de una entrega ajena no filtra una fila, entrega el token en claro
    // con el que se canjea la gift card de otra tienda. El `auditSecureLink` de abajo
    // deja rastro de quién lo pidió, pero registrar el robo no es impedirlo.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.GIFT_CARD_DELIVERY_SITE_SCOPE, req.params.id);
    const service = req.scope.resolve(gift_card_experience_1.GIFT_CARD_EXPERIENCE_MODULE);
    const delivery = await service.retrieveGiftCardDelivery(req.params.id);
    const actorId = req.auth_context?.actor_id ?? 'admin';
    const configured = process.env.STOREFRONT_URL;
    if (!configured || !delivery.token_encrypted)
        throw new Error('No se puede generar el enlace seguro.');
    const storefront = new URL(configured);
    if (!['http:', 'https:'].includes(storefront.protocol))
        throw new Error('STOREFRONT_URL debe usar HTTP(S).');
    const origin = storefront.origin;
    const countryCode = process.env.DEFAULT_COUNTRY_CODE?.toLowerCase() || 'ar';
    await service.auditSecureLink(delivery, actorId);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ url: `${origin}/${countryCode}/gift-card/${encodeURIComponent((0, crypto_1.decryptGiftCardToken)(delivery.token_encrypted))}` });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2dpZnQtY2FyZC1leHBlcmllbmNlL2RlbGl2ZXJpZXMvW2lkXS9zZWN1cmUtbGluay9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQVFBLG9CQXFCQztBQTVCRCxzRUFBMkU7QUFDM0Usa0VBQXdFO0FBQ3hFLDBGQUEwRztBQUMxRyxrRkFBNkY7QUFDN0YseUZBQTZGO0FBR3RGLEtBQUssVUFBVSxJQUFJLENBQUMsR0FBa0IsRUFBRSxHQUFtQjtJQUNoRSwwRUFBMEU7SUFDMUUsZ0ZBQWdGO0lBQ2hGLGlGQUFpRjtJQUNqRixpRkFBaUY7SUFDakYsa0ZBQWtGO0lBQ2xGLHlFQUF5RTtJQUN6RSxNQUFNLElBQUEsc0JBQWMsRUFBQyxHQUFHLENBQUMsS0FBSyxFQUFFLE1BQU0sSUFBQSx5QkFBZSxFQUFDLEdBQUcsQ0FBQyxFQUFFLDBDQUE2QixFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBWSxDQUFDLENBQUM7SUFFcEgsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQWtDLGtEQUEyQixDQUFDLENBQUM7SUFDaEcsTUFBTSxRQUFRLEdBQUcsTUFBTSxPQUFPLENBQUMsd0JBQXdCLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFHLENBQUMsQ0FBQztJQUN4RSxNQUFNLE9BQU8sR0FBSSxHQUFnRSxDQUFDLFlBQVksRUFBRSxRQUFRLElBQUksT0FBTyxDQUFDO0lBQ3BILE1BQU0sVUFBVSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDO0lBQzlDLElBQUksQ0FBQyxVQUFVLElBQUksQ0FBQyxRQUFRLENBQUMsZUFBZTtRQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMsdUNBQXVDLENBQUMsQ0FBQztJQUN2RyxNQUFNLFVBQVUsR0FBRyxJQUFJLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUN2QyxJQUFJLENBQUMsQ0FBQyxPQUFPLEVBQUUsUUFBUSxDQUFDLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUM7UUFBRSxNQUFNLElBQUksS0FBSyxDQUFDLG1DQUFtQyxDQUFDLENBQUM7SUFDN0csTUFBTSxNQUFNLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQztJQUNqQyxNQUFNLFdBQVcsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLG9CQUFvQixFQUFFLFdBQVcsRUFBRSxJQUFJLElBQUksQ0FBQztJQUM1RSxNQUFNLE9BQU8sQ0FBQyxlQUFlLENBQUMsUUFBeUcsRUFBRSxPQUFPLENBQUMsQ0FBQztJQUNsSixHQUFHLENBQUMsU0FBUyxDQUFDLGVBQWUsRUFBRSxVQUFVLENBQUMsQ0FBQztJQUMzQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsTUFBTSxJQUFJLFdBQVcsY0FBYyxrQkFBa0IsQ0FBQyxJQUFBLDZCQUFvQixFQUFDLFFBQVEsQ0FBQyxlQUFlLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0FBQ2hJLENBQUMifQ==