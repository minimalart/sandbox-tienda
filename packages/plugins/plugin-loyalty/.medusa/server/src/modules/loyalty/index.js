"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOYALTY_MODULE = void 0;
const utils_1 = require("@medusajs/framework/utils");
const service_1 = __importDefault(require("./service"));
// NOTE: must NOT be 'loyalty' — that key belongs to @medusajs/loyalty-plugin,
// which ships its own `loyalty` module and a loyalty↔gift_card link (used for
// gift-card store credit). Reusing 'loyalty' shadows the plugin's service, so
// its link resolves against this module and `medusa build` fails with
// "Key gift_card_id is not linkable on service loyalty". Keep this distinct.
exports.LOYALTY_MODULE = 'loyalty_engine';
const moduleDefinition = (0, utils_1.Module)(exports.LOYALTY_MODULE, {
    service: service_1.default,
});
exports.default = moduleDefinition;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9sb3lhbHR5L2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBLHFEQUFtRDtBQUNuRCx3REFBNkM7QUFFN0MsOEVBQThFO0FBQzlFLDhFQUE4RTtBQUM5RSw4RUFBOEU7QUFDOUUsc0VBQXNFO0FBQ3RFLDZFQUE2RTtBQUNoRSxRQUFBLGNBQWMsR0FBRyxnQkFBZ0IsQ0FBQztBQUUvQyxNQUFNLGdCQUFnQixHQUE4QixJQUFBLGNBQU0sRUFBQyxzQkFBYyxFQUFFO0lBQ3pFLE9BQU8sRUFBRSxpQkFBb0I7Q0FDOUIsQ0FBQyxDQUFDO0FBRUgsa0JBQWUsZ0JBQWdCLENBQUMifQ==