"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const request_1 = require("../../../lib/multistore/request");
const ga4_1 = require("../../../modules/ga4");
/** `null` = la fila GLOBAL, el fallback de toda tienda sin configuración propia. */
const siteOf = async (req) => {
    const resolution = await (0, request_1.siteFromRequest)(req);
    return resolution.status === 'site' ? resolution.site.id : null;
};
/** Serializa la fila de settings a la respuesta pública: NUNCA devuelve el
 * api_secret, solo el flag api_secret_set. */
function toResponse(settings) {
    return {
        measurement_id: settings.measurement_id ?? null,
        gtm_id: settings.gtm_id ?? null,
        api_secret_set: Boolean(settings.api_secret),
        debug: Boolean(settings.debug),
    };
}
/**
 * GET /admin/ga4-config — devuelve la config GA4 EFECTIVA (app-settings, con la
 * fila legacy `ga4_settings` como override por campo) para mostrar el estado de
 * envío en el backoffice. Solo IDs públicos + flags; NUNCA el api_secret.
 *
 * Los campos se editan desde la card de app-settings, no desde acá.
 */
async function GET(req, res) {
    const ga4Service = req.scope.resolve(ga4_1.GA4_MODULE);
    const settings = await ga4Service.getSettings(await siteOf(req));
    res.status(200).json(toResponse(settings));
}
/**
 * POST /admin/ga4-config — guarda la configuración de la tienda de la request.
 *
 * Escribe en `ga4_settings` con `site_id`, que desde multitienda es la fuente de
 * verdad de esta extensión. `updateSettings` clona la fila global heredada en
 * vez de pisarla: guardar desde una tienda no puede cambiarle la propiedad de
 * GA4 a todas las demás.
 *
 * El api_secret sólo se escribe si llega un string no vacío; vacío u omitido
 * preserva el guardado, igual que antes.
 */
async function POST(req, res) {
    const ga4Service = req.scope.resolve(ga4_1.GA4_MODULE);
    const body = (req.body ?? {});
    const patch = {};
    if (body.measurement_id !== undefined) {
        patch.measurement_id = body.measurement_id?.trim() || null;
    }
    if (body.gtm_id !== undefined) {
        patch.gtm_id = body.gtm_id?.trim() || null;
    }
    if (body.debug !== undefined) {
        patch.debug = Boolean(body.debug);
    }
    if (typeof body.api_secret === 'string' && body.api_secret.trim()) {
        patch.api_secret = body.api_secret.trim();
    }
    const settings = await ga4Service.updateSettings(patch, await siteOf(req));
    res.status(200).json(toResponse(settings));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2dhNC1jb25maWcvcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUF5Q0Esa0JBSUM7QUFvQkQsb0JBcUJDO0FBckZELDZEQUFrRTtBQUNsRSw4Q0FBa0Q7QUFHbEQsb0ZBQW9GO0FBQ3BGLE1BQU0sTUFBTSxHQUFHLEtBQUssRUFBRSxHQUFrQixFQUEwQixFQUFFO0lBQ2xFLE1BQU0sVUFBVSxHQUFHLE1BQU0sSUFBQSx5QkFBZSxFQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQzlDLE9BQU8sVUFBVSxDQUFDLE1BQU0sS0FBSyxNQUFNLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7QUFDbEUsQ0FBQyxDQUFDO0FBU0Y7OENBQzhDO0FBQzlDLFNBQVMsVUFBVSxDQUFDLFFBS25CO0lBQ0MsT0FBTztRQUNMLGNBQWMsRUFBRSxRQUFRLENBQUMsY0FBYyxJQUFJLElBQUk7UUFDL0MsTUFBTSxFQUFFLFFBQVEsQ0FBQyxNQUFNLElBQUksSUFBSTtRQUMvQixjQUFjLEVBQUUsT0FBTyxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUM7UUFDNUMsS0FBSyxFQUFFLE9BQU8sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDO0tBQy9CLENBQUM7QUFDSixDQUFDO0FBRUQ7Ozs7OztHQU1HO0FBQ0ksS0FBSyxVQUFVLEdBQUcsQ0FBQyxHQUFrQixFQUFFLEdBQW1CO0lBQy9ELE1BQU0sVUFBVSxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFtQixnQkFBVSxDQUFDLENBQUM7SUFDbkUsTUFBTSxRQUFRLEdBQUcsTUFBTSxVQUFVLENBQUMsV0FBVyxDQUFDLE1BQU0sTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDakUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7QUFDN0MsQ0FBQztBQVNEOzs7Ozs7Ozs7O0dBVUc7QUFDSSxLQUFLLFVBQVUsSUFBSSxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDaEUsTUFBTSxVQUFVLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQW1CLGdCQUFVLENBQUMsQ0FBQztJQUNuRSxNQUFNLElBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLElBQUksRUFBRSxDQUFrQixDQUFDO0lBRS9DLE1BQU0sS0FBSyxHQUE0QixFQUFFLENBQUM7SUFFMUMsSUFBSSxJQUFJLENBQUMsY0FBYyxLQUFLLFNBQVMsRUFBRSxDQUFDO1FBQ3RDLEtBQUssQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLGNBQWMsRUFBRSxJQUFJLEVBQUUsSUFBSSxJQUFJLENBQUM7SUFDN0QsQ0FBQztJQUNELElBQUksSUFBSSxDQUFDLE1BQU0sS0FBSyxTQUFTLEVBQUUsQ0FBQztRQUM5QixLQUFLLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLElBQUksSUFBSSxDQUFDO0lBQzdDLENBQUM7SUFDRCxJQUFJLElBQUksQ0FBQyxLQUFLLEtBQUssU0FBUyxFQUFFLENBQUM7UUFDN0IsS0FBSyxDQUFDLEtBQUssR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ3BDLENBQUM7SUFDRCxJQUFJLE9BQU8sSUFBSSxDQUFDLFVBQVUsS0FBSyxRQUFRLElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDO1FBQ2xFLEtBQUssQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUM1QyxDQUFDO0lBRUQsTUFBTSxRQUFRLEdBQUcsTUFBTSxVQUFVLENBQUMsY0FBYyxDQUFDLEtBQUssRUFBRSxNQUFNLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQzNFLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0FBQzdDLENBQUMifQ==