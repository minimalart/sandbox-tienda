import { HotspotInput } from '../../modules/pdf-catalog/service';
export type CreatePdfCatalogStepInput = {
    name: string;
    pdf_url: string;
    pdf_file_id?: string | null;
    pages?: number;
    published?: boolean;
    metadata?: Record<string, unknown> | null;
    hotspots?: HotspotInput[];
    sales_channel_ids?: string[];
};
export declare const createPdfCatalogStep: import("@medusajs/framework/workflows-sdk").StepFunction<CreatePdfCatalogStepInput, {
    id: string;
    name: string;
    pdf_url: string;
    pdf_file_id: string | null;
    pages: number;
    published: boolean;
    metadata: Record<string, unknown> | null;
    hotspots: {
        id: string;
        type: "product" | "video" | "text";
        page_index: number;
        pos_x: number;
        pos_y: number;
        product_id: string | null;
        variant_id: string | null;
        data: Record<string, unknown> | null;
        sort_order: number;
        catalog: /*elided*/ any;
        created_at: Date;
        updated_at: Date;
        deleted_at: Date | null;
        catalog_id: string;
    }[];
    channels: {
        id: string;
        sales_channel_id: string;
        catalog: /*elided*/ any;
        created_at: Date;
        updated_at: Date;
        deleted_at: Date | null;
        catalog_id: string;
    }[];
    created_at: Date;
    updated_at: Date;
    deleted_at: Date | null;
}>;
