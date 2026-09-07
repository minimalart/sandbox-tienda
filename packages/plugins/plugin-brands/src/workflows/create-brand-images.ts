import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import { convertBrandThumbnailsStep } from './steps/convert-brand-thumbnails';
import { createBrandImagesStep } from './steps/create-brand-images';

export type CreateBrandImagesInput = {
  brand_images: {
    brand_id: string;
    type: 'thumbnail' | 'image';
    url: string;
    file_id: string;
  }[];
};

export const createBrandImagesWorkflow = createWorkflow(
  'create-brand-images',
  (input: CreateBrandImagesInput) => {
    when(input, (data) => data.brand_images.some((img) => img.type === 'thumbnail')).then(() => {
      const brandIds = transform(
        {
          input,
        },
        (data) => {
          return data.input.brand_images
            .filter((img) => img.type === 'thumbnail')
            .map((img) => img.brand_id);
        }
      );

      convertBrandThumbnailsStep({
        brand_ids: brandIds,
      });
    });

    const brandImages = createBrandImagesStep({
      brand_images: input.brand_images,
    });

    return new WorkflowResponse(brandImages);
  }
);
