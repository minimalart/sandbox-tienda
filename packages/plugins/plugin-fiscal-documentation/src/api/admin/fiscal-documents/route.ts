import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { Modules } from '@medusajs/framework/utils';
import { lookupTaxpayer } from '../../../lib/arca/lookup';
import {
  ArcaConfigError,
  ArcaInvalidCuitError,
  ArcaNotFoundError,
} from '../../../lib/arca/types';
import { FISCAL_DOCUMENTATION_MODULE } from '../../../modules/fiscal-documentation';
import type FiscalDocumentationModuleService from '../../../modules/fiscal-documentation/service';
import { buildSnapshot, hashSnapshot } from '../../../modules/fiscal-documentation/snapshot';
import { generateConstanciaPdf } from '../../../modules/fiscal-documentation/pdf';
import { applyOwnerUpdate, readFiscalConfig, resolveArcaCache, resolveArcaConfig, resolveOwnerName , assertFiscalOwnerInSite } from './_helpers';
import { ListFiscalDocumentsQuery, PostFiscalDocument } from './validators';

/** GET /admin/fiscal-documents?owner_type=&owner_id= — historial del owner. */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const parsed = ListFiscalDocumentsQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Query inválida' });
    return;
  }
  await assertFiscalOwnerInSite(req, parsed.data.owner_type, parsed.data.owner_id);

  const service = req.scope.resolve<FiscalDocumentationModuleService>(FISCAL_DOCUMENTATION_MODULE);
  const fiscal_documents = await service.listByOwner(parsed.data.owner_type, parsed.data.owner_id);
  res.json({ fiscal_documents, count: fiscal_documents.length });
}

/**
 * POST /admin/fiscal-documents — consulta ARCA, genera el PDF, lo almacena y
 * crea una versión nueva (archivando la anterior). Devuelve el documento nuevo,
 * el diff contra la versión previa y si hubo cambios.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const parsed = PostFiscalDocument.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Body inválido' });
    return;
  }
  const { owner_type, owner_id, cuit } = parsed.data;
  // También al EMITIR: generar la constancia de una empresa ajena la consulta contra
  // ARCA y la persiste como si fuera nuestra.
  await assertFiscalOwnerInSite(req, owner_type, owner_id);

  const config = await readFiscalConfig(req);
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
    const arca = await resolveArcaConfig(req);
    taxpayer = await lookupTaxpayer(cuit, { cache: resolveArcaCache(req), config: arca });
  } catch (error) {
    if (error instanceof ArcaInvalidCuitError) {
      res.status(400).json({ message: error.message });
      return;
    }
    if (error instanceof ArcaNotFoundError) {
      res.status(404).json({ message: 'No encontramos ese CUIT en ARCA.' });
      return;
    }
    if (!(error instanceof ArcaConfigError)) {
      const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
      console.error(`[fiscal-documents] ARCA lookup error cuit=${cuit}:`, detail);
    }
    // 424 y no 503 (DO App Platform intercepta los 503).
    res.status(424).json({ message: 'No pudimos consultar ARCA en este momento.' });
    return;
  }

  const snapshot = buildSnapshot(taxpayer);
  const snapshot_hash = hashSnapshot(snapshot);
  const generatedAt = new Date();

  // PDF + subida al File module (privado; se sirve por el proxy /download).
  let file_id: string | null = null;
  let file_url: string | null = null;
  if (config.auto_pdf) {
    try {
      const ownerName = await resolveOwnerName(req, owner_type, owner_id);
      const pdf = await generateConstanciaPdf({
        snapshot,
        ownerName,
        generatedAt,
        brandName: config.pdf_brand_name,
        footer: config.pdf_footer,
      });
      const fileModule = req.scope.resolve(Modules.FILE);
      const [file] = await fileModule.createFiles([
        {
          filename: `constancia-${cuit}-${generatedAt.getTime()}.pdf`,
          mimeType: 'application/pdf',
          content: pdf.toString('base64'),
        },
      ]);
      file_id = file?.id ?? null;
      file_url = file?.url ?? null;
    } catch (error) {
      // El PDF es secundario: si falla, igual persistimos el snapshot (auditoría).
      const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
      console.error(`[fiscal-documents] PDF/upload error owner=${owner_type}:${owner_id}:`, detail);
    }
  }

  const service = req.scope.resolve<FiscalDocumentationModuleService>(FISCAL_DOCUMENTATION_MODULE);
  const result = await service.createVersion({
    owner_type,
    owner_id,
    tax_id: cuit,
    snapshot,
    snapshot_hash,
    source: 'arca',
    file_id,
    file_url,
    requested_by: (req as { auth_context?: { actor_id?: string } }).auth_context?.actor_id ?? null,
    generated_at: generatedAt,
  });

  // Actualiza los datos de la empresa desde ARCA (si está habilitado).
  if (config.update_owner_data) {
    await applyOwnerUpdate(req, owner_type, owner_id, snapshot, result.document.id, snapshot_hash);
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
