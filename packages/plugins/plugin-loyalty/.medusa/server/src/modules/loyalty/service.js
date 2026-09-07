"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
const models_1 = require("./models");
class LoyaltyModuleService extends (0, utils_1.MedusaService)({
    LoyaltyProgram: models_1.LoyaltyProgram,
    EarnRule: models_1.EarnRule,
    Reward: models_1.Reward,
    RewardGrant: models_1.RewardGrant,
    Tier: models_1.Tier,
    Campaign: models_1.Campaign,
}) {
    // The single active program (MVP: one program). Most-recently-created active one.
    async getActiveProgram() {
        const programs = await this.listLoyaltyPrograms({ status: 'active' }, { order: { created_at: 'DESC' }, take: 1 });
        return programs[0] ?? null;
    }
}
exports.default = LoyaltyModuleService;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2xveWFsdHkvc2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLHFEQUEwRDtBQUMxRCxxQ0FPa0I7QUFFbEIsTUFBTSxvQkFBcUIsU0FBUSxJQUFBLHFCQUFhLEVBQUM7SUFDL0MsY0FBYyxFQUFkLHVCQUFjO0lBQ2QsUUFBUSxFQUFSLGlCQUFRO0lBQ1IsTUFBTSxFQUFOLGVBQU07SUFDTixXQUFXLEVBQVgsb0JBQVc7SUFDWCxJQUFJLEVBQUosYUFBSTtJQUNKLFFBQVEsRUFBUixpQkFBUTtDQUNULENBQUM7SUFDQSxrRkFBa0Y7SUFDbEYsS0FBSyxDQUFDLGdCQUFnQjtRQUNwQixNQUFNLFFBQVEsR0FBRyxNQUFNLElBQUksQ0FBQyxtQkFBbUIsQ0FDN0MsRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFLEVBQ3BCLEVBQUUsS0FBSyxFQUFFLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxFQUFFLElBQUksRUFBRSxDQUFDLEVBQUUsQ0FDM0MsQ0FBQztRQUNGLE9BQU8sUUFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQztJQUM3QixDQUFDO0NBQ0Y7QUFFRCxrQkFBZSxvQkFBb0IsQ0FBQyJ9