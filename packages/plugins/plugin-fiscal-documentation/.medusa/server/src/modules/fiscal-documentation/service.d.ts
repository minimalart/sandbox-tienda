import type { FiscalDiffEntry, FiscalDocumentRecord, FiscalDocumentSource, FiscalOwnerType, FiscalSnapshot } from './types';
type CreateDocumentInput = {
    owner_type: FiscalOwnerType;
    owner_id: string;
    tax_id: string;
    snapshot: FiscalSnapshot;
    snapshot_hash: string;
    source?: FiscalDocumentSource;
    file_id?: string | null;
    file_url?: string | null;
    requested_by?: string | null;
    generated_at?: Date | null;
    metadata?: Record<string, unknown> | null;
};
declare const FiscalDocumentationModuleService_base: import("@medusajs/framework/utils").MedusaServiceReturnType<import("@medusajs/framework/utils").ModelConfigurationsToConfigTemplate<{
    readonly FiscalDocument: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
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
}>>;
declare class FiscalDocumentationModuleService extends FiscalDocumentationModuleService_base {
    /** Documentos de un owner, más nuevo primero. */
    listByOwner(ownerType: FiscalOwnerType, ownerId: string): Promise<FiscalDocumentRecord[]>;
    /** La constancia vigente del owner (o null). */
    getCurrent(ownerType: FiscalOwnerType, ownerId: string): Promise<FiscalDocumentRecord | null>;
    /**
     * Crea una versión nueva y la marca `vigente`, archivando la anterior como
     * `historica`. Nunca reemplaza documentos: el historial es append-only.
     * Devuelve el documento nuevo, la versión anterior (si había) y el diff.
     */
    createVersion(input: CreateDocumentInput): Promise<{
        document: FiscalDocumentRecord;
        previous: FiscalDocumentRecord | null;
        diff: FiscalDiffEntry[];
        changed: boolean;
    }>;
    /**
     * Aplica la política de retención (baja lógica de versiones sobrantes):
     * - `keepHistory=false`: conserva solo la vigente.
     * - `maxVersions=n`: conserva las n más nuevas.
     * Nunca da de baja la versión vigente. Devuelve cuántas archivó.
     */
    pruneVersions(ownerType: FiscalOwnerType, ownerId: string, opts: {
        keepHistory: boolean;
        maxVersions: number | null;
    }): Promise<number>;
    /**
     * Compara dos documentos por id (deben pertenecer al mismo owner).
     * Si `otherId` se omite, compara `documentId` contra la versión inmediatamente
     * anterior del mismo owner.
     */
    compare(documentId: string, otherId?: string): Promise<{
        before: FiscalDocumentRecord;
        after: FiscalDocumentRecord;
        changes: FiscalDiffEntry[];
    }>;
}
export default FiscalDocumentationModuleService;
