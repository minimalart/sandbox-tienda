/**
 * Standalone, idempotent seed for the STORE PICKUP ("Retiro en sucursal")
 * shipping option.
 *
 * Crea una shipping option flat & gratis sobre la service zone Argentina del set
 * "Main Warehouse delivery" (creado por el seed principal), con el provider
 * manual_manual. Al elegirla en el checkout:
 *  - el storefront la trata como PICKUP (el nombre contiene "retiro") y NO como
 *    Andreani (el provider no es andreani), mostrando el selector de sucursal;
 *  - create-delivery-execution la clasifica como provider_type 'store_pickup'
 *    vía el marker data.pickup_kind === 'store' (que el storefront reenvía al
 *    setear el método, ya que el provider manual no preserva el data sembrado).
 *
 * NOTA: la palabra "sucursal" en el NOMBRE dispara hasAndreaniHint() en
 * classify(); por eso la clasificación correcta depende del marker pickup_kind,
 * no del nombre.
 *
 * Run with:
 *   pnpm exec medusa exec ./src/scripts/seed-store-pickup-shipping.ts
 */
import { createShippingOptionsWorkflow } from '@medusajs/core-flows';
import type {
  ExecArgs,
  IFulfillmentModuleService,
} from '@medusajs/framework/types';
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
} from '@medusajs/framework/utils';

const FULFILLMENT_SET_NAME = 'Main Warehouse delivery';
const ARGENTINA_ZONE_NAME = 'Argentina';
const SHIPPING_OPTION_NAME = 'Retiro en sucursal';
const SHIPPING_OPTION_CODE = 'store-pickup-ar';
const PROVIDER_ID = 'manual_manual';

export default async function seedStorePickupShipping({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  const fulfillmentService: IFulfillmentModuleService = container.resolve(
    ModuleRegistrationName.FULFILLMENT,
  );

  logger.info('Seeding "Retiro en sucursal" (store pickup) shipping option...');

  const [shippingProfile] = await fulfillmentService.listShippingProfiles({
    name: 'Default',
  });
  if (!shippingProfile) {
    throw new Error(
      'Default shipping profile not found. Run the main seed (pnpm db:seed) first.',
    );
  }

  const [fulfillmentSet] = await fulfillmentService.listFulfillmentSets(
    { name: FULFILLMENT_SET_NAME },
    { relations: ['service_zones'] },
  );
  if (!fulfillmentSet) {
    throw new Error(
      `Fulfillment set "${FULFILLMENT_SET_NAME}" not found. Run the main seed (pnpm db:seed) first.`,
    );
  }

  const zone = (fulfillmentSet.service_zones ?? []).find(
    (z) => z.name === ARGENTINA_ZONE_NAME,
  );
  if (!zone) {
    throw new Error(
      `Service zone "${ARGENTINA_ZONE_NAME}" not found on "${FULFILLMENT_SET_NAME}".`,
    );
  }

  // Idempotente: salir si ya existe (por nombre).
  const [byName] = await fulfillmentService.listShippingOptions({
    name: SHIPPING_OPTION_NAME,
  });
  if (byName) {
    logger.info('"Retiro en sucursal" shipping option already exists. Done.');
    return;
  }

  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: SHIPPING_OPTION_NAME,
        price_type: 'flat',
        provider_id: PROVIDER_ID,
        service_zone_id: zone.id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: 'Retiro en sucursal',
          description: 'Retirá tu pedido en una de nuestras sucursales.',
          code: SHIPPING_OPTION_CODE,
        },
        // Marker leído por classify() → store_pickup. El storefront lo reenvía al
        // setear el método (el provider manual no preserva este data por sí solo).
        data: {
          pickup_kind: 'store',
        },
        // Gratis: el retiro en sucursal no tiene costo de envío.
        prices: [{ currency_code: 'ars', amount: 0 }],
        rules: [
          { attribute: 'enabled_in_store', value: 'true', operator: 'eq' },
          { attribute: 'is_return', value: 'false', operator: 'eq' },
        ],
      },
    ],
  });

  logger.info('"Retiro en sucursal" (store pickup) shipping option created.');
}
