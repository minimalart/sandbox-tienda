import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';
import { GA4_MODULE } from '../../../modules/ga4';
import Ga4ModuleService from '../../../modules/ga4/service';
import { createGa4MappingWorkflow } from '../../../workflows/create-ga4-mapping';

import { siteFromRequest } from '../../../lib/multistore/request';
import { siteDefaults, siteFilter } from '../../../lib/multistore/scope';
import { GA4_EVENT_MAPPING_SITE_SCOPE } from '../../../modules/ga4/site-scope';

const Ga4ParamMappingSchema = z.object({
  ga4_param: z.string().min(1, 'ga4_param is required'),
  source_path: z.string().optional(),
  static_value: z.unknown().optional(),
});

export const CreateGa4MappingSchema = z.object({
  medusa_event: z.string().min(1, 'medusa_event is required'),
  ga4_event_name: z.string().min(1, 'ga4_event_name is required'),
  is_active: z.boolean().optional().default(true),
  description: z.string().optional(),
  param_mappings: z.array(Ga4ParamMappingSchema).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

type CreateGa4MappingInput = z.infer<typeof CreateGa4MappingSchema>;

export async function POST(
  req: MedusaRequest<CreateGa4MappingInput>,
  res: MedusaResponse
): Promise<void> {
  const input = req.validatedBody as CreateGa4MappingInput;

  const { result } = await createGa4MappingWorkflow(req.scope).run({
    input: {
      // Los defaults primero: un `site_id` explícito en el body gana.
      ...siteDefaults(await siteFromRequest(req), GA4_EVENT_MAPPING_SITE_SCOPE),
      ...input,
    },
  });

  res.status(201).json({ ga4_mapping: result });
}

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const ga4Service: Ga4ModuleService = req.scope.resolve(GA4_MODULE);

  const limit = req.query.limit ? Number(req.query.limit) : 20;
  const offset = req.query.offset ? Number(req.query.offset) : 0;
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

  const filters: Record<string, unknown> = {};
  if (q) {
    filters.$or = [
      { medusa_event: { $ilike: `%${q}%` } },
      { ga4_event_name: { $ilike: `%${q}%` } },
    ];
  }

  // El mapeo global se lista junto a los de la tienda: si se escondiera, el operador
  // vería eventos llegando a GA4 con un nombre que no aparece en ningún lado.
  Object.assign(
    filters,
    await siteFilter(req.scope, await siteFromRequest(req), GA4_EVENT_MAPPING_SITE_SCOPE),
  );

  const [ga4_mappings, count] = await ga4Service.listAndCountGa4EventMappings(filters, {
    skip: offset,
    take: limit,
    order: { medusa_event: 'ASC' },
  });

  res.status(200).json({ ga4_mappings, count, offset, limit });
}
