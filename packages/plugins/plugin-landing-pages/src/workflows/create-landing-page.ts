import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import { LANDING_PAGE_MODULE } from '../modules/landing-page';
import type LandingPageModuleService from '../modules/landing-page/service';
import { EMPTY_PUCK_DATA } from '../modules/landing-page/service';
import type { CreateLandingPageInput } from '../modules/landing-page/types';

const createLandingPageStep = createStep(
  'create-landing-page',
  async (input: CreateLandingPageInput, { container }) => {
    const service: LandingPageModuleService = container.resolve(
      LANDING_PAGE_MODULE,
    );

    const baseSlug = input.slug || service.generateSlug(input.title);
    const slug = await service.ensureUniqueSlug(baseSlug);
    const willPublish = input.status === 'published';

    const created = await (service as any).createLandingPages({
      title: input.title,
      slug,
      status: input.status || 'draft',
      description: input.description ?? null,
      seo: input.seo ?? null,
      puck_data: input.puck_data ?? EMPTY_PUCK_DATA,
      template: input.template ?? null,
      locale: input.locale ?? null,
      sales_channel_id: input.sales_channel_id ?? null,
      metadata: input.metadata ?? null,
      created_by: input.created_by ?? null,
      updated_by: input.created_by ?? null,
      published_at: willPublish ? new Date() : null,
    });

    return new StepResponse(created, created.id as string);
  },
  async (id, { container }) => {
    if (!id) {
      return;
    }
    const service: LandingPageModuleService = container.resolve(
      LANDING_PAGE_MODULE,
    );
    await (service as any).deleteLandingPages(id);
  },
);

export const createLandingPageWorkflow = createWorkflow(
  'create-landing-page',
  (input: CreateLandingPageInput) => {
    const landing_page = createLandingPageStep(input);
    return new WorkflowResponse(landing_page);
  },
);
