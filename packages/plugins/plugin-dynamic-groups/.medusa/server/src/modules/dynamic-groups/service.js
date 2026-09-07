"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
const models_1 = require("./models");
class DynamicGroupsModuleService extends (0, utils_1.MedusaService)({
    DynamicGroup: models_1.DynamicGroup,
    DynamicGroupMembershipLog: models_1.DynamicGroupMembershipLog,
}) {
    /** Registra una entrada/salida de un cliente en el historial. */
    async logMembership(entries) {
        if (!entries.length)
            return;
        await this.createDynamicGroupMembershipLogs(entries);
    }
}
exports.default = DynamicGroupsModuleService;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2R5bmFtaWMtZ3JvdXBzL3NlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxxREFBMEQ7QUFDMUQscUNBQW1FO0FBRW5FLE1BQU0sMEJBQTJCLFNBQVEsSUFBQSxxQkFBYSxFQUFDO0lBQ3JELFlBQVksRUFBWixxQkFBWTtJQUNaLHlCQUF5QixFQUF6QixrQ0FBeUI7Q0FDMUIsQ0FBQztJQUNBLGlFQUFpRTtJQUNqRSxLQUFLLENBQUMsYUFBYSxDQUNqQixPQUtFO1FBRUYsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNO1lBQUUsT0FBTztRQUM1QixNQUFNLElBQUksQ0FBQyxnQ0FBZ0MsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUN2RCxDQUFDO0NBQ0Y7QUFFRCxrQkFBZSwwQkFBMEIsQ0FBQyJ9