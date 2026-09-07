export type LandingPageStatus = 'draft' | 'published' | 'archived';
export interface LandingPageSeo {
    title?: string;
    description?: string;
    image?: string;
    noindex?: boolean;
}
/** Puck editor's native document shape. */
export interface PuckData {
    content: unknown[];
    root: {
        props?: Record<string, unknown>;
    };
    zones?: Record<string, unknown[]>;
}
export interface CreateLandingPageInput {
    title: string;
    slug?: string;
    status?: LandingPageStatus;
    description?: string | null;
    seo?: LandingPageSeo | null;
    puck_data?: PuckData | null;
    template?: string | null;
    locale?: string | null;
    sales_channel_id?: string | null;
    metadata?: Record<string, unknown> | null;
    created_by?: string;
    updated_by?: string;
}
export type UpdateLandingPageInput = Partial<CreateLandingPageInput>;
export interface StoreLandingPageQuery {
    locale?: string;
    limit?: number;
    offset?: number;
}
