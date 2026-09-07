"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GA4_MODULE = void 0;
const utils_1 = require("@medusajs/framework/utils");
const service_1 = __importDefault(require("./service"));
exports.GA4_MODULE = 'ga4';
/**
 * El `Module(...)` con `service: Ga4ModuleService` genera un tipo que arrastra
 * la clase entera. `Ga4ModuleService` extiende `MedusaService({ Ga4EventMapping,
 * Ga4BuiltinSetting, Ga4Settings })`, y con TRES modelos la inferencia de
 * métodos generados desborda el límite de instanciación al emitir el `.d.ts`
 * (TS2589). Casteamos el default export a `unknown` para no arrastrar ese tipo
 * a través del barrel; en runtime sigue siendo el mismo objeto que el host
 * pasa a `Modules`.
 */
const definition = (0, utils_1.Module)(exports.GA4_MODULE, {
    service: service_1.default,
});
exports.default = definition;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9nYTQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEscURBQW1EO0FBQ25ELHdEQUF5QztBQUU1QixRQUFBLFVBQVUsR0FBRyxLQUFLLENBQUM7QUFFaEM7Ozs7Ozs7O0dBUUc7QUFDSCxNQUFNLFVBQVUsR0FBRyxJQUFBLGNBQU0sRUFBQyxrQkFBVSxFQUFFO0lBQ3BDLE9BQU8sRUFBRSxpQkFBZ0I7Q0FDMUIsQ0FBQyxDQUFDO0FBRUgsa0JBQWUsVUFBNkMsQ0FBQyJ9