import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk';
import { BRAND_MODULE } from '../../modules/brand';
import BrandModuleService from '../../modules/brand/service';

export type CreateBrandStepInput = {
  name: string;
  handle: string;
  description?: string;
  is_active?: boolean;
  sales_channel_ids?: string[] | null;
  metadata?: Record<string, unknown>;
};

export const createBrandStep = createStep(
  'create-brand-step',
  async (input: CreateBrandStepInput, { container }) => {
    const brandService: BrandModuleService = container.resolve(BRAND_MODULE);

    // `sales_channel_ids` es un array en una columna model.json() (tipada como
    // Record por Medusa); casteamos para el create.
    const brand = await brandService.createBrands(input as any);

    return new StepResponse(brand, brand);
  },
  async (compensationData, { container }) => {
    if (!compensationData) {
      return;
    }

    const brandService: BrandModuleService = container.resolve(BRAND_MODULE);

    await brandService.deleteBrands(compensationData.id);
  }
);
