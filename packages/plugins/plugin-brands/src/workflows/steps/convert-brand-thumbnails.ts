import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk';
import { BRAND_MODULE } from '../../modules/brand';
import BrandModuleService from '../../modules/brand/service';

export type ConvertBrandThumbnailsStepInput = {
  brand_ids: string[];
};

export const convertBrandThumbnailsStep = createStep(
  'convert-brand-thumbnails-step',
  async (input: ConvertBrandThumbnailsStepInput, { container }) => {
    const brandService: BrandModuleService = container.resolve(BRAND_MODULE);

    const existingThumbnails = await brandService.listBrandImages({
      type: 'thumbnail',
      brand_id: input.brand_ids,
    });

    if (existingThumbnails.length === 0) {
      return new StepResponse([], []);
    }

    const compensationData: string[] = existingThumbnails.map((t) => t.id);

    await brandService.updateBrandImages(
      existingThumbnails.map((t) => ({
        id: t.id,
        type: 'image' as const,
      }))
    );

    return new StepResponse(existingThumbnails, compensationData);
  },
  async (compensationData, { container }) => {
    if (!compensationData?.length) {
      return;
    }

    const brandService: BrandModuleService = container.resolve(BRAND_MODULE);

    await brandService.updateBrandImages(
      compensationData.map((id) => ({
        id,
        type: 'thumbnail' as const,
      }))
    );
  }
);
