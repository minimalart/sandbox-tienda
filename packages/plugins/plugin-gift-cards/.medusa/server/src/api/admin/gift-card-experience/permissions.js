"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GIFT_CARD_ADMIN_PERMISSIONS = void 0;
exports.resolveGiftCardAdminPermissions = resolveGiftCardAdminPermissions;
exports.requireGiftCardAdminPermission = requireGiftCardAdminPermission;
const utils_1 = require("@medusajs/framework/utils");
exports.GIFT_CARD_ADMIN_PERMISSIONS = {
    read: 'gift_cards.read',
    designs: 'gift_cards.designs',
    deliveries: 'gift_cards.deliveries',
    settings: 'gift_cards.settings',
    metrics: 'gift_cards.metrics',
};
const ALL_PERMISSIONS = Object.values(exports.GIFT_CARD_ADMIN_PERMISSIONS);
// Cualquier usuario administrativo autenticado tiene acceso completo: el
// personal del backoffice es de confianza y el encendido operativo real vive
// en la configuración de la extensión ("Extensión operativa"), no en un RBAC
// aparte que dependía de env vars o metadata no editables desde el backoffice.
async function resolveGiftCardAdminPermissions(req) {
    const actorId = req.auth_context?.actor_id;
    if (!actorId)
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.UNAUTHORIZED, 'Autenticación administrativa requerida.');
    return { actor_id: actorId, permissions: [...ALL_PERMISSIONS], source: 'admin' };
}
function requireGiftCardAdminPermission(_permission) {
    return async (req, _res, next) => {
        await resolveGiftCardAdminPermissions(req);
        next();
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGVybWlzc2lvbnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2dpZnQtY2FyZC1leHBlcmllbmNlL3Blcm1pc3Npb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQWtCQSwwRUFRQztBQUVELHdFQUtDO0FBaENELHFEQUF3RDtBQUUzQyxRQUFBLDJCQUEyQixHQUFHO0lBQ3pDLElBQUksRUFBRSxpQkFBaUI7SUFDdkIsT0FBTyxFQUFFLG9CQUFvQjtJQUM3QixVQUFVLEVBQUUsdUJBQXVCO0lBQ25DLFFBQVEsRUFBRSxxQkFBcUI7SUFDL0IsT0FBTyxFQUFFLG9CQUFvQjtDQUNyQixDQUFDO0FBR1gsTUFBTSxlQUFlLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxtQ0FBMkIsQ0FBQyxDQUFDO0FBRW5FLHlFQUF5RTtBQUN6RSw2RUFBNkU7QUFDN0UsNkVBQTZFO0FBQzdFLCtFQUErRTtBQUN4RSxLQUFLLFVBQVUsK0JBQStCLENBQUMsR0FBa0I7SUFLdEUsTUFBTSxPQUFPLEdBQUksR0FBZ0UsQ0FBQyxZQUFZLEVBQUUsUUFBUSxDQUFDO0lBQ3pHLElBQUksQ0FBQyxPQUFPO1FBQUUsTUFBTSxJQUFJLG1CQUFXLENBQUMsbUJBQVcsQ0FBQyxLQUFLLENBQUMsWUFBWSxFQUFFLHlDQUF5QyxDQUFDLENBQUM7SUFDL0csT0FBTyxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFFLENBQUMsR0FBRyxlQUFlLENBQUMsRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLENBQUM7QUFDbkYsQ0FBQztBQUVELFNBQWdCLDhCQUE4QixDQUFDLFdBQW9DO0lBQ2pGLE9BQU8sS0FBSyxFQUFFLEdBQWtCLEVBQUUsSUFBb0IsRUFBRSxJQUF3QixFQUFpQixFQUFFO1FBQ2pHLE1BQU0sK0JBQStCLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDM0MsSUFBSSxFQUFFLENBQUM7SUFDVCxDQUFDLENBQUM7QUFDSixDQUFDIn0=