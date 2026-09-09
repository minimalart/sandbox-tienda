import type { Link } from '@medusajs/framework/modules-sdk';
import type { Logger, RemoteQueryFunction } from '@medusajs/framework/types';
/**
 * create-delivery-execution — crea el sidecar operativo de un Fulfillment.
 *
 * Dado un fulfillment_id: lee el fulfillment + su order + shipping method vía
 * query.graph, clasifica provider_type / service_mode (reutilizando la lógica de
 * detección de Andreani de los subscribers/workflows existentes), crea la
 * DeliveryExecution en estado 'pending' y la linkea al fulfillment, a la order y
 * a la shipping option.
 *
 * Idempotente: si el fulfillment ya tiene una DeliveryExecution linkeada, la
 * devuelve sin crear otra.
 *
 * NO copia items, direcciones ni montos: todo eso se lee en vivo de la order a
 * través del link cuando se necesita.
 */

import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import { DELIVERY_MODULE } from '../modules/delivery';
import type DeliveryModuleService from '../modules/delivery/service';
import { STORE_LOCATION_MODULE } from '../modules/store-location';
import type StoreLocationModuleService from '../modules/store-location/service';
import type {
  DeliveryProviderType,
  DeliveryServiceMode,
  RuleEvaluationContext,
} from '../modules/delivery/types';
import { buildOrderItemsAggregate } from '../modules/delivery/order-context';
import { extractLatLng } from '../modules/delivery/geo';
import { geocodeAddress } from '../modules/delivery/geocoding';
import { hasCorreoCarrierToken } from '../modules/delivery/normalizers/correo-argentino';
// Fuente de verdad de "¿este método es de Correo?" y del `deliveryType` del
// envío: vive en el workflow que da de alta el envío en Correo y se REUSA acá.
// Duplicar la detección garantizaría que las dos capas se desincronicen, y el
// síntoma sería un envío creado en Correo con una DeliveryExecution que dice
// otra cosa.
import {
  isCorreoShippingMethod,
  resolveCorreoDeliveryType,
} from './correo-generate-tickets';

export interface CreateDeliveryExecutionInput {
  fulfillment_id: string;
}

interface Classification {
  provider_type: DeliveryProviderType;
  service_mode: DeliveryServiceMode;
}

interface ResolvedContext extends Classification {
  fulfillment_id: string;
  order_id: string | null;
  shipping_option_id: string | null;
  /**
   * store_location resuelto por precedencia:
   *  - nivel 0: la sucursal que ELIGIÓ el comprador (sólo retiro en tienda) —
   *    ver resolveChosenStoreLocationId. Es un dato explícito y gana sobre todo.
   *  - nivel 2: FALLBACK desde fulfillment.location_id (stock location de Medusa
   *    → store_location.stock_location_id).
   * La zona (nivel 1) puede sobreescribir el nivel 2 más tarde en el refine, que
   * sólo corre para own_fleet — así que nunca pisa la elección del comprador.
   */
  store_location_id: string | null;
  /** Id de la ejecución ya existente (idempotencia), si la hay. */
  existing_execution_id: string | null;
}

type UnknownRecord = Record<string, unknown>;

const isRecord = (v: unknown): v is UnknownRecord =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const getString = (source: unknown, key: string): string | undefined => {
  if (!isRecord(source)) return undefined;
  const value = source[key];
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
};

const hasAndreaniHint = (value: string | undefined): boolean => {
  if (!value) return false;
  const n = value.trim().toLowerCase();
  return (
    n.includes('andreani') ||
    n.includes('domicilio') ||
    n.includes('sucursal') ||
    n.includes('punto') ||
    n.includes('hop')
  );
};

/**
 * `data.service_type` de ANDREANI. Enumeración cerrada, y ese es justamente el
 * valor de la señal: Correo también escribe `data.service_type`, pero con `CP` /
 * `EP` (Clásico / Expreso), así que los dos vocabularios no se pisan y este set
 * sirve para descartar Andreani sin ambigüedad.
 */
const ANDREANI_SERVICE_TYPES = new Set(['Domicilio', 'Sucursal', 'PuntoDeTercero']);

/**
 * ¿El método trae una señal EXPLÍCITA de Andreani?
 *
 * Solo se usa para vetar el match de Correo POR NOMBRE, que es la señal más
 * débil de todas. Un método no puede pertenecer a dos carriers, así que en la
 * práctica esto nunca se activa sobre un envío real de Correo — es un cinturón
 * para que el token `\bcorreo\b` no pueda robarse una opción de Andreani que
 * mencione la palabra al pasar (el bug de §4.1 del PRD, en espejo).
 */
const hasExplicitAndreaniSignal = (
  data: unknown,
  name: string | undefined,
): boolean => {
  const carrier = getString(data, 'carrier');
  if (carrier?.toLowerCase().includes('andreani')) return true;
  const serviceType = getString(data, 'service_type');
  if (serviceType && ANDREANI_SERVICE_TYPES.has(serviceType)) return true;
  const provider = getString(data, 'provider');
  if (provider?.toLowerCase().includes('andreani')) return true;
  return Boolean(name && name.toLowerCase().includes('andreani'));
};

/**
 * ¿Este shipping method lo ejecuta Correo Argentino?
 *
 * PRECEDENCIA (la misma de `isCorreoShippingMethod()` en el workflow de tickets,
 * que es la fuente de verdad y se REUSA en lugar de duplicarse):
 *
 *   1. `provider_id` del FULFILLMENT (dato que el método no lleva en esta query).
 *   2. `data.carrier` / `data.provider` explícitos — la señal que estampa
 *      `validateFulfillmentData()` y que manda el storefront desde la Fase 0.
 *      Se compara con `hasCorreoCarrierToken()` para tolerar `correo-argentino`
 *      (id del CARRIER_REGISTRY del storefront), `correo_argentino` y `correo`.
 *   3. `data.id` de la fulfillment option (`correo-domicilio` / `correo-sucursal`).
 *   4. El NOMBRE, exigiendo el token `\bcorreo\b` con límite de palabra, y solo
 *      si el método no tiene una señal explícita de Andreani.
 *
 * Los pasos 3 y 4 los aporta `isCorreoShippingMethod()`. Lo único que se agrega
 * acá es el `provider_id` del fulfillment (que ese predicado no puede ver) y el
 * veto por señal ajena, que solo aplica al match por nombre.
 */
export const isCorreoMethod = (
  method: UnknownRecord,
  providerIsCorreo: boolean,
): boolean => {
  if (providerIsCorreo) return true;

  const data = method?.data;
  if (
    hasCorreoCarrierToken(getString(data, 'carrier')) ||
    hasCorreoCarrierToken(getString(data, 'provider'))
  ) {
    return true;
  }

  const name = typeof method?.name === 'string' ? method.name : undefined;
  if (hasExplicitAndreaniSignal(data, name)) return false;

  return isCorreoShippingMethod(method);
};

const hasStorePickupHint = (value: string | undefined): boolean => {
  if (!value) return false;
  const n = value.trim().toLowerCase();
  return (
    n.includes('pickup') ||
    n.includes('retiro') ||
    n.includes('tienda') ||
    n.includes('store') ||
    n.includes('sucursal propia')
  );
};

/**
 * Reconoce el envío por FLOTA PROPIA explícito (shipping option dedicada).
 * Matchea 'flota', 'own_fleet' u 'own-fleet' (case-insensitive). Se evalúa
 * DESPUÉS de Andreani/store_pickup y ANTES del fallback por descarte, para que
 * un método de flota propia quede etiquetado explícitamente (y no por defecto),
 * sin pisar la detección de Andreani/HOP/Sucursal/store_pickup existente.
 */
export const hasOwnFleetHint = (
  name: string | undefined,
  code: string | undefined,
): boolean => {
  for (const value of [name, code]) {
    if (!value) continue;
    const n = value.trim().toLowerCase();
    if (
      n.includes('flota') ||
      n.includes('own_fleet') ||
      n.includes('own-fleet')
    ) {
      return true;
    }
  }
  return false;
};

/**
 * Clasifica provider_type / service_mode a partir del/los shipping method(s) y
 * provider del fulfillment. Reusa los hints de Andreani y el service_type
 * (Domicilio→home_delivery, Sucursal→branch_pickup, PuntoDeTercero→hop) tal
 * como los detectan src/subscribers/andreani-order.ts y
 * src/workflows/andreani-generate-tickets.ts.
 */
export const classify = (
  shippingMethods: UnknownRecord[],
  providerId: string | undefined,
): Classification => {
  const providerIsAndreani = Boolean(
    providerId && providerId.toLowerCase().includes('andreani'),
  );
  const providerIsCorreo = Boolean(
    providerId && providerId.toLowerCase().includes('correo'),
  );

  for (const method of shippingMethods) {
    const data = method?.data;
    const name = typeof method?.name === 'string' ? method.name : undefined;

    // 0) CORREO ARGENTINO. Va PRIMERO, y el orden no es estético:
    //
    //    `hasAndreaniHint()` (paso 2) matchea "sucursal" y "domicilio", así que
    //    "Retiro en sucursal de Correo Argentino" caería en la rama de Andreani
    //    y la DeliveryExecution quedaría con provider_type 'andreani'. El
    //    poller consultaría la API equivocada, el step que linkea el ticket no
    //    encontraría la ejecución y el estado nunca avanzaría — todo sin un solo
    //    error que apunte a la causa. El fallback del final (`own_fleet`) es la
    //    otra mitad de la misma trampa: sin esta rama, un envío de Correo se
    //    convierte EN SILENCIO en flota propia.
    //
    //    La detección prefiere la señal ESTRUCTURADA (`provider_id`,
    //    `data.carrier`/`data.provider`, `data.id`) sobre el nombre, y reusa el
    //    predicado del workflow de tickets para que las dos capas no puedan
    //    divergir. Ver `isCorreoMethod`.
    if (isCorreoMethod(method, providerIsCorreo)) {
      return {
        provider_type: 'correo_argentino',
        // `resolveCorreoDeliveryType()` es la MISMA función que decide el
        // `deliveryType` del payload que se le manda a Correo: si el envío se dio
        // de alta como `agency`, el service_mode del sidecar dice `branch_pickup`
        // sí o sí. Derivarlo por separado abriría la puerta a que la ejecución
        // diga "domicilio" sobre un envío que Correo tiene como retiro en
        // sucursal.
        service_mode:
          resolveCorreoDeliveryType(method) === 'agency'
            ? 'branch_pickup'
            : 'home_delivery',
      };
    }

    // 1) service_type explícito de Andreani (la señal más fuerte).
    const serviceType = getString(data, 'service_type');
    if (serviceType === 'Sucursal') {
      return { provider_type: 'andreani', service_mode: 'branch_pickup' };
    }
    if (serviceType === 'PuntoDeTercero') {
      return { provider_type: 'andreani', service_mode: 'hop' };
    }
    if (serviceType === 'Domicilio') {
      return { provider_type: 'andreani', service_mode: 'home_delivery' };
    }

    // 1b) Retiro en sucursal PROPIA explícito vía data.pickup_kind === 'store'.
    //     Va ANTES de los hints de Andreani por nombre porque la palabra
    //     "sucursal" dispara hasAndreaniHint(); este marker dedicado permite un
    //     método "Retiro en sucursal" propio sin que lo capture Andreani.
    if (getString(data, 'pickup_kind') === 'store') {
      return { provider_type: 'store_pickup', service_mode: 'store_pickup' };
    }

    // 2) Hints de Andreani por nombre / provider del método.
    if (
      providerIsAndreani ||
      hasAndreaniHint(name) ||
      hasAndreaniHint(getString(data, 'provider'))
    ) {
      const n = (name || '').toLowerCase();
      if (n.includes('sucursal')) {
        return { provider_type: 'andreani', service_mode: 'branch_pickup' };
      }
      if (n.includes('punto') || n.includes('hop')) {
        return { provider_type: 'andreani', service_mode: 'hop' };
      }
      return { provider_type: 'andreani', service_mode: 'home_delivery' };
    }

    // 3) Retiro en tienda propia.
    if (hasStorePickupHint(name) || hasStorePickupHint(getString(data, 'provider'))) {
      return { provider_type: 'store_pickup', service_mode: 'store_pickup' };
    }

    // 4) Flota propia EXPLÍCITA (shipping option dedicada). Va después de
    //    Andreani/store_pickup y antes del fallback por descarte.
    if (
      hasOwnFleetHint(name, getString(data, 'code')) ||
      hasOwnFleetHint(getString(data, 'provider'), undefined)
    ) {
      return { provider_type: 'own_fleet', service_mode: 'home_delivery' };
    }
  }

  // 5) Default: flota propia a domicilio.
  return { provider_type: 'own_fleet', service_mode: 'home_delivery' };
};

/**
 * La sucursal que el comprador ELIGIÓ en el checkout de retiro en tienda.
 *
 * Sale de `metadata.store_id` de la orden: lo escribe `handleSelectStore`
 * (apps/storefront/src/modules/checkout/components/shipping/index.tsx) en la
 * metadata del CARRITO, y `completeCartWorkflow` la copia tal cual a la orden.
 *
 * Existe porque resolver la sucursal desde el stock location NO alcanza: varias
 * sucursales pueden compartir un mismo `stock_location_id` —depósito común, o un
 * mapeo mal cargado en el Admin— y ahí `listStoreLocations({ stock_location_id })`
 * devuelve una CUALQUIERA. El retiro en tienda es el único modo donde el
 * comprador elige la sucursal de forma explícita, así que su elección manda sobre
 * cualquier inferencia.
 *
 * Segundo lugar donde busca: el `data` del shipping method. Hoy el storefront no
 * estampa `store_id` ahí (sólo `pickup_kind`), pero es el mismo orden de
 * precedencia que ya usa `andreani-generate-tickets` para `pickup_branch_id`, y
 * cubre un `setShippingMethod` futuro que sí lo mande.
 *
 * `getString()` descarta el string vacío, y acá eso no es un detalle: al cambiar
 * de modo de entrega el storefront LIMPIA el campo escribiendo `store_id: ''` en
 * vez de borrarlo, así que un `''` tiene que leerse como "no eligió", no como id.
 */
export const resolveChosenStoreLocationId = (
  orderMetadata: unknown,
  shippingMethods: UnknownRecord[],
): string | null =>
  getString(orderMetadata, 'store_id') ??
  shippingMethods
    .map((m) => getString(m?.data, 'store_id'))
    .find((v): v is string => Boolean(v)) ??
  null;

/**
 * Lee el fulfillment + order + shipping method vía query.graph, detecta si ya
 * existe una ejecución linkeada (idempotencia) y clasifica el servicio.
 */
const resolveFulfillmentContextStep = createStep(
  'resolve-fulfillment-context',
  async (input: CreateDeliveryExecutionInput, { container }) => {
    const query = container.resolve<Omit<RemoteQueryFunction, symbol>>(ContainerRegistrationKeys.QUERY);

    const { data: fulfillments } = await query.graph({
      entity: 'fulfillment',
      fields: [
        'id',
        'provider_id',
        'shipping_option_id',
        // location_id = stock location de Medusa desde donde sale el envío.
        // Lo mapeamos a la store_location dueña vía stock_location_id (M10).
        'location_id',
        'delivery_execution.id',
        'order.id',
        // `metadata.store_id` = la sucursal que eligió el comprador en el
        // retiro en tienda. Ver resolveChosenStoreLocationId.
        'order.metadata',
        'order.shipping_methods.name',
        'order.shipping_methods.shipping_option_id',
        'order.shipping_methods.data',
      ],
      filters: { id: input.fulfillment_id },
    });

    const fulfillment = fulfillments?.[0] as UnknownRecord | undefined;
    if (!fulfillment) {
      throw new Error(`FULFILLMENT_NOT_FOUND: ${input.fulfillment_id}`);
    }

    const existingExecution = isRecord(fulfillment.delivery_execution)
      ? fulfillment.delivery_execution
      : undefined;
    const existingExecutionId = getString(existingExecution, 'id') ?? null;

    const order = isRecord(fulfillment.order) ? fulfillment.order : undefined;
    const orderId = getString(order, 'id') ?? null;
    const shippingMethods = Array.isArray(order?.shipping_methods)
      ? (order!.shipping_methods as UnknownRecord[])
      : [];

    const classification = classify(
      shippingMethods,
      getString(fulfillment, 'provider_id'),
    );

    // shipping_option_id: del fulfillment, o del método que matchee si no.
    const shippingOptionId =
      getString(fulfillment, 'shipping_option_id') ??
      shippingMethods
        .map((m) => getString(m, 'shipping_option_id'))
        .find((v): v is string => Boolean(v)) ??
      null;

    // ── store_location: precedencia ────────────────────────────────────────
    const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
    const storeLocationService = () =>
      container.resolve<StoreLocationModuleService>(STORE_LOCATION_MODULE);

    let storeLocationId: string | null = null;

    // NIVEL 0 — la sucursal que ELIGIÓ el comprador. Sólo se lee en el retiro en
    // tienda, el único modo donde esa elección existe; en los demás el
    // `store_id` de la metadata es residuo de un paso anterior del checkout.
    if (classification.provider_type === 'store_pickup') {
      const chosenId = resolveChosenStoreLocationId(
        order?.metadata,
        shippingMethods,
      );
      if (chosenId) {
        try {
          // Se valida contra el módulo A PROPÓSITO: `store_id` viaja por la
          // metadata del carrito, que la escribe el cliente, así que un id viejo
          // o inventado no puede terminar guardado en la ejecución.
          const branches = (await storeLocationService().listStoreLocations(
            { id: chosenId },
            { take: 1 },
          )) as UnknownRecord[];
          storeLocationId = getString(branches?.[0], 'id') ?? null;
          if (!storeLocationId) {
            logger.warn(
              `[delivery-execution] La orden ${orderId ?? '(sin orden)'} eligió la sucursal ${chosenId}, que no existe en store_location. Se cae al mapeo por stock location.`,
            );
          }
        } catch (err) {
          logger.warn(
            `[delivery-execution] No se pudo validar la sucursal elegida ${chosenId}: ${
              err instanceof Error ? err.message : String(err)
            }. Se cae al mapeo por stock location.`,
          );
        }
      }
    }

    // NIVEL 2 (fallback): mapeamos el fulfillment.location_id (stock location de
    // Medusa) a la store_location cuyo stock_location_id coincide. Best-effort:
    // si no hay location_id, o no hay sucursal con ese stock_location, queda null
    // y la zona (nivel 1) podrá fijarlo después en el refine.
    const stockLocationId = getString(fulfillment, 'location_id');
    if (!storeLocationId && stockLocationId) {
      try {
        // `take: 2` y no 1: con dos sucursales apuntando al mismo stock location
        // el resultado es ARBITRARIO — exactamente el agujero que el nivel 0
        // tapa para el retiro en tienda. Para los otros modos no hay nada mejor
        // que elegir, pero al menos la ambigüedad deja de ser invisible.
        const branches = (await storeLocationService().listStoreLocations(
          { stock_location_id: stockLocationId },
          { take: 2 },
        )) as UnknownRecord[];
        storeLocationId = getString(branches?.[0], 'id') ?? null;
        if ((branches?.length ?? 0) > 1) {
          logger.warn(
            `[delivery-execution] El stock location ${stockLocationId} está mapeado a más de una sucursal; se tomó ${storeLocationId}. Revisá stock_location_id en la extensión Sucursales.`,
          );
        }
      } catch {
        // Sin sucursal mapeada al stock location: queda null (Andreani nacional).
      }
    }

    const resolved: ResolvedContext = {
      fulfillment_id: input.fulfillment_id,
      order_id: orderId,
      shipping_option_id: shippingOptionId,
      store_location_id: storeLocationId,
      existing_execution_id: existingExecutionId,
      ...classification,
    };

    return new StepResponse(resolved);
  },
);

/**
 * Crea la DeliveryExecution en 'pending'. No-op idempotente si ya existía una
 * ligada al fulfillment. Rollback: borra la que haya creado.
 */
const createExecutionRecordStep = createStep(
  'create-delivery-execution-record',
  async (input: ResolvedContext, { container }) => {
    if (input.existing_execution_id) {
      // Ya existe — devolvemos su id y NO marcamos compensación (no la creamos).
      return new StepResponse(
        { execution_id: input.existing_execution_id, created: false },
        null,
      );
    }

    const service = container.resolve<DeliveryModuleService>(DELIVERY_MODULE);
    const created = await service.createDeliveryExecutions({
      provider_type: input.provider_type,
      service_mode: input.service_mode,
      status: 'pending',
      // Nivel 0 (elección del comprador) o fallback nivel 2 (stock location).
      // La zona sólo puede sobreescribir el segundo, en el refine.
      store_location_id: input.store_location_id,
    });
    const record = Array.isArray(created) ? created[0] : created;
    if (!record) throw new Error('No se pudo crear la DeliveryExecution.');

    return new StepResponse(
      { execution_id: record.id, created: true },
      record.id,
    );
  },
  async (executionId: string | null | undefined, { container }) => {
    if (!executionId) return;
    const service = container.resolve<DeliveryModuleService>(DELIVERY_MODULE);
    await service.deleteDeliveryExecutions([executionId]);
  },
);

interface LinkStepInput {
  execution_id: string;
  created: boolean;
  fulfillment_id: string;
  order_id: string | null;
  shipping_option_id: string | null;
}

type ExecutionFulfillmentLink = {
  [DELIVERY_MODULE]: { delivery_execution_id: string };
  [Modules.FULFILLMENT]: { fulfillment_id: string };
};
type ExecutionOrderLink = {
  [DELIVERY_MODULE]: { delivery_execution_id: string };
  [Modules.ORDER]: { order_id: string };
};
type ExecutionShippingOptionLink = {
  [DELIVERY_MODULE]: { delivery_execution_id: string };
  [Modules.FULFILLMENT]: { shipping_option_id: string };
};
type CreatedLink =
  | ExecutionFulfillmentLink
  | ExecutionOrderLink
  | ExecutionShippingOptionLink;

/**
 * Appendea el hito de sistema 'created' al timeline, SOLO cuando la ejecución es
 * nueva (idempotencia: nunca se re-crea sobre una existente). Sin external_code,
 * así que la idempotencia la garantiza este gate `created`, no el dedupe del
 * service. No tiene compensación: si el create de la ejecución rollbackea, el
 * evento huérfano queda inocuo (FK lógica) y igualmente la ejecución se borra.
 */
const appendCreatedEventStep = createStep(
  'append-created-tracking-event',
  async (
    input: { execution_id: string; created: boolean },
    { container },
  ) => {
    if (!input.created) {
      return new StepResponse({ appended: false });
    }
    const service = container.resolve<DeliveryModuleService>(DELIVERY_MODULE);
    await service.appendTrackingEvent({
      delivery_execution_id: input.execution_id,
      source: 'system',
      code: 'created',
      description: 'DeliveryExecution creada',
    });
    return new StepResponse({ appended: true });
  },
);

/**
 * Crea los links execution↔fulfillment (1:1), execution↔order y
 * execution↔shipping_option. Solo cuando la ejecución es nueva (idempotencia).
 * Rollback: dismiss de los links creados.
 */
const linkExecutionStep = createStep(
  'link-delivery-execution',
  async (input: LinkStepInput, { container }) => {
    if (!input.created) {
      return new StepResponse({ links: [] as CreatedLink[] }, [] as CreatedLink[]);
    }

    const link = container.resolve<Link>(ContainerRegistrationKeys.LINK);
    const links: CreatedLink[] = [];

    links.push({
      [DELIVERY_MODULE]: { delivery_execution_id: input.execution_id },
      [Modules.FULFILLMENT]: { fulfillment_id: input.fulfillment_id },
    });

    if (input.order_id) {
      links.push({
        [DELIVERY_MODULE]: { delivery_execution_id: input.execution_id },
        [Modules.ORDER]: { order_id: input.order_id },
      });
    }

    if (input.shipping_option_id) {
      links.push({
        [DELIVERY_MODULE]: { delivery_execution_id: input.execution_id },
        [Modules.FULFILLMENT]: { shipping_option_id: input.shipping_option_id },
      });
    }

    await link.create(links);

    return new StepResponse({ links }, links);
  },
  async (links: CreatedLink[] | undefined, { container }) => {
    if (!links?.length) return;
    const link = container.resolve<Link>(ContainerRegistrationKeys.LINK);
    await link.dismiss(links);
  },
);

interface RefineRulesInput {
  execution_id: string;
  created: boolean;
  order_id: string | null;
  provider_type: DeliveryProviderType;
  service_mode: DeliveryServiceMode;
}

/**
 * Refina la clasificación con el MOTOR DE REGLAS (M6).
 *
 * PRECEDENCIA shipping-method vs reglas:
 * --------------------------------------------------------------------------
 * El shipping method MANDA. Si la clasificación por shipping method ya resolvió
 * un carrier concreto (provider_type 'andreani' o 'store_pickup'), las reglas NO
 * lo tocan — el cliente eligió ese servicio en el checkout y eso es vinculante.
 * Esto preserva intacta la clasificación Andreani/HOP/Sucursal existente.
 *
 * Las reglas SOLO actúan cuando hay AMBIGÜEDAD: la clasificación cayó en el
 * default de flota propia ('own_fleet'), que es justamente el caso donde el
 * shipping method no determinó un carrier externo. Ahí las reglas refinan
 * provider_type / service_mode (ej. derivar a Andreani por peso, o forzar ruta
 * manual por SKU) y, en todo caso, fijan la `delivery_zone_id`.
 *
 * La zona se resuelve REUSANDO store-location.resolveByPoint (PolygonEngine);
 * este step no reimplementa point-in-polygon. Best-effort: si algo falla
 * (geocoding ausente, sin zona, sin reglas), deja la clasificación tal cual.
 */
interface RefineRulesResult {
  refined: boolean;
  provider_type: DeliveryProviderType;
  service_mode: DeliveryServiceMode;
  zone_id: string | null;
}

const refineWithRulesStep = createStep(
  'refine-delivery-with-rules',
  async (input: RefineRulesInput, { container }) => {
    const unchanged: RefineRulesResult = {
      refined: false,
      provider_type: input.provider_type,
      service_mode: input.service_mode,
      zone_id: null,
    };

    // Solo refinamos ejecuciones recién creadas y SOLO cuando la clasificación
    // por shipping method fue ambigua (cayó en flota propia). Andreani /
    // store_pickup ya están determinados por el método y MANDAN.
    if (!input.created || input.provider_type !== 'own_fleet') {
      return new StepResponse(unchanged);
    }
    if (!input.order_id) {
      return new StepResponse(unchanged);
    }

    const query = container.resolve<Omit<RemoteQueryFunction, symbol>>(ContainerRegistrationKeys.QUERY);
    const delivery = container.resolve<DeliveryModuleService>(DELIVERY_MODULE);

    // Contexto de evaluación derivado de la orden (peso, total, items, skus,
    // postal_code + coords para resolver la zona).
    const { data: orders } = await query.graph({
      entity: 'order',
      fields: [
        'id',
        'total',
        'shipping_address.postal_code',
        'shipping_address.metadata',
        // Campos para el geocoding de respaldo (cuando el metadata no trae coords).
        'shipping_address.address_1',
        'shipping_address.city',
        'shipping_address.province',
        'shipping_address.country_code',
        'items.quantity',
        'items.variant_sku',
        'items.variant.sku',
        'items.variant.weight',
        'items.product.weight',
        // Temperatura: se LEE del metadata NATIVO del producto/variante (nunca
        // un atributo custom). Lo consume buildOrderItemsAggregate.
        'items.variant.metadata',
        'items.product.metadata',
      ],
      filters: { id: input.order_id },
    });

    const order = orders?.[0] as UnknownRecord | undefined;
    if (!order) return new StepResponse(unchanged);

    const items = Array.isArray(order.items)
      ? (order.items as UnknownRecord[])
      : [];

    // Agregación reutilizable (peso, conteo, skus, temperatura). Misma fuente que
    // usará el service de elegibilidad de recursos.
    const aggregate = buildOrderItemsAggregate(items);

    const shippingAddress = isRecord(order.shipping_address)
      ? order.shipping_address
      : undefined;
    const postalCode = getString(shippingAddress, 'postal_code') ?? null;

    // Hora local 'HH:mm' para condiciones de cutoff / ventanas.
    const now = new Date();
    const timeOfDay = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes(),
    ).padStart(2, '0')}`;

    const ruleContext: RuleEvaluationContext = {
      weight_kg: aggregate.weight_kg,
      order_total: typeof order.total === 'number' ? order.total : null,
      item_count: aggregate.item_count,
      skus: aggregate.skus,
      postal_code: postalCode,
      time_of_day: timeOfDay,
      temperature: aggregate.temperature,
    };

    // Resolución geométrica punto→coverage REUSANDO store-location.
    //
    // COORDS — dos fuentes, en este orden de preferencia:
    //  1) address.metadata.{lat,lng}|{latitude,longitude} capturadas por el
    //     storefront, normalizadas con extractLatLng (acepta ambas convenciones
    //     de claves y valida rango — esto arregla el mismatch lat/lng vs
    //     latitude/longitude que dejaba store_location_id NULL).
    //  2) GEOCODING de respaldo (Google) si el storefront no las capturó.
    // Si las coords vinieron del GEOCODING, las persistimos en
    // metadata.geocoded de la EXECUTION (merge no destructivo) para no volver a
    // geocodificar y para que create-route tenga coords aunque el address no las
    // tenga.
    const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

    let coverageId: string | null = null;
    let storeLocationId: string | null = null;
    let geocodedCoords: { lat: number; lng: number } | null = null;

    let coords = extractLatLng(shippingAddress?.metadata);
    if (!coords && shippingAddress) {
      const geocoded = await geocodeAddress(
        {
          address_1: getString(shippingAddress, 'address_1') ?? null,
          city: getString(shippingAddress, 'city') ?? null,
          province: getString(shippingAddress, 'province') ?? null,
          postal_code: getString(shippingAddress, 'postal_code') ?? null,
          country_code: getString(shippingAddress, 'country_code') ?? null,
        },
        { logger },
      );
      if (geocoded) {
        coords = geocoded;
        geocodedCoords = geocoded;
      }
    }

    if (coords) {
      try {
        const storeLocation =
          container.resolve<StoreLocationModuleService>(STORE_LOCATION_MODULE);
        const match = await storeLocation.resolveByPoint({
          lat: coords.lat,
          lng: coords.lng,
        });
        if (match) {
          coverageId = match.coverage_id;
          storeLocationId = match.store_location_id;
        }
      } catch {
        // Sin geometría resuelta: la decisión cae a reglas globales por contexto.
      }
    }

    const decision = await delivery.resolveDeliveryDecision(ruleContext, {
      branch_coverage_id: coverageId,
      store_location_id: storeLocationId,
    });

    // Construimos el patch sin romper la clasificación: solo sobreescribimos
    // provider_type / service_mode si una regla los fijó explícitamente.
    const update: Record<string, unknown> = { id: input.execution_id };
    let changed = false;
    if (decision.provider_type && decision.provider_type !== input.provider_type) {
      update.provider_type = decision.provider_type;
      changed = true;
    }
    if (decision.service_mode && decision.service_mode !== input.service_mode) {
      update.service_mode = decision.service_mode;
      changed = true;
    }
    if (decision.zone_id) {
      update.delivery_zone_id = decision.zone_id;
      changed = true;
    }
    // PRECEDENCIA store_location (M10): nivel 1. Si la resolución geométrica
    // determinó la sucursal que cubre el punto, esa es la dueña de la zona y
    // MANDA sobre el fallback por stock_location seteado al crear el record.
    if (storeLocationId) {
      update.store_location_id = storeLocationId;
      changed = true;
    }
    // METADATA — merge NO destructivo. Acumulamos:
    //  - geocoded: coords resueltas por geocoding (solo si vinieron de ahí, no
    //    del metadata original) → evita re-geocodificar y le da coords a
    //    create-route aunque el address no las tenga.
    //  - delivery_decision: auditoría de la regla ganadora / recargo / estrategia.
    // Leemos el metadata ACTUAL de la execution y mergeamos por encima, sin pisar
    // otras claves que pudieran existir.
    const wantsDecisionMeta =
      decision.matched_rule_id || decision.surcharge > 0 || decision.route_strategy;
    if (geocodedCoords || wantsDecisionMeta) {
      let existingMeta: UnknownRecord = {};
      try {
        const [current] = (await delivery.listDeliveryExecutions(
          { id: input.execution_id },
          { take: 1 },
        )) as UnknownRecord[];
        if (isRecord(current?.metadata)) {
          existingMeta = current.metadata as UnknownRecord;
        }
      } catch {
        // Best-effort: si no podemos leer el metadata previo, partimos de {}.
      }

      const mergedMeta: UnknownRecord = { ...existingMeta };
      if (geocodedCoords) {
        mergedMeta.geocoded = { lat: geocodedCoords.lat, lng: geocodedCoords.lng };
      }
      if (wantsDecisionMeta) {
        mergedMeta.delivery_decision = {
          matched_rule_id: decision.matched_rule_id,
          route_strategy: decision.route_strategy,
          surcharge: decision.surcharge,
          zone_id: decision.zone_id,
        };
      }
      update.metadata = mergedMeta;
      changed = true;
    }

    // COSTO OPERATIVO INTERNO (Y4) — NO un cargo al cliente.
    // ----------------------------------------------------------------------
    // Persistimos el surcharge resuelto en estimated_cost como lo que le cuesta
    // a la EMPRESA mover este envío (costeo/analytics). DELIBERADAMENTE no se
    // toca el order ni el payment_collection: este step corre en
    // fulfillment.created, DESPUÉS del checkout, con el envío YA cobrado al
    // cliente. Mutar el monto cobrado acá modificaría una orden ya pagada
    // (incorrecto y peligroso). Para COBRARLE el recargo al cliente habría que
    // moverlo a la capa de checkout (calculatePrice del shipping option) — eso
    // queda FUERA DE ALCANCE de Y4.
    if (typeof decision.surcharge === 'number' && decision.surcharge > 0) {
      update.estimated_cost = decision.surcharge;
      changed = true;
    }

    if (!changed) {
      return new StepResponse(unchanged);
    }

    await delivery.updateDeliveryExecutions(update);
    const result: RefineRulesResult = {
      refined: true,
      provider_type: decision.provider_type ?? input.provider_type,
      service_mode: decision.service_mode ?? input.service_mode,
      zone_id: decision.zone_id,
    };
    return new StepResponse(result);
  },
);

export const createDeliveryExecutionWorkflow = createWorkflow(
  'create-delivery-execution',
  (input: CreateDeliveryExecutionInput) => {
    const context = resolveFulfillmentContextStep(input);
    const record = createExecutionRecordStep(context);

    const linkInput = transform({ context, record }, ({ context, record }) => ({
      execution_id: record.execution_id,
      created: record.created,
      fulfillment_id: context.fulfillment_id,
      order_id: context.order_id,
      shipping_option_id: context.shipping_option_id,
    }));

    linkExecutionStep(linkInput);

    // Hito 'created' en el timeline (solo si la ejecución es nueva).
    const createdEventInput = transform({ record }, ({ record }) => ({
      execution_id: record.execution_id,
      created: record.created,
    }));
    appendCreatedEventStep(createdEventInput);

    // Refinamiento por motor de reglas (M6). Solo actúa sobre flota propia
    // (clasificación ambigua); Andreani/store_pickup ya determinados MANDAN.
    const refineInput = transform({ context, record }, ({ context, record }) => ({
      execution_id: record.execution_id,
      created: record.created,
      order_id: context.order_id,
      provider_type: context.provider_type,
      service_mode: context.service_mode,
    }));
    const refinement = refineWithRulesStep(refineInput);

    return new WorkflowResponse(
      transform(
        { context, record, refinement },
        ({ context, record, refinement }) => ({
          execution_id: record.execution_id,
          created: record.created,
          fulfillment_id: context.fulfillment_id,
          order_id: context.order_id,
          provider_type: refinement.refined
            ? refinement.provider_type
            : context.provider_type,
          service_mode: refinement.refined
            ? refinement.service_mode
            : context.service_mode,
          zone_id: refinement.refined ? refinement.zone_id : null,
        }),
      ),
    );
  },
);

export default createDeliveryExecutionWorkflow;
