import type { StoreBannerQuery } from './types';
declare const BannerModuleService_base: import("@medusajs/framework/utils").MedusaServiceReturnType<import("@medusajs/framework/utils").ModelConfigurationsToConfigTemplate<{
    readonly Banner: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        internal_name: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        handle: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        type: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        device_type: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        placement: import("@medusajs/framework/utils").TextProperty;
        status: import("@medusajs/framework/utils").TextProperty;
        priority: import("@medusajs/framework/utils").NumberProperty;
        content: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        media: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        cta: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        rules: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        start_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
        end_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
    }>, "banner">;
    readonly BannerAudit: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        banner_id: import("@medusajs/framework/utils").TextProperty;
        action: import("@medusajs/framework/utils").TextProperty;
        user_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        changes: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        snapshot: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
    }>, "banner_audit">;
    readonly BannerAnalytics: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        banner_id: import("@medusajs/framework/utils").TextProperty;
        impressions: import("@medusajs/framework/utils").NumberProperty;
        clicks: import("@medusajs/framework/utils").NumberProperty;
        last_impression_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
        last_click_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
    }>, "banner_analytics">;
}>>;
declare class BannerModuleService extends BannerModuleService_base {
    private parseJsonField;
    resolveBanners(query: StoreBannerQuery): Promise<any[]>;
    private matchRules;
    private matchPath;
    generateHandle(internalName: string): string;
    createAuditEntry(bannerId: string, action: string, userId?: string, changes?: Record<string, unknown>, snapshot?: Record<string, unknown>): Promise<void>;
    trackImpression(bannerId: string): Promise<void>;
    trackClick(bannerId: string): Promise<void>;
}
export default BannerModuleService;
