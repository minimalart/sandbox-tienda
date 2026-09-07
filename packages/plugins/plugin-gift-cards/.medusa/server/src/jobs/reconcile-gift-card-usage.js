"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.default = reconcileGiftCardUsage;
const utils_1 = require("@medusajs/framework/utils");
const gift_card_experience_1 = require("../modules/gift-card-experience");
const settings_1 = require("../modules/gift-card-experience/settings");
async function reconcileGiftCardUsage(container) {
    // Kill switch de despliegue. El `schedule` de abajo NO se puede mover en
    // runtime (job-loader.js hornea el cron al arrancar), así que apagar la
    // extensión desde el admin es este early return.
    if (!(0, settings_1.getGiftCardExperienceSettings)().experienceEnabled)
        return;
    const logger = container.resolve(utils_1.ContainerRegistrationKeys.LOGGER);
    try {
        const service = container.resolve(gift_card_experience_1.GIFT_CARD_EXPERIENCE_MODULE);
        // `null` EXPLÍCITO: el kill switch que se mira sigue siendo el de la fila global,
        // para una reconciliación que sella hitos sobre las entregas de TODAS las tiendas.
        // Queda `pending` en `job-scope.ts`; moverlo pide que `reconcileUsageMilestones()`
        // filtre por tienda, no que este `getSettings` reciba otra cosa.
        const settings = await service.getSettings(null);
        if (!settings.enabled)
            return;
        await service.reconcileUsageMilestones();
    }
    catch (error) {
        logger.error(`[Gift Card] Usage reconciliation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}
exports.config = { name: 'gift-card-usage-reconciliation', schedule: '*/15 * * * *' };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVjb25jaWxlLWdpZnQtY2FyZC11c2FnZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9qb2JzL3JlY29uY2lsZS1naWZ0LWNhcmQtdXNhZ2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBTUEseUNBa0JDO0FBdkJELHFEQUFzRTtBQUN0RSwwRUFBOEU7QUFFOUUsdUVBQXlGO0FBRTFFLEtBQUssVUFBVSxzQkFBc0IsQ0FBQyxTQUEwQjtJQUM3RSx5RUFBeUU7SUFDekUsd0VBQXdFO0lBQ3hFLGlEQUFpRDtJQUNqRCxJQUFJLENBQUMsSUFBQSx3Q0FBNkIsR0FBRSxDQUFDLGlCQUFpQjtRQUFFLE9BQU87SUFDL0QsTUFBTSxNQUFNLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FBUyxpQ0FBeUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUMzRSxJQUFJLENBQUM7UUFDSCxNQUFNLE9BQU8sR0FBRyxTQUFTLENBQUMsT0FBTyxDQUFrQyxrREFBMkIsQ0FBQyxDQUFDO1FBQ2hHLGtGQUFrRjtRQUNsRixtRkFBbUY7UUFDbkYsbUZBQW1GO1FBQ25GLGlFQUFpRTtRQUNqRSxNQUFNLFFBQVEsR0FBRyxNQUFNLE9BQU8sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDakQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPO1lBQUUsT0FBTztRQUM5QixNQUFNLE9BQU8sQ0FBQyx3QkFBd0IsRUFBRSxDQUFDO0lBQzNDLENBQUM7SUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1FBQ2YsTUFBTSxDQUFDLEtBQUssQ0FBQyw0Q0FBNEMsS0FBSyxZQUFZLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUNySCxDQUFDO0FBQ0gsQ0FBQztBQUVZLFFBQUEsTUFBTSxHQUFHLEVBQUUsSUFBSSxFQUFFLGdDQUFnQyxFQUFFLFFBQVEsRUFBRSxjQUFjLEVBQUUsQ0FBQyJ9