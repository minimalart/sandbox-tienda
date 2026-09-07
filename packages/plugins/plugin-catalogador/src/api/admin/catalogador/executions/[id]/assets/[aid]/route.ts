import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { CATALOGADOR_MODULE } from '../../../../../../../modules/catalogador';
import type CatalogadorModuleService from '../../../../../../../modules/catalogador/service';
import type { ASSET_PROPOSAL_STATUSES } from '../../../../../../../modules/catalogador/models';
import { cleanupProposalFiles } from '../../../../../../../modules/catalogador/asset-cleanup';

import { siteFromRequest } from '../../../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../../../lib/multistore/scope';
import { CATALOGING_EXECUTION_SITE_SCOPE } from '../../../../../../../modules/catalogador/site-scope';

type AssetStatus = (typeof ASSET_PROPOSAL_STATUSES)[number];

/**
 * POST /admin/catalogador/executions/:id/assets/:aid — acepta o rechaza una
 * propuesta de imagen (PRD §12.3: el usuario elige una variación y descarta las
 * demás). body: { decision: 'accept' | 'reject' }. Al aceptar una imagen IA,
 * las otras variaciones de la MISMA operación en ese producto se rechazan.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // El guard va sobre la EJECUCIÓN: `cataloging_asset_proposal` no tiene columna de
  // tienda, cuelga de `execution_product_id` y de ahí de la corrida.
  await assertIdInSite(req.scope, await siteFromRequest(req), CATALOGING_EXECUTION_SITE_SCOPE, req.params.id as string);

  const service = req.scope.resolve<CatalogadorModuleService>(CATALOGADOR_MODULE);
  const executionId = req.params.id as string;
  const aid = req.params.aid as string;
  const body = (req.body ?? {}) as { decision?: 'accept' | 'reject' };
  const decision = body.decision ?? 'accept';

  let proposal;
  try {
    proposal = await service.retrieveCatalogingAssetProposal(aid);
  } catch {
    res.status(404).json({ type: 'not_found', message: 'Propuesta de imagen no encontrada' });
    return;
  }

  /*
    El guard de arriba cubre la TIENDA; esto cubre la PERTENENCIA a la corrida del
    path. Sin esto el guard quedaba decorativo: `:aid` se resolvía por su PK y `:id`
    no se volvía a usar, así que una corrida propia con una propuesta ajena aceptaba
    —o rechazaba— la imagen de otra corrida.

    El salto es DOBLE porque el modelo no da uno solo: `cataloging_asset_proposal` no
    tiene `execution_id`, sólo `execution_product_id` (ver
    `models/cataloging-asset-proposal.ts`). Así que hay que pasar por el producto de
    la ejecución, que sí lo tiene, para llegar a la comparación que hace
    `products/[pid]`: `execution_id !== executionId → 404`.

    La lectura del producto NO es nueva: este handler ya la hacía, pero tarde y
    condicionada —dentro del `if (decision === 'accept')`, DESPUÉS de escribir el
    estado de la propuesta y envuelta en un catch best-effort—. Sirve como validación
    justamente porque se movió acá arriba: como guard tiene que correr antes de
    mutar, siempre, y su fallo tiene que cortar en vez de tragarse. El costo real es
    una consulta extra sólo en el camino 'reject'.

    La alternativa descartada era un descriptor `via_parent` encadenado para la
    propuesta: resuelve el eje de TIENDA en una llamada, pero seguiría aceptando una
    propuesta de otra corrida de la misma tienda, que es el cruce que rompe el
    tablero de revisión.

    404 y no 403, igual que el guard: el status no tiene que delatar que esa
    propuesta existe en otra corrida.
  */
  const product = await service
    .retrieveCatalogingExecutionProduct(proposal.execution_product_id)
    .catch(() => null);
  if (product?.execution_id !== executionId) {
    res.status(404).json({ type: 'not_found', message: 'Propuesta de imagen no encontrada' });
    return;
  }

  const nextStatus: AssetStatus = decision === 'accept' ? 'accepted' : 'rejected';
  await service.updateCatalogingAssetProposals([{ id: aid, status: nextStatus }]);

  if (decision === 'reject') {
    // Rechazar deja de ser sólo un cambio de columna: el binario se va. Antes el
    // archivo quedaba en el storage para siempre, y la propuesta rechazada era la
    // única pista de que existía.
    await cleanupProposalFiles(req.scope, [proposal], { mode: 'discard' });
  }

  if (decision === 'accept') {
    // Exclusividad SÓLO para IA: las variaciones de la misma operación son
    // alternativas → elegir una descarta las demás. Las técnicas (optimize) NO
    // son excluyentes: cada una reemplaza una imagen distinta.
    if (proposal.is_ai_generated) {
      const siblings = await service.listCatalogingAssetProposals(
        { execution_product_id: proposal.execution_product_id, operation_type: proposal.operation_type },
        { take: null as unknown as number }
      );
      const toReject = siblings.filter((s) => s.id !== aid && s.status !== 'applied' && s.is_ai_generated);
      if (toReject.length) {
        await service.updateCatalogingAssetProposals(toReject.map((s) => ({ id: s.id, status: 'rejected' as const })));
        // Las variaciones descartadas son el residuo más voluminoso del módulo:
        // `variations: 2` por defecto significa que la mitad de lo generado por IA
        // nace para tirarse. `keepUrls` protege la elegida por si dos propuestas
        // llegaran a apuntar al mismo archivo.
        await cleanupProposalFiles(req.scope, toReject, {
          mode: 'discard',
          keepUrls: [proposal.generated_asset_id].filter((u): u is string => Boolean(u)),
        });
      }
    }

    // Elegir una imagen marca el producto como aceptado (para que entre en la
    // aplicación aunque no se hayan aceptado campos de texto), salvo que ya esté
    // aplicado o excluido.
    //
    // Reusa el `product` que ya leyó la validación de pertenencia de arriba. El
    // try/catch se mantiene sólo alrededor de la ESCRITURA: el best-effort era para
    // no tumbar la decisión sobre la imagen si falla el arrastre del producto, no
    // para tolerar que el producto no se pueda leer — eso ahora es un 404 y corta.
    if (!['applied', 'excluded'].includes(product.status as string)) {
      try {
        await service.updateCatalogingExecutionProducts([
          { id: proposal.execution_product_id, status: 'accepted' as const },
        ]);
      } catch {
        // best-effort
      }
    }
  }

  const updated = await service.retrieveCatalogingAssetProposal(aid);
  res.status(200).json({ asset_proposal: updated });
}
