import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import { BANNER_MODULE } from '../modules/banner';
import type BannerModuleService from '../modules/banner/service';

type DeleteBannerWorkflowInput = {
  id: string;
  user_id?: string;
};

const deleteBannerStep = createStep(
  'delete-banner',
  async (input: DeleteBannerWorkflowInput, { container }) => {
    const bannerService: BannerModuleService = container.resolve(BANNER_MODULE);

    const banners = await bannerService.listBanners({ id: input.id });
    if (!banners || banners.length === 0) {
      throw new Error(`Banner with id "${input.id}" not found`);
    }

    const banner = banners[0];

    await bannerService.createAuditEntry(
      input.id,
      'deleted',
      input.user_id,
      undefined,
      banner as unknown as Record<string, unknown>,
    );

    await (bannerService as any).deleteBanners(input.id);

    return new StepResponse({ id: input.id, object: 'banner', deleted: true }, banner);
  },
  async (banner: any, { container }) => {
    if (!banner) return;

    const bannerService: BannerModuleService = container.resolve(BANNER_MODULE);
    await (bannerService as any).createBanners(banner);
  },
);

export const deleteBannerWorkflow = createWorkflow(
  'delete-banner',
  function (input: DeleteBannerWorkflowInput) {
    const result = deleteBannerStep(input);
    return new WorkflowResponse(result);
  },
);
