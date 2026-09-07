"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Campaign = void 0;
const utils_1 = require("@medusajs/framework/utils");
const loyalty_program_1 = require("./loyalty-program");
// A time-boxed boost (double/triple points, extra points). While active, the
// earn workflow applies `multiplier` to the rules listed in `affected_rule_ids`
// (empty = all rules). `priority` breaks ties when several campaigns overlap.
exports.Campaign = utils_1.model.define('loyalty_campaign', {
    id: utils_1.model.id({ prefix: 'loycm' }).primaryKey(),
    name: utils_1.model.text(),
    status: utils_1.model.enum(['active', 'inactive']).default('active'),
    starts_at: utils_1.model.dateTime().nullable(),
    ends_at: utils_1.model.dateTime().nullable(),
    multiplier: utils_1.model.number().default(1),
    affected_rule_ids: utils_1.model.json().nullable(),
    limits: utils_1.model.json().nullable(),
    priority: utils_1.model.number().default(0),
    program: utils_1.model.belongsTo(() => loyalty_program_1.LoyaltyProgram, { mappedBy: 'campaigns' }),
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FtcGFpZ24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9sb3lhbHR5L21vZGVscy9jYW1wYWlnbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxxREFBa0Q7QUFDbEQsdURBQW1EO0FBRW5ELDZFQUE2RTtBQUM3RSxnRkFBZ0Y7QUFDaEYsOEVBQThFO0FBQ2pFLFFBQUEsUUFBUSxHQUFHLGFBQUssQ0FBQyxNQUFNLENBQUMsa0JBQWtCLEVBQUU7SUFDdkQsRUFBRSxFQUFFLGFBQUssQ0FBQyxFQUFFLENBQUMsRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLENBQUMsQ0FBQyxVQUFVLEVBQUU7SUFDOUMsSUFBSSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUU7SUFDbEIsTUFBTSxFQUFFLGFBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLEVBQUUsVUFBVSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDO0lBQzVELFNBQVMsRUFBRSxhQUFLLENBQUMsUUFBUSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ3RDLE9BQU8sRUFBRSxhQUFLLENBQUMsUUFBUSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ3BDLFVBQVUsRUFBRSxhQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUNyQyxpQkFBaUIsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQzFDLE1BQU0sRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQy9CLFFBQVEsRUFBRSxhQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUNuQyxPQUFPLEVBQUUsYUFBSyxDQUFDLFNBQVMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxnQ0FBYyxFQUFFLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSxDQUFDO0NBQzFFLENBQUMsQ0FBQyJ9