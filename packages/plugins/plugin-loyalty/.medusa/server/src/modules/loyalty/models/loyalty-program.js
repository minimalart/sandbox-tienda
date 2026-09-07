"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoyaltyProgram = void 0;
const utils_1 = require("@medusajs/framework/utils");
const earn_rule_1 = require("./earn-rule");
const reward_1 = require("./reward");
const tier_1 = require("./tier");
const campaign_1 = require("./campaign");
// A loyalty program groups the earn rules, rewards, tiers and campaigns of the
// Loyalty Engine. The MVP runs a single active program; the model supports more
// so multi-program setups don't need a disruptive migration later.
//
// `expiration_policy` (JSON): { type: 'none' | 'fixed_days' | 'end_of_year', days?: number }.
// The points ledger itself lives in the `points` module (extension loyalty-points);
// this program only configures how points are earned/spent.
exports.LoyaltyProgram = utils_1.model.define('loyalty_program', {
    id: utils_1.model.id({ prefix: 'loypr' }).primaryKey(),
    name: utils_1.model.text(),
    status: utils_1.model.enum(['active', 'inactive']).default('active'),
    points_name: utils_1.model.text().default('puntos'),
    currency_code: utils_1.model.text().default('ars'),
    starts_at: utils_1.model.dateTime().nullable(),
    ends_at: utils_1.model.dateTime().nullable(),
    expiration_policy: utils_1.model.json().nullable(),
    config: utils_1.model.json().nullable(),
    earn_rules: utils_1.model.hasMany(() => earn_rule_1.EarnRule, { mappedBy: 'program' }),
    rewards: utils_1.model.hasMany(() => reward_1.Reward, { mappedBy: 'program' }),
    tiers: utils_1.model.hasMany(() => tier_1.Tier, { mappedBy: 'program' }),
    campaigns: utils_1.model.hasMany(() => campaign_1.Campaign, { mappedBy: 'program' }),
    /**
     * La tienda dueña del programa. `NULL` = global de la instancia.
     *
     * El eje va SÓLO acá: tiers, rewards, campaigns y earn-rules cuelgan del programa
     * y heredan su tienda por la FK. Repetir `site_id` en las cinco tablas parece más
     * simple hasta que una escritura se lo olvida — la fila queda contradiciendo a su
     * propio programa y no hay forma de detectarlo salvo mirando datos.
     *
     * Los programas existentes quedan en `NULL` y se siguen viendo desde cualquier
     * tienda: esconder el programa de fidelidad vivo el día del deploy sería apagarlo
     * sin avisar a nadie.
     */
    site_id: utils_1.model.text().nullable(),
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG95YWx0eS1wcm9ncmFtLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL21vZHVsZXMvbG95YWx0eS9tb2RlbHMvbG95YWx0eS1wcm9ncmFtLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHFEQUFrRDtBQUNsRCwyQ0FBdUM7QUFDdkMscUNBQWtDO0FBQ2xDLGlDQUE4QjtBQUM5Qix5Q0FBc0M7QUFFdEMsK0VBQStFO0FBQy9FLGdGQUFnRjtBQUNoRixtRUFBbUU7QUFDbkUsRUFBRTtBQUNGLDhGQUE4RjtBQUM5RixvRkFBb0Y7QUFDcEYsNERBQTREO0FBQy9DLFFBQUEsY0FBYyxHQUFHLGFBQUssQ0FBQyxNQUFNLENBQUMsaUJBQWlCLEVBQUU7SUFDNUQsRUFBRSxFQUFFLGFBQUssQ0FBQyxFQUFFLENBQUMsRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLENBQUMsQ0FBQyxVQUFVLEVBQUU7SUFDOUMsSUFBSSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUU7SUFDbEIsTUFBTSxFQUFFLGFBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLEVBQUUsVUFBVSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDO0lBQzVELFdBQVcsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQztJQUMzQyxhQUFhLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUM7SUFDMUMsU0FBUyxFQUFFLGFBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDdEMsT0FBTyxFQUFFLGFBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDcEMsaUJBQWlCLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUMxQyxNQUFNLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUMvQixVQUFVLEVBQUUsYUFBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxvQkFBUSxFQUFFLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxDQUFDO0lBQ2xFLE9BQU8sRUFBRSxhQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDLGVBQU0sRUFBRSxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsQ0FBQztJQUM3RCxLQUFLLEVBQUUsYUFBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxXQUFJLEVBQUUsRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLENBQUM7SUFDekQsU0FBUyxFQUFFLGFBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLENBQUMsbUJBQVEsRUFBRSxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsQ0FBQztJQUNqRTs7Ozs7Ozs7Ozs7T0FXRztJQUNILE9BQU8sRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0NBQ2pDLENBQUMsQ0FBQyJ9