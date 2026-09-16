import { siteStorefrontUrl, storefrontOrigins } from '../../lib/multistore/public-url';
import { safeReturnBase } from './return-base';
import {
  readMercadoPagoSetting,
  isMercadoPagoCheckoutEnabled,
} from '../app-settings/mercadopago-runtime';
import {
  AbstractPaymentProvider,
  BigNumber,
  ContainerRegistrationKeys,
  MedusaError,
} from '@medusajs/framework/utils';
import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  Logger,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from '@medusajs/framework/types';
import { MercadoPagoConfig, Payment, PaymentRefund, Preference } from 'mercadopago';
import {
  mapMpPaymentToAction,
  mapMpPaymentToSessionStatus,
  type MpPaymentLike,
} from './utils/status-mapper';
import { verifyMpWebhookSignature } from './utils/webhook-verifier';
import { parseMpAccounts, resolveMpAccount, type MpAccount } from './utils/accounts';
import { resolveSiteViaSql } from '../../lib/multistore/resolve-site-sql';

/**
 * Options injected from `medusa-config.ts` (sourced from env vars).
 *
 * This is the SIMPLIFIED, single-tenant port: credentials live in the provider
 * options instead of an encrypted per-sales-channel DB table.
 */
export type MercadoPagoOptions = {
  /** MP private access token (MERCADOPAGO_ACCESS_TOKEN). Required — global fallback. */
  accessToken: string;
  /** MP webhook HMAC secret (MERCADOPAGO_WEBHOOK_SECRET). Optional but strongly recommended. */
  webhookSecret?: string;
  /** MP public key (MERCADOPAGO_PUBLIC_KEY). Optional, only needed for client-side bricks. */
  publicKey?: string;
  /** Backend base URL — used to build the webhook notification_url (MEDUSA_BACKEND_URL). */
  backendUrl?: string;
  /** Storefront base URL — used to build the Checkout Pro back_urls (STOREFRONT_URL). */
  storefrontUrl?: string;
  /** Optional statement descriptor shown on the customer's MP receipt. */
  statementDescriptor?: string;
  /**
   * Per-branch MP accounts as a JSON map (MERCADOPAGO_ACCOUNTS), keyed by branch
   * code (or sales_channel_id). When a payment carries a branch code/sales
   * channel that matches a key, that account collects; otherwise the global
   * accessToken above is used. See utils/accounts.ts.
   */
  accounts?: string;
};

type InjectedDependencies = {
  logger: Logger;
  /**
   * La conexión cruda. Es la ÚNICA vía: un provider de pago recibe un container
   * aislado y no puede `resolve()` el módulo de tiendas. Mismo motivo por el que
   * andreani, correo-argentino y kapso leen por SQL.
   */
  [ContainerRegistrationKeys.PG_CONNECTION]?: unknown;
};

/**
 * MercadoPago Checkout Pro payment provider.
 *
 * Registered with id "mercadopago", so the full Medusa provider_id becomes
 * `pp_mercadopago_mercadopago` (the storefront keys off this).
 *
 * Flow overview:
 *  - initiatePayment creates a Checkout Pro Preference and returns its
 *    `init_point` (the redirect URL) + the preference id on the session data.
 *  - The storefront redirects the buyer to `data.init_point`.
 *  - MP fires an IPN webhook to `notification_url`; the custom route in
 *    `src/api/mercado-pago/route.ts` fetches the real payment, maps its status
 *    and authorizes/captures the Medusa payment session.
 *
 * Note on Checkout Pro: the id we store at initiate time is the PREFERENCE id,
 * NOT a payment id. The real payment only exists once the buyer checks out at
 * MP, and is found via `external_reference` (the cart id).
 */
class MercadoPagoProviderService extends AbstractPaymentProvider<MercadoPagoOptions> {
  static identifier = 'mercadopago';

  protected logger_: Logger;
  protected options_: MercadoPagoOptions;
  protected get client_(): MercadoPagoConfig {
    return new MercadoPagoConfig({
      accessToken:
        readMercadoPagoSetting('MERCADOPAGO_ACCESS_TOKEN') ||
        this.options_.accessToken ||
        parseMpAccounts(readMercadoPagoSetting('MERCADOPAGO_ACCOUNTS') || this.options_.accounts)
          .values()
          .next().value?.accessToken ||
        '',
    });
  }
  /** Per-branch accounts (keyed by branch code / sales_channel_id). */
  protected accounts_: Map<string, MpAccount>;
  /** Global fallback account (single-tenant behaviour). */
  protected fallbackAccount_: MpAccount;
  protected pgConnection_?: Parameters<typeof resolveSiteViaSql>[0];

  constructor(container: InjectedDependencies, options: MercadoPagoOptions) {
    super(container, options);
    this.logger_ = container.logger;
    this.options_ = options;
    this.accounts_ = parseMpAccounts(options.accounts);
    this.pgConnection_ = container[ContainerRegistrationKeys.PG_CONNECTION] as
      | Parameters<typeof resolveSiteViaSql>[0]
      | undefined;
    this.fallbackAccount_ = {
      accessToken: options.accessToken,
      webhookSecret: options.webhookSecret,
      publicKey: options.publicKey,
    };
  }

  /**
   * Resolves the MP account for a payment from the branch code / sales channel
   * stamped on the session data, falling back to the global account.
   */
  getAccount(opts: {
    branchCode?: string | null;
    siteId?: string | null;
    siteSlug?: string | null;
    salesChannelId?: string | null;
  }): MpAccount {
    return resolveMpAccount(
      parseMpAccounts(readMercadoPagoSetting('MERCADOPAGO_ACCOUNTS') || this.options_.accounts),
      {
        accessToken:
          readMercadoPagoSetting('MERCADOPAGO_ACCESS_TOKEN') || this.options_.accessToken || '',
        publicKey: readMercadoPagoSetting('MERCADOPAGO_PUBLIC_KEY') || this.options_.publicKey,
        webhookSecret:
          readMercadoPagoSetting('MERCADOPAGO_WEBHOOK_SECRET') || this.options_.webhookSecret,
      },
      opts
    );
  }

  /** Como `clientForData`, pero con las claves ya resueltas. */
  private getClientFor(opts: {
    branchCode?: string | null;
    siteId?: string | null;
    siteSlug?: string | null;
    salesChannelId?: string | null;
  }): MercadoPagoConfig {
    const account = this.getAccount(opts);
    return new MercadoPagoConfig({ accessToken: account.accessToken });
  }

  private clientForData(data?: Record<string, unknown> | null): MercadoPagoConfig {
    const account = this.getAccount({
      branchCode: (data?.branch_code as string | undefined) ?? null,
      siteId: (data?.site_id as string | undefined) ?? null,
      siteSlug: (data?.site_slug as string | undefined) ?? null,
      salesChannelId: (data?.sales_channel_id as string | undefined) ?? null,
    });
    // Reuse the global client when the resolved token matches (avoids re-instantiation).
    return new MercadoPagoConfig({ accessToken: account.accessToken });
  }

  static validateOptions(_options: Record<string, unknown>): void {
    // Credentials are configured after boot through the admin.
  }

  /**
   * Builds the Checkout Pro back_urls from the storefront URL. MP appends
   * `collection_status`, `external_reference`, `payment_id`, etc. as query
   * params — the storefront /checkout/success page reads those to route the
   * buyer to success / pending / failure while the webhook does the real work.
   *
   * `returnBase` lo manda el storefront (`data.return_base`) y trae el prefijo
   * del SITIO activo (`https://host/tienda/<slug>`). Sin él, un comprador que
   * pagó dentro de una tienda volvía siempre a `https://host/checkout/success`
   * — o sea, al sitio PRINCIPAL: se salía de su tienda y la sesión sólo se
   * sostenía de casualidad, por la cookie `_site_slug`. En el sitio principal
   * el prefijo es vacío y no había nada que perder, que es por lo que el bug
   * sólo se veía en las tiendas.
   */
  private getBackUrls(
    returnBase?: string | null,
    allowed: string[] = []
  ): { success: string; failure: string; pending: string } | undefined {
    const base = allowed[0] ?? this.options_.storefrontUrl?.replace(/\/$/, '');
    if (!base) {
      return undefined;
    }
    const fallback = allowed[0] ?? base;
    const target = safeReturnBase(fallback, returnBase, allowed.length ? allowed : [base]);
    return {
      success: `${target}/checkout/success`,
      failure: `${target}/checkout/failure`,
      pending: `${target}/checkout/pending`,
    };
  }

  /**
   * Acepta la base de retorno del storefront SÓLO si cuelga del storefront
   * configurado. Es un valor que viaja por el cliente y termina en un redirect
   * de MercadoPago: sin este guard sería un open redirect.
   */
  /**
   * Builds the IPN notification_url pointing at our custom webhook route. When
   * the payment belongs to a branch, the branch code (and sales channel) are
   * appended so the webhook can pick the matching account's credentials BEFORE
   * fetching the payment / verifying the signature.
   *
   * REVIENTA si no hay `backendUrl`, y esto NO es defensa de más: en Checkout
   * Pro el webhook es lo ÚNICO que convierte el carrito en orden (la vuelta del
   * browser a /checkout/success es sólo UX y no llama a placeOrder a propósito,
   * para que la orden exista aunque el comprador cierre la pestaña). Una
   * preferencia sin `notification_url` no es "una preferencia con una feature
   * menos": es un cobro que MercadoPago aprueba y del que Medusa nunca se
   * entera. Plata cobrada sin orden, de forma determinística, en TODAS las
   * compras — no en un caso raro.
   *
   * Antes esto devolvía `undefined` y `initiatePayment` lo esquivaba con un
   * spread condicional, así que la única señal era un `logger.info` con
   * `notification_url=(none)` mezclado entre los demás logs. Precedente real:
   * un deploy con las MERCADOPAGO_* cargadas pero sin BACKEND_URL cobró y dejó
   * al comprador con "Tu pago fue aprobado pero la confirmación está tardando".
   * Es preferible que el checkout no arranque a que arranque, cobre y pierda la
   * orden: lo primero se ve en el primer intento, lo segundo se descubre con un
   * cliente enojado.
   */
  private getNotificationUrl(keys?: {
    branchCode?: string | null;
    salesChannelId?: string | null;
  }): string {
    const base = this.options_.backendUrl?.replace(/\/$/, '');
    if (!base) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        'MercadoPago: falta la URL del backend (MEDUSA_BACKEND_URL o BACKEND_URL), ' +
          'así que la preferencia se crearía sin notification_url y el webhook —único ' +
          'camino que convierte el carrito en orden— nunca se dispararía: el pago se ' +
          'cobraría y la orden no existiría. Configurá MEDUSA_BACKEND_URL con la URL ' +
          'pública del backend y volvé a intentar.'
      );
    }
    const params = new URLSearchParams();
    if (keys?.branchCode) params.set('branch', keys.branchCode);
    if (keys?.salesChannelId) params.set('sc', keys.salesChannelId);
    const qs = params.toString();
    return qs ? `${base}/mercado-pago?${qs}` : `${base}/mercado-pago`;
  }

  /**
   * Creates a MercadoPago Checkout Pro Preference and returns its init_point +
   * preference id on the session data.
   *
   * Medusa v2 does NOT pass cart line items to the provider, so we create a
   * single line item representing the order total (required by MP).
   */
  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    if (!isMercadoPagoCheckoutEnabled())
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, 'Checkout Pro está desactivado.');
    const amount = typeof input.amount === 'number' ? input.amount : Number(input.amount);

    // cart_id is used as external_reference so the webhook can link the MP
    // payment back to the Medusa cart. The storefront passes it on the session
    // data when initiating the payment session.
    const cartId =
      (input.data?.cart_id as string | undefined) ??
      (input.data?.external_reference as string | undefined) ??
      '';

    // Branch routing keys (passed by the storefront on the session data). Used
    // to pick the collecting MP account and to route the webhook back.
    const branchCode = (input.data?.branch_code as string | undefined) ?? null;
    const salesChannelId = (input.data?.sales_channel_id as string | undefined) ?? null;

    /**
     * La tienda: la que mande el storefront, o la derivada del canal.
     *
     * Se deriva acá —en `initiatePayment`, que es async— y NO en `getAccount`, que
     * es síncrono y está sobre el camino del cobro. El resultado se estampa en la
     * data de la sesión, así el webhook y el refund resuelven la MISMA cuenta sin
     * volver a consultar.
     *
     * Un fallo de lectura NO corta el checkout: a diferencia de las credenciales
     * cifradas, acá el peor caso es cobrar con la cuenta global, que es lo que se
     * venía haciendo. Cortar el pago sería peor que el problema.
     */
    let siteId = (input.data?.site_id as string | undefined) ?? null;
    let siteSlug = (input.data?.site_slug as string | undefined) ?? null;
    if (!siteId && !siteSlug && salesChannelId) {
      try {
        const resolution = await resolveSiteViaSql(this.pgConnection_, { salesChannelId });
        if (resolution.status === 'site') {
          siteId = resolution.site.id;
          siteSlug = resolution.site.slug;
        }
      } catch (error) {
        this.logger_.warn(
          `MercadoPago: no se pudo resolver la tienda del canal ${salesChannelId}. Se usa la cuenta global. ${(error as Error).message}`
        );
      }
    }

    const client = this.getClientFor({ branchCode, siteId, siteSlug, salesChannelId });

    const items = [
      {
        id: '1',
        title: 'Pedido',
        description: 'Total del pedido',
        quantity: 1,
        unit_price: Math.round(amount * 100) / 100,
        currency_id: input.currency_code.toUpperCase(),
      },
    ];

    // Base de retorno con el prefijo del sitio activo (ver getBackUrls).
    const returnBase = (input.data?.return_base as string | undefined) ?? null;

    const allowedReturnBases: string[] = [];
    // Resolve the registered store from the cart/channel, never trust an arbitrary host.
    let returnChannel = salesChannelId;
    if (cartId && this.pgConnection_) {
      const cartRows = await this.pgConnection_.raw('SELECT "sales_channel_id" FROM "cart" WHERE "id" = ? AND "deleted_at" IS NULL LIMIT 1', [cartId]);
      returnChannel = cartRows?.rows?.[0]?.sales_channel_id ?? null;
      if (!returnChannel) throw new MedusaError(MedusaError.Types.INVALID_DATA, 'No se pudo resolver el carrito del pago.');
    }
    const returnSite = await resolveSiteViaSql(this.pgConnection_, { salesChannelId: returnChannel, allowMainFallback: true });
    if (returnSite.status === 'site' || returnSite.status === 'singleSite') {
      const origins = storefrontOrigins(this.options_.storefrontUrl);
      const site = returnSite.site;
      allowedReturnBases.push(siteStorefrontUrl(site, origins.base));
      // The supported path form stays valid: preserve host-only session cookies.
      if (!site.is_main) {
        allowedReturnBases.push(`${origins.base}/tienda/${site.slug}`, `${origins.sitesBase}/tienda/${site.slug}`);
        if (origins.hostSuffix) allowedReturnBases.push(siteStorefrontUrl({ ...site, canonical_form: 'host' }, origins.base));
      }
    } else if (returnSite.status === 'unknownSite') {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, 'La tienda del pago no existe.');
    }
    const backUrls = this.getBackUrls(returnBase, allowedReturnBases);
    const notificationUrl = this.getNotificationUrl({ branchCode, salesChannelId });

    this.logger_.info(
      `MercadoPago initiatePayment | amount=${amount} | currency=${input.currency_code} | cart_id=${cartId || '(none)'} | branch=${branchCode ?? '(global)'} | notification_url=${notificationUrl} | back_url=${backUrls?.success ?? '(none)'}`
    );

    const preference = new Preference(client);
    const preferenceResponse = await preference.create({
      body: {
        items,
        external_reference: cartId,
        ...(backUrls ? { back_urls: backUrls, auto_return: 'approved' } : {}),
        // Sin spread condicional: `getNotificationUrl` ya garantizó que existe.
        // Un spread acá volvería a hacer opcional lo único que crea la orden.
        notification_url: notificationUrl,
        ...(this.options_.statementDescriptor
          ? { statement_descriptor: this.options_.statementDescriptor }
          : {}),
        metadata: {
          cart_id: cartId,
          ...(branchCode ? { branch_code: branchCode } : {}),
          ...(siteId ? { site_id: siteId } : {}),
          ...(siteSlug ? { site_slug: siteSlug } : {}),
          ...(salesChannelId ? { sales_channel_id: salesChannelId } : {}),
        },
      },
    });

    return {
      id: preferenceResponse.id as string,
      data: {
        id: preferenceResponse.id,
        // The storefront redirects the buyer to this URL.
        init_point: preferenceResponse.init_point,
        // Persisted so getPaymentStatus / refundPayment can look up the real MP
        // payment by external_reference, and re-resolve the collecting account.
        cart_id: cartId,
        ...(branchCode ? { branch_code: branchCode } : {}),
        // Sin esto el refund y el webhook re-resuelven la cuenta SIN la tienda y
        // caen al fallback global: se devolvería plata desde la cuenta equivocada.
        ...(siteId ? { site_id: siteId } : {}),
        ...(siteSlug ? { site_slug: siteSlug } : {}),
        ...(salesChannelId ? { sales_channel_id: salesChannelId } : {}),
      },
    };
  }

  /**
   * MercadoPago Checkout Pro payments are captured by MP itself. We just mark
   * the session authorized and preserve the existing data so downstream methods
   * keep access to `cart_id` / `init_point`.
   */
  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    return {
      data: { ...(input.data ?? {}) },
      status: 'authorized',
    };
  }

  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    return {
      data: { ...(input.data ?? {}), status: 'captured' },
    };
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    const externalId = input.data?.id as string | undefined;
    if (!externalId) {
      return { data: { ...(input.data ?? {}) } };
    }
    try {
      const payment = new Payment(this.clientForData(input.data));
      await payment.cancel({ id: externalId });
    } catch (err) {
      this.logger_.warn(
        `MercadoPago cancelPayment failed for ${externalId}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    return { data: { ...(input.data ?? {}), status: 'cancelled' } };
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    await this.cancelPayment(input);
    return {};
  }

  /**
   * The id we stored is the PREFERENCE id, not a payment id, so Payment.get(id)
   * would 404. We look the real payment up via external_reference (cart_id),
   * which we set at preference-creation time.
   */
  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    const cartId =
      (input.data?.cart_id as string | undefined) ??
      (input.data?.external_reference as string | undefined);

    if (!cartId) {
      return { status: 'pending' };
    }

    try {
      const payment = new Payment(this.clientForData(input.data));
      const { results } = await payment.search({
        options: {
          external_reference: cartId,
          sort: 'date_created',
          criteria: 'desc',
        },
      });
      const latest = (results ?? [])[0] as MpPaymentLike | undefined;
      if (latest) {
        return { status: mapMpPaymentToSessionStatus(latest) };
      }
    } catch (err) {
      this.logger_.warn(
        `MercadoPago getPaymentStatus lookup failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    return { status: 'pending' };
  }

  /**
   * Refunds against the latest MP payment found by external_reference (cart_id).
   * Simplified: no reconciliation, just a best-effort refund call.
   */
  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const cartId =
      (input.data?.cart_id as string | undefined) ??
      (input.data?.external_reference as string | undefined);

    if (!cartId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        'MercadoPago refundPayment: missing cart_id/external_reference on payment data; cannot resolve the MP payment.'
      );
    }

    const amountToRefund = Number(
      (input.amount as unknown as { value?: number })?.value ?? input.amount ?? 0
    );

    const client = this.clientForData(input.data);
    const payment = new Payment(client);
    const { results } = await payment.search({
      options: {
        external_reference: cartId,
        sort: 'date_created',
        criteria: 'desc',
        range: 'date_created',
        begin_date: 'NOW-30DAYS',
        end_date: 'NOW',
      },
    });

    const mpPayment = (results ?? [])[0] as MpPaymentLike | undefined;
    if (!mpPayment?.id) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `MercadoPago refundPayment: no MP payment found for external_reference=${cartId}.`
      );
    }

    const refund = new PaymentRefund(client);
    await refund.create({
      payment_id: mpPayment.id as unknown as string,
      body: { amount: amountToRefund },
    });

    return {
      data: {
        ...(input.data ?? {}),
        last_refund: {
          mp_payment_id: mpPayment.id,
          amount: amountToRefund,
          at: new Date().toISOString(),
        },
      },
    };
  }

  async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    const externalId = input.data?.id as string | undefined;
    if (!externalId) {
      return { data: { ...(input.data ?? {}) } };
    }
    try {
      const payment = new Payment(this.clientForData(input.data));
      const paymentData = await payment.get({ id: externalId });
      return { data: { ...(paymentData as unknown as Record<string, unknown>) } };
    } catch (err) {
      this.logger_.warn(
        `MercadoPago retrievePayment failed for ${externalId}: ${err instanceof Error ? err.message : String(err)}`
      );
      return { data: { ...(input.data ?? {}) } };
    }
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    // Checkout Pro preferences are immutable once the buyer is redirected; we
    // simply echo the existing data back.
    return { data: { ...(input.data ?? {}) } };
  }

  /**
   * Called by the custom webhook route after it has fetched the full MP payment
   * object (the route owns signature verification + the MP fetch, because the
   * raw webhook body only carries `data.id`).
   *
   * The route hands us `{ session_id, mp_payment }` so we can map status -> the
   * Medusa action. Raw MP payloads without that context return not_supported.
   */
  async getWebhookActionAndData(
    payload: ProviderWebhookPayload['payload']
  ): Promise<WebhookActionResult> {
    const data = (payload?.data ?? {}) as {
      session_id?: string;
      mp_payment?: MpPaymentLike;
    };

    const mpPayment = data.mp_payment ?? null;
    const sessionId = data.session_id;

    if (!mpPayment || !sessionId) {
      return { action: 'not_supported' };
    }

    try {
      const action = mapMpPaymentToAction(mpPayment);
      if (action === 'not_supported' || action === 'pending') {
        return { action };
      }
      return {
        action,
        data: {
          session_id: sessionId,
          amount: new BigNumber(Number(mpPayment.transaction_amount) || 0),
        },
      };
    } catch (e) {
      this.logger_.error(
        `MercadoPago getWebhookActionAndData error: ${e instanceof Error ? e.message : String(e)}`
      );
      return {
        action: 'failed',
        data: {
          session_id: sessionId,
          amount: new BigNumber(Number(mpPayment.transaction_amount) || 0),
        },
      };
    }
  }

  /**
   * Exposed so the custom webhook route can verify the HMAC. Pass `secret` to
   * use a branch account's webhook secret; defaults to the global secret.
   */
  verifyWebhookSignature(params: {
    xSignature: string | undefined;
    xRequestId: string | undefined;
    dataId: string | undefined;
    secret?: string;
  }): { valid: boolean; reason?: string } {
    const { secret, ...rest } = params;
    return verifyMpWebhookSignature({
      secret: secret ?? this.options_.webhookSecret,
      ...rest,
    });
  }

  /**
   * Exposed so the custom webhook route can fetch the real MP payment. Pass
   * `accessToken` to use a branch account's token; defaults to the global one.
   */
  async fetchMpPayment(mpPaymentId: string, accessToken?: string): Promise<MpPaymentLike> {
    const client =
      accessToken && accessToken !== this.options_.accessToken
        ? new MercadoPagoConfig({ accessToken })
        : this.client_;
    const payment = new Payment(client);
    const result = await payment.get({ id: mpPaymentId });
    return result as unknown as MpPaymentLike;
  }
}

export default MercadoPagoProviderService;
