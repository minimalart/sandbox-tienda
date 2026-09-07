"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseExplorerAuditLog = void 0;
const utils_1 = require("@medusajs/framework/utils");
exports.DatabaseExplorerAuditLog = utils_1.model
    .define('database_explorer_audit_log', {
    id: utils_1.model.id({ prefix: 'dbxaud' }).primaryKey(),
    user_id: utils_1.model.text().nullable(),
    action: utils_1.model.text(),
    table_name: utils_1.model.text().nullable(),
    record_id: utils_1.model.text().nullable(),
    view_id: utils_1.model.text().nullable(),
    filters_json: utils_1.model.json().nullable(),
    duration_ms: utils_1.model.number().nullable(),
    success: utils_1.model.boolean().default(true),
    error_message: utils_1.model.text().nullable(),
})
    .indexes([
    { on: ['user_id'] },
    { on: ['table_name'] },
    { on: ['action'] },
    { on: ['created_at'] },
]);
exports.default = exports.DatabaseExplorerAuditLog;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXVkaXQtbG9nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL21vZHVsZXMvZGF0YWJhc2UtZXhwbG9yZXIvbW9kZWxzL2F1ZGl0LWxvZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxxREFBa0Q7QUFFckMsUUFBQSx3QkFBd0IsR0FBRyxhQUFLO0tBQzFDLE1BQU0sQ0FBQyw2QkFBNkIsRUFBRTtJQUNyQyxFQUFFLEVBQUUsYUFBSyxDQUFDLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDLFVBQVUsRUFBRTtJQUMvQyxPQUFPLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNoQyxNQUFNLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRTtJQUNwQixVQUFVLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNuQyxTQUFTLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNsQyxPQUFPLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNoQyxZQUFZLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNyQyxXQUFXLEVBQUUsYUFBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUN0QyxPQUFPLEVBQUUsYUFBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUM7SUFDdEMsYUFBYSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7Q0FDdkMsQ0FBQztLQUNELE9BQU8sQ0FBQztJQUNQLEVBQUUsRUFBRSxFQUFFLENBQUMsU0FBUyxDQUFDLEVBQUU7SUFDbkIsRUFBRSxFQUFFLEVBQUUsQ0FBQyxZQUFZLENBQUMsRUFBRTtJQUN0QixFQUFFLEVBQUUsRUFBRSxDQUFDLFFBQVEsQ0FBQyxFQUFFO0lBQ2xCLEVBQUUsRUFBRSxFQUFFLENBQUMsWUFBWSxDQUFDLEVBQUU7Q0FDdkIsQ0FBQyxDQUFDO0FBRUwsa0JBQWUsZ0NBQXdCLENBQUMifQ==