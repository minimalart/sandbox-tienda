export type CreateBrandImagesStepInput = {
    brand_images: {
        brand_id: string;
        type: 'thumbnail' | 'image';
        url: string;
        file_id: string;
    }[];
};
export declare const createBrandImagesStep: import("@medusajs/framework/workflows-sdk").StepFunction<CreateBrandImagesStepInput, {
    id: string;
    url: string;
    file_id: string;
    type: "thumbnail" | "image";
    brand_id: string;
    created_at: Date;
    updated_at: Date;
    deleted_at: Date | null;
}[]>;
