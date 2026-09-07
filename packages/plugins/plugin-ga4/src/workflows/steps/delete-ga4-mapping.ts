import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk';
import { GA4_MODULE } from '../../modules/ga4';
import Ga4ModuleService from '../../modules/ga4/service';

export type DeleteGa4MappingStepInput = {
  id: string;
};

export const deleteGa4MappingStep = createStep(
  'delete-ga4-mapping-step',
  async (input: DeleteGa4MappingStepInput, { container }) => {
    const ga4Service: Ga4ModuleService = container.resolve(GA4_MODULE);

    // Snapshot before deletion so the compensation can recreate the row.
    const previous = await ga4Service.retrieveGa4EventMapping(input.id);

    await ga4Service.deleteGa4EventMappings(input.id);

    return new StepResponse({ id: input.id }, previous);
  },
  async (previous, { container }) => {
    if (!previous) {
      return;
    }

    const ga4Service: Ga4ModuleService = container.resolve(GA4_MODULE);

    await ga4Service.createGa4EventMappings({
      medusa_event: previous.medusa_event,
      ga4_event_name: previous.ga4_event_name,
      is_active: previous.is_active,
      description: previous.description,
      param_mappings: previous.param_mappings,
      metadata: previous.metadata,
    });
  }
);
