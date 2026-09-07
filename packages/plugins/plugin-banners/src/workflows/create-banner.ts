import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import { BANNER_MODULE } from '../modules/banner';
import type BannerModuleService from '../modules/banner/service';
import type { CreateBannerInput } from '../modules/banner/types';

type CreateBannerWorkflowInput = CreateBannerInput & { user_id?: string };

const validateBannerInputStep = createStep(
  'validate-banner-input',
  async (input: CreateBannerWorkflowInput) => {
    if (!input.internal_name?.trim()) {
      throw new Error('internal_name is required');
    }
    if (!input.placement) {
      throw new Error('placement is required');
    }

    if (input.start_at && input.end_at) {
      const start = new Date(input.start_at);
      const end = new Date(input.end_at);
      if (start >= end) {
        throw new Error('start_at must be before end_at');
      }
    }

    return new StepResponse(input);
  },
);

const createBannerStep = createStep(
  'create-banner',
  async (input: CreateBannerWorkflowInput, { container }) => {
    const bannerService: BannerModuleService = container.resolve(BANNER_MODULE);

    const handle = input.handle || bannerService.generateHandle(input.internal_name);

    const existing = await bannerService.listBanners({ handle } as any);
    if (existing.length > 0) {
      throw new Error(`Banner with handle "${handle}" already exists`);
    }

    const banner = await (bannerService as any).createBanners({
      internal_name: input.internal_name,
      handle,
      type: input.type || 'hero',
      device_type: input.device_type || 'all',
      placement: input.placement,
      status: input.status || 'draft',
      priority: input.priority ?? 0,
      content: input.content ?? null,
      media: input.media ?? null,
      cta: input.cta ?? null,
      start_at: input.start_at ? new Date(input.start_at) : null,
      end_at: input.end_at ? new Date(input.end_at) : null,
      rules: input.rules ?? null,
      metadata: input.metadata ?? null,
    });

    await bannerService.createAuditEntry(
      banner.id,
      'created',
      input.user_id,
      undefined,
      banner as unknown as Record<string, unknown>,
    );

    return new StepResponse(banner, banner.id);
  },
  async (bannerId: string | undefined, { container }) => {
    if (!bannerId) return;

    const bannerService: BannerModuleService = container.resolve(BANNER_MODULE);
    await (bannerService as any).deleteBanners(bannerId);
  },
);

export const createBannerWorkflow = createWorkflow(
  'create-banner',
  function (input: CreateBannerWorkflowInput) {
    const validated = validateBannerInputStep(input);
    const banner = createBannerStep(validated);
    return new WorkflowResponse(banner);
  },
);
