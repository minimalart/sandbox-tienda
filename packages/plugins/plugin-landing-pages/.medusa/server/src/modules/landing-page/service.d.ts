export declare const EMPTY_PUCK_DATA: {
    content: never[];
    root: {
        props: {};
    };
};
declare const LandingPageModuleService_base: import("@medusajs/framework/utils").MedusaServiceReturnType<import("@medusajs/framework/utils").ModelConfigurationsToConfigTemplate<{
    readonly LandingPage: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        title: import("@medusajs/framework/utils").TextProperty;
        slug: import("@medusajs/framework/utils").TextProperty;
        status: import("@medusajs/framework/utils").TextProperty;
        description: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        seo: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        puck_data: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        template: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        locale: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        sales_channel_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        published_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
        created_by: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        updated_by: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    }>, "landing_page">;
}>>;
declare class LandingPageModuleService extends LandingPageModuleService_base {
    /** URL-safe slug from a title (accent-folded, lowercased, hyphenated). */
    generateSlug(title: string): string;
    /** Returns a slug that is not used by another (non-deleted) landing page. */
    ensureUniqueSlug(slug: string, excludeId?: string): Promise<string>;
}
export default LandingPageModuleService;
