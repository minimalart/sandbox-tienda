"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PAYMENT_BENEFITS_MODULE = void 0;
const utils_1 = require("@medusajs/framework/utils");
const service_1 = __importDefault(require("./service"));
var types_1 = require("./types");
Object.defineProperty(exports, "PAYMENT_BENEFITS_MODULE", { enumerable: true, get: function () { return types_1.PAYMENT_BENEFITS_MODULE; } });
const moduleDefinition = (0, utils_1.Module)('payment_benefits', {
    service: service_1.default,
});
exports.default = moduleDefinition;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9wYXltZW50LWJlbmVmaXRzL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBLHFEQUFtRDtBQUNuRCx3REFBcUQ7QUFFckQsaUNBQWtEO0FBQXpDLGdIQUFBLHVCQUF1QixPQUFBO0FBRWhDLE1BQU0sZ0JBQWdCLEdBQThCLElBQUEsY0FBTSxFQUFDLGtCQUFrQixFQUFFO0lBQzdFLE9BQU8sRUFBRSxpQkFBNEI7Q0FDdEMsQ0FBQyxDQUFDO0FBRUgsa0JBQWUsZ0JBQWdCLENBQUMifQ==