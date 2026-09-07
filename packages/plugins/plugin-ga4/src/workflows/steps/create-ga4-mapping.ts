import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk';
import { GA4_MODULE } from '../../modules/ga4';
import Ga4ModuleService from '../../modules/ga4/service';

export type Ga4ParamMappingInput = {
  ga4_param: string;
  source_path?: string;
  static_value?: unknown;
};

export type CreateGa4MappingStepInput = {
  medusa_event: string;
  ga4_event_name: string;
  is_active?: boolean;
  description?: string;
  param_mappings?: Ga4ParamMappingInput[];
  metadata?: Record<string, unknown>;
  /**
   * La tienda dueña del mapeo. `null` = GLOBAL.
   *
   * Acá alcanza con tiparlo porque el step hace `...input`. En los workflows que arman
   * el objeto campo por campo hay que enumerarlo además, si no se descarta en silencio
   * — pasó cinco veces en esta migración.
   */
  site_id?: string | null;
};

export const createGa4MappingStep = createStep(
  'create-ga4-mapping-step',
  async (input: CreateGa4MappingStepInput, { container }) => {
    const ga4Service: Ga4ModuleService = container.resolve(GA4_MODULE);

    // param_mappings (array) va a una columna json() que el ORM tipa como
    // Record — casteamos solo ese campo en el borde de persistencia.
    const mapping = await ga4Service.createGa4EventMappings({
      ...input,
      param_mappings: input.param_mappings as unknown as Record<string, unknown>,
    });

    return new StepResponse(mapping, mapping);
  },
  async (compensationData, { container }) => {
    if (!compensationData) {
      return;
    }

    const ga4Service: Ga4ModuleService = container.resolve(GA4_MODULE);

    await ga4Service.deleteGa4EventMappings(compensationData.id);
  }
);
