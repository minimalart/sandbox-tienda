import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import { LANDING_PAGE_MODULE } from '../modules/landing-page';
import type LandingPageModuleService from '../modules/landing-page/service';
import type { UpdateLandingPageInput } from '../modules/landing-page/types';

export type UpdateLandingPageWorkflowInput = UpdateLandingPageInput & {
  id: string;
};

const updateLandingPageStep = createStep(
  'update-landing-page',
  async (input: UpdateLandingPageWorkflowInput, { container }) => {
    const service: LandingPageModuleService = container.resolve(
      LANDING_PAGE_MODULE,
    );

    const { id, slug, status, ...rest } = input;

    const data: Record<string, unknown> = { id, ...rest };
    if (slug !== undefined) {
      data.slug = await service.ensureUniqueSlug(slug, id);
    }
    if (status !== undefined) {
      data.status = status;
      // Stamp/clear published_at to keep it consistent with the new status.
      if (status === 'published') {
        data.published_at = new Date();
      } else if (status === 'draft' || status === 'archived') {
        data.published_at = null;
      }
    }

    const updated = await (service as any).updateLandingPages(data);
    return new StepResponse(Array.isArray(updated) ? updated[0] : updated);
  },
);

export const updateLandingPageWorkflow = createWorkflow(
  'update-landing-page',
  (input: UpdateLandingPageWorkflowInput) => {
    const landing_page = updateLandingPageStep(input);
    return new WorkflowResponse(landing_page);
  },
);
