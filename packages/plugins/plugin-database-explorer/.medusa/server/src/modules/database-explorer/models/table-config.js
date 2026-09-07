"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseExplorerTableConfig = void 0;
const utils_1 = require("@medusajs/framework/utils");
exports.DatabaseExplorerTableConfig = utils_1.model
    .define('database_explorer_table_config', {
    id: utils_1.model.id({ prefix: 'dbxtbl' }).primaryKey(),
    table_name: utils_1.model.text(),
    display_name: utils_1.model.text().nullable(),
    description: utils_1.model.text().nullable(),
    enabled: utils_1.model.boolean().default(false),
    show_in_visual: utils_1.model.boolean().default(true),
    primary_label_column: utils_1.model.text().nullable(),
    default_sort_column: utils_1.model.text().nullable(),
    default_sort_direction: utils_1.model.text().default('desc'),
})
    .indexes([{ on: ['table_name'], unique: true }, { on: ['enabled'] }]);
exports.default = exports.DatabaseExplorerTableConfig;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFibGUtY29uZmlnLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL21vZHVsZXMvZGF0YWJhc2UtZXhwbG9yZXIvbW9kZWxzL3RhYmxlLWNvbmZpZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxxREFBa0Q7QUFFckMsUUFBQSwyQkFBMkIsR0FBRyxhQUFLO0tBQzdDLE1BQU0sQ0FBQyxnQ0FBZ0MsRUFBRTtJQUN4QyxFQUFFLEVBQUUsYUFBSyxDQUFDLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDLFVBQVUsRUFBRTtJQUMvQyxVQUFVLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRTtJQUN4QixZQUFZLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNyQyxXQUFXLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNwQyxPQUFPLEVBQUUsYUFBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUM7SUFDdkMsY0FBYyxFQUFFLGFBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDO0lBQzdDLG9CQUFvQixFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDN0MsbUJBQW1CLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUM1QyxzQkFBc0IsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQztDQUNyRCxDQUFDO0tBQ0QsT0FBTyxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxZQUFZLENBQUMsRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUV4RSxrQkFBZSxtQ0FBMkIsQ0FBQyJ9