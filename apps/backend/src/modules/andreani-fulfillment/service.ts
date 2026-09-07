/**
 * Andreani fulfillment provider service.
 *
 * Implementa `AbstractFulfillmentProviderService` para Medusa 2.13.1.
 *
 * La configuración y las credenciales salen de `app-settings` + `site_credential`
 * con la precedencia de la decisión 3, y las `options` que inyecta
 * `medusa-config.ts` quedan como último fallback —para instalaciones que las
 * hardcodean ahí—. Mismo criterio que el notification provider de Kapso.
 *
 * Un provider recibe un container AISLADO (`load-internal.js` lo crea sin padre y
 * le re-exporta seis claves), así que TODO lo que este archivo lee de la base va
 * por `PG_CONNECTION` con knex crudo. No hay `container.resolve(APP_SETTINGS_MODULE)`
 * posible desde acá.
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

import { resolveSiteViaSql } from '../../lib/multistore/resolve-site-sql';
import { readSiteCredentialsViaSql } from '../../lib/multistore/credentials';
import type { AndreaniClient } from './client';
import {
  applyAndreaniSiteCredentials,
  normalizeAndreaniOptions,
  resolveContractForService,
  type AndreaniSiteCredentials,
} from './env-options';
import { getCachedAndreaniClient } from './get-client';
import {
  getAndreaniSettings,
  hasAndreaniCredentials,
  loadAndreaniSettingsViaPg,
  type AndreaniContractOverrides,
} from './settings';
import { AndreaniDataTransformer } from './transformers/data-transformer';
import type {
  AndreaniProviderOptions,
  AndreaniServiceType,
} from './types';

type InjectedDependencies = {
  logger: Logger;
  /**
   * Conexión Postgres compartida (knex), inyectada en el cradle de CADA módulo.
   *
   * Es la única vía para leer las credenciales por tienda desde acá: un provider de
   * fulfillment recibe un container AISLADO y no puede `resolve()` otro módulo —
   * mismo motivo por el que `email/service.ts` y `kapso-whatsapp/service.ts` leen
   * `store_setting` por SQL crudo.
   */
  [ContainerRegistrationKeys.PG_CONNECTION]?: PgLike;
};

type PgLike = { raw: (sql: string, bindings?: unknown[]) => Promise<{ rows?: any[] }> };

type RawProviderOptions = Record<string, unknown> | undefined;

/**
 * Todo lo que hace falta para cotizar o despachar en nombre de UNA tienda.
 *
 * Existe porque las credenciales y el CONTRATO POR SERVICIO son dos cosas
 * distintas que antes se resolvían en dos lugares distintos: el cliente salía de
 * `clientForChannel` (que sí miraba la tienda) y el contrato de
 * `resolveContractForService`, que leía `process.env` adentro del provider. O sea:
 * una tienda con cuenta propia cotizaba con su usuario y el override de contrato de
 * la instancia.
 */
type AndreaniChannelContext = {
  client: AndreaniClient;
  options: AndreaniProviderOptions;
  contractOverrides: AndreaniContractOverrides;
};

const SERVICE_TYPE_BY_OPTION_ID: Record<string, AndreaniServiceType> = {
  'andreani-domicilio': 'Domicilio',
  'andreani-sucursal': 'Sucursal',
  'andreani-punto-tercero': 'PuntoDeTercero',
};

class AndreaniFulfillmentProviderService extends AbstractFulfillmentProviderService {
  static identifier = 'andreani';

  protected readonly logger_: Logger;
  protected readonly pgConnection_?: PgLike;
  /**
   * Las options CRUDAS de `medusa-config.ts`, tal como llegaron.
   *
   * Se guardan porque `contextForChannel` tiene que re-normalizarlas contra la
   * configuración de OTRA tienda: `this.options_` ya tiene la de la instancia
   * horneada y no se puede distinguir de un valor que el operador puso a mano.
   */
  protected readonly rawOptions_: RawProviderOptions;
  protected readonly options_: AndreaniProviderOptions;
  protected readonly client_: AndreaniClient;
  protected readonly transformer_: AndreaniDataTransformer;

  constructor(cradle: InjectedDependencies, options: RawProviderOptions) {
    super();

    const { logger } = cradle;
    this.logger_ = logger;
    this.pgConnection_ = cradle[ContainerRegistrationKeys.PG_CONNECTION];
    this.rawOptions_ = options;
    this.options_ = normalizeAndreaniOptions(options);
    this.client_ = getCachedAndreaniClient(this.options_, logger);
    this.transformer_ = new AndreaniDataTransformer(this.options_);

    // Antes esto TIRABA desde `normalizeOptions` si faltaba usuario, contraseña o
    // contrato. Combinado con el gate de `medusa-config.ts:455` —que registra el
    // provider cuando `ANDREANI_USERNAME` está seteada— una contraseña vacía
    // dejaba el backend sin arrancar. Ahora se avisa y se sigue: mismo precedente
    // que `kapso-whatsapp/service.ts:79-93`.
    if (!hasAndreaniCredentials(this.options_)) {
      this.logger_.warn(
        '[andreani] Credenciales incompletas (faltan usuario, contraseña o contrato). ' +
          'El carrier queda registrado pero no va a poder cotizar ni despachar hasta ' +
          'que se completen en Ajustes → Andreani o en las credenciales de la tienda.',
      );
    }
  }

  /**
   * Configuración y credenciales de la tienda dueña de este carrito.
   *
   * Sin tienda o sin nada propio devuelve el contexto del boot, que es el
   * comportamiento de siempre — por eso esto se despliega sin migrar ninguna tienda.
   *
   * Resuelve DOS cosas que antes venían de lugares distintos:
   *  - la CONFIGURACIÓN (`site_setting`), incluidos los contratos por servicio, que
   *    antes se leían de `process.env` adentro de `resolveContractForService`;
   *  - las CREDENCIALES (`site_credential`), que ya se resolvían por tienda pero se
   *    aplicaban con un spread plano.
   *
   * Si la tienda SÍ declaró credenciales y no se pueden descifrar, TIRA en vez de
   * caer a las de entorno: despachar con la cuenta de otra tienda es peor que
   * fallar, porque el envío sale igual y se factura al titular equivocado.
   */
  protected async contextForChannel(
    carrier: { sales_channel_id?: string } | undefined,
  ): Promise<AndreaniChannelContext> {
    // Contexto de la INSTANCIA. Los overrides salen del camino sincrónico (snapshot
    // → env → default), que es lo que había antes de que existiera la capa de tienda.
    const fromBoot = (): AndreaniChannelContext => ({
      client: this.client_,
      options: this.options_,
      contractOverrides: getAndreaniSettings().contractOverrides,
    });

    const channelId = carrier?.sales_channel_id;
    if (!channelId || !this.pgConnection_) return fromBoot();

    try {
      const site = await resolveSiteViaSql(this.pgConnection_, { salesChannelId: channelId });
      const settings = await loadAndreaniSettingsViaPg(this.pgConnection_, site);
      // `'andreani'` va como LITERAL y no como constante importada a propósito:
      // `api/admin/site-credentials/catalog.test.ts` grepea este archivo buscando el
      // string con el que el admin ESCRIBE la credencial, y una constante lo deja
      // ciego. Si los dos strings divergen, la credencial queda en una fila que nadie
      // lee y la tienda sigue despachando con la cuenta del entorno, en silencio.
      const creds = await readSiteCredentialsViaSql<AndreaniSiteCredentials>(
        this.pgConnection_,
        'andreani',
        site,
      );

      if (creds.status === 'missing' && creds.reason === 'undecryptable') {
        throw new Error(
          'Las credenciales de Andreani de esta tienda no se pueden descifrar ' +
            '(probablemente rotó JWT_SECRET). Volvé a cargarlas antes de despachar.',
        );
      }

      // Las `options` del boot siguen siendo el piso: una instalación que hardcodea
      // credenciales en `medusa-config.ts` no puede quedarse sin ellas porque la
      // fila global de `site_setting` no exista.
      const base = normalizeAndreaniOptions(
        this.rawOptions_,
        settings.options,
      );
      const options =
        creds.status === 'found' && creds.source === 'site'
          ? applyAndreaniSiteCredentials(base, creds.value)
          : base;

      return {
        client: getCachedAndreaniClient(options, this.logger_),
        options,
        contractOverrides: settings.contractOverrides,
      };
    } catch (error) {
      // Un fallo de LECTURA no puede dejar la instancia sin despachar: se cae al
      // contexto de entorno. El caso `undecryptable` de arriba sí corta, y por eso
      // se relanza.
      if (error instanceof Error && error.message.includes('no se pueden descifrar')) throw error;
      this.logger_.warn(
        `[andreani] No se pudieron resolver las credenciales por tienda: ${
          error instanceof Error ? error.message : String(error)
        }. Se usan las de entorno.`,
      );
      return fromBoot();
    }
  }

  // Public accessors so store API routes can reuse the configured instance.
  getClient(): AndreaniClient {
    return this.client_;
  }

  getTransformer(): AndreaniDataTransformer {
    return this.transformer_;
  }

  getOptions(): AndreaniProviderOptions {
    return this.options_;
  }

  // --- Fulfillment provider interface ---

  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return [
      { id: 'andreani-domicilio', name: 'Andreani Domicilio', service_type: 'Domicilio' },
      { id: 'andreani-sucursal', name: 'Andreani Sucursal', service_type: 'Sucursal' },
      {
        id: 'andreani-punto-tercero',
        name: 'Andreani Punto de Tercero',
        service_type: 'PuntoDeTercero',
      },
    ];
  }

  async validateOption(data: Record<string, unknown>): Promise<boolean> {
    const id = typeof data?.id === 'string' ? data.id : undefined;
    return id ? id in SERVICE_TYPE_BY_OPTION_ID : true;
  }

  async canCalculate(_data: CreateShippingOptionDTO): Promise<boolean> {
    return true;
  }

  async validateFulfillmentData(
    optionData: Record<string, unknown>,
    data: Record<string, unknown>,
    _context: ValidateFulfillmentDataContext
  ): Promise<Record<string, unknown>> {
    const serviceType = this.resolveServiceType(optionData, data);

    const validated: Record<string, unknown> = {
      ...data,
      provider: 'andreani',
      service_type: serviceType,
    };

    const pickupLocationId = this.resolvePickupLocationId(data);
    if (pickupLocationId) {
      validated.pickup_location_id = pickupLocationId;
    }

    return validated;
  }

  async calculatePrice(
    optionData: CalculateShippingOptionPriceDTO['optionData'],
    data: CalculateShippingOptionPriceDTO['data'],
    context: CalculateShippingOptionPriceDTO['context']
  ): Promise<CalculatedShippingOptionPrice> {
    try {
      const serviceType = this.resolveServiceType(
        optionData as Record<string, unknown>,
        data as Record<string, unknown>
      );

      const destinationPostalCode =
        this.str(data as Record<string, unknown>, 'postal_code') ??
        this.nestedStr(data as Record<string, unknown>, ['shipping_address', 'postal_code']) ??
        this.nestedStr(context as unknown as Record<string, unknown>, [
          'shipping_address',
          'postal_code',
        ]);

      if (!destinationPostalCode) {
        throw new Error(
          'Destination postal code is required to calculate Andreani price'
        );
      }

      const weight =
        this.num(data as Record<string, unknown>, 'weight') ?? 1;
      const declaredValue =
        this.num(data as Record<string, unknown>, 'declared_value') ?? 1000;

      // La cotización sale con la configuración Y las credenciales de la tienda
      // dueña del carrito: el contrato de Andreani determina la tarifa, así que
      // cotizar con la cuenta (o el contrato) de otra tienda devuelve un precio que
      // después no se puede despachar.
      const { client, options, contractOverrides } = await this.contextForChannel(
        (context as { sales_channel_id?: string } | undefined) ?? undefined,
      );

      // Andreani cotiza cada servicio bajo su propio contrato. La tarifa de
      // Domicilio NO aparece en la respuesta si no se consulta con el contrato de
      // domicilio (override de ESTA tienda, o el base). Sin esto la opción devuelve
      // 0 en silencio → "Gratuito".
      const contract = resolveContractForService(
        serviceType,
        options.contract,
        contractOverrides,
      );

      const rateResponse = await client.getTarifas({
        cpDestino: destinationPostalCode,
        contrato: contract,
        bultos: [
          {
            valorDeclarado: declaredValue,
            volumen: 1000,
            kilos: weight,
            altoCm: 10,
            largoCm: 10,
            anchoCm: 10,
          },
        ],
      });

      const matchingRate = rateResponse.tarifas?.find(
        (t) => t.tipoServicio === serviceType
      );

      if (!matchingRate) {
        // Surface WHY the price is 0: usually the contract does not quote this
        // service, so no tarifa matches. Log what Andreani actually returned so
        // the missing contract override is diagnosable from the logs.
        const returned = (rateResponse.tarifas ?? [])
          .map((t) => `${t.tipoServicio}=${t.precio}`)
          .join(', ');
        this.logger_.warn(
          `Andreani calculatePrice: no '${serviceType}' tarifa (cp=${destinationPostalCode}, contrato=${contract}). Returned: [${returned || 'none'}]`
        );
      }

      return {
        calculated_amount: matchingRate ? Math.round(matchingRate.precio) : 0,
        is_calculated_price_tax_inclusive: false,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger_.error(`Andreani calculatePrice failed: ${message}`);
      return {
        calculated_amount: 0,
        is_calculated_price_tax_inclusive: false,
      };
    }
  }

  async createFulfillment(
    data: Record<string, unknown>,
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
    if (!items || items.length === 0) {
      throw new Error('At least one item is required for fulfillment creation');
    }

    const serviceType = this.resolveServiceType(undefined, data);

    // STUB INTENCIONAL: el provider NO crea el envío real en Andreani.
    //
    // La creación del envío (POST /v2/ordenes-de-envio) y la etiqueta se
    // disparan SOLO on-demand vía el workflow `andreani-generate-tickets`
    // (botón "Generar etiqueta" / bulk en el admin). Así hay un único camino
    // de creación y se evita el doble envío que ocurriría si tanto este método
    // como el workflow le pegaran a Andreani.
    //
    // Acá solo registramos la intención: el fulfillment nativo de Medusa queda
    // creado (la orden pasa a "fulfilled") con un tracking placeholder. El job
    // de sync ignora los tracking que empiezan con "PENDING".
    const placeholderTracking = `PENDING-${order.display_id ?? order.id}`;

    // El contrato que se estampa acá tiene que ser el de LA TIENDA, no el de la
    // instancia. Es informativo (el envío real lo crea el workflow), pero es lo que
    // el widget del admin muestra: dejar el de la instancia hace que el operador de
    // la tienda B lea el contrato de la A y crea que despachó mal —o peor, que no lo
    // note cuando de verdad despachó mal—.
    const { options, contractOverrides } = await this.contextForChannel(order);
    const contract = resolveContractForService(serviceType, options.contract, contractOverrides);

    this.logger_.info(
      `Andreani fulfillment registrado (stub, sin envío real): order=${
        order.display_id ?? order.id
      }. La etiqueta se genera on-demand desde el admin.`
    );

    return {
      data: {
        tracking_number: placeholderTracking,
        service_type: serviceType,
        contract,
        label_url: '',
        status: 'pending_label',
        created_at: new Date().toISOString(),
        fulfillment_id: fulfillment.id ?? null,
      },
      labels: [],
    };
  }

  async cancelFulfillment(data: Record<string, unknown>): Promise<unknown> {
    const trackingNumber = this.str(data, 'tracking_number');
    // Andreani exposes no shipment-cancellation endpoint; cancellation must be
    // arranged through Andreani customer service. We acknowledge here.
    this.logger_.info(
      `Andreani cancelFulfillment acknowledged (no remote cancel API): ${
        trackingNumber ?? '(no tracking)'
      }`
    );
    return {
      success: true,
      tracking_number: trackingNumber,
      message:
        'Andreani has no cancellation API. Contact Andreani customer service to cancel the physical shipment.',
    };
  }

  async createReturnFulfillment(
    fulfillment: Record<string, unknown>
  ): Promise<CreateFulfillmentResult> {
    // Stub: Andreani return shipments are not automated in this boilerplate.
    const originalTracking = this.str(fulfillment, 'tracking_number');
    this.logger_.info(
      `Andreani createReturnFulfillment stub invoked for tracking=${
        originalTracking ?? '(unknown)'
      }`
    );
    return {
      data: {
        ...((fulfillment.data as object) || {}),
        return_requested: true,
        original_tracking_number: originalTracking ?? null,
        return_instructions:
          'Contact Andreani customer service to arrange return pickup.',
      },
      labels: [],
    };
  }

  async getFulfillmentDocuments(
    _data: Record<string, unknown>
  ): Promise<never[]> {
    // Labels are returned at creation time via the `labels` array.
    return [];
  }

  async getReturnDocuments(_data: Record<string, unknown>): Promise<never[]> {
    return [];
  }

  async getShipmentDocuments(_data: Record<string, unknown>): Promise<never[]> {
    return [];
  }

  // --- helpers ---

  private resolveServiceType(
    optionData: Record<string, unknown> | undefined,
    data: Record<string, unknown>
  ): AndreaniServiceType {
    const direct =
      this.str(data, 'service_type') ??
      this.nestedStr(data, ['metadata', 'service_type']) ??
      (optionData ? this.str(optionData, 'service_type') : undefined);

    if (this.isServiceType(direct)) {
      return direct;
    }

    const optionId =
      this.str(data, 'id') ??
      (optionData ? this.str(optionData, 'id') : undefined);
    if (optionId && optionId in SERVICE_TYPE_BY_OPTION_ID) {
      return SERVICE_TYPE_BY_OPTION_ID[optionId] as AndreaniServiceType;
    }

    return 'Domicilio';
  }

  private resolvePickupLocationId(
    data: Record<string, unknown>
  ): string | undefined {
    return (
      this.str(data, 'pickup_location_id') ??
      this.str(data, 'pickup_branch_id') ??
      this.str(data, 'andreani_hop_point_id') ??
      this.nestedStr(data, ['metadata', 'pickup_location_id'])
    );
  }

  private isServiceType(value: unknown): value is AndreaniServiceType {
    return (
      value === 'Domicilio' || value === 'Sucursal' || value === 'PuntoDeTercero'
    );
  }

  private str(
    source: Record<string, unknown> | undefined,
    key: string
  ): string | undefined {
    if (!source) {
      return undefined;
    }
    const value = source[key];
    if (typeof value !== 'string') {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private nestedStr(
    source: Record<string, unknown> | undefined,
    path: string[]
  ): string | undefined {
    let current: unknown = source;
    for (const key of path) {
      if (typeof current !== 'object' || current === null) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[key];
    }
    if (typeof current !== 'string') {
      return undefined;
    }
    const trimmed = current.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private num(
    source: Record<string, unknown> | undefined,
    key: string
  ): number | undefined {
    if (!source) {
      return undefined;
    }
    const value = source[key];
    if (typeof value === 'number' && !Number.isNaN(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
  }
}

export default AndreaniFulfillmentProviderService;
