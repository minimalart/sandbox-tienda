/**
 * Seed idempotente de la opción de envío a domicilio de Correo Argentino.
 *
 * ⚠️ **DOBLE GATE, y el segundo es a propósito.**
 *
 * Además de `CORREO_ARGENTINO_API_KEY` (que es lo que registra el provider),
 * este seed exige `CORREO_ARGENTINO_SEED_SHIPPING_OPTIONS=true`. Razón: sin
 * credenciales de MiCorreo no hay cotización, y con la decisión D4 vigente
 * (una cotización fallida degrada a $0) sembrar esta opción hoy pondría en el
 * checkout un envío de Correo que dice **"Gratuito"** en el 100% de los casos.
 *
 * Prendé el flag cuando `CORREO_ARGENTINO_MICORREO_USER` / `_PASS` /
 * `_CUSTOMER_ID` estén cargadas Y Correo haya confirmado que la cuenta está
 * activada comercialmente. Verificalo antes con:
 *   `POST /store/correo-argentino/rates`
 *
 * Correr con:
 *   pnpm exec medusa exec ./src/scripts/seed-correo-domicilio.ts
 *   o: dotenv -e .env -- medusa exec ./src/scripts/seed-correo-domicilio.ts
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

/** `fp_{identifier}_{id}` sin el prefijo: los dos son `correo_argentino`. */
const CORREO_PROVIDER_ID = 'correo_argentino_correo_argentino';
const DOMICILIO_OPTION_NAME = 'Envío por Correo Argentino';
/** Zona del *shipping set* principal, la que el main seed ya creó. */
const ARGENTINA_ZONE_NAME = 'Argentina';

export default async function seedCorreoDomicilio({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const link = container.resolve(ContainerRegistrationKeys.LINK);

  const fulfillmentService: IFulfillmentModuleService = container.resolve(
    ModuleRegistrationName.FULFILLMENT
  );
  const stockLocationService: IStockLocationService = container.resolve(
    ModuleRegistrationName.STOCK_LOCATION
  );

  logger.info('Seeding Correo Argentino home-delivery shipping option...');

  if (!process.env.CORREO_ARGENTINO_API_KEY) {
    logger.warn(
      'CORREO_ARGENTINO_API_KEY is not set — the correo_argentino provider is not registered. Aborting.'
    );
    return;
  }

  if (process.env.CORREO_ARGENTINO_SEED_SHIPPING_OPTIONS !== 'true') {
    logger.warn(
      'CORREO_ARGENTINO_SEED_SHIPPING_OPTIONS is not "true" — skipping. ' +
        'Sin credenciales de MiCorreo la opción cotizaría $0 ("Gratuito") en todos los envíos. ' +
        'Prendé el flag cuando la cotización esté verificada.'
    );
    return;
  }

  if (
    !process.env.CORREO_ARGENTINO_MICORREO_USER ||
    !process.env.CORREO_ARGENTINO_CUSTOMER_ID
  ) {
    // Warning, no abort: el flag explícito manda. Pero que quede en el log
    // quién lo prendió sin la mitad de las credenciales.
    logger.warn(
      'SEED_SHIPPING_OPTIONS está prendido pero faltan credenciales de MiCorreo: la opción va a cotizar $0.'
    );
  }

  // Idempotente: si ya existe, no se toca.
  const [existing] = await fulfillmentService.listShippingOptions({
    name: DOMICILIO_OPTION_NAME,
  });
  if (existing) {
    logger.info('Correo domicilio shipping option already exists. Done.');
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

  // ⚠️ El provider tiene que estar linkeado al stock location ANTES de
  // createShippingOptionsWorkflow, o falla con "not enabled for the service
  // location". Idempotente: si el link ya existe, se ignora el error.
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

  // Domicilio vive en la zona del *shipping* set principal (NO en un pickup
  // set), que es lo que hace que el storefront lo clasifique como envío a
  // domicilio.
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
        name: DOMICILIO_OPTION_NAME,
        // Calculated: el precio sale de MiCorreo `POST /rates` vía
        // `calculatePrice()`. Sin array de `prices` a propósito.
        price_type: 'calculated',
        provider_id: CORREO_PROVIDER_ID,
        service_zone_id: argentinaZone.id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: 'Envío a domicilio',
          description: 'Correo Argentino te lo lleva a tu domicilio.',
          code: 'correo-domicilio-ar',
        },
        // `resolveDeliveryType()` y `resolveServiceType()` leen de acá. `id`
        // tiene que coincidir con OPTION_DEFINITIONS del provider.
        data: {
          id: 'correo-domicilio',
          name: 'Correo Argentino Domicilio',
          delivery_type: 'homeDelivery',
          service_type: process.env.CORREO_ARGENTINO_SERVICE_TYPE || 'CP',
        },
        rules: [
          { attribute: 'enabled_in_store', value: 'true', operator: 'eq' },
          { attribute: 'is_return', value: 'false', operator: 'eq' },
        ],
      },
    ],
  });

  logger.info('Correo Argentino domicilio shipping option created.');
}
