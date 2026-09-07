import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { z } from 'zod';
import { productIdsForSite } from '../../../../../lib/multistore/product-scope';

/**
 * Filtros de selección de productos (Paso 1, PRD §11.2). Sólo trabaja sobre
 * productos EXISTENTES: nunca crea ni importa (PRD §11.3).
 */
export const SelectionPreviewSchema = z.object({
  q: z.string().optional(),
  category_id: z.string().optional(),
  collection_id: z.string().optional(),
  tag_id: z.string().optional(),
  status: z.enum(['draft', 'proposed', 'published', 'rejected']).optional(),
  /** Productos a los que les falta este campo (best-effort: description/subtitle/title). */
  missing_field: z.enum(['description', 'subtitle', 'title']).optional(),
  limit: z.number().int().positive().max(100).optional(),
});

type SelectionPreviewInput = z.infer<typeof SelectionPreviewSchema>;

const VOLUME_WARN_THRESHOLD = 200;

/** POST /admin/catalogador/selection/preview — resuelve filtros → conteo + muestra. */
export async function POST(
  req: MedusaRequest<SelectionPreviewInput>,
  res: MedusaResponse
): Promise<void> {
  const input = req.validatedBody as SelectionPreviewInput;
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  /**
   * El paso 1 del catalogador ELIGE sobre qué productos van a correr los pasos
   * siguientes, así que su conteo es la promesa de la corrida entera: "voy a tocar
   * estos 340". Sin el eje, ese número —y la muestra— eran los del catálogo de toda
   * la instalación, y `admin/catalogador/executions` filtra: el operador elegía
   * sobre un universo que su pantalla de corridas después no le muestra.
   *
   * `[]` se propaga tal cual y no se ignora: una tienda sin catálogo tiene que ver
   * cero, no todo.
   */
  const allowedProducts = await productIdsForSite(req);

  const filters: Record<string, unknown> = {};
  if (allowedProducts !== null) filters.id = allowedProducts;
  if (input.q) filters.title = { $ilike: `%${input.q}%` };
  if (input.status) filters.status = input.status;
  if (input.category_id) filters.categories = { id: input.category_id };
  if (input.collection_id) filters.collection_id = input.collection_id;
  if (input.tag_id) filters.tags = { id: input.tag_id };

  const sampleLimit = input.limit ?? 20;

  const { data, metadata } = await query.graph({
    entity: 'product',
    fields: ['id', 'title', 'status', 'thumbnail', 'subtitle', 'description'],
    filters,
    pagination: { skip: 0, take: sampleLimit, order: { title: 'ASC' } },
  });

  let products = data as Array<Record<string, unknown>>;
  let count = metadata?.count ?? products.length;

  // "Sin campo X" — post-filtro best-effort sobre la muestra (Medusa no filtra
  // por null de forma uniforme). Se marca la limitación al usuario en la UI.
  let approximate = false;
  if (input.missing_field) {
    products = products.filter((p) => {
      const val = p[input.missing_field as string];
      return val === null || val === undefined || String(val).trim() === '';
    });
    count = products.length;
    approximate = true;
  }

  res.status(200).json({
    count,
    approximate,
    sample: products.map((p) => ({
      id: p.id,
      title: p.title,
      status: p.status,
      thumbnail: p.thumbnail ?? null,
    })),
    warning: count > VOLUME_WARN_THRESHOLD ? 'volume_high' : null,
  });
}
