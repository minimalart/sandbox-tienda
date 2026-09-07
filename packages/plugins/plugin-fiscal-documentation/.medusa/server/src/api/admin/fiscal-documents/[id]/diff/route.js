"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const utils_1 = require("@medusajs/framework/utils");
const fiscal_documentation_1 = require("../../../../../modules/fiscal-documentation");
const _helpers_1 = require("../../_helpers");
/**
 * GET /admin/fiscal-documents/:id/diff[?against=<otherId>] — diferencias entre
 * este documento y otro (o la versión inmediatamente anterior del mismo owner).
 */
async function GET(req, res) {
    // Todos los handlers: un id adivinado baja la constancia de otra tienda, con
    // CUIT y domicilio fiscal adentro.
    await (0, _helpers_1.assertFiscalDocumentInSite)(req, req.params.id);
    const service = req.scope.resolve(fiscal_documentation_1.FISCAL_DOCUMENTATION_MODULE);
    const id = req.params.id;
    const against = typeof req.query.against === 'string' ? req.query.against : undefined;
    try {
        const result = await service.compare(id, against);
        res.json({
            before: { id: result.before.id, created_at: result.before.created_at },
            after: { id: result.after.id, created_at: result.after.created_at },
            changes: result.changes,
            changed: result.changes.length > 0,
        });
    }
    catch (error) {
        if (error instanceof utils_1.MedusaError && error.type === utils_1.MedusaError.Types.NOT_FOUND) {
            res.status(404).json({ message: error.message });
            return;
        }
        if (error instanceof utils_1.MedusaError && error.type === utils_1.MedusaError.Types.INVALID_DATA) {
            res.status(400).json({ message: error.message });
            return;
        }
        throw error;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2Zpc2NhbC1kb2N1bWVudHMvW2lkXS9kaWZmL3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBV0Esa0JBNEJDO0FBdENELHFEQUF3RDtBQUN4RCxzRkFBMEY7QUFHMUYsNkNBQTREO0FBRTVEOzs7R0FHRztBQUNJLEtBQUssVUFBVSxHQUFHLENBQUMsR0FBa0IsRUFBRSxHQUFtQjtJQUMvRCw2RUFBNkU7SUFDN0UsbUNBQW1DO0lBQ25DLE1BQU0sSUFBQSxxQ0FBMEIsRUFBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFZLENBQUMsQ0FBQztJQUUvRCxNQUFNLE9BQU8sR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBbUMsa0RBQTJCLENBQUMsQ0FBQztJQUNqRyxNQUFNLEVBQUUsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQVksQ0FBQztJQUNuQyxNQUFNLE9BQU8sR0FBRyxPQUFPLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztJQUV0RixJQUFJLENBQUM7UUFDSCxNQUFNLE1BQU0sR0FBRyxNQUFNLE9BQU8sQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ2xELEdBQUcsQ0FBQyxJQUFJLENBQUM7WUFDUCxNQUFNLEVBQUUsRUFBRSxFQUFFLEVBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFFLEVBQUUsVUFBVSxFQUFFLE1BQU0sQ0FBQyxNQUFNLENBQUMsVUFBVSxFQUFFO1lBQ3RFLEtBQUssRUFBRSxFQUFFLEVBQUUsRUFBRSxNQUFNLENBQUMsS0FBSyxDQUFDLEVBQUUsRUFBRSxVQUFVLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxVQUFVLEVBQUU7WUFDbkUsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPO1lBQ3ZCLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLE1BQU0sR0FBRyxDQUFDO1NBQ25DLENBQUMsQ0FBQztJQUNMLENBQUM7SUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1FBQ2YsSUFBSSxLQUFLLFlBQVksbUJBQVcsSUFBSSxLQUFLLENBQUMsSUFBSSxLQUFLLG1CQUFXLENBQUMsS0FBSyxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQy9FLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO1lBQ2pELE9BQU87UUFDVCxDQUFDO1FBQ0QsSUFBSSxLQUFLLFlBQVksbUJBQVcsSUFBSSxLQUFLLENBQUMsSUFBSSxLQUFLLG1CQUFXLENBQUMsS0FBSyxDQUFDLFlBQVksRUFBRSxDQUFDO1lBQ2xGLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO1lBQ2pELE9BQU87UUFDVCxDQUFDO1FBQ0QsTUFBTSxLQUFLLENBQUM7SUFDZCxDQUFDO0FBQ0gsQ0FBQyJ9