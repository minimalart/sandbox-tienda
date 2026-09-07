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
export declare const FiscalDocument: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
    id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
    owner_type: import("@medusajs/framework/utils").TextProperty;
    owner_id: import("@medusajs/framework/utils").TextProperty;
    type: import("@medusajs/framework/utils").TextProperty;
    status: import("@medusajs/framework/utils").TextProperty;
    source: import("@medusajs/framework/utils").TextProperty;
    tax_id: import("@medusajs/framework/utils").TextProperty;
    file_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    file_url: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    snapshot: import("@medusajs/framework/utils").JSONProperty;
    snapshot_hash: import("@medusajs/framework/utils").TextProperty;
    requested_by: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    generated_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
    metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
}>, "fiscal_document">;
export default FiscalDocument;
