"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListFiscalDocumentsQuery = exports.PostFiscalDocument = void 0;
const zod_1 = require("zod");
const cuit_1 = require("../../../lib/cuit");
/**
 * POST /admin/fiscal-documents — consulta ARCA para un CUIT y genera una
 * constancia versionada asociada a la empresa (corporate | company).
 */
exports.PostFiscalDocument = zod_1.z.object({
    owner_type: zod_1.z.enum(['corporate', 'company']),
    owner_id: zod_1.z.string().min(1, 'owner_id es requerido'),
    cuit: zod_1.z
        .string()
        .transform((v) => v.replace(/\D/g, ''))
        .refine(cuit_1.validateCuit, 'CUIT inválido (revisá los 11 dígitos y el verificador).'),
});
/** GET /admin/fiscal-documents?owner_type=&owner_id= — lista por owner. */
exports.ListFiscalDocumentsQuery = zod_1.z.object({
    owner_type: zod_1.z.enum(['corporate', 'company']),
    owner_id: zod_1.z.string().min(1, 'owner_id es requerido'),
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmFsaWRhdG9ycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9hcGkvYWRtaW4vZmlzY2FsLWRvY3VtZW50cy92YWxpZGF0b3JzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLDZCQUF3QjtBQUN4Qiw0Q0FBaUQ7QUFFakQ7OztHQUdHO0FBQ1UsUUFBQSxrQkFBa0IsR0FBRyxPQUFDLENBQUMsTUFBTSxDQUFDO0lBQ3pDLFVBQVUsRUFBRSxPQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsV0FBVyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQzVDLFFBQVEsRUFBRSxPQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSx1QkFBdUIsQ0FBQztJQUNwRCxJQUFJLEVBQUUsT0FBQztTQUNKLE1BQU0sRUFBRTtTQUNSLFNBQVMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7U0FDdEMsTUFBTSxDQUFDLG1CQUFZLEVBQUUseURBQXlELENBQUM7Q0FDbkYsQ0FBQyxDQUFDO0FBSUgsMkVBQTJFO0FBQzlELFFBQUEsd0JBQXdCLEdBQUcsT0FBQyxDQUFDLE1BQU0sQ0FBQztJQUMvQyxVQUFVLEVBQUUsT0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFdBQVcsRUFBRSxTQUFTLENBQUMsQ0FBQztJQUM1QyxRQUFRLEVBQUUsT0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsdUJBQXVCLENBQUM7Q0FDckQsQ0FBQyxDQUFDIn0=