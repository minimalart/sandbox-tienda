import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import { Modules, MedusaError } from '@medusajs/framework/utils';
import { CORPORATE_MODULE } from '../modules/corporate';
import type CorporateModuleService from '../modules/corporate/service';
import type { CorporateStatus } from '../modules/corporate/types';

export type SetCorporateStatusInput = {
  corporate_id: string;
  status: CorporateStatus;
};

const setStatusStep = createStep(
  'set-corporate-status',
  async (input: SetCorporateStatusInput, { container }) => {
    const service = container.resolve<CorporateModuleService>(CORPORATE_MODULE);
    const current = await service.retrieveCorporate(input.corporate_id);
    if (!current) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Empresa no encontrada.');
    }
    const previous = current.status as CorporateStatus;
    await service.updateCorporates({ id: input.corporate_id, status: input.status });

    const eventBus = container.resolve(Modules.EVENT_BUS);
    if (input.status === 'active' && previous !== 'active') {
      await eventBus.emit({ name: 'corporate.activated', data: { id: input.corporate_id } });
    } else if (input.status === 'suspended') {
      await eventBus.emit({ name: 'corporate.suspended', data: { id: input.corporate_id } });
    }

    return new StepResponse({ id: input.corporate_id, status: input.status }, {
      id: input.corporate_id,
      previous,
    });
  },
  async (undo: { id: string; previous: CorporateStatus } | undefined, { container }) => {
    if (!undo) return;
    const service = container.resolve<CorporateModuleService>(CORPORATE_MODULE);
    await service.updateCorporates({ id: undo.id, status: undo.previous });
  },
);

export const setCorporateStatusWorkflow = createWorkflow(
  'set-corporate-status',
  function (input: SetCorporateStatusInput) {
    return new WorkflowResponse(setStatusStep(input));
  },
);
