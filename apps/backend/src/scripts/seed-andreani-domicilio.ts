/**
 * Standalone, idempotent seed for the Andreani home-delivery shipping option
 * ("Envío por Andreani", service_type Domicilio) + rename of the legacy pickup
 * option to "Retiro en sucursales".
 *
 * Use this on an EXISTING database where the main seed already ran but predates
 * the two-flow Andreani checkout (it only had the single HOP pickup option). It
 * adds the calculated home-delivery option to the main *shipping* set's Argentina
 * zone and renames the existing pickup option; the storefront then shows both
 * "Envío por Andreani" (domicilio) and "Retiro en sucursales" (retiro + HOP).
 *
 * Run with:
 *   pnpm exec medusa exec ./src/scripts/seed-andreani-domicilio.ts
 *   or: dotenv -e .env -- medusa exec ./src/scripts/seed-andreani-domicilio.ts
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
const DOMICILIO_OPTION_NAME = 'Envío por Andreani';
const ARGENTINA_ZONE_NAME = 'Argentina';
const LEGACY_PICKUP_OPTION_NAME = 'Retiro en punto Andreani HOP';
const NEW_PICKUP_OPTION_NAME = 'Retiro en sucursales';

export default async function seedAndreaniDomicilio({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const link = container.resolve(ContainerRegistrationKeys.LINK);

  const fulfillmentService: IFulfillmentModuleService = container.resolve(
    ModuleRegistrationName.FULFILLMENT
  );
  const stockLocationService: IStockLocationService = container.resolve(
    ModuleRegistrationName.STOCK_LOCATION
  );

  logger.info('Seeding Andreani home-delivery (domicilio) shipping option...');

  if (!process.env.ANDREANI_USERNAME) {
    logger.warn(
      'ANDREANI_USERNAME is not set — the andreani_andreani provider is not registered. Aborting.'
    );
    return;
  }

  // ── Rename the legacy pickup option, if present ────────────────────────────
  // The find-or-create seed never touches existing options, so an already-seeded
  // "Retiro en punto Andreani HOP" keeps its old name until updated here.
  const [legacyPickup] = await fulfillmentService.listShippingOptions({
    name: LEGACY_PICKUP_OPTION_NAME,
  });
  if (legacyPickup) {
    await fulfillmentService.updateShippingOptions(legacyPickup.id, {
      name: NEW_PICKUP_OPTION_NAME,
    });
    logger.info(
      `Renamed pickup option "${LEGACY_PICKUP_OPTION_NAME}" → "${NEW_PICKUP_OPTION_NAME}".`
    );
  } else {
    logger.info(
      `No legacy pickup option "${LEGACY_PICKUP_OPTION_NAME}" found (already renamed or not seeded).`
    );
  }

  // ── Home-delivery option ───────────────────────────────────────────────────
  const [existingDomicilio] = await fulfillmentService.listShippingOptions({
    name: DOMICILIO_OPTION_NAME,
  });
  if (existingDomicilio) {
    logger.info('Andreani domicilio shipping option already exists. Done.');
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

  // The Andreani domicilio option lives in the main *shipping* set's "Argentina"
  // zone (NOT the pickup set), so the storefront classifies it as home delivery.
  const [argentinaZone] = await fulfillmentService.listServiceZones({
    name: ARGENTINA_ZONE_NAME,
  });
  if (!argentinaZone) {
    throw new Error(
      `"${ARGENTINA_ZONE_NAME}" service zone not found. Run the main seed first.`
    );
  }

  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        // Contains "andreani" but not "retiro" → storefront domicilio flow.
        name: DOMICILIO_OPTION_NAME,
        // Calculated: the provider quotes the live Andreani tarifa. No flat
        // `prices` array — createShippingOptions computes via calculatePrice.
        price_type: 'calculated',
        provider_id: ANDREANI_PROVIDER_ID,
        service_zone_id: argentinaZone.id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: 'Envío a domicilio',
          description: 'Andreani te lo lleva a tu domicilio.',
          code: 'andreani-domicilio-ar',
        },
        // resolveServiceType() reads service_type/id from here → the shipment is
        // created as Domicilio (dispatched to the cart shipping address).
        data: {
          id: 'andreani-domicilio',
          name: 'Andreani Domicilio',
          service_type: 'Domicilio',
        },
        rules: [
          { attribute: 'enabled_in_store', value: 'true', operator: 'eq' },
          { attribute: 'is_return', value: 'false', operator: 'eq' },
        ],
      },
    ],
  });

  logger.info('Andreani domicilio shipping option created.');
}
