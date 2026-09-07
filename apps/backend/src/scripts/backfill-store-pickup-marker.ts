/**
 * Backfill del marker `data.pickup_kind: 'store'` en shipping options de retiro
 * en tienda propia creadas SIN él.
 *
 * ¿Por qué hace falta? El Admin de Medusa no expone el campo `data` al crear una
 * shipping option, así que toda opción de retiro dada de alta a mano (ej.
 * "Retiro en tienda") nace sin el marker. El storefront clasifica el retiro
 * EN POSITIVO (ver isStorePickupOption en
 * apps/storefront/src/modules/checkout/components/shipping/index.tsx): sin
 * `pickup_kind` y sin un carrier reconocido, la opción no es ni carrier-pickup ni
 * store-pickup, no hay lista de sucursales que mostrar y el paso de envío queda
 * trabado con el botón "Continuar" deshabilitado.
 *
 * El backend ya trata esas opciones como store_pickup por nombre (paso 3 de
 * classify() en src/workflows/create-delivery-execution.ts, vía
 * hasStorePickupHint), así que escribir el marker ALINEA las dos capas en vez de
 * cambiar el comportamiento del fulfillment.
 *
 * Candidatas: opciones de retiro (fulfillment_set.type 'pickup' o nombre con
 * "retiro") que NO son CDE, NO matchean ningún carrier del CARRIER_REGISTRY del
 * storefront y todavía no tienen `data.pickup_kind`.
 *
 * Idempotente: las que ya tienen el marker se saltean.
 *
 * DRY-RUN POR DEFECTO. Lista lo que haría y no escribe nada. Para aplicar:
 *
 *   dotenv -e .env -- medusa exec ./src/scripts/backfill-store-pickup-marker.ts apply
 *
 * OJO con la forma del argumento: `medusa exec` parsea con yargs y rechaza
 * cualquier flag que no conozca ("Unknown argument: apply"), así que el modo se
 * pasa POSICIONAL (`apply`), no como `--apply`. Igual se acepta `--apply` por si
 * alguien lo escribe por costumbre y el CLI llegara a dejarlo pasar.
 *
 * NOTE: requiere DB alcanzable (igual que las migraciones / otros backfills).
 */
import type {
  ExecArgs,
  IFulfillmentModuleService,
} from '@medusajs/framework/types';
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
} from '@medusajs/framework/utils';

const PICKUP_KIND_STORE = 'store';

// Espejo de CARRIER_REGISTRY[*].matcher en
// apps/storefront/src/lib/constants.tsx. Si se registra un carrier nuevo allá,
// sumarlo acá: de lo contrario este backfill le escribiría `pickup_kind: store`
// a una opción de retiro EN SUCURSAL DE CARRIER y el storefront le mostraría al
// usuario la lista de sucursales propias en vez de las del carrier.
//
// El `\bcorreo\b` con límite de palabra (y no un includes plano) es deliberado,
// por la misma razón que en el storefront: "correo" es palabra corriente en
// castellano y un match laxo sobre `name` clasificaría mal cualquier opción que
// la mencione al pasar. Sobre `provider_id` sí alcanza el includes, porque es un
// identificador de sistema (`correo_argentino_correo_argentino`) donde el `_` no
// deja boundary de palabra.
const matchesKnownCarrier = (
  name?: string | null,
  providerId?: string | null,
): boolean => {
  const n = name ?? '';
  const p = (providerId ?? '').toLowerCase();
  return (
    n.toLowerCase().includes('andreani') ||
    p.includes('andreani') ||
    /\bcorreo\b/i.test(n) ||
    p.includes('correo')
  );
};

// Espejo de isCdeShippingOption (storefront). El id es un valor literal de DB,
// no algo derivable del nombre, así que se acepta por env igual que allá.
const CDE_SHIPPING_OPTION_ID =
  process.env.NEXT_PUBLIC_CDE_SHIPPING_OPTION_ID ||
  'so_01KN5516WTYBPEVNQQDEZ3T9S6';

const isCde = (id: string, name?: string | null): boolean => {
  const n = (name ?? '').toLowerCase();
  return (
    id === CDE_SHIPPING_OPTION_ID ||
    n.includes('centro de distribución') ||
    n.includes('centro de distribucion')
  );
};

type ShippingOptionRow = {
  id: string;
  name?: string | null;
  provider_id?: string | null;
  data?: Record<string, unknown> | null;
  service_zone?: { fulfillment_set?: { type?: string | null } | null } | null;
};

export default async function backfillStorePickupMarker({
  container,
  args,
}: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const fulfillmentService: IFulfillmentModuleService = container.resolve(
    ModuleRegistrationName.FULFILLMENT,
  );

  const apply = args.some((a) => a === 'apply' || a === '--apply');

  logger.info('================================================');
  logger.info(
    `Backfill data.pickup_kind='store' en shipping options de retiro ${apply ? '(APPLY)' : '(DRY-RUN)'}...`,
  );
  logger.info('================================================');

  const options = (await fulfillmentService.listShippingOptions(
    {},
    { relations: ['service_zone.fulfillment_set'] },
  )) as unknown as ShippingOptionRow[];

  const candidates = options.filter((o) => {
    const isPickup =
      o.service_zone?.fulfillment_set?.type === 'pickup' ||
      !!o.name?.toLowerCase().includes('retiro');
    if (!isPickup) return false;
    if (isCde(o.id, o.name)) return false;
    if (matchesKnownCarrier(o.name, o.provider_id)) return false;
    // Idempotencia: respetamos cualquier pickup_kind ya seteado, incluso uno
    // distinto de 'store' — pisarlo sería cambiar una decisión explícita.
    return o.data?.pickup_kind == null;
  });

  const alreadyMarked = options.filter(
    (o) => o.data?.pickup_kind === PICKUP_KIND_STORE,
  ).length;

  logger.info(
    `Shipping options totales: ${options.length} | ya marcadas como store: ${alreadyMarked} | a corregir: ${candidates.length}`,
  );

  if (candidates.length === 0) {
    logger.info('Nada que hacer. Done.');
    return;
  }

  for (const o of candidates) {
    logger.info(`  - ${o.id}  "${o.name}"  (provider: ${o.provider_id})`);
  }

  if (!apply) {
    logger.info('');
    logger.info(
      'DRY-RUN: no se escribió nada. Volvé a correrlo agregando `apply` al final para aplicar.',
    );
    return;
  }

  for (const o of candidates) {
    // Merge, no reemplazo: `data` puede traer claves del provider de
    // fulfillment que no tenemos por qué conocer ni pisar.
    await fulfillmentService.updateShippingOptions(o.id, {
      data: { ...(o.data ?? {}), pickup_kind: PICKUP_KIND_STORE },
    });
    logger.info(`  ✔ ${o.id} "${o.name}" → data.pickup_kind='store'`);
  }

  logger.info('');
  logger.info(`Listo: ${candidates.length} shipping option(s) corregida(s).`);
}
