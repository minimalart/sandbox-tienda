import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk';
import { GA4_MODULE } from '../../modules/ga4';
import Ga4ModuleService from '../../modules/ga4/service';
import { Ga4ParamMappingInput } from './create-ga4-mapping';

export type UpdateGa4MappingStepInput = {
  id: string;
  medusa_event?: string;
  ga4_event_name?: string;
  is_active?: boolean;
  description?: string;
  param_mappings?: Ga4ParamMappingInput[];
  metadata?: Record<string, unknown>;
};

export const updateGa4MappingStep = createStep(
  'update-ga4-mapping-step',
  async (input: UpdateGa4MappingStepInput, { container }) => {
    const ga4Service: Ga4ModuleService = container.resolve(GA4_MODULE);

    // Snapshot the current row so the compensation can restore it on failure.
    const previous = await ga4Service.retrieveGa4EventMapping(input.id);

    // param_mappings (array) va a una columna json() que el ORM tipa como
    // Record — casteamos solo ese campo en el borde de persistencia.
    const mapping = await ga4Service.updateGa4EventMappings({
      ...input,
      param_mappings: input.param_mappings as unknown as Record<string, unknown>,
    });

    return new StepResponse(mapping, previous);
  },
  async (previous, { container }) => {
    if (!previous) {
      return;
    }

    const ga4Service: Ga4ModuleService = container.resolve(GA4_MODULE);

    await ga4Service.updateGa4EventMappings({
      id: previous.id,
      medusa_event: previous.medusa_event,
      ga4_event_name: previous.ga4_event_name,
      is_active: previous.is_active,
      description: previous.description,
      param_mappings: previous.param_mappings,
      metadata: previous.metadata,
    });
  }
);
