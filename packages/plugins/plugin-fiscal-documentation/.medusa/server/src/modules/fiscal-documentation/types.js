"use strict";
/**
 * Documentación Fiscal — módulo compartido que almacena constancias fiscales
 * (obtenidas de ARCA) y su historial de versiones, asociadas a una empresa
 * corporativa (`corporate`) o mayorista (`company`).
 *
 * El modelo es polimórfico (`owner_type` + `owner_id`) para poder ser reutilizado
 * por ambas extensiones y por integraciones futuras (facturación, ERP, agentes).
 * La obtención del dato viene de `modules/arca` (lookupTaxpayer); este módulo solo
 * persiste snapshots, genera el PDF y mantiene el historial/diff.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FISCAL_OWNER_TYPES = exports.FISCAL_DOCUMENTATION_MODULE = void 0;
exports.FISCAL_DOCUMENTATION_MODULE = 'fiscal_documentation';
exports.FISCAL_OWNER_TYPES = ['corporate', 'company'];
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHlwZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9maXNjYWwtZG9jdW1lbnRhdGlvbi90eXBlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7OztHQVNHOzs7QUFFVSxRQUFBLDJCQUEyQixHQUFHLHNCQUFzQixDQUFDO0FBS3JELFFBQUEsa0JBQWtCLEdBQXNCLENBQUMsV0FBVyxFQUFFLFNBQVMsQ0FBQyxDQUFDIn0=