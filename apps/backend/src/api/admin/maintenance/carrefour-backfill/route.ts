/**
 * Endpoint de mantenimiento one-off: dispara el backfill de inventario +
 * shipping profile para los productos de Carrefour (metadata.source ===
 * "carrefour-vtex").
 *
 * Existe porque la DB de prod no es alcanzable directo desde fuera del entorno
 * de DO (allowlist), así que el script `medusa exec` no se puede correr de
 * forma remota. Este endpoint corre la MISMA lógica server-side (donde la DB sí
 * es alcanzable) y se dispara por HTTP con la admin API key.
 *
 * Está trozado: cada llamada procesa hasta `max_products` productos-con-trabajo
 * y devuelve `capped: true` mientras queden más, para no chocar contra el
 * timeout del load balancer. El cliente repite hasta `capped: false`.
 *
 *   # DRY-RUN (no escribe)
 *   curl -u "$KEY:" -X POST "$URL/admin/maintenance/carrefour-backfill" \
 *     -H 'Content-Type: application/json' -d '{"dry_run":true,"max_products":2000}'
 *
 *   # APPLY (un chunk)
 *   curl -u "$KEY:" -X POST "$URL/admin/maintenance/carrefour-backfill" \
 *     -H 'Content-Type: application/json' -d '{"dry_run":false,"max_products":1000}'
 */
import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { runCarrefourBackfill } from '../../../../scripts/backfill-carrefour-inventory-shipping';

type Body = {
  dry_run?: boolean;
  max_products?: number;
  stocked_quantity?: number;
  stock_location?: string;
  shipping_profile?: string;
};

// Marcador de deploy: permite verificar por HTTP que el build/deploy nuevo entró
// (GET liviano y read-only). Bumpear el valor en cada prueba de deploy.
const DEPLOY_MARKER = 'deploy-probe-2026-06-26a';

export async function GET(_req: MedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ ok: true, marker: DEPLOY_MARKER });
}

export async function POST(req: MedusaRequest<Body>, res: MedusaResponse): Promise<void> {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
  const body = (req.body ?? {}) as Body;

  // Por seguridad, el default es DRY-RUN: hay que mandar dry_run:false explícito.
  const apply = body.dry_run === false;

  const summary = await runCarrefourBackfill(req.scope, {
    apply,
    maxMutateProducts:
      typeof body.max_products === 'number' && body.max_products > 0
        ? body.max_products
        : undefined,
    stockedQuantity:
      typeof body.stocked_quantity === 'number' ? body.stocked_quantity : undefined,
    stockLocationName: body.stock_location,
    shippingProfileName: body.shipping_profile,
    logger,
  });

  res.json({ ok: true, ...summary });
}
