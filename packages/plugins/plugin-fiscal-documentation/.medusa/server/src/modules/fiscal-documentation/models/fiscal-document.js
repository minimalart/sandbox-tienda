"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FiscalDocument = void 0;
const utils_1 = require("@medusajs/framework/utils");
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
exports.FiscalDocument = utils_1.model
    .define('fiscal_document', {
    id: utils_1.model.id({ prefix: 'fdoc' }).primaryKey(),
    owner_type: utils_1.model.text(),
    owner_id: utils_1.model.text(),
    type: utils_1.model.text().default('constancia'),
    status: utils_1.model.text().default('vigente'),
    source: utils_1.model.text().default('arca'),
    tax_id: utils_1.model.text(),
    file_id: utils_1.model.text().nullable(),
    file_url: utils_1.model.text().nullable(),
    snapshot: utils_1.model.json(),
    snapshot_hash: utils_1.model.text(),
    requested_by: utils_1.model.text().nullable(),
    generated_at: utils_1.model.dateTime().nullable(),
    metadata: utils_1.model.json().nullable(),
})
    .indexes([
    { on: ['owner_type', 'owner_id'] },
    { on: ['status'] },
    { on: ['snapshot_hash'] },
    { on: ['tax_id'] },
]);
exports.default = exports.FiscalDocument;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmlzY2FsLWRvY3VtZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL21vZHVsZXMvZmlzY2FsLWRvY3VtZW50YXRpb24vbW9kZWxzL2Zpc2NhbC1kb2N1bWVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxxREFBa0Q7QUFFbEQ7Ozs7Ozs7Ozs7OztHQVlHO0FBQ1UsUUFBQSxjQUFjLEdBQUcsYUFBSztLQUNoQyxNQUFNLENBQUMsaUJBQWlCLEVBQUU7SUFDekIsRUFBRSxFQUFFLGFBQUssQ0FBQyxFQUFFLENBQUMsRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQyxVQUFVLEVBQUU7SUFDN0MsVUFBVSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUU7SUFDeEIsUUFBUSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUU7SUFDdEIsSUFBSSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDO0lBQ3hDLE1BQU0sRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQztJQUN2QyxNQUFNLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUM7SUFDcEMsTUFBTSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUU7SUFDcEIsT0FBTyxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDaEMsUUFBUSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDakMsUUFBUSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUU7SUFDdEIsYUFBYSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUU7SUFDM0IsWUFBWSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDckMsWUFBWSxFQUFFLGFBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDekMsUUFBUSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7Q0FDbEMsQ0FBQztLQUNELE9BQU8sQ0FBQztJQUNQLEVBQUUsRUFBRSxFQUFFLENBQUMsWUFBWSxFQUFFLFVBQVUsQ0FBQyxFQUFFO0lBQ2xDLEVBQUUsRUFBRSxFQUFFLENBQUMsUUFBUSxDQUFDLEVBQUU7SUFDbEIsRUFBRSxFQUFFLEVBQUUsQ0FBQyxlQUFlLENBQUMsRUFBRTtJQUN6QixFQUFFLEVBQUUsRUFBRSxDQUFDLFFBQVEsQ0FBQyxFQUFFO0NBQ25CLENBQUMsQ0FBQztBQUVMLGtCQUFlLHNCQUFjLENBQUMifQ==