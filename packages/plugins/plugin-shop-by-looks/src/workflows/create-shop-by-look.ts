import { createWorkflow, WorkflowResponse } from '@medusajs/framework/workflows-sdk';
import {
  createShopByLookStep,
  CreateShopByLookStepInput,
} from './steps/create-shop-by-look';

export type CreateShopByLookInput = CreateShopByLookStepInput;

export const createShopByLookWorkflow = createWorkflow(
  'create-shop-by-look',
  (input: CreateShopByLookInput) => {
    const look = createShopByLookStep(input);

    return new WorkflowResponse(look);
  }
);
