import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import { BANNER_MODULE } from '../modules/banner';
import type BannerModuleService from '../modules/banner/service';

type PublishBannerWorkflowInput = {
  id: string;
  user_id?: string;
};

const publishBannerStep = createStep(
  'publish-banner',
  async (input: PublishBannerWorkflowInput, { container }) => {
    const bannerService: BannerModuleService = container.resolve(BANNER_MODULE);

    const banners = await bannerService.listBanners({ id: input.id });
    const banner = banners[0];
    if (!banner) {
      throw new Error(`Banner with id "${input.id}" not found`);
    }

    const previousStatus = banner.status;

    const updatedBanner = await (bannerService as any).updateBanners({
      id: input.id,
      status: 'published',
    });

    await bannerService.createAuditEntry(
      input.id,
      'published',
      input.user_id,
      { status: 'published' },
      banner as unknown as Record<string, unknown>,
    );

    return new StepResponse(updatedBanner, { id: input.id, previousStatus });
  },
  async (context: { id: string; previousStatus: string } | undefined, { container }) => {
    if (!context?.id) return;

    const bannerService: BannerModuleService = container.resolve(BANNER_MODULE);
    await (bannerService as any).updateBanners({
      id: context.id,
      status: context.previousStatus,
    });
  },
);

export const publishBannerWorkflow = createWorkflow(
  'publish-banner',
  function (input: PublishBannerWorkflowInput) {
    const result = publishBannerStep(input);
    return new WorkflowResponse(result);
  },
);
