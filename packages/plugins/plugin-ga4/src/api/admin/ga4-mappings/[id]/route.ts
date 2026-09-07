import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';
import { GA4_MODULE } from '../../../../modules/ga4';
import Ga4ModuleService from '../../../../modules/ga4/service';
import { updateGa4MappingWorkflow } from '../../../../workflows/update-ga4-mapping';
import { deleteGa4MappingWorkflow } from '../../../../workflows/delete-ga4-mapping';

import { siteFromRequest } from '../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../lib/multistore/scope';
import { GA4_EVENT_MAPPING_SITE_SCOPE } from '../../../../modules/ga4/site-scope';

const Ga4ParamMappingSchema = z.object({
  ga4_param: z.string().min(1, 'ga4_param is required'),
  source_path: z.string().optional(),
  static_value: z.unknown().optional(),
});

export const UpdateGa4MappingSchema = z.object({
  medusa_event: z.string().min(1).optional(),
  ga4_event_name: z.string().min(1).optional(),
  is_active: z.boolean().optional(),
  description: z.string().optional(),
  param_mappings: z.array(Ga4ParamMappingSchema).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

type UpdateGa4MappingInput = z.infer<typeof UpdateGa4MappingSchema>;

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // Todos los handlers: editar el mapeo GLOBAL desde la pantalla de una tienda
  // cambia a qué evento de GA4 va cada acción en TODAS las demás.
  await assertIdInSite(req.scope, await siteFromRequest(req), GA4_EVENT_MAPPING_SITE_SCOPE, req.params.id as string);

  const id = req.params.id as string;
  const ga4Service: Ga4ModuleService = req.scope.resolve(GA4_MODULE);

  const ga4_mapping = await ga4Service.retrieveGa4EventMapping(id);

  res.status(200).json({ ga4_mapping });
}

export async function POST(
  req: MedusaRequest<UpdateGa4MappingInput>,
  res: MedusaResponse
): Promise<void> {
  // Todos los handlers: editar el mapeo GLOBAL desde la pantalla de una tienda
  // cambia a qué evento de GA4 va cada acción en TODAS las demás.
  await assertIdInSite(req.scope, await siteFromRequest(req), GA4_EVENT_MAPPING_SITE_SCOPE, req.params.id as string);

  const id = req.params.id as string;
  const input = req.validatedBody as UpdateGa4MappingInput;

  const { result } = await updateGa4MappingWorkflow(req.scope).run({
    input: { id, ...input },
  });

  res.status(200).json({ ga4_mapping: result });
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // Todos los handlers: editar el mapeo GLOBAL desde la pantalla de una tienda
  // cambia a qué evento de GA4 va cada acción en TODAS las demás.
  await assertIdInSite(req.scope, await siteFromRequest(req), GA4_EVENT_MAPPING_SITE_SCOPE, req.params.id as string);

  const id = req.params.id as string;

  await deleteGa4MappingWorkflow(req.scope).run({
    input: { id },
  });

  res.status(200).json({ id, deleted: true });
}
