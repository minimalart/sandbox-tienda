import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';
import { ERP_MODULE } from '../../../../../modules/erp';
import type ErpModuleService from '../../../../../modules/erp/service';
import { FAILURE_STRIKES } from '../../../../../modules/erp/sync/image-failures';

/**
 * POST /admin/erp/config/reset-image-failures
 *
 * Vacía el mapa `settings.catalog_sync.failures` para desbloquear los SKUs que
 * el planner de imágenes está saltando por cooldown (3+ strikes en los últimos
 * 7 días — ver `image-failures.ts`). Sin esto, ajustar `min_dimension_px` o
 * publicar el artículo en el ERP no alcanza: el guard `shouldSkipImageFetch`
 * los sigue saltando hasta que expire el cooldown.
 *
 * Se limpia TODO el mapa (incluidos los SKUs con < FAILURE_STRIKES). Los que
 * quedaban con 1-2 strikes no bloqueaban nada, así que borrarlos no cambia
 * comportamiento; si vuelven a fallar, el motor los re-registra en el primer
 * intento fallido.
 */
export async function POST(_req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const service = _req.scope.resolve<ErpModuleService>(ERP_MODULE);
  const config = await service.getConfig();
  if (!config) {
    // El endpoint es idempotente cuando no hay config: nada que limpiar. Un 200
    // con `cleared: 0` es más simpático que un 404 para una acción que el
    // operador va a disparar por reflejo.
    res.status(200).json({ cleared: 0, remaining: 0 });
    return;
  }

  const failures = config.settings?.catalog_sync?.images?.failures ?? {};
  let cleared = 0;
  let remaining = 0;
  for (const record of Object.values(failures)) {
    if ((record?.count ?? 0) >= FAILURE_STRIKES) cleared += 1;
    else remaining += 1;
  }

  try {
    await service.upsertConfig({
      // Los root flags NO se tocan: pasar los actuales dispararía el bug del
      // "must pass a non-undefined value" si hay un update parcial en paralelo,
      // pero el service ya filtra `undefined`, así que omitirlos es la
      // señal correcta de "no cambio nada de esto".
      settings: {
        catalog_sync: {
          // El mapa vive DENTRO de `images` (no directo en `catalog_sync`) —
          // el motor lo persiste ahí en `imageFailures` del sync loop. Mandar
          // `images: { failures: {} }` bypasea el nested merge de la sección
          // `images` porque el `NESTED_SUBKEYS.catalog_sync = ['images']` deja
          // los otros keys de `images` intactos (enabled, min_dimension_px,
          // backfill_pending).
          images: { failures: {} },
        },
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `No se pudo resetear el mapa de fallas de imágenes: ${detail}`
    );
  }

  // `remaining` viaja como referencia informativa: cuántas quedaban sin llegar
  // al cooldown antes de la limpieza. Después del reset el mapa queda vacío.
  res.status(200).json({ cleared: cleared + remaining, remaining: 0 });
}
