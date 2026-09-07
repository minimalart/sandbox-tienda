"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const utils_1 = require("@medusajs/framework/utils");
const fiscal_documentation_1 = require("../../../../../modules/fiscal-documentation");
const _helpers_1 = require("../../_helpers");
/**
 * GET /admin/fiscal-documents/:id/download — streamea el PDF por el backend.
 * Los PDFs se suben privados (no expone la URL pública del bucket); este proxy
 * autenticado los sirve same-origin.
 */
async function GET(req, res) {
    // Todos los handlers: un id adivinado baja la constancia de otra tienda, con
    // CUIT y domicilio fiscal adentro.
    await (0, _helpers_1.assertFiscalDocumentInSite)(req, req.params.id);
    const service = req.scope.resolve(fiscal_documentation_1.FISCAL_DOCUMENTATION_MODULE);
    const id = req.params.id;
    const doc = (await service.retrieveFiscalDocument(id));
    if (!doc?.file_id) {
        res.status(404).json({ message: 'Este documento no tiene un PDF asociado.' });
        return;
    }
    const fileModule = req.scope.resolve(utils_1.Modules.FILE);
    const stream = await fileModule.getDownloadStream(doc.file_id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('Content-Disposition', `inline; filename="constancia-${doc.tax_id ?? id}.pdf"`);
    stream.on('error', () => {
        if (!res.headersSent)
            res.status(404);
        res.end();
    });
    stream.pipe(res);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2Zpc2NhbC1kb2N1bWVudHMvW2lkXS9kb3dubG9hZC9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQWFBLGtCQXlCQztBQXJDRCxxREFBb0Q7QUFFcEQsc0ZBQTBGO0FBRzFGLDZDQUE0RDtBQUU1RDs7OztHQUlHO0FBQ0ksS0FBSyxVQUFVLEdBQUcsQ0FBQyxHQUFrQixFQUFFLEdBQW1CO0lBQy9ELDZFQUE2RTtJQUM3RSxtQ0FBbUM7SUFDbkMsTUFBTSxJQUFBLHFDQUEwQixFQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQVksQ0FBQyxDQUFDO0lBRS9ELE1BQU0sT0FBTyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFtQyxrREFBMkIsQ0FBQyxDQUFDO0lBQ2pHLE1BQU0sRUFBRSxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBWSxDQUFDO0lBQ25DLE1BQU0sR0FBRyxHQUFHLENBQUMsTUFBTSxPQUFPLENBQUMsc0JBQXNCLENBQUMsRUFBRSxDQUFDLENBQWlELENBQUM7SUFFdkcsSUFBSSxDQUFDLEdBQUcsRUFBRSxPQUFPLEVBQUUsQ0FBQztRQUNsQixHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSwwQ0FBMEMsRUFBRSxDQUFDLENBQUM7UUFDOUUsT0FBTztJQUNULENBQUM7SUFFRCxNQUFNLFVBQVUsR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBcUIsZUFBTyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3ZFLE1BQU0sTUFBTSxHQUFHLE1BQU0sVUFBVSxDQUFDLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUUvRCxHQUFHLENBQUMsU0FBUyxDQUFDLGNBQWMsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDO0lBQ2pELEdBQUcsQ0FBQyxTQUFTLENBQUMsZUFBZSxFQUFFLHNCQUFzQixDQUFDLENBQUM7SUFDdkQsR0FBRyxDQUFDLFNBQVMsQ0FBQyxxQkFBcUIsRUFBRSxnQ0FBZ0MsR0FBRyxDQUFDLE1BQU0sSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQzlGLE1BQU0sQ0FBQyxFQUFFLENBQUMsT0FBTyxFQUFFLEdBQUcsRUFBRTtRQUN0QixJQUFJLENBQUMsR0FBRyxDQUFDLFdBQVc7WUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ3RDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztJQUNaLENBQUMsQ0FBQyxDQUFDO0lBQ0gsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUNuQixDQUFDIn0=