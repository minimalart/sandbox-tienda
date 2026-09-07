/**
 * Seed idempotente de la opción de retiro en sucursal de Correo Argentino.
 *
 * ⚠️ Mismo doble gate que `seed-correo-domicilio.ts`: además de
 * `CORREO_ARGENTINO_API_KEY` exige `CORREO_ARGENTINO_SEED_SHIPPING_OPTIONS=true`,
 * porque sin credenciales de MiCorreo la opción cotizaría "Gratuito" siempre.
 *
 * Correr con:
 *   pnpm exec medusa exec ./src/scripts/seed-correo-sucursal.ts
 *   o: dotenv -e .env -- medusa exec ./src/scripts/seed-correo-sucursal.ts
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

const CORREO_PROVIDER_ID = 'correo_argentino_correo_argentino';
const PICKUP_SET_NAME = 'Retiro Correo Argentino';
/**
 * ⚠️ Los nombres de service zone son GLOBALMENTE únicos en Medusa. Este NO
 * puede ser "Argentina" (del shipping set principal) ni "Argentina (Andreani
 * HOP)" (del pickup set de Andreani).
 */
const PICKUP_ZONE_NAME = 'Argentina (Correo Argentino)';
/**
 * El nombre lleva "Retiro" (lo clasifica como pickup en el checkout) y "Correo
 * Argentino" (lo matchea el registry de carriers del storefront).
 */
const SHIPPING_OPTION_NAME = 'Retiro en sucursal de Correo Argentino';

export default async function seedCorreoSucursal({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const link = container.resolve(ContainerRegistrationKeys.LINK);

  const fulfillmentService: IFulfillmentModuleService = container.resolve(
    ModuleRegistrationName.FULFILLMENT
  );
  const stockLocationService: IStockLocationService = container.resolve(
    ModuleRegistrationName.STOCK_LOCATION
  );

  logger.info('Seeding Correo Argentino branch-pickup shipping option...');

  if (!process.env.CORREO_ARGENTINO_API_KEY) {
    logger.warn(
      'CORREO_ARGENTINO_API_KEY is not set — the correo_argentino provider is not registered. Aborting.'
    );
    return;
  }

  if (process.env.CORREO_ARGENTINO_SEED_SHIPPING_OPTIONS !== 'true') {
    logger.warn(
      'CORREO_ARGENTINO_SEED_SHIPPING_OPTIONS is not "true" — skipping. ' +
        'Sin credenciales de MiCorreo la opción cotizaría $0 ("Gratuito") en todos los envíos.'
    );
    return;
  }

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

  // ⚠️ El link del provider al stock location va ANTES de
  // createShippingOptionsWorkflow, o falla con "not enabled for the service
  // location".
  try {
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_provider_id: CORREO_PROVIDER_ID },
    });
    logger.info(`Linked provider ${CORREO_PROVIDER_ID} to the stock location.`);
  } catch (e) {
    logger.info(
      `Provider link skipped (likely already enabled): ${
        e instanceof Error ? e.message : String(e)
      }`
    );
  }

  // Find-or-create: una corrida parcial anterior puede haber dejado el set sin
  // la shipping option.
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
          name: PICKUP_ZONE_NAME,
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
  if (!zone) throw new Error('Correo pickup set has no service zone.');

  const [existingOption] = await fulfillmentService.listShippingOptions({
    name: SHIPPING_OPTION_NAME,
  });
  if (existingOption) {
    logger.info('Correo branch-pickup shipping option already exists. Done.');
    return;
  }

  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: SHIPPING_OPTION_NAME,
        // `calculated`, a diferencia del seed de pickup de Andreani (que usa
        // `flat` + $0 para que la opción esté siempre seleccionable y dispare
        // el lookup de puntos HOP). Acá no hace falta el truco: el provider
        // cotiza retiro en sucursal con `deliveredType: 'S'`, que suele ser más
        // barato que domicilio, y esa diferencia es justamente el incentivo del
        // retiro. Ponerlo en $0 fijo regalaría el envío incluso cuando SÍ se
        // puede cotizar.
        price_type: 'calculated',
        provider_id: CORREO_PROVIDER_ID,
        service_zone_id: zone.id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: 'Retiro en sucursal',
          description:
            'Retirá tu pedido en una sucursal de Correo Argentino cercana.',
          code: 'correo-sucursal-ar',
        },
        data: {
          id: 'correo-sucursal',
          name: 'Correo Argentino Sucursal',
          delivery_type: 'agency',
          service_type: process.env.CORREO_ARGENTINO_SERVICE_TYPE || 'CP',
        },
        rules: [
          { attribute: 'enabled_in_store', value: 'true', operator: 'eq' },
          { attribute: 'is_return', value: 'false', operator: 'eq' },
        ],
      },
    ],
  });

  logger.info('Correo Argentino branch-pickup shipping option created.');
}
