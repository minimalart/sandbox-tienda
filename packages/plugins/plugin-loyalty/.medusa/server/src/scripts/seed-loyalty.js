"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = seedLoyalty;
const utils_1 = require("@medusajs/framework/utils");
const loyalty_1 = require("../modules/loyalty");
const settings_1 = require("../modules/loyalty/settings");
/**
 * Seeds the default Loyalty Engine config: one program + a purchase earn rule
 * that replicates the legacy POINTS_EARN_RATE setting. A rate maps to a
 * percentage rule (rate 1 → 100% → 1 point per $1; rate 0.1 → 10% → 1 point per $10).
 *
 *   npx medusa exec ./src/scripts/seed-loyalty.ts   (o `pnpm seed:loyalty`)
 *
 * Idempotent: skips if any program already exists. Seeds are NOT auto-applied on
 * deploy — run once per environment.
 */
async function seedLoyalty({ container }) {
    const logger = container.resolve(utils_1.ContainerRegistrationKeys.LOGGER);
    const loyalty = container.resolve(loyalty_1.LOYALTY_MODULE);
    const existing = await loyalty.listLoyaltyPrograms({}, { take: 1 });
    if (existing.length) {
        logger.info('[seed-loyalty] Ya existe un programa — no se siembra nada.');
        return;
    }
    // El saneo (`> 0`, `NaN` → default) vive en `resolvePointsEarnRate`, junto con
    // el del subscriber: eran dos criterios distintos para el mismo número.
    const rate = (0, settings_1.resolvePointsEarnRate)();
    const percent = Math.max(0, Math.round(rate * 100));
    const program = await loyalty.createLoyaltyPrograms({
        name: 'Programa de fidelización',
        status: 'active',
        points_name: 'puntos',
        currency_code: 'ars',
        expiration_policy: { type: 'none' },
    });
    await loyalty.createEarnRules({
        name: 'Compras',
        status: 'active',
        priority: 0,
        event: 'purchase',
        calc_type: 'percentage',
        calc_value: percent,
        program_id: program.id,
    });
    logger.info(`[seed-loyalty] Programa ${program.id} + regla de compra creados (${percent}% ≈ rate ${rate}).`);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VlZC1sb3lhbHR5LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3NjcmlwdHMvc2VlZC1sb3lhbHR5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBZ0JBLDhCQW9DQztBQW5ERCxxREFBc0U7QUFDdEUsZ0RBQW9EO0FBRXBELDBEQUFvRTtBQUVwRTs7Ozs7Ozs7O0dBU0c7QUFDWSxLQUFLLFVBQVUsV0FBVyxDQUFDLEVBQUUsU0FBUyxFQUFZO0lBQy9ELE1BQU0sTUFBTSxHQUFHLFNBQVMsQ0FBQyxPQUFPLENBQUMsaUNBQXlCLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDbkUsTUFBTSxPQUFPLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FBdUIsd0JBQWMsQ0FBQyxDQUFDO0lBRXhFLE1BQU0sUUFBUSxHQUFHLE1BQU0sT0FBTyxDQUFDLG1CQUFtQixDQUFDLEVBQUUsRUFBRSxFQUFFLElBQUksRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQ3BFLElBQUksUUFBUSxDQUFDLE1BQU0sRUFBRSxDQUFDO1FBQ3BCLE1BQU0sQ0FBQyxJQUFJLENBQUMsNERBQTRELENBQUMsQ0FBQztRQUMxRSxPQUFPO0lBQ1QsQ0FBQztJQUVELCtFQUErRTtJQUMvRSx3RUFBd0U7SUFDeEUsTUFBTSxJQUFJLEdBQUcsSUFBQSxnQ0FBcUIsR0FBRSxDQUFDO0lBQ3JDLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFFcEQsTUFBTSxPQUFPLEdBQUcsTUFBTSxPQUFPLENBQUMscUJBQXFCLENBQUM7UUFDbEQsSUFBSSxFQUFFLDBCQUEwQjtRQUNoQyxNQUFNLEVBQUUsUUFBUTtRQUNoQixXQUFXLEVBQUUsUUFBUTtRQUNyQixhQUFhLEVBQUUsS0FBSztRQUNwQixpQkFBaUIsRUFBRSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUU7S0FDcEMsQ0FBQyxDQUFDO0lBRUgsTUFBTSxPQUFPLENBQUMsZUFBZSxDQUFDO1FBQzVCLElBQUksRUFBRSxTQUFTO1FBQ2YsTUFBTSxFQUFFLFFBQVE7UUFDaEIsUUFBUSxFQUFFLENBQUM7UUFDWCxLQUFLLEVBQUUsVUFBVTtRQUNqQixTQUFTLEVBQUUsWUFBWTtRQUN2QixVQUFVLEVBQUUsT0FBTztRQUNuQixVQUFVLEVBQUUsT0FBTyxDQUFDLEVBQUU7S0FDdkIsQ0FBQyxDQUFDO0lBRUgsTUFBTSxDQUFDLElBQUksQ0FDVCwyQkFBMkIsT0FBTyxDQUFDLEVBQUUsK0JBQStCLE9BQU8sWUFBWSxJQUFJLElBQUksQ0FDaEcsQ0FBQztBQUNKLENBQUMifQ==