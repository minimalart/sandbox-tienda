/**
 * Standalone, idempotent seed for the Andreani pickup / HOP shipping option.
 *
 * Use this on an EXISTING database where the main seed already ran (the main
 * seed is first-run oriented and its region step can fail on re-run). It only
 * creates the Andreani pickup fulfillment set + shipping option, reusing the
 * Default shipping profile and Main Warehouse stock location already present.
 *
 * Run with:
 *   pnpm exec medusa exec ./src/scripts/seed-andreani-pickup.ts
 *   or: dotenv -e .env -- medusa exec ./src/scripts/seed-andreani-pickup.ts
 *
 * Requires ANDREANI_USERNAME (so the `andreani_andreani` provider is registered).
 */
import { createShippingOptionsWorkflow } from '@medusajs/core-flows';
import type {
  ExecArgs,
  IFulfillmentModuleService,
  IStockLocationService,
} from '@medusajs/framework/types';
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
  Modules,
} from '@medusajs/framework/utils';

const ANDREANI_PROVIDER_ID = 'andreani_andreani';
const PICKUP_SET_NAME = 'Retiro Andreani';
// "Retiro" → pickup option; "Andreani" → Andreani provider. The PuntoDeTercero
// lookup returns Andreani branches AND HOP points, so it reads as "sucursales".
const SHIPPING_OPTION_NAME = 'Retiro en sucursales';

export default async function seedAndreaniPickup({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const link = container.resolve(ContainerRegistrationKeys.LINK);

  const fulfillmentService: IFulfillmentModuleService = container.resolve(
    ModuleRegistrationName.FULFILLMENT
  );
  const stockLocationService: IStockLocationService = container.resolve(
    ModuleRegistrationName.STOCK_LOCATION
  );

  logger.info('Seeding Andreani pickup / HOP shipping option...');

  if (!process.env.ANDREANI_USERNAME) {
    logger.warn(
      'ANDREANI_USERNAME is not set — the andreani_andreani provider is not registered. Aborting.'
    );
    return;
  }

  // Reuse the prerequisites the main seed already created.
  const [shippingProfile] = await fulfillmentService.listShippingProfiles({
    name: 'Default',
  });
  if (!shippingProfile) {
    throw new Error(
      'Default shipping profile not found. Run the main seed (pnpm db:seed) first.'
    );
  }

  const [stockLocation] = await stockLocationService.listStockLocations({
    name: 'Main Warehouse',
  });
  if (!stockLocation) {
    throw new Error(
      'Main Warehouse stock location not found. Run the main seed (pnpm db:seed) first.'
    );
  }

  // The provider must be enabled for the stock location before a shipping option
  // can use it. Idempotent: ignore the error if the link already exists.
  try {
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_provider_id: ANDREANI_PROVIDER_ID },
    });
    logger.info(`Linked provider ${ANDREANI_PROVIDER_ID} to the stock location.`);
  } catch (e) {
    logger.info(
      `Provider link skipped (likely already enabled): ${
        e instanceof Error ? e.message : String(e)
      }`
    );
  }

  // Find-or-create the pickup fulfillment set (a prior partial run may have
  // created it without the shipping option).
  let [pickupSet] = await fulfillmentService.listFulfillmentSets(
    { name: PICKUP_SET_NAME },
    { relations: ['service_zones'] }
  );

  if (!pickupSet) {
    pickupSet = await fulfillmentService.createFulfillmentSets({
      name: PICKUP_SET_NAME,
      type: 'pickup',
      service_zones: [
        {
          // Service zone names are globally unique in Medusa, so it cannot reuse
          // the "Argentina" zone of the main shipping set.
          name: 'Argentina (Andreani HOP)',
          geo_zones: [{ country_code: 'ar', type: 'country' as const }],
        },
      ],
    });

    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_set_id: pickupSet.id },
    });
    logger.info(`Created pickup fulfillment set "${PICKUP_SET_NAME}".`);
  } else {
    logger.info(`Reusing existing pickup fulfillment set "${PICKUP_SET_NAME}".`);
  }

  const [zone] = pickupSet.service_zones ?? [];
  if (!zone) throw new Error('Andreani pickup set has no service zone.');

  // Idempotent: skip if the option already exists.
  const [existingOption] = await fulfillmentService.listShippingOptions({
    name: SHIPPING_OPTION_NAME,
  });
  if (existingOption) {
    logger.info('Andreani pickup (HOP) shipping option already exists. Done.');
    return;
  }

  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        // "Retiro" → pickup option; "Andreani" → Andreani provider. Together they
        // make the checkout's isAndreaniPickupOption() match and fetch HOP points.
        name: SHIPPING_OPTION_NAME,
        price_type: 'flat',
        provider_id: ANDREANI_PROVIDER_ID,
        service_zone_id: zone.id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: 'Retiro HOP',
          description: 'Retirá tu pedido en un punto Andreani HOP cercano.',
          code: 'andreani-hop-ar',
        },
        // resolveServiceType() reads service_type/id from here → shipment created
        // as PuntoDeTercero (HOP).
        data: {
          id: 'andreani-punto-tercero',
          name: 'Andreani Punto de Tercero',
          service_type: 'PuntoDeTercero',
        },
        // Flat & free keeps it always selectable, which is what triggers the HOP
        // lookup. Live cotización is validated via POST /store/andreani/rates.
        prices: [{ currency_code: 'ars', amount: 0 }],
        rules: [
          { attribute: 'enabled_in_store', value: 'true', operator: 'eq' },
          { attribute: 'is_return', value: 'false', operator: 'eq' },
        ],
      },
    ],
  });

  logger.info('Andreani pickup (HOP) shipping option created.');
}
