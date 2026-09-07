import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import { BANNER_MODULE } from '../modules/banner';
import type BannerModuleService from '../modules/banner/service';

type ArchiveBannerWorkflowInput = {
  id: string;
  user_id?: string;
};

const archiveBannerStep = createStep(
  'archive-banner',
  async (input: ArchiveBannerWorkflowInput, { container }) => {
    const bannerService: BannerModuleService = container.resolve(BANNER_MODULE);

    const banners = await bannerService.listBanners({ id: input.id });
    const banner = banners[0];
    if (!banner) {
      throw new Error(`Banner with id "${input.id}" not found`);
    }

    const previousStatus = banner.status;

    const updatedBanner = await (bannerService as any).updateBanners({
      id: input.id,
      status: 'archived',
    });

    await bannerService.createAuditEntry(
      input.id,
      'archived',
      input.user_id,
      { status: 'archived' },
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

export const archiveBannerWorkflow = createWorkflow(
  'archive-banner',
  function (input: ArchiveBannerWorkflowInput) {
    const result = archiveBannerStep(input);
    return new WorkflowResponse(result);
  },
);
