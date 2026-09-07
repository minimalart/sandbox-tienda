"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseExplorerColumnConfig = void 0;
const utils_1 = require("@medusajs/framework/utils");
exports.DatabaseExplorerColumnConfig = utils_1.model
    .define('database_explorer_column_config', {
    id: utils_1.model.id({ prefix: 'dbxcol' }).primaryKey(),
    table_name: utils_1.model.text(),
    column_name: utils_1.model.text(),
    display_name: utils_1.model.text().nullable(),
    data_type: utils_1.model.text().nullable(),
    visible: utils_1.model.boolean().default(false),
    masked: utils_1.model.boolean().default(false),
    searchable: utils_1.model.boolean().default(false),
    filterable: utils_1.model.boolean().default(false),
    sortable: utils_1.model.boolean().default(false),
    sensitive: utils_1.model.boolean().default(false),
})
    .indexes([
    { on: ['table_name', 'column_name'], unique: true },
    { on: ['table_name'] },
]);
exports.default = exports.DatabaseExplorerColumnConfig;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29sdW1uLWNvbmZpZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2RhdGFiYXNlLWV4cGxvcmVyL21vZGVscy9jb2x1bW4tY29uZmlnLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHFEQUFrRDtBQUVyQyxRQUFBLDRCQUE0QixHQUFHLGFBQUs7S0FDOUMsTUFBTSxDQUFDLGlDQUFpQyxFQUFFO0lBQ3pDLEVBQUUsRUFBRSxhQUFLLENBQUMsRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRSxDQUFDLENBQUMsVUFBVSxFQUFFO0lBQy9DLFVBQVUsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFO0lBQ3hCLFdBQVcsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFO0lBQ3pCLFlBQVksRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ3JDLFNBQVMsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ2xDLE9BQU8sRUFBRSxhQUFLLENBQUMsT0FBTyxFQUFFLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQztJQUN2QyxNQUFNLEVBQUUsYUFBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUM7SUFDdEMsVUFBVSxFQUFFLGFBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDO0lBQzFDLFVBQVUsRUFBRSxhQUFLLENBQUMsT0FBTyxFQUFFLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQztJQUMxQyxRQUFRLEVBQUUsYUFBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUM7SUFDeEMsU0FBUyxFQUFFLGFBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDO0NBQzFDLENBQUM7S0FDRCxPQUFPLENBQUM7SUFDUCxFQUFFLEVBQUUsRUFBRSxDQUFDLFlBQVksRUFBRSxhQUFhLENBQUMsRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFO0lBQ25ELEVBQUUsRUFBRSxFQUFFLENBQUMsWUFBWSxDQUFDLEVBQUU7Q0FDdkIsQ0FBQyxDQUFDO0FBRUwsa0JBQWUsb0NBQTRCLENBQUMifQ==