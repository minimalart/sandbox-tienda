import { createWorkflow, WorkflowResponse } from '@medusajs/framework/workflows-sdk';
import { deleteGa4MappingStep, DeleteGa4MappingStepInput } from './steps/delete-ga4-mapping';

export type DeleteGa4MappingInput = DeleteGa4MappingStepInput;

export const deleteGa4MappingWorkflow = createWorkflow(
  'delete-ga4-mapping',
  (input: DeleteGa4MappingInput) => {
    const result = deleteGa4MappingStep(input);

    return new WorkflowResponse(result);
  }
);
