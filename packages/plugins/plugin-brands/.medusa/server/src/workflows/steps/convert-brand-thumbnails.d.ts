export type ConvertBrandThumbnailsStepInput = {
    brand_ids: string[];
};
export declare const convertBrandThumbnailsStep: import("@medusajs/framework/workflows-sdk").StepFunction<ConvertBrandThumbnailsStepInput, {
    id: string;
    url: string;
    file_id: string;
    type: "thumbnail" | "image";
    brand_id: string;
    created_at: Date;
    updated_at: Date;
    deleted_at: Date | null;
}[]>;
