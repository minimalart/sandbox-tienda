import type { MediaAssetInput } from './types';
declare const MediaLibraryModuleService_base: import("@medusajs/framework/utils").MedusaServiceReturnType<import("@medusajs/framework/utils").ModelConfigurationsToConfigTemplate<{
    readonly MediaAsset: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        file_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        url: import("@medusajs/framework/utils").TextProperty;
        filename: import("@medusajs/framework/utils").TextProperty;
        mime_type: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        size: import("@medusajs/framework/utils").NullableModifier<number, import("@medusajs/framework/utils").NumberProperty>;
        alt: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        title: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        source: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
    }>, "media_asset">;
}>>;
declare class MediaLibraryModuleService extends MediaLibraryModuleService_base {
    /** Lista + búsqueda por nombre (ILIKE). */
    search(q: string | undefined, opts?: {
        limit?: number;
        offset?: number;
    }): Promise<[{
        id: string;
        file_id: string | null;
        url: string;
        filename: string;
        mime_type: string | null;
        size: number | null;
        alt: string | null;
        title: string | null;
        source: string | null;
        metadata: Record<string, unknown> | null;
        raw_size: Record<string, unknown> | null;
        created_at: Date;
        updated_at: Date;
        deleted_at: Date | null;
    }[], number]>;
    /** Registra un asset; dedup por URL (si ya existe, lo devuelve). */
    registerAsset(input: MediaAssetInput): Promise<any>;
    /** URLs ya presentes en el catálogo (para dedup en backfill). */
    existingUrls(urls: string[]): Promise<Set<string>>;
}
export default MediaLibraryModuleService;
