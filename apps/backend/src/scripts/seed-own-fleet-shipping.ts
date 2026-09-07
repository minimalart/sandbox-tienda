/**
 * Standalone, idempotent cleanup for the legacy OWN-FLEET ("Flota Propia")
 * shipping option.
 *
 * CONTEXTO: los métodos "Común" (Envío Estándar) y "Express" YA son flota
 * propia — classify() (en workflows/create-delivery-execution.ts) los resuelve a
 * provider_type 'own_fleet' / service_mode 'home_delivery' por el fallback por
 * defecto, porque sus nombres/códigos no disparan ningún hint. Por eso la opción
 * separada "Flota Propia Mercatto" (code 'own-fleet-ar') es REDUNDANTE y no debe
 * aparecer como un cuarto método en el checkout.
 *
 * Este script (antes creaba la opción) ahora la ELIMINA si existe, para limpiar
 * entornos ya sembrados. Es idempotente: si no existe, no hace nada. El hint
 * hasOwnFleetHint() en classify() se deja vigente por compatibilidad, pero ya no
 * hay ninguna opción que lo dispare.
 *
 * Run with:
 *   pnpm exec medusa exec ./src/scripts/seed-own-fleet-shipping.ts
 *   or: dotenv -e .env -- medusa exec ./src/scripts/seed-own-fleet-shipping.ts
 */
import { deleteShippingOptionsWorkflow } from '@medusajs/core-flows';
import type {
  ExecArgs,
  IFulfillmentModuleService,
} from '@medusajs/framework/types';
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
} from '@medusajs/framework/utils';

const SHIPPING_OPTION_NAME = 'Flota Propia Mercatto';
const SHIPPING_OPTION_CODE = 'own-fleet-ar';

export default async function removeOwnFleetShipping({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  const fulfillmentService: IFulfillmentModuleService = container.resolve(
    ModuleRegistrationName.FULFILLMENT,
  );

  logger.info(
    'Removing legacy "Flota Propia" (own-fleet) shipping option if present...',
  );

  // Buscar por nombre y por type.code (cubrir ambos identificadores).
  const [byName] = await fulfillmentService.listShippingOptions({
    name: SHIPPING_OPTION_NAME,
  });
  const byCode = await fulfillmentService.listShippingOptions(
    {},
    { relations: ['type'] },
  );
  const byCodeMatch = byCode.find(
    (so) => (so.type as { code?: string } | undefined)?.code === SHIPPING_OPTION_CODE,
  );

  const ids = Array.from(
    new Set([byName?.id, byCodeMatch?.id].filter((id): id is string => !!id)),
  );

  if (ids.length === 0) {
    logger.info('No "Flota Propia" shipping option found. Nothing to do.');
    return;
  }

  await deleteShippingOptionsWorkflow(container).run({ input: { ids } });

  logger.info(
    `Removed ${ids.length} legacy "Flota Propia" shipping option(s). Común/Express ya cubren flota propia.`,
  );
}
