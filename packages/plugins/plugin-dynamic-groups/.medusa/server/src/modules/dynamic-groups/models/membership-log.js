"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DynamicGroupMembershipLog = void 0;
const utils_1 = require("@medusajs/framework/utils");
/**
 * Historial/auditoría de pertenencia: cada vez que un cliente entra o sale de
 * un grupo dinámico se registra acá, con la razón (regla/atributos que lo
 * dispararon). Permite responder "¿por qué este cliente recibió/no recibió X?".
 */
exports.DynamicGroupMembershipLog = utils_1.model
    .define('dynamic_group_membership_log', {
    id: utils_1.model.id({ prefix: 'dgml' }).primaryKey(),
    dynamic_group_id: utils_1.model.text(),
    customer_id: utils_1.model.text(),
    // 'added' | 'removed'
    action: utils_1.model.text(),
    // { match, conditions, aggregates } — por qué entró/salió.
    reason: utils_1.model.json().nullable(),
})
    .indexes([{ on: ['dynamic_group_id'] }, { on: ['customer_id'] }]);
exports.default = exports.DynamicGroupMembershipLog;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVtYmVyc2hpcC1sb2cuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9keW5hbWljLWdyb3Vwcy9tb2RlbHMvbWVtYmVyc2hpcC1sb2cudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscURBQWtEO0FBRWxEOzs7O0dBSUc7QUFDVSxRQUFBLHlCQUF5QixHQUFHLGFBQUs7S0FDM0MsTUFBTSxDQUFDLDhCQUE4QixFQUFFO0lBQ3RDLEVBQUUsRUFBRSxhQUFLLENBQUMsRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUMsVUFBVSxFQUFFO0lBQzdDLGdCQUFnQixFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUU7SUFDOUIsV0FBVyxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUU7SUFDekIsc0JBQXNCO0lBQ3RCLE1BQU0sRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFO0lBQ3BCLDJEQUEyRDtJQUMzRCxNQUFNLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtDQUNoQyxDQUFDO0tBQ0QsT0FBTyxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxhQUFhLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUVwRSxrQkFBZSxpQ0FBeUIsQ0FBQyJ9