import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import { LANDING_PAGE_MODULE } from '../modules/landing-page';
import type LandingPageModuleService from '../modules/landing-page/service';

export type PublishLandingPageWorkflowInput = {
  id: string;
  publish: boolean;
};

const publishLandingPageStep = createStep(
  'publish-landing-page',
  async (input: PublishLandingPageWorkflowInput, { container }) => {
    const service: LandingPageModuleService = container.resolve(
      LANDING_PAGE_MODULE,
    );

    const updated = await (service as any).updateLandingPages({
      id: input.id,
      status: input.publish ? 'published' : 'draft',
      published_at: input.publish ? new Date() : null,
    });

    return new StepResponse(Array.isArray(updated) ? updated[0] : updated);
  },
);

export const publishLandingPageWorkflow = createWorkflow(
  'publish-landing-page',
  (input: PublishLandingPageWorkflowInput) => {
    const landing_page = publishLandingPageStep(input);
    return new WorkflowResponse(landing_page);
  },
);
