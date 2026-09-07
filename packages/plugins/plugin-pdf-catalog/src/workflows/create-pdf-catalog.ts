import { createWorkflow, WorkflowResponse } from '@medusajs/framework/workflows-sdk';
import {
  createPdfCatalogStep,
  CreatePdfCatalogStepInput,
} from './steps/create-pdf-catalog';

export type CreatePdfCatalogInput = CreatePdfCatalogStepInput;

export const createPdfCatalogWorkflow = createWorkflow(
  'create-pdf-catalog',
  (input: CreatePdfCatalogInput) => {
    const catalog = createPdfCatalogStep(input);

    return new WorkflowResponse(catalog);
  }
);
