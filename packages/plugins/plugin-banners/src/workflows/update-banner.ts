import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import { BANNER_MODULE } from '../modules/banner';
import type BannerModuleService from '../modules/banner/service';
import type { UpdateBannerInput } from '../modules/banner/types';

type UpdateBannerWorkflowInput = {
  id: string;
  data: UpdateBannerInput;
  user_id?: string;
};

const validateUpdateInputStep = createStep(
  'validate-update-input',
  async (input: UpdateBannerWorkflowInput, { container }) => {
    const bannerService: BannerModuleService = container.resolve(BANNER_MODULE);

    const banners = await bannerService.listBanners({ id: input.id });
    const banner = banners[0];
    if (!banner) {
      throw new Error(`Banner with id "${input.id}" not found`);
    }

    const startAt = input.data.start_at ?? banner.start_at;
    const endAt = input.data.end_at ?? banner.end_at;

    if (startAt && endAt) {
      const start = new Date(startAt);
      const end = new Date(endAt);
      if (start >= end) {
        throw new Error('start_at must be before end_at');
      }
    }

    if (input.data.handle && input.data.handle !== banner.handle) {
      const existing = await bannerService.listBanners({
        handle: input.data.handle,
      } as any);
      if (existing.length > 0) {
        throw new Error(`Banner with handle "${input.data.handle}" already exists`);
      }
    }

    return new StepResponse({ banner, input });
  },
);

const updateBannerStep = createStep(
  'update-banner',
  async (context: { banner: any; input: UpdateBannerWorkflowInput }, { container }) => {
    const { banner: originalBanner, input } = context;
    const bannerService: BannerModuleService = container.resolve(BANNER_MODULE);

    const updateData: Record<string, unknown> = {};

    if (input.data.internal_name !== undefined) {
      updateData.internal_name = input.data.internal_name;
    }
    if (input.data.handle !== undefined) {
      updateData.handle = input.data.handle;
    }
    if (input.data.type !== undefined) {
      updateData.type = input.data.type;
    }
    if (input.data.device_type !== undefined) {
      updateData.device_type = input.data.device_type;
    }
    if (input.data.placement !== undefined) {
      updateData.placement = input.data.placement;
    }
    if (input.data.status !== undefined) {
      updateData.status = input.data.status;
    }
    if (input.data.priority !== undefined) {
      updateData.priority = input.data.priority;
    }
    if (input.data.content !== undefined) {
      updateData.content = input.data.content;
    }
    if (input.data.media !== undefined) {
      updateData.media = input.data.media;
    }
    if (input.data.cta !== undefined) {
      updateData.cta = input.data.cta;
    }
    if (input.data.start_at !== undefined) {
      updateData.start_at = input.data.start_at ? new Date(input.data.start_at) : null;
    }
    if (input.data.end_at !== undefined) {
      updateData.end_at = input.data.end_at ? new Date(input.data.end_at) : null;
    }
    if (input.data.rules !== undefined) {
      updateData.rules = input.data.rules;
    }
    if (input.data.metadata !== undefined) {
      updateData.metadata = input.data.metadata;
    }

    const updatedBanner = await (bannerService as any).updateBanners({
      id: input.id,
      ...updateData,
    });

    await bannerService.createAuditEntry(
      input.id,
      'updated',
      input.user_id,
      updateData,
      originalBanner as unknown as Record<string, unknown>,
    );

    return new StepResponse(updatedBanner, {
      id: input.id,
      originalData: originalBanner,
    });
  },
  async (context: { id: string; originalData: Record<string, unknown> } | undefined, { container }) => {
    if (!context?.id) return;

    const bannerService: BannerModuleService = container.resolve(BANNER_MODULE);
    await (bannerService as any).updateBanners({ id: context.id, ...context.originalData });
  },
);

export const updateBannerWorkflow = createWorkflow(
  'update-banner',
  function (input: UpdateBannerWorkflowInput) {
    const validated = validateUpdateInputStep(input);
    const banner = updateBannerStep(validated);
    return new WorkflowResponse(banner);
  },
);
