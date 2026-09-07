"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseExplorerRelationConfig = void 0;
const utils_1 = require("@medusajs/framework/utils");
exports.DatabaseExplorerRelationConfig = utils_1.model
    .define('database_explorer_relation_config', {
    id: utils_1.model.id({ prefix: 'dbxrel' }).primaryKey(),
    source_table: utils_1.model.text(),
    source_column: utils_1.model.text(),
    target_table: utils_1.model.text(),
    target_column: utils_1.model.text(),
    relation_type: utils_1.model.text().default('many_to_one'),
    display_name: utils_1.model.text().nullable(),
    enabled: utils_1.model.boolean().default(true),
})
    .indexes([
    { on: ['source_table', 'source_column'] },
    { on: ['target_table', 'target_column'] },
    { on: ['enabled'] },
]);
exports.default = exports.DatabaseExplorerRelationConfig;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVsYXRpb24tY29uZmlnLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL21vZHVsZXMvZGF0YWJhc2UtZXhwbG9yZXIvbW9kZWxzL3JlbGF0aW9uLWNvbmZpZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxxREFBa0Q7QUFFckMsUUFBQSw4QkFBOEIsR0FBRyxhQUFLO0tBQ2hELE1BQU0sQ0FBQyxtQ0FBbUMsRUFBRTtJQUMzQyxFQUFFLEVBQUUsYUFBSyxDQUFDLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDLFVBQVUsRUFBRTtJQUMvQyxZQUFZLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRTtJQUMxQixhQUFhLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRTtJQUMzQixZQUFZLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRTtJQUMxQixhQUFhLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRTtJQUMzQixhQUFhLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUM7SUFDbEQsWUFBWSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDckMsT0FBTyxFQUFFLGFBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDO0NBQ3ZDLENBQUM7S0FDRCxPQUFPLENBQUM7SUFDUCxFQUFFLEVBQUUsRUFBRSxDQUFDLGNBQWMsRUFBRSxlQUFlLENBQUMsRUFBRTtJQUN6QyxFQUFFLEVBQUUsRUFBRSxDQUFDLGNBQWMsRUFBRSxlQUFlLENBQUMsRUFBRTtJQUN6QyxFQUFFLEVBQUUsRUFBRSxDQUFDLFNBQVMsQ0FBQyxFQUFFO0NBQ3BCLENBQUMsQ0FBQztBQUVMLGtCQUFlLHNDQUE4QixDQUFDIn0=