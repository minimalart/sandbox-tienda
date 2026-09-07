"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const utils_1 = require("@medusajs/framework/utils");
const lookup_1 = require("../../../lib/arca/lookup");
const types_1 = require("../../../lib/arca/types");
const fiscal_documentation_1 = require("../../../modules/fiscal-documentation");
const snapshot_1 = require("../../../modules/fiscal-documentation/snapshot");
const pdf_1 = require("../../../modules/fiscal-documentation/pdf");
const _helpers_1 = require("./_helpers");
const validators_1 = require("./validators");
/** GET /admin/fiscal-documents?owner_type=&owner_id= — historial del owner. */
async function GET(req, res) {
    const parsed = validators_1.ListFiscalDocumentsQuery.safeParse(req.query);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Query inválida' });
        return;
    }
    await (0, _helpers_1.assertFiscalOwnerInSite)(req, parsed.data.owner_type, parsed.data.owner_id);
    const service = req.scope.resolve(fiscal_documentation_1.FISCAL_DOCUMENTATION_MODULE);
    const fiscal_documents = await service.listByOwner(parsed.data.owner_type, parsed.data.owner_id);
    res.json({ fiscal_documents, count: fiscal_documents.length });
}
/**
 * POST /admin/fiscal-documents — consulta ARCA, genera el PDF, lo almacena y
 * crea una versión nueva (archivando la anterior). Devuelve el documento nuevo,
 * el diff contra la versión previa y si hubo cambios.
 */
async function POST(req, res) {
    const parsed = validators_1.PostFiscalDocument.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Body inválido' });
        return;
    }
    const { owner_type, owner_id, cuit } = parsed.data;
    // También al EMITIR: generar la constancia de una empresa ajena la consulta contra
    // ARCA y la persiste como si fuera nuestra.
    await (0, _helpers_1.assertFiscalOwnerInSite)(req, owner_type, owner_id);
    const config = await (0, _helpers_1.readFiscalConfig)(req);
    if (!config.arca_enabled) {
        res.status(400).json({ message: 'La integración ARCA está deshabilitada en la configuración.' });
        return;
    }
    let taxpayer;
    try {
        // La identidad fiscal con la que se consulta es la de LA TIENDA ACTIVA, no la de
        // la instancia: ver `resolveArcaConfig`. Va adentro del try porque también puede
        // fallar por configuración (fail-closed) o por credenciales ilegibles, y las dos
        // tienen que salir por el mismo 424 que ya devolvía esta ruta.
        const arca = await (0, _helpers_1.resolveArcaConfig)(req);
        taxpayer = await (0, lookup_1.lookupTaxpayer)(cuit, { cache: (0, _helpers_1.resolveArcaCache)(req), config: arca });
    }
    catch (error) {
        if (error instanceof types_1.ArcaInvalidCuitError) {
            res.status(400).json({ message: error.message });
            return;
        }
        if (error instanceof types_1.ArcaNotFoundError) {
            res.status(404).json({ message: 'No encontramos ese CUIT en ARCA.' });
            return;
        }
        if (!(error instanceof types_1.ArcaConfigError)) {
            const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
            console.error(`[fiscal-documents] ARCA lookup error cuit=${cuit}:`, detail);
        }
        // 424 y no 503 (DO App Platform intercepta los 503).
        res.status(424).json({ message: 'No pudimos consultar ARCA en este momento.' });
        return;
    }
    const snapshot = (0, snapshot_1.buildSnapshot)(taxpayer);
    const snapshot_hash = (0, snapshot_1.hashSnapshot)(snapshot);
    const generatedAt = new Date();
    // PDF + subida al File module (privado; se sirve por el proxy /download).
    let file_id = null;
    let file_url = null;
    if (config.auto_pdf) {
        try {
            const ownerName = await (0, _helpers_1.resolveOwnerName)(req, owner_type, owner_id);
            const pdf = await (0, pdf_1.generateConstanciaPdf)({
                snapshot,
                ownerName,
                generatedAt,
                brandName: config.pdf_brand_name,
                footer: config.pdf_footer,
            });
            const fileModule = req.scope.resolve(utils_1.Modules.FILE);
            const [file] = await fileModule.createFiles([
                {
                    filename: `constancia-${cuit}-${generatedAt.getTime()}.pdf`,
                    mimeType: 'application/pdf',
                    content: pdf.toString('base64'),
                },
            ]);
            file_id = file?.id ?? null;
            file_url = file?.url ?? null;
        }
        catch (error) {
            // El PDF es secundario: si falla, igual persistimos el snapshot (auditoría).
            const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
            console.error(`[fiscal-documents] PDF/upload error owner=${owner_type}:${owner_id}:`, detail);
        }
    }
    const service = req.scope.resolve(fiscal_documentation_1.FISCAL_DOCUMENTATION_MODULE);
    const result = await service.createVersion({
        owner_type,
        owner_id,
        tax_id: cuit,
        snapshot,
        snapshot_hash,
        source: 'arca',
        file_id,
        file_url,
        requested_by: req.auth_context?.actor_id ?? null,
        generated_at: generatedAt,
    });
    // Actualiza los datos de la empresa desde ARCA (si está habilitado).
    if (config.update_owner_data) {
        await (0, _helpers_1.applyOwnerUpdate)(req, owner_type, owner_id, snapshot, result.document.id, snapshot_hash);
    }
    // Aplica retención (baja lógica de versiones sobrantes).
    await service.pruneVersions(owner_type, owner_id, {
        keepHistory: config.keep_history,
        maxVersions: config.max_versions,
    });
    res.status(201).json({
        fiscal_document: result.document,
        diff: result.diff,
        changed: result.changed,
        previous_id: result.previous?.id ?? null,
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2Zpc2NhbC1kb2N1bWVudHMvcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFnQkEsa0JBV0M7QUFPRCxvQkE0R0M7QUE3SUQscURBQW9EO0FBQ3BELHFEQUEwRDtBQUMxRCxtREFJaUM7QUFDakMsZ0ZBQW9GO0FBRXBGLDZFQUE2RjtBQUM3RixtRUFBa0Y7QUFDbEYseUNBQWlKO0FBQ2pKLDZDQUE0RTtBQUU1RSwrRUFBK0U7QUFDeEUsS0FBSyxVQUFVLEdBQUcsQ0FBQyxHQUFrQixFQUFFLEdBQW1CO0lBQy9ELE1BQU0sTUFBTSxHQUFHLHFDQUF3QixDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDN0QsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUNwQixHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxNQUFNLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxPQUFPLElBQUksZ0JBQWdCLEVBQUUsQ0FBQyxDQUFDO1FBQ3ZGLE9BQU87SUFDVCxDQUFDO0lBQ0QsTUFBTSxJQUFBLGtDQUF1QixFQUFDLEdBQUcsRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBRWpGLE1BQU0sT0FBTyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFtQyxrREFBMkIsQ0FBQyxDQUFDO0lBQ2pHLE1BQU0sZ0JBQWdCLEdBQUcsTUFBTSxPQUFPLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDakcsR0FBRyxDQUFD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