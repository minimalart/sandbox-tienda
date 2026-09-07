import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';
import { CATALOGADOR_MODULE } from '../../../../../../../../modules/catalogador';
import type CatalogadorModuleService from '../../../../../../../../modules/catalogador/service';
import { getCatalogadorConfig } from '../../../../../../../../modules/catalogador/config';
import {
  clampComposition,
  type EditableLifestyleMetadata,
} from '../../../../../../../../modules/catalogador/ai/editable-lifestyle';

import { siteFromRequest } from '../../../../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../../../../lib/multistore/scope';
import { CATALOGING_EXECUTION_SITE_SCOPE } from '../../../../../../../../modules/catalogador/site-scope';

/**
 * PATCH /admin/catalogador/executions/:id/assets/:aid/composition (PRD §10).
 *
 * Actualiza ÚNICAMENTE `metadata.composition` de una propuesta lifestyle
 * editable. No genera archivos ni llama a IA (PRD §6.4). El backend aplica los
 * límites del PRD §14 (x/y ∈ [0,1], scale ∈ [MIN,MAX]). El render definitivo se
 * hace al aplicar (PRD §11), no acá.
 */
export const UpdateCompositionSchema = z.object({
  x: z.number(),
  y: z.number(),
  scale: z.number(),
});

type UpdateCompositionInput = z.infer<typeof UpdateCompositionSchema>;

export async function PATCH(req: MedusaRequest<UpdateCompositionInput>, res: MedusaResponse): Promise<void> {
  // El guard va sobre la EJECUCIÓN: la propuesta no tiene columna de tienda, cuelga
  // de `execution_product_id` y de ahí de la corrida.
  await assertIdInSite(req.scope, await siteFromRequest(req), CATALOGING_EXECUTION_SITE_SCOPE, req.params.id as string);

  const service = req.scope.resolve<CatalogadorModuleService>(CATALOGADOR_MODULE);
  const id = req.params.id as string;
  const aid = req.params.aid as string;
  const body = req.validatedBody as UpdateCompositionInput;

  let proposal;
  try {
    proposal = await service.retrieveCatalogingAssetProposal(aid);
  } catch {
    res.status(404).json({ type: 'not_found', message: 'Propuesta de imagen no encontrada' });
    return;
  }

  /*
    El guard de arriba cubre la TIENDA; esto cubre la PERTENENCIA a la corrida del
    path, y va ANTES del 400 de `lifestyle_editable` de abajo a propósito: un 400 que
    dice "esta propuesta no admite composición" sobre una propuesta ajena ya delata
    que existe y de qué tipo es. La pertenencia se chequea antes que la forma.

    El salto es DOBLE porque `cataloging_asset_proposal` no tiene `execution_id`,
    sólo `execution_product_id` (ver `models/cataloging-asset-proposal.ts`): hay que
    pasar por el producto de la ejecución, que sí lo tiene. La lectura del producto
    es NUEVA acá —a diferencia de `assets/[aid]`, este handler no leía el producto en
    ningún camino—, y no hay atajo más corto en el servicio: no existe un
    `retrieve...ByExecution` ni una vista que junte los dos saltos.

    Sin esto, el daño no era sólo la mutación: el `logActivity` de abajo escribe
    `execution_id: id` con el id del PATH, así que editar la composición de una
    propuesta ajena dejaba el rastro anotado en MI corrida y ninguno en la corrida
    que de verdad cambió — la auditoría apuntando al lugar equivocado es peor que no
    tenerla.

    404 y no 403, igual que el guard: el status no tiene que delatar que esa
    propuesta existe en otra corrida.
  */
  const product = await service
    .retrieveCatalogingExecutionProduct(proposal.execution_product_id)
    .catch(() => null);
  if (product?.execution_id !== id) {
    res.status(404).json({ type: 'not_found', message: 'Propuesta de imagen no encontrada' });
    return;
  }

  if (proposal.operation_type !== 'lifestyle_editable') {
    res.status(400).json({
      type: 'invalid_data',
      message: 'Sólo las propuestas lifestyle editable admiten ajuste de composición.',
    });
    return;
  }

  const config = await getCatalogadorConfig(req.scope);
  const composition = clampComposition(
    { x: body.x, y: body.y, scale: body.scale },
    config.image_ai.editable_lifestyle_default_scale
  );

  const meta = (proposal.metadata ?? {}) as Partial<EditableLifestyleMetadata>;
  const nextMeta = { ...meta, composition } as unknown as Record<string, unknown>;
  await service.updateCatalogingAssetProposals([{ id: aid, metadata: nextMeta }]);

  await service.logActivity({
    execution_id: id,
    execution_product_id: proposal.execution_product_id,
    type: 'catalogador.lifestyle_editable.edited',
    metadata: {
      asset_id: aid,
      initial_scale: meta.initial_composition?.scale ?? null,
      scale: composition.scale,
    },
  });

  const updated = await service.retrieveCatalogingAssetProposal(aid);
  res.status(200).json({ asset_proposal: updated });
}
