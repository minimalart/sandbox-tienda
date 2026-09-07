"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.DELETE = DELETE;
const fiscal_documentation_1 = require("../../../../modules/fiscal-documentation");
const _helpers_1 = require("../_helpers");
/** GET /admin/fiscal-documents/:id — un documento. */
async function GET(req, res) {
    // Todos los handlers: un id adivinado baja la constancia de otra tienda, con
    // CUIT y domicilio fiscal adentro.
    await (0, _helpers_1.assertFiscalDocumentInSite)(req, req.params.id);
    const service = req.scope.resolve(fiscal_documentation_1.FISCAL_DOCUMENTATION_MODULE);
    const id = req.params.id;
    const fiscal_document = await service.retrieveFiscalDocument(id);
    res.json({ fiscal_document });
}
/**
 * DELETE /admin/fiscal-documents/:id — baja lógica (soft delete). No borra el
 * PDF del File module ni rompe el historial; solo lo oculta de los listados.
 */
async function DELETE(req, res) {
    // Todos los handlers: un id adivinado baja la constancia de otra tienda, con
    // CUIT y domicilio fiscal adentro.
    await (0, _helpers_1.assertFiscalDocumentInSite)(req, req.params.id);
    const service = req.scope.resolve(fiscal_documentation_1.FISCAL_DOCUMENTATION_MODULE);
    const id = req.params.id;
    await service.softDeleteFiscalDocuments([id]);
    res.json({ id, deleted: true });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2Zpc2NhbC1kb2N1bWVudHMvW2lkXS9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQU9BLGtCQVNDO0FBTUQsd0JBU0M7QUE5QkQsbUZBQXVGO0FBR3ZGLDBDQUF5RDtBQUV6RCxzREFBc0Q7QUFDL0MsS0FBSyxVQUFVLEdBQUcsQ0FBQyxHQUFrQixFQUFFLEdBQW1CO0lBQy9ELDZFQUE2RTtJQUM3RSxtQ0FBbUM7SUFDbkMsTUFBTSxJQUFBLHFDQUEwQixFQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQVksQ0FBQyxDQUFDO0lBRS9ELE1BQU0sT0FBTyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFtQyxrREFBMkIsQ0FBQyxDQUFDO0lBQ2pHLE1BQU0sRUFBRSxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBWSxDQUFDO0lBQ25DLE1BQU0sZUFBZSxHQUFHLE1BQU0sT0FBTyxDQUFDLHNCQUFzQixDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQ2pFLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxlQUFlLEVBQUUsQ0FBQyxDQUFDO0FBQ2hDLENBQUM7QUFFRDs7O0dBR0c7QUFDSSxLQUFLLFVBQVUsTUFBTSxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDbEUsNkVBQTZFO0lBQzdFLG1DQUFtQztJQUNuQyxNQUFNLElBQUEscUNBQTBCLEVBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBWSxDQUFDLENBQUM7SUFFL0QsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQW1DLGtEQUEyQixDQUFDLENBQUM7SUFDakcsTUFBTSxFQUFFLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFZLENBQUM7SUFDbkMsTUFBTSxPQUFPLENBQUMseUJBQXlCLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQzlDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7QUFDbEMsQ0FBQyJ9