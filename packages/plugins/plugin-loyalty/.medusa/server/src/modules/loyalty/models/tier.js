"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tier = void 0;
const utils_1 = require("@medusajs/framework/utils");
const loyalty_program_1 = require("./loyalty-program");
// A VIP level. A customer's tier is derived from accumulated spend / points /
// orders (>= threshold). `multiplier` boosts earn rules; `benefits` (JSON) holds
// extra perks and can reference tier-exclusive rewards.
exports.Tier = utils_1.model.define('loyalty_tier', {
    id: utils_1.model.id({ prefix: 'loyti' }).primaryKey(),
    name: utils_1.model.text(),
    condition_type: utils_1.model.enum(['spend', 'points', 'orders']).default('spend'),
    threshold: utils_1.model.number().default(0),
    multiplier: utils_1.model.number().default(1),
    benefits: utils_1.model.json().nullable(),
    program: utils_1.model.belongsTo(() => loyalty_program_1.LoyaltyProgram, { mappedBy: 'tiers' }),
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGllci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2xveWFsdHkvbW9kZWxzL3RpZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscURBQWtEO0FBQ2xELHVEQUFtRDtBQUVuRCw4RUFBOEU7QUFDOUUsaUZBQWlGO0FBQ2pGLHdEQUF3RDtBQUMzQyxRQUFBLElBQUksR0FBRyxhQUFLLENBQUMsTUFBTSxDQUFDLGNBQWMsRUFBRTtJQUMvQyxFQUFFLEVBQUUsYUFBSyxDQUFDLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDLFVBQVUsRUFBRTtJQUM5QyxJQUFJLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRTtJQUNsQixjQUFjLEVBQUUsYUFBSyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sRUFBRSxRQUFRLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDO0lBQzFFLFNBQVMsRUFBRSxhQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUNwQyxVQUFVLEVBQUUsYUFBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFDckMsUUFBUSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDakMsT0FBTyxFQUFFLGFBQUssQ0FBQyxTQUFTLENBQUMsR0FBRyxFQUFFLENBQUMsZ0NBQWMsRUFBRSxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsQ0FBQztDQUN0RSxDQUFDLENBQUMifQ==