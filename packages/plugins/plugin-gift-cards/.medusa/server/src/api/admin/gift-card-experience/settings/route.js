"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const request_1 = require("../../../../lib/multistore/request");
const gift_card_experience_1 = require("../../../../modules/gift-card-experience");
/** `null` = la fila GLOBAL, que es el fallback de toda tienda sin configuración propia. */
const siteOf = async (req) => {
    const resolution = await (0, request_1.siteFromRequest)(req);
    return resolution.status === 'site' ? resolution.site.id : null;
};
async function GET(req, res) {
    const service = req.scope.resolve(gift_card_experience_1.GIFT_CARD_EXPERIENCE_MODULE);
    res.json({ settings: await service.getSettings(await siteOf(req)) });
}
async function POST(req, res) {
    const service = req.scope.resolve(gift_card_experience_1.GIFT_CARD_EXPERIENCE_MODULE);
    const actorId = req.auth_context?.actor_id;
    const input = req.validatedBody;
    /**
     * `upsertSettingsForSite` y no `updateGiftCardSettings` sobre la fila que devolvió
     * el GET: si la tienda todavía no tiene fila propia, el GET devuelve la GLOBAL, y
     * actualizar esa fila por su id escribiría la configuración de la instancia entera
     * creyendo estar editando una sola tienda.
     */
    const settings = await service.upsertSettingsForSite(await siteOf(req), {
        ...input,
        ...(input.retry_delays_minutes ? { retry_delays_minutes: { delays: input.retry_delays_minutes } } : {}),
        updated_by: actorId,
    });
    res.json({ settings });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2dpZnQtY2FyZC1leHBlcmllbmNlL3NldHRpbmdzL3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBZUEsa0JBR0M7QUFFRCxvQkFpQkM7QUFwQ0QsZ0VBQXFFO0FBRXJFLG1GQUF1RjtBQU12RiwyRkFBMkY7QUFDM0YsTUFBTSxNQUFNLEdBQUcsS0FBSyxFQUFFLEdBQWtCLEVBQTBCLEVBQUU7SUFDbEUsTUFBTSxVQUFVLEdBQUcsTUFBTSxJQUFBLHlCQUFlLEVBQUMsR0FBRyxDQUFDLENBQUM7SUFDOUMsT0FBTyxVQUFVLENBQUMsTUFBTSxLQUFLLE1BQU0sQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztBQUNsRSxDQUFDLENBQUM7QUFFSyxLQUFLLFVBQVUsR0FBRyxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDL0QsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQWtDLGtEQUEyQixDQUFDLENBQUM7SUFDaEcsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLFFBQVEsRUFBRSxNQUFNLE9BQU8sQ0FBQyxXQUFXLENBQUMsTUFBTSxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDdkUsQ0FBQztBQUVNLEtBQUssVUFBVSxJQUFJLENBQUMsR0FBeUIsRUFBRSxHQUFtQjtJQUN2RSxNQUFNLE9BQU8sR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBa0Msa0RBQTJCLENBQUMsQ0FBQztJQUNoRyxNQUFNLE9BQU8sR0FBSSxHQUFnRSxDQUFDLFlBQVksRUFBRSxRQUFRLENBQUM7SUFDekcsTUFBTSxLQUFLLEdBQUcsR0FBRyxDQUFDLGFBQXNCLENBQUM7SUFFekM7Ozs7O09BS0c7SUFDSCxNQUFNLFFBQVEsR0FBRyxNQUFNLE9BQU8sQ0FBQyxxQkFBcUIsQ0FBQyxNQUFNLE1BQU0sQ0FBQyxHQUFHLENBQUMsRUFBRTtRQUN0RSxHQUFHLEtBQUs7UUFDUixHQUFHLENBQUMsS0FBSyxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxFQUFFLG9CQUFvQixFQUFFLEVBQUUsTUFBTSxFQUFFLEtBQUssQ0FBQyxvQkFBb0IsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztRQUN2RyxVQUFVLEVBQUUsT0FBTztLQUNwQixDQUFDLENBQUM7SUFDSCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsUUFBUSxFQUFFLENBQUMsQ0FBQztBQUN6QixDQUFDIn0=