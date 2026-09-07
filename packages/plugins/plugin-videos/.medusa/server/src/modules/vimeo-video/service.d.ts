import { ProductVideoLink } from './models';
type VimeoModuleOptions = {
    clientId?: string;
    clientSecret?: string;
    redirectUri?: string;
    accessToken?: string;
    folderUri?: string;
};
declare const VimeoVideoModuleService_base: import("@medusajs/framework/utils").MedusaServiceReturnType<import("@medusajs/framework/utils").ModelConfigurationsToConfigTemplate<{
    readonly VimeoVideo: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        vimeo_id: import("@medusajs/framework/utils").TextProperty;
        vimeo_uri: import("@medusajs/framework/utils").TextProperty;
        title: import("@medusajs/framework/utils").TextProperty;
        description: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        thumbnail_url: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        poster_url: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        vimeo_url: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        duration: import("@medusajs/framework/utils").NullableModifier<number, import("@medusajs/framework/utils").NumberProperty>;
        status: import("@medusajs/framework/utils").EnumProperty<["uploading", "transcoding", "processing", "available", "error", "quota_exceeded", "total_cap_exceeded", "transcode_starting", "unavailable"]>;
        is_active: import("@medusajs/framework/utils").BooleanProperty;
        show_in_carousel: import("@medusajs/framework/utils").BooleanProperty;
        sort_order: import("@medusajs/framework/utils").NumberProperty;
        sales_channel_ids: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        product_links: import("@medusajs/framework/utils").HasMany<() => typeof ProductVideoLink>;
    }>, "vimeo_video">;
    readonly ProductVideoLink: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        product_id: import("@medusajs/framework/utils").TextProperty;
        vimeo_video: import("@medusajs/framework/utils").BelongsTo<() => import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
            id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
            vimeo_id: import("@medusajs/framework/utils").TextProperty;
            vimeo_uri: import("@medusajs/framework/utils").TextProperty;
            title: import("@medusajs/framework/utils").TextProperty;
            description: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
            thumbnail_url: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
            poster_url: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
            vimeo_url: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
            duration: import("@medusajs/framework/utils").NullableModifier<number, import("@medusajs/framework/utils").NumberProperty>;
            status: import("@medusajs/framework/utils").EnumProperty<["uploading", "transcoding", "processing", "available", "error", "quota_exceeded", "total_cap_exceeded", "transcode_starting", "unavailable"]>;
            is_active: import("@medusajs/framework/utils").BooleanProperty;
            show_in_carousel: import("@medusajs/framework/utils").BooleanProperty;
            sort_order: import("@medusajs/framework/utils").NumberProperty;
            sales_channel_ids: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
            metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
            product_links: import("@medusajs/framework/utils").HasMany<() => typeof ProductVideoLink>;
        }>, "vimeo_video">, undefined>;
    }>, "product_video_link">;
    readonly VimeoToken: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        access_token: import("@medusajs/framework/utils").TextProperty;
        refresh_token: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        token_type: import("@medusajs/framework/utils").TextProperty;
        scope: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        expires_at: import("@medusajs/framework/utils").DateTimeProperty;
        user_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    }>, "vimeo_token">;
}>>;
export default class VimeoVideoModuleService extends VimeoVideoModuleService_base {
    private bootOptions;
    private get options();
    private readonly VIMEO_API_BASE;
    protected readonly vimeoVideoRepository_: any;
    constructor(container: any, options?: VimeoModuleOptions);
    getAuthorizationUrl(state?: string): Promise<string>;
    exchangeCodeForTokens(code: string): Promise<any>;
    storeTokens(tokens: any): Promise<void>;
    getAccessToken(): Promise<string | null>;
    refreshAccessToken(refreshToken: string): Promise<void>;
    isConnected(): Promise<boolean>;
    getConnectionStatus(): Promise<{
        connected: boolean;
        user?: any;
        error?: string;
        folderUri?: string;
    }>;
    getVimeoUser(token: string): Promise<any>;
    searchVimeoVideos(query?: string, page?: number, perPage?: number): Promise<any>;
    getVimeoVideo(vimeoId: string): Promise<any>;
    listVideos(filters?: any, config?: any): Promise<any>;
    createVideo(data: any): Promise<any>;
    syncVideoFromVimeo(id: string): Promise<any>;
    updateVideo(id: string, data: any): Promise<any>;
    deleteVideo(id: string): Promise<any>;
    initiateUpload(title: string, description?: string, fileSize?: number): Promise<any>;
    disconnect(): Promise<void>;
}
export {};
