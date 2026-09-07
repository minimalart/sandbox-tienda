import { model } from '@medusajs/framework/utils';

/**
 * Constancia fiscal versionada. Cada consulta a ARCA genera un registro nuevo;
 * nunca se reemplaza el anterior (se archiva pasándolo a `historica`).
 *
 * - `owner_type` + `owner_id`: entidad dueña (corporate | company). Polimórfico
 *   a propósito para reusar el módulo desde ambas extensiones sin FK cruzada.
 * - `snapshot`: respuesta normalizada de ARCA en el momento de la consulta.
 * - `snapshot_hash`: sha256 determinístico del snapshot; permite detectar cambios
 *   entre versiones sin comparar campo por campo.
 * - `file_id` / `file_url`: PDF generado y subido vía el File module. El PDF se
 *   sirve por un proxy autenticado (getDownloadStream), no por la URL pública.
 * - baja lógica: el soft-delete del File module (deleted_at) cubre la eliminación.
 */
export const FiscalDocument = model
  .define('fiscal_document', {
    id: model.id({ prefix: 'fdoc' }).primaryKey(),
    owner_type: model.text(),
    owner_id: model.text(),
    type: model.text().default('constancia'),
    status: model.text().default('vigente'),
    source: model.text().default('arca'),
    tax_id: model.text(),
    file_id: model.text().nullable(),
    file_url: model.text().nullable(),
    snapshot: model.json(),
    snapshot_hash: model.text(),
    requested_by: model.text().nullable(),
    generated_at: model.dateTime().nullable(),
    metadata: model.json().nullable(),
  })
  .indexes([
    { on: ['owner_type', 'owner_id'] },
    { on: ['status'] },
    { on: ['snapshot_hash'] },
    { on: ['tax_id'] },
  ]);

export default FiscalDocument;
