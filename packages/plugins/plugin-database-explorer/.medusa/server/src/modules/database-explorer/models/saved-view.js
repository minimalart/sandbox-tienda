"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseExplorerSavedView = void 0;
const utils_1 = require("@medusajs/framework/utils");
exports.DatabaseExplorerSavedView = utils_1.model
    .define('database_explorer_saved_view', {
    id: utils_1.model.id({ prefix: 'dbxview' }).primaryKey(),
    name: utils_1.model.text(),
    description: utils_1.model.text().nullable(),
    table_name: utils_1.model.text(),
    filters_json: utils_1.model.json().nullable(),
    columns_json: utils_1.model.json().nullable(),
    sort_json: utils_1.model.json().nullable(),
    role_ids_json: utils_1.model.json().nullable(),
    enabled: utils_1.model.boolean().default(true),
})
    .indexes([{ on: ['table_name'] }, { on: ['enabled'] }]);
exports.default = exports.DatabaseExplorerSavedView;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2F2ZWQtdmlldy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2RhdGFiYXNlLWV4cGxvcmVyL21vZGVscy9zYXZlZC12aWV3LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHFEQUFrRDtBQUVyQyxRQUFBLHlCQUF5QixHQUFHLGFBQUs7S0FDM0MsTUFBTSxDQUFDLDhCQUE4QixFQUFFO0lBQ3RDLEVBQUUsRUFBRSxhQUFLLENBQUMsRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUMsVUFBVSxFQUFFO0lBQ2hELElBQUksRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFO0lBQ2xCLFdBQVcsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ3BDLFVBQVUsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFO0lBQ3hCLFlBQVksRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ3JDLFlBQVksRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ3JDLFNBQVMsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ2xDLGFBQWEsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ3RDLE9BQU8sRUFBRSxhQUFLLENBQUMsT0FBTyxFQUFFLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQztDQUN2QyxDQUFDO0tBQ0QsT0FBTyxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxZQUFZLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFFMUQsa0JBQWUsaUNBQXlCLENBQUMifQ==