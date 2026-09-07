import { createWorkflow, WorkflowResponse } from '@medusajs/framework/workflows-sdk';
import { createGa4MappingStep, CreateGa4MappingStepInput } from './steps/create-ga4-mapping';

export type CreateGa4MappingInput = CreateGa4MappingStepInput;

export const createGa4MappingWorkflow = createWorkflow(
  'create-ga4-mapping',
  (input: CreateGa4MappingInput) => {
    const mapping = createGa4MappingStep(input);

    return new WorkflowResponse(mapping);
  }
);
