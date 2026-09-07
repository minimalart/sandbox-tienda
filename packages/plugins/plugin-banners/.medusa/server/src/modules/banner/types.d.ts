export declare enum BannerStatus {
    DRAFT = "draft",
    PUBLISHED = "published",
    ARCHIVED = "archived"
}
export declare enum BannerType {
    HERO = "hero",
    ANNOUNCEMENT = "announcement",
    STRIP = "strip",
    CARD = "card",
    MODAL = "modal"
}
export declare enum BannerDeviceType {
    ALL = "all",
    MOBILE = "mobile",
    DESKTOP = "desktop",
    TABLET = "tablet"
}
export declare enum BannerPlacement {
    TOP_BAR = "top_bar",
    BANNER_1 = "banner_1",
    BANNER_2 = "banner_2",
    BANNER_3 = "banner_3",
    BANNER_4 = "banner_4",
    BANNER_5 = "banner_5",
    BANNER_6 = "banner_6"
}
export interface BannerContent {
    title?: string;
    subtitle?: string;
    body?: string;
}
export interface BannerMedia {
    url: string;
    alt?: string;
    type?: 'image' | 'video';
    aspect_ratio?: string;
    file_id?: string;
    background_color?: string;
}
export interface BannerCTA {
    label?: string;
    url: string;
    target?: '_self' | '_blank';
}
export interface BannerRules {
    sales_channel_ids?: string[];
    customer_group_ids?: string[];
    locales?: string[];
    countries?: string[];
    devices?: ('mobile' | 'desktop')[];
    paths?: string[];
}
export interface CreateBannerInput {
    internal_name: string;
    handle?: string;
    type?: string;
    device_type?: string;
    placement: string;
    status?: string;
    priority?: number;
    content?: BannerContent | null;
    media?: BannerMedia | null;
    cta?: BannerCTA | null;
    start_at?: Date | string | null;
    end_at?: Date | string | null;
    rules?: BannerRules | null;
    metadata?: Record<string, unknown> | null;
}
export interface UpdateBannerInput {
    internal_name?: string;
    handle?: string;
    type?: string;
    device_type?: string;
    placement?: string;
    status?: string;
    priority?: number;
    content?: BannerContent | null;
    media?: BannerMedia | null;
    cta?: BannerCTA | null;
    start_at?: Date | string | null;
    end_at?: Date | string | null;
    rules?: BannerRules | null;
    metadata?: Record<string, unknown> | null;
}
export interface StoreBannerQuery {
    placement: string | string[];
    sales_channel_id?: string;
    customer_group_id?: string;
    /** A customer can belong to several groups; any match passes. */
    customer_group_ids?: string[];
    locale?: string;
    country?: string;
    device?: 'mobile' | 'desktop';
    path?: string;
    /**
     * Strict sales-channel scoping (contexto demo): cuando es true, solo pasan los
     * banners cuyo `rules.sales_channel_ids` incluye explícitamente el
     * `sales_channel_id`. Los banners sin canal (globales) quedan excluidos, para
     * que una demo muestre únicamente sus banners y oculte la sección si no tiene.
     */
    require_sales_channel?: boolean;
}
export declare enum AuditAction {
    CREATED = "created",
    UPDATED = "updated",
    PUBLISHED = "published",
    UNPUBLISHED = "unpublished",
    ARCHIVED = "archived",
    DELETED = "deleted"
}
