/**
 * Correo Argentino fulfillment provider.
 *
 * Espeja `andreani-fulfillment/service.ts` en estructura, con tres diferencias
 * de fondo:
 *
 *  1. **Dos APIs, dos clientes.** `paqar` opera (órdenes, rótulos, tracking,
 *     sucursales) y `micorreo` cotiza. Sin credenciales de MiCorreo el provider
 *     ARRANCA IGUAL y solo se degrada `calculatePrice()` — se puede vender y
 *     despachar sin cotizar, no al revés.
 *  2. **`cancelFulfillment()` cancela de verdad.** Andreani no tiene endpoint de
 *     cancelación; Correo sí (`PATCH /orders/{tn}/cancel`), pero solo antes de
 *     la imposición. El fallo se propaga a propósito.
 *  3. **`data.carrier`.** El provider estampa la identidad del carrier en
 *     `shipping_method.data`, que es lo que la Fase 0 del storefront necesita
 *     para dejar de adivinar el carrier con `name.includes()`.
 *
 * Como Andreani, `createFulfillment()` es un STUB deliberado: el envío real lo
 * crea el workflow `correo-generate-tickets`, para que haya UN solo camino de
 * alta y no se dupliquen envíos.
 */

import { AbstractFulfillmentProviderService, ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Logger } from '@medusajs/framework/types';
import type {
  CalculatedShippingOptionPrice,
  CalculateShippingOptionPriceDTO,
  CreateFulfillmentResult,
  CreateShippingOptionDTO,
  FulfillmentDTO,
  FulfillmentItemDTO,
  FulfillmentOption,
  FulfillmentOrderDTO,
  ValidateFulfillmentDataContext,
} from '@medusajs/types';

import { MiCorreoClient, selectRate } from './clients/micorreo-client';
import { PaqarClient } from './clients/paqar-client';
import {
  deliveredTypeForDeliveryType,
  normalizeCorreoOptions,
} from './env-options';
import { correoClientsFor, loadCorreoOptionsViaPg } from './get-client';
import { isUndecryptableCredentialsError } from './site-credentials';
import type { SiteResolution } from '../../lib/multistore/types';
import {
  consolidateParcel,
  type ConsolidateParcelItem,
} from './transformers/consolidate-parcel';
import { normalizePostalCode } from './transformers/province-codes';
import { extractErrorMessage } from './utils/errors';
import type {
  CorreoDeliveryType,
  CorreoProviderOptions,
  CorreoRatesOutcome,
  CorreoServiceType,
} from './types';

type InjectedDependencies = {
  logger: Logger;
  /**
   * Conexión Postgres compartida (knex). Única vía para leer las credenciales por
   * tienda: un provider de fulfillment recibe un container AISLADO y no puede
   * `resolve()` otro módulo. Mismo patrón que `andreani-fulfillment`.
   */
  [ContainerRegistrationKeys.PG_CONNECTION]?: PgLike;
};

type PgLike = { raw: (sql: string, bindings?: unknown[]) => Promise<{ rows?: any[] }> };

/**
 * El mapeo del blob plano de `site_credential` a las options anidadas vive en
 * `site-credentials.ts`, que es el ÚNICO lector de esa tabla para Correo (lo usan
 * este provider y `get-client.ts`). Se re-exporta acá porque el nombre ya estaba
 * publicado desde este archivo.
 */
export {
  applyCorreoSiteCredentials,
  type CorreoSiteCredentials,
} from './site-credentials';

type RawProviderOptions = Record<string, unknown> | undefined;
type UnknownRecord = Record<string, unknown>;

/**
 * La configuración de UNA llamada: options y los dos clientes que las usan.
 *
 * Van juntos y no sueltos porque separarlos es exactamente cómo nació el bug que
 * esta migración cierra — el cliente de cotización se resolvía por tienda y las
 * options que se estampaban en el fulfillment salían de otro lado. Con un solo
 * objeto no hay forma de mezclar la cuenta de una tienda con el acuerdo de otra.
 */
type CorreoCallContext = {
  options: CorreoProviderOptions;
  paqar: PaqarClient;
  micorreo: MiCorreoClient;
  /** `undefined` = configuración de la instancia (sin tienda resuelta). */
  resolution?: SiteResolution;
};

/** Identidad del carrier que viaja en `shipping_method.data.carrier`. */
export const CORREO_CARRIER_ID = 'correo-argentino';

interface CorreoOptionDefinition {
  id: string;
  name: string;
  delivery_type: CorreoDeliveryType;
}

/**
 * ⚠️ NO se ofrece `locker`: los SmartLockers figuran como *currently
 * unavailable* en el FAQ oficial y `GET /agencies` no tiene ningún campo que
 * permita distinguir un locker de una sucursal.
 */
const OPTION_DEFINITIONS: ReadonlyArray<CorreoOptionDefinition> = Object.freeze([
  {
    id: 'correo-domicilio',
    name: 'Correo Argentino Domicilio',
    delivery_type: 'homeDelivery',
  },
  {
    id: 'correo-sucursal',
    name: 'Correo Argentino Sucursal',
    delivery_type: 'agency',
  },
]);

const DELIVERY_TYPE_BY_OPTION_ID: Record<string, CorreoDeliveryType> =
  Object.fromEntries(
    OPTION_DEFINITIONS.map((option) => [option.id, option.delivery_type])
  );

/**
 * Contador de degradaciones a $0 (D4b).
 *
 * La decisión del negocio (D4) es que una cotización fallida se le muestre al
 * comprador como "Gratuito", igual que Andreani. El riesgo — regalar el flete
 * en cada timeout del carrier — se aceptó explícitamente, y se mitiga con
 * VISIBILIDAD, no con UX: `logger.error` en cada caso + este contador para
 * poder medir cuántas veces pasa y revisar la decisión con datos.
 *
 * Es un contador de proceso, no de cluster: sirve para un health endpoint o
 * para un log periódico, no para facturación.
 */
let rateFallbackCount = 0;

export function getCorreoRateFallbackCount(): number {
  return rateFallbackCount;
}

export function resetCorreoRateFallbackCount(): void {
  rateFallbackCount = 0;
}

/**
 * Traduce el `outcome` de `/rates` a la acción concreta que corresponde.
 *
 * Los tres casos se ven idénticos desde el checkout ("Gratuito"), pero se
 * arreglan de formas completamente distintas: uno es una llamada a Correo, otro
 * es cobertura, y el tercero es un bug nuestro. Sin esto, el log dice "no hubo
 * tarifa" y arranca la cacería equivocada.
 */
/**
 * ¿Estas options alcanzan para cotizar?
 *
 * Función libre y no método porque ahora hay DOS juegos de options en juego —el
 * del arranque y el de la tienda de la llamada— y preguntárselo a `this` era
 * exactamente cómo `calculatePrice` terminaba mirando la configuración
 * equivocada mientras cotizaba con la cuenta correcta.
 */
export function canQuoteWith(options: CorreoProviderOptions): boolean {
  const { username, password, customerId } = options.micorreo;
  return Boolean(username && password && customerId);
}

export function diagnoseRatesOutcome(outcome: CorreoRatesOutcome): string {
  switch (outcome) {
    case 'account_not_activated':
      return 'La cuenta NO está activada comercialmente (202 con rates vacío) — pedir la activación a Correo, no debuggear el código.';
    case 'no_rates':
      return 'Correo no cotiza esta ruta/producto — revisar cobertura del CP de destino y el serviceType del acuerdo.';
    case 'ok':
      return 'Hubo tarifas pero ninguna del producto pedido — revisar serviceType (¿EP habilitado en el agreement?) y deliveredType.';
  }
}

class CorreoArgentinoFulfillmentProviderService extends AbstractFulfillmentProviderService {
  static identifier = 'correo_argentino';

  protected readonly logger_: Logger;
  protected readonly pgConnection_?: PgLike;
  protected readonly options_: CorreoProviderOptions;
  protected readonly paqar_: PaqarClient;
  protected readonly micorreo_: MiCorreoClient;

  /**
   * TODA la configuración de Correo para ESTA llamada: options resueltas y los dos
   * clientes con la cuenta que corresponde.
   *
   * ┌────────────────────────────────────────────────────────────────────────┐
   * │ NO ES UN REFACTOR DE `micorreoForChannel`: ES EL ARREGLO DE UN BUG.    │
   * └────────────────────────────────────────────────────────────────────────┘
   *
   * Lo que había resolvía la tienda SÓLO para el cliente de MiCorreo, o sea sólo
   * para COTIZAR, y sólo desde `calculatePrice`. Todo lo que OPERA —`this.paqar_`
   * en `cancelFulfillment`, el `agreement` que `createFulfillment` estampa en
   * `fulfillment.data`— seguía usando lo del boot, que sale del entorno. La tienda
   * B cotizaba con su cuenta y despachaba con la de A.
   *
   * Ahora se resuelve el paquete completo por llamada: la configuración sale de
   * `site_setting` con la precedencia de la decisión 3 (incluido el fail-closed) y
   * las credenciales de `site_credential` la pisan. Los clientes se cachean POR
   * HUELLA en `get-client.ts`, no por tiempo: `MiCorreoClient` cachea un JWT y uno
   * nuevo por llamada sería un `POST /token` por cotización.
   *
   * Degrada a la configuración del BOOT en dos casos, y sólo en esos dos: cuando no
   * hay `PG_CONNECTION` (contenedor sin base) y cuando la lectura falla por
   * infraestructura. Si la tienda declaró credenciales propias y su blob no se
   * puede descifrar, TIRA: despachar con la cuenta de otro titular es peor que
   * fallar, porque el envío sale igual y se le factura a quien no corresponde.
   */
  protected async contextFor(
    hint: { site_id?: string; sales_channel_id?: string } | undefined,
  ): Promise<CorreoCallContext> {
    const siteId = hint?.site_id;
    const salesChannelId = hint?.sales_channel_id;

    if (!this.pgConnection_ || (!siteId && !salesChannelId)) return this.bootContext();

    try {
      const { options, resolution } = await loadCorreoOptionsViaPg(
        this.pgConnection_,
        { siteId, salesChannelId },
        this.logger_,
      );
      const clients = correoClientsFor(options, resolution, this.logger_);
      return { ...clients, resolution };
    } catch (error) {
      if (isUndecryptableCredentialsError(error)) throw error;
      this.logger_.warn(
        `[correo-argentino] No se pudo resolver la configuración por tienda: ${
          error instanceof Error ? error.message : String(error)
        }. Se usa la del arranque.`,
      );
      return this.bootContext();
    }
  }

  /** La configuración congelada en el arranque. Último eslabón, nunca el primero. */
  private bootContext(): CorreoCallContext {
    return { options: this.options_, paqar: this.paqar_, micorreo: this.micorreo_ };
  }

  constructor(cradle: InjectedDependencies, options: RawProviderOptions) {
    super();

    const { logger } = cradle;
    this.logger_ = logger;
    this.pgConnection_ = cradle[ContainerRegistrationKeys.PG_CONNECTION];
    // Delega en `normalizeCorreoOptions()` en vez de tener su propio
    // `static normalizeOptions()` como Andreani. Los TRES caminos que producen
    // options —el de `medusa-config.ts` (acá), el resolver por tienda
    // (`settings.ts`) y el loader por ENV puro (`loadCorreoOptionsFromEnv`)—
    // terminan en esa función, así que no pueden divergir. Si divergieran, el
    // provider cotizaría con una configuración y el workflow daría de alta con
    // otra, y el síntoma no apuntaría a ningún archivo.
    //
    // Estas options son el ÚLTIMO fallback, no la fuente: cada llamada resuelve las
    // suyas con `contextFor()`. Quedan para instalaciones que hardcodean
    // credenciales en `medusa-config.ts` y para cuando no hay base a mano — mismo
    // criterio que el notification provider de Kapso.
    this.options_ = normalizeCorreoOptions(options);
    this.paqar_ = new PaqarClient(this.options_, logger);
    this.micorreo_ = new MiCorreoClient(this.options_, logger);

    if (!this.canQuote()) {
      // No es fatal a propósito (ver normalizeCorreoOptions), pero tiene que
      // gritar: sin esto TODOS los envíos de Correo cotizan $0 y el síntoma en
      // producción es "el checkout dice Gratuito", que no apunta a acá.
      this.logger_.error(
        '[correo-argentino] Sin credenciales de MiCorreo (CORREO_ARGENTINO_MICORREO_USER / _PASS / _CUSTOMER_ID) en la configuración de la instancia. ' +
          'El provider opera (órdenes, rótulos, tracking) pero NO puede cotizar: todo envío va a degradar a $0 → "Gratuito". ' +
          'En multitienda esto NO es concluyente: cada tienda puede tener las suyas en site_setting/site_credential.'
      );
    }

    if (!this.options_.apiKey || !this.options_.agreement) {
      // Antes esto TIRABA en `normalizeCorreoOptions` y volteaba el arranque. Ya no:
      // en multitienda la configuración se resuelve por llamada y una instancia sin
      // credenciales globales es un estado legítimo —cada tienda tiene las suyas—.
      // Sigue siendo un `error` y no un `warn` porque, si además ninguna tienda las
      // declaró, el síntoma es un alta rechazada por Correo sin pista de por qué.
      this.logger_.error(
        '[correo-argentino] Sin API key o sin número de acuerdo en la configuración de la instancia ' +
          '(CORREO_ARGENTINO_API_KEY / _AGREEMENT). El provider se registra igual y degrada: si ninguna tienda ' +
          'declara los suyos, TODA llamada a paqar (alta, rótulos, tracking, cancelación) va a fallar.'
      );
    }
  }

  // Accesores públicos, para que las rutas puedan reusar la instancia
  // configurada. Ojo: las rutas custom deben construir sus clientes con
  // `get-client.ts` — resolver el provider del `req.scope` no es confiable.
  getPaqarClient(): PaqarClient {
    return this.paqar_;
  }

  getMiCorreoClient(): MiCorreoClient {
    return this.micorreo_;
  }

  getOptions(): CorreoProviderOptions {
    return this.options_;
  }

  /**
   * Si hay credenciales para cotizar CON LA CONFIGURACIÓN DE LA INSTANCIA.
   *
   * ⚠️ Es un diagnóstico de arranque, no el guard de `calculatePrice`: ahí se
   * pregunta lo mismo pero sobre las options de la TIENDA (`canQuoteWith`). Un
   * `false` acá no significa que ninguna tienda pueda cotizar.
   */
  canQuote(): boolean {
    return canQuoteWith(this.options_);
  }

  // --- Interfaz del fulfillment provider ---

  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return OPTION_DEFINITIONS.map((option) => ({
      id: option.id,
      name: option.name,
      delivery_type: option.delivery_type,
      service_type: this.options_.serviceType,
    }));
  }

  async validateOption(data: UnknownRecord): Promise<boolean> {
    const id = this.str(data, 'id');
    return id ? id in DELIVERY_TYPE_BY_OPTION_ID : true;
  }

  async canCalculate(_data: CreateShippingOptionDTO): Promise<boolean> {
    return true;
  }

  /**
   * Punto donde la elección del comprador se persiste en
   * `shipping_method.data`. Todo lo que el workflow de tickets necesite saber
   * tiene que quedar acá: después del checkout, `data` es la única fuente.
   *
   * `...data` primero, a propósito: preserva TODO lo que manda el checkout
   * (`carrier`, `branch_id`, `branch_code`, `pickup_kind`, `amount`) en vez de
   * quedarse solo con los campos que este método conoce.
   *
   * ⚠️ NO valida que `agency_id` esté presente para `delivery_type: 'agency'`,
   * aunque `POST /orders` lo exija. El orden de operaciones del checkout lo
   * prohíbe: al tocar el radio de "Retiro en sucursal" el storefront llama a
   * `setShippingMethod` con `{ carrier }` y SIN sucursal
   * (`shipping/index.tsx:1109-1124`) y solo después carga la lista de
   * sucursales; la sucursal llega en un segundo `setShippingMethod`
   * (`:908-926`). Tirar acá haría que la opción no se pueda seleccionar nunca y
   * el flujo de sucursal quedaría muerto.
   *
   * TODO(fase-3): la ausencia de sucursal se valida al completar el carrito y
   * en `correoGenerateTicketsWorkflow`, que son los dos puntos donde ya hay una
   * elección definitiva.
   */
  async validateFulfillmentData(
    optionData: UnknownRecord,
    data: UnknownRecord,
    context: ValidateFulfillmentDataContext
  ): Promise<UnknownRecord> {
    const contextRecord = (context ?? {}) as unknown as UnknownRecord;
    // El default de producto es de la tienda. `contextFor` está memoizado 30 s por
    // scope, así que esto no agrega un viaje a Postgres por cada `setShippingMethod`.
    const ctx = await this.contextFor({
      sales_channel_id: this.str(contextRecord, 'sales_channel_id'),
      site_id: this.str(contextRecord, 'site_id'),
    });

    const deliveryType = this.resolveDeliveryType(optionData, data);
    const serviceType = this.resolveServiceType(
      optionData,
      data,
      ctx.options.serviceType
    );
    const agencyId = this.resolveAgencyId(data);

    const validated: UnknownRecord = {
      ...data,
      /**
       * La tienda queda ESTAMPADA en `shipping_method.data`.
       *
       * Es lo que hace que `cancelFulfillment` —que sólo recibe el blob de `data`,
       * sin orden y sin request— pueda cancelar contra la cuenta correcta. Sin
       * esto, cancelar un envío de la tienda B le pega a la API con el acuerdo de
       * A y la respuesta es un 404 que no explica nada.
       */
      ...(this.str(contextRecord, 'sales_channel_id')
        ? { sales_channel_id: this.str(contextRecord, 'sales_channel_id') }
        : {}),
      // `provider` mantiene la convención de Andreani; `carrier` es la
      // identidad estable que consume el registry del storefront (Fase 0) para
      // no volver a inferir el carrier desde el nombre de la opción.
      provider: CorreoArgentinoFulfillmentProviderService.identifier,
      carrier: CORREO_CARRIER_ID,
      delivery_type: deliveryType,
      service_type: serviceType,
    };

    if (agencyId) {
      validated.agency_id = agencyId;
    }

    return validated;
  }

  /**
   * Cotiza con MiCorreo `POST /rates`.
   *
   * Cualquier falla degrada a `calculated_amount: 0` — decisión D4, que el
   * checkout muestra como "Gratuito". Ver el comentario de `rateFallbackCount`.
   */
  async calculatePrice(
    optionData: CalculateShippingOptionPriceDTO['optionData'],
    data: CalculateShippingOptionPriceDTO['data'],
    context: CalculateShippingOptionPriceDTO['context']
  ): Promise<CalculatedShippingOptionPrice> {
    const optionRecord = (optionData ?? {}) as UnknownRecord;
    const dataRecord = (data ?? {}) as UnknownRecord;
    const contextRecord = (context ?? {}) as unknown as UnknownRecord;

    const deliveryType = this.resolveDeliveryType(optionRecord, dataRecord);
    const postalCodeDestination = this.resolveDestinationPostalCode(
      dataRecord,
      contextRecord
    );

    // Se declaran FUERA del try para que el log de la degradación pueda decir
    // con qué se cotizó (D4b). Un "Gratuito" en producción sin el CP y el peso
    // en el log es irreproducible: no se sabe si fue la ruta, el bulto o la API.
    let billedWeightG: number | undefined;
    let outcome: CorreoRatesOutcome | undefined;
    // El serviceType también sale de la config de la tienda cuando el checkout no
    // lo manda, así que se resuelve DENTRO del try (contra el contexto ya cargado)
    // y se pre-carga con el del boot para que el log de la degradación nunca quede
    // sin ese dato.
    let serviceType = this.resolveServiceType(
      optionRecord,
      dataRecord,
      this.options_.serviceType
    );

    try {
      // Todo lo que sigue —origen, límites, fallback de dimensiones, credenciales
      // de MiCorreo— sale de la configuración de la TIENDA dueña del carrito, no
      // de la del arranque. Antes sólo el cliente salía de acá y el resto de
      // `this.options_`: una tienda podía cotizar con su cuenta pero con el CP de
      // origen y los límites de otra.
      const ctx = await this.contextFor({
        sales_channel_id: this.str(contextRecord, 'sales_channel_id'),
        site_id: this.str(contextRecord, 'site_id'),
      });
      serviceType = this.resolveServiceType(
        optionRecord,
        dataRecord,
        ctx.options.serviceType
      );

      if (!canQuoteWith(ctx.options)) {
        throw new Error(
          'MiCorreo credentials are not configured — cannot quote'
        );
      }

      if (!postalCodeDestination) {
        throw new Error(
          'Destination postal code is required to quote with Correo Argentino'
        );
      }

      const postalCodeOrigin = normalizePostalCode(ctx.options.origin.postalCode);
      if (!postalCodeOrigin) {
        throw new Error(
          'Origin postal code is not configured (CORREO_ARGENTINO_ORIGIN_POSTAL_CODE)'
        );
      }

      // El bulto consolidado, no los ítems sueltos: `parcels[]` de Correo
      // descarta todo menos el primer elemento (§3.1 del plan).
      const parcel = consolidateParcel(this.readItems(contextRecord), {
        logger: this.logger_,
        weightUnit: ctx.options.productWeightUnit,
        aforoDivisor: ctx.options.limits.aforoDivisor,
        maxWeightG: ctx.options.limits.maxWeightG,
        maxDimensionCm: ctx.options.limits.maxDimensionCm,
        dimensionFallback: ctx.options.dimensionFallback.enabled
          ? ctx.options.dimensionFallback
          : undefined,
      });
      billedWeightG = parcel.billedWeightG;

      const result = await ctx.micorreo.getRates({
        postalCodeOrigin,
        postalCodeDestination,
        deliveredType: deliveredTypeForDeliveryType(deliveryType),
        dimensions: {
          weight: parcel.billedWeightG,
          height: parcel.dimensions.height,
          width: parcel.dimensions.width,
          length: parcel.dimensions.depth,
        },
      });
      outcome = result.outcome;

      outcome = result.outcome;

      const rate = selectRate(result.rates, {
        serviceType,
        deliveredType: deliveredTypeForDeliveryType(deliveryType),
      });

      if (!rate) {
        // El motivo importa: `account_not_activated` no se arregla con código.
        throw new Error(
          `MiCorreo no devolvió tarifa '${serviceType}' (http=${result.httpStatus}, rates=[${result.rates
            .map((r) => `${r.productType}/${r.deliveredType}=${r.price}`)
            .join(', ')}]). ${diagnoseRatesOutcome(result.outcome)}`
        );
      }

      return {
        calculated_amount: Math.round(Number(rate.price)),
        // `false` por decisión de negocio: alinear con Andreani
        // (`andreani-fulfillment/service.ts:189`), el carrier que ya factura.
        //
        // ⚠️ SIN VERIFICAR con Correo: no sabemos si `/rates` devuelve precio
        // final al consumidor o neto. Si devolviera precio final, Medusa le
        // suma el IVA de la región encima y el comprador lo paga dos veces.
        // Si aparece un reclamo de doble IVA sobre envíos de Correo, este flag
        // es el primer lugar donde mirar.
        is_calculated_price_tax_inclusive: false,
      };
    } catch (error) {
      rateFallbackCount += 1;
      // `extractErrorMessage` y no `error.message`: los errores que vuelven del
      // workflow engine llegan rehidratados como objetos planos envueltos en
      // `{ error, action, handlerType }`, y `String(error)` daría
      // "[object Object]" justo en el log que necesitamos leer.
      const message = extractErrorMessage(error);
      // `error`, no `warn` (D4b): cada ocurrencia es plata que el negocio
      // absorbe, y tiene que llegar a Sentry.
      //
      // El log lleva los tres datos con los que la cotización se puede
      // reproducir a mano contra `/rates`: outcome, CP destino y peso facturado.
      // `outcome=sin_respuesta` significa que ni se llegó a llamar a la API (o
      // que tiró), que es un problema distinto de `no_rates`.
      this.logger_.error(
        `[correo-argentino] calculatePrice degradó a $0 (ocurrencia #${rateFallbackCount}): ${message} ` +
          `[outcome=${outcome ?? 'sin_respuesta'} service=${serviceType} delivery=${deliveryType} ` +
          `cp_destino=${postalCodeDestination ?? 'sin_cp'} peso_g=${billedWeightG ?? 'sin_bulto'}]`
      );
      return {
        calculated_amount: 0,
        // Mismo flag que el camino feliz: la degradación no debe cambiar el
        // régimen impositivo del monto, solo el monto.
        is_calculated_price_tax_inclusive: false,
      };
    }
  }

  /**
   * STUB DELIBERADO — no le pega a Correo.
   *
   * El alta real (`POST /orders`) la hace el workflow `correo-generate-tickets`
   * on-demand desde el admin. Si este método también diera de alta, una orden
   * terminaría con dos envíos y doble flete.
   *
   * A diferencia de Andreani, acá NO se inventa un `PENDING-<display_id>`: el
   * TN lo asigna el workflow y hasta entonces el campo queda `null`. Los
   * placeholders de Andreani obligan al storefront y al job de sync a filtrar
   * por prefijo; no vale la pena heredar eso.
   */
  async createFulfillment(
    data: UnknownRecord,
    items: Partial<Omit<FulfillmentItemDTO, 'fulfillment'>>[],
    order: Partial<FulfillmentOrderDTO> | undefined,
    fulfillment: Partial<Omit<FulfillmentDTO, 'provider_id' | 'data' | 'items'>>
  ): Promise<CreateFulfillmentResult> {
    if (!order) {
      throw new Error('Order data is required for fulfillment creation');
    }
    if (!order.shipping_address) {
      throw new Error('Shipping address is required for fulfillment creation');
    }
    if (!items?.length) {
      throw new Error('At least one item is required for fulfillment creation');
    }

    // El `agreement` que se estampa acá es el de LA TIENDA de la orden, no el del
    // arranque. Es el dato que después se audita para saber contra qué acuerdo se
    // despachó, así que escribir el global sería dejar un registro que miente.
    const salesChannelId =
      order.sales_channel_id ?? this.str(data, 'sales_channel_id');
    const ctx = await this.contextFor({ sales_channel_id: salesChannelId });

    const deliveryType = this.resolveDeliveryType(undefined, data);
    const serviceType = this.resolveServiceType(
      undefined,
      data,
      ctx.options.serviceType
    );

    this.logger_.info(
      `[correo-argentino] fulfillment registrado (stub, sin envío real): order=${
        order.display_id ?? order.id
      }. El alta en Correo la hace el workflow de tickets desde el admin.`
    );

    return {
      data: {
        tracking_number: null,
        carrier: CORREO_CARRIER_ID,
        delivery_type: deliveryType,
        service_type: serviceType,
        agency_id: this.resolveAgencyId(data) ?? null,
        agreement: ctx.options.agreement,
        // Se propaga para que `cancelFulfillment` —que sólo recibe este blob—
        // pueda resolver la misma cuenta contra la que se creó el envío.
        ...(salesChannelId ? { sales_channel_id: salesChannelId } : {}),
        label_url: '',
        status: 'pending_label',
        created_at: new Date().toISOString(),
        fulfillment_id: fulfillment.id ?? null,
      },
      labels: [],
    };
  }

  /**
   * `PATCH /orders/{trackingNumber}/cancel`.
   *
   * ⚠️ Correo solo acepta la cancelación mientras el envío NO fue **impuesto**
   * (no entró físicamente a la red). Después, la API la rechaza.
   *
   * El error se PROPAGA a propósito. Tragarlo y devolver `success: true`
   * dejaría al operador convencido de que canceló un envío que va a salir
   * igual, y con la orden ya marcada como cancelada de este lado.
   *
   * ⚠️ Usaba `this.paqar_`, el cliente del ARRANQUE. En multitienda eso cancelaba
   * con el acuerdo del entorno un envío creado con el de la tienda: la API
   * responde que no existe y el operador queda convencido de que no se puede
   * cancelar. La tienda viaja en el propio blob de `data`, estampada por
   * `createFulfillment` / `validateFulfillmentData`, porque acá no hay ni orden ni
   * request de dónde sacarla.
   */
  async cancelFulfillment(data: UnknownRecord): Promise<unknown> {
    const trackingNumber = this.str(data, 'tracking_number');

    if (!trackingNumber) {
      // Stub sin ticket generado: no hay nada que cancelar del lado de Correo.
      this.logger_.info(
        '[correo-argentino] cancelFulfillment sin tracking_number: el envío nunca se dio de alta, no hay nada que cancelar.'
      );
      return { success: true, tracking_number: null, cancelled_remotely: false };
    }

    const ctx = await this.contextFor({
      sales_channel_id: this.str(data, 'sales_channel_id'),
      site_id: this.str(data, 'site_id'),
    });

    try {
      const response = await ctx.paqar.cancelOrder(trackingNumber);
      this.logger_.info(
        `[correo-argentino] envío ${trackingNumber} cancelado en Correo.`
      );
      return {
        success: true,
        tracking_number: trackingNumber,
        cancelled_remotely: true,
        response,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger_.error(
        `[correo-argentino] no se pudo cancelar ${trackingNumber} en Correo: ${message}`
      );
      throw new Error(
        `Correo Argentino rechazó la cancelación de ${trackingNumber}: ${message}. ` +
          'Si el envío ya fue impuesto, la cancelación por API no es posible — gestionarla con el ejecutivo de cuenta.'
      );
    }
  }

  async createReturnFulfillment(
    fulfillment: UnknownRecord
  ): Promise<CreateFulfillmentResult> {
    // Stub: las devoluciones de Correo no están automatizadas en el boilerplate.
    const originalTracking = this.str(fulfillment, 'tracking_number');
    this.logger_.info(
      `[correo-argentino] createReturnFulfillment stub para tracking=${
        originalTracking ?? '(desconocido)'
      }`
    );
    return {
      data: {
        ...((fulfillment.data as object) ?? {}),
        return_requested: true,
        original_tracking_number: originalTracking ?? null,
        return_instructions:
          'Coordinar la devolución con el ejecutivo de cuenta de Correo Argentino.',
      },
      labels: [],
    };
  }

  // Los rótulos se sirven on-demand por ruta admin (`POST /labels` es bulk
  // nativo), no como documentos del fulfillment.
  async getFulfillmentDocuments(_data: UnknownRecord): Promise<never[]> {
    return [];
  }

  async getReturnDocuments(_data: UnknownRecord): Promise<never[]> {
    return [];
  }

  async getShipmentDocuments(_data: UnknownRecord): Promise<never[]> {
    return [];
  }

  // --- helpers ---

  private resolveDeliveryType(
    optionData: UnknownRecord | undefined,
    data: UnknownRecord
  ): CorreoDeliveryType {
    const direct =
      this.str(data, 'delivery_type') ??
      this.nestedStr(data, ['metadata', 'delivery_type']) ??
      this.str(optionData, 'delivery_type');

    if (direct === 'homeDelivery' || direct === 'agency') {
      return direct;
    }

    const optionId = this.str(data, 'id') ?? this.str(optionData, 'id');
    if (optionId && optionId in DELIVERY_TYPE_BY_OPTION_ID) {
      return DELIVERY_TYPE_BY_OPTION_ID[optionId] as CorreoDeliveryType;
    }

    return 'homeDelivery';
  }

  /**
   * `fallback` es OBLIGATORIO y no cae a `this.options_` por su cuenta: el default
   * del producto es configuración de la TIENDA, y quien llama es el único que sabe
   * si ya resolvió su contexto. Hacer que este helper mire `this` fue cómo, en la
   * versión anterior, una tienda cotizaba con su cuenta y el serviceType default
   * salía del entorno.
   */
  private resolveServiceType(
    optionData: UnknownRecord | undefined,
    data: UnknownRecord,
    fallback: CorreoServiceType
  ): CorreoServiceType {
    const direct = (
      this.str(data, 'service_type') ??
      this.nestedStr(data, ['metadata', 'service_type']) ??
      this.str(optionData, 'service_type')
    )?.toUpperCase();

    // ⚠️ `EP` (Expreso) NO está verificado contra el agreement real. El default
    // sale de la configuración para poder apagarlo sin tocar código.
    return direct === 'CP' || direct === 'EP'
      ? (direct as CorreoServiceType)
      : fallback;
  }

  /**
   * El id de sucursal llega con distintos nombres según por dónde entró
   * (checkout, admin, retry del workflow). `agency_id` es el canónico.
   *
   * `branch_code` / `branch_id` son los que manda HOY el checkout después de la
   * Fase 0 (`shipping/index.tsx:910-924`), y son los que importan: en el
   * transformer de sucursales el `agency_id` de Correo se copia tanto a `id`
   * como a `code` (`transformers/agencies.ts:106-107`), así que los dos
   * resuelven al mismo código de planta de 3 chars. `code` va primero porque es
   * el campo que, por contrato, lleva el identificador del lado del carrier.
   */
  private resolveAgencyId(data: UnknownRecord): string | undefined {
    return (
      this.str(data, 'agency_id') ??
      this.str(data, 'branch_code') ??
      this.str(data, 'branch_id') ??
      this.str(data, 'pickup_location_id') ??
      this.str(data, 'pickup_branch_id') ??
      this.nestedStr(data, ['metadata', 'agency_id']) ??
      this.nestedStr(data, ['metadata', 'pickup_location_id'])
    );
  }

  private resolveDestinationPostalCode(
    data: UnknownRecord,
    context: UnknownRecord
  ): string | undefined {
    const raw =
      this.str(data, 'postal_code') ??
      this.nestedStr(data, ['shipping_address', 'postal_code']) ??
      this.nestedStr(context, ['shipping_address', 'postal_code']);

    // El carrito puede traer el CPA completo ("C1121AAF"); `/rates` quiere los
    // 4 dígitos.
    return normalizePostalCode(raw);
  }

  /**
   * Ítems del contexto de cotización → entrada de `consolidateParcel`.
   *
   * Medusa expone las dimensiones en la variante, con el producto como
   * fallback. Los faltantes NO se rellenan acá: `consolidateParcel` decide
   * según `dimensionFallback` y, si está apagado, tira el error tipado que
   * lista todos los ofensores.
   */
  private readItems(context: UnknownRecord): ConsolidateParcelItem[] {
    const items = Array.isArray(context.items) ? context.items : [];

    return items
      .filter((item): item is UnknownRecord => this.isRecord(item))
      .map((item, index) => {
        const variant = this.isRecord(item.variant) ? item.variant : {};
        const product = this.isRecord(variant.product) ? variant.product : {};

        const dim = (key: string): number =>
          this.num(item, key) ?? this.num(variant, key) ?? this.num(product, key) ?? 0;

        return {
          id:
            this.str(item, 'id') ??
            this.str(item, 'variant_id') ??
            `item-${index}`,
          title: this.str(item, 'title') ?? this.str(product, 'title') ?? '',
          quantity: this.num(item, 'quantity') ?? 1,
          weight: dim('weight'),
          length: dim('length'),
          width: dim('width'),
          height: dim('height'),
          unit_price: this.num(item, 'unit_price'),
        };
      });
  }

  private isRecord(value: unknown): value is UnknownRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private str(
    source: UnknownRecord | undefined,
    key: string
  ): string | undefined {
    const value = source?.[key];
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private nestedStr(
    source: UnknownRecord | undefined,
    path: string[]
  ): string | undefined {
    let current: unknown = source;
    for (const key of path) {
      if (!this.isRecord(current)) return undefined;
      current = current[key];
    }
    if (typeof current !== 'string') return undefined;
    const trimmed = current.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  /**
   * Lee un número tolerando las tres formas de `BigNumberValue`.
   *
   * ⚠️ `quantity` y `unit_price` de las líneas del carrito son `BigNumberValue`:
   * número, string, o el objeto de BigNumber. Con ese objeto, `Number(value)` da
   * `NaN` y `quantity` caería a 1 EN SILENCIO — el bulto consolidado quedaría con
   * el peso de una sola unidad y la cotización saldría de menos, que es
   * exactamente el error que nadie ve hasta que Correo factura la diferencia.
   */
  private num(
    source: UnknownRecord | undefined,
    key: string
  ): number | undefined {
    return this.toNumber(source?.[key]);
  }

  private toNumber(value: unknown): number | undefined {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : undefined;
    }
    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    if (this.isRecord(value)) {
      // `numeric` es la forma pública de BigNumber; `value` / `raw_.value` son
      // las que aparecen cuando el objeto viaja serializado.
      return (
        this.toNumber(value.numeric) ??
        this.toNumber(value.value) ??
        this.toNumber(this.isRecord(value.raw_) ? value.raw_.value : undefined)
      );
    }
    return undefined;
  }
}

export default CorreoArgentinoFulfillmentProviderService;
