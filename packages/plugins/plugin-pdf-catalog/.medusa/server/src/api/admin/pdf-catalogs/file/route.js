"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const utils_1 = require("@medusajs/framework/utils");
const request_1 = require("../../../../lib/multistore/request");
const scope_1 = require("../../../../lib/multistore/scope");
const site_scope_1 = require("../../../../modules/pdf-catalog/site-scope");
const pdf_catalog_1 = require("../../../../modules/pdf-catalog");
/**
 * GET /admin/pdf-catalogs/file?id=<file_id> — streamea el PDF por el backend.
 *
 * El bucket (DO Spaces) no manda headers CORS, así que react-pdf no puede
 * fetchear la URL pública desde el admin; este proxy same-origin lo evita.
 */
async function GET(req, res) {
    const id = typeof req.query.id === 'string' ? req.query.id : '';
    if (!id) {
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, 'Query param "id" is required');
    }
    /**
     * El `id` es un file_id del bucket, no una fila nuestra: sin esto, cualquiera con un
     * file_id se baja el catálogo de otra tienda. Se resuelve al revés — se buscan los
     * catálogos de la tienda y se exige que alguno apunte a ESE archivo.
     */
    const catalogService = req.scope.resolve(pdf_catalog_1.PDF_CATALOG_MODULE);
    const ownCatalogs = await catalogService.listPdfCatalogs({
        pdf_file_id: id,
        ...(await (0, scope_1.siteFilter)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.PDF_CATALOG_SITE_SCOPE)),
    });
    if (ownCatalogs.length === 0) {
        // 404 y no 403: un 403 confirmaría que el archivo existe en otra tienda.
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_FOUND, 'No encontrado.');
    }
    const fileModule = req.scope.resolve(utils_1.Modules.FILE);
    const stream = await fileModule.getDownloadStream(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'private, max-age=300');
    stream.on('error', () => {
        if (!res.headersSent)
            res.status(404);
        res.end();
    });
    stream.pipe(res);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL3BkZi1jYXRhbG9ncy9maWxlL3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBZ0JBLGtCQStCQztBQTlDRCxxREFBaUU7QUFHakUsZ0VBQXFFO0FBQ3JFLDREQUE4RDtBQUM5RCwyRUFBb0Y7QUFDcEYsaUVBQXFFO0FBR3JFOzs7OztHQUtHO0FBQ0ksS0FBSyxVQUFVLEdBQUcsQ0FBQyxHQUFrQixFQUFFLEdBQW1CO0lBQy9ELE1BQU0sRUFBRSxHQUFHLE9BQU8sR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO0lBQ2hFLElBQUksQ0FBQyxFQUFFLEVBQUUsQ0FBQztRQUNSLE1BQU0sSUFBSSxtQkFBVyxDQUFDLG1CQUFXLENBQUMsS0FBSyxDQUFDLFlBQVksRUFBRSw4QkFBOEIsQ0FBQyxDQUFDO0lBQ3hGLENBQUM7SUFFRDs7OztPQUlHO0lBQ0gsTUFBTSxjQUFjLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQTBCLGdDQUFrQixDQUFDLENBQUM7SUFDdEYsTUFBTSxXQUFXLEdBQUcsTUFBTSxjQUFjLENBQUMsZUFBZSxDQUFDO1FBQ3ZELFdBQVcsRUFBRSxFQUFFO1FBQ2YsR0FBRyxDQUFDLE1BQU0sSUFBQSxrQkFBVSxFQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsTUFBTSxJQUFBLHlCQUFlLEVBQUMsR0FBRyxDQUFDLEVBQUUsbUNBQXNCLENBQUMsQ0FBQztLQUNyRixDQUFDLENBQUM7SUFDSCxJQUFJLFdBQVcsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7UUFDN0IseUVBQXlFO1FBQ3pFLE1BQU0sSUFBSSxtQkFBVyxDQUFDLG1CQUFXLENBQUMsS0FBSyxDQUFDLFNBQVMsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO0lBQ3ZFLENBQUM7SUFFRCxNQUFNLFVBQVUsR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBcUIsZUFBTyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3ZFLE1BQU0sTUFBTSxHQUFHLE1BQU0sVUFBVSxDQUFDLGlCQUFpQixDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBRXRELEdBQUcsQ0FBQyxTQUFTLENBQUMsY0FBYyxFQUFFLGlCQUFpQixDQUFDLENBQUM7SUFDakQsR0FBRyxDQUFDLFNBQVMsQ0FBQyxlQUFlLEVBQUUsc0JBQXNCLENBQUMsQ0FBQztJQUN2RCxNQUFNLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxHQUFHLEVBQUU7UUFDdEIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxXQUFXO1lBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUN0QyxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7SUFDWixDQUFDLENBQUMsQ0FBQztJQUNILE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDbkIsQ0FBQyJ9