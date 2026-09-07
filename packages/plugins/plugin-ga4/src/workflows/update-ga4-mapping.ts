import { createWorkflow, WorkflowResponse } from '@medusajs/framework/workflows-sdk';
import { updateGa4MappingStep, UpdateGa4MappingStepInput } from './steps/update-ga4-mapping';

export type UpdateGa4MappingInput = UpdateGa4MappingStepInput;

export const updateGa4MappingWorkflow = createWorkflow(
  'update-ga4-mapping',
  (input: UpdateGa4MappingInput) => {
    const mapping = updateGa4MappingStep(input);

    return new WorkflowResponse(mapping);
  }
);
