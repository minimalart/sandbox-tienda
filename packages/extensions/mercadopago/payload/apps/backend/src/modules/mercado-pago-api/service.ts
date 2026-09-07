import {
  readMercadoPagoSetting,
  isMercadoPagoCheckoutEnabled,
} from '../app-settings/mercadopago-runtime';
import {
  AbstractPaymentProvider,
  MedusaError,
  PaymentActions,
  PaymentSessionStatus,
} from '@medusajs/framework/utils';
import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  CreateAccountHolderInput,
  CreateAccountHolderOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  ListPaymentMethodsInput,
  ListPaymentMethodsOutput,
  Logger,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  SavePaymentMethodInput,
  SavePaymentMethodOutput,
  UpdateAccountHolderInput,
  UpdateAccountHolderOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from '@medusajs/framework/types';
import { MercadoPagoConfig, Customer, CustomerCard, Payment, PaymentRefund } from 'mercadopago';
import type { PaymentResponse } from 'mercadopago/dist/clients/payment/commonTypes';
import type { PaymentCreateRequest } from 'mercadopago/dist/clients/payment/create/types';
import type { CustomerRequestBody } from 'mercadopago/dist/clients/customer/commonTypes';
import type { PostStoreMercadopagoPaymentType } from '../../api/store/mercadopago/payment/validators';
import { parseMpAccounts, resolveMpAccount, type MpAccount } from '../mercado-pago/utils/accounts';
import { verifyMpWebhookSignature } from '../mercado-pago/utils/webhook-verifier';

/**
 * Options injected from `medusa-config.ts` (sourced from env vars). Shared with
 * the Express provider — the same MP account can collect via both flows.
 */
export type MercadoPagoApiOptions = {
  /** MP private access token (MERCADOPAGO_ACCESS_TOKEN). Fallback global. */
  accessToken?: string;
  /** MP webhook HMAC secret (MERCADOPAGO_WEBHOOK_SECRET). Optional but strongly recommended. */
  webhookSecret?: string;
  /** MP public key (MERCADOPAGO_PUBLIC_KEY). Optional, only the storefront Brick needs it. */
  publicKey?: string;
  /** Backend base URL — used to build the webhook notification_url (MEDUSA_BACKEND_URL). */
  backendUrl?: string;
  /** Per-branch MP accounts as a JSON map (MERCADOPAGO_ACCOUNTS). See utils/accounts.ts. */
  accounts?: string;
};

type InjectedDependencies = {
  logger: Logger;
};

/**
 * Traduce un throw del SDK de MercadoPago a (mensaje para el comprador, línea
 * de log).
 *
 * El SDK tira objetos con `message`, `status` y `cause: [{ code, description }]`.
 * Ese `cause` es lo único que dice QUÉ pasó realmente ("Invalid payment_method_id",
 * "Collector user without key enabled for QR", "invalid transaction_amount"…), y
 * es lo que se manda al log. Al comprador se le muestra un mensaje accionable —
 * nunca el texto crudo de MP, que viene en inglés y filtra internals.
 */
function describeMpError(err: unknown): { message: string; log: string } {
  const raw = err as {
    message?: string;
    status?: number;
    cause?: Array<{ code?: string | number; description?: string }> | unknown;
  };
  const causes = Array.isArray(raw?.cause) ? raw.cause : [];
  const codes = causes
    .map((c) => `${c?.code ?? '?'}: ${c?.description ?? ''}`.trim())
    .filter(Boolean);
  const log =
    [
      raw?.status ? `status=${raw.status}` : null,
      raw?.message ? `message=${raw.message}` : null,
      codes.length ? `causes=[${codes.join(' | ')}]` : null,
    ]
      .filter(Boolean)
      .join(' | ') || String(err);

  const haystack = `${raw?.message ?? ''} ${codes.join(' ')}`.toLowerCase();

  if (haystack.includes('transaction_amount')) {
    return {
      message: 'El monto no está permitido para este medio de pago. Probá con otro medio de pago.',
      log,
    };
  }
  if (haystack.includes('payment_method') || haystack.includes('payment method')) {
    return {
      message: 'Ese medio de pago no está disponible en este momento. Probá con otro.',
      log,
    };
  }
  if (
    haystack.includes('identification') ||
    haystack.includes('payer') ||
    haystack.includes('email')
  ) {
    return {
      message: 'Faltan datos del pagador o son inválidos. Revisá nombre, DNI y correo electrónico.',
      log,
    };
  }
  if (raw?.status === 401 || raw?.status === 403) {
    return {
      message:
        'No pudimos conectarnos con MercadoPago. Probá de nuevo en unos minutos o usá otro medio de pago.',
      log,
    };
  }
  return {
    message: 'No pudimos procesar el pago. Intentá nuevamente o probá con otro medio de pago.',
    log,
  };
}

/** Arguments for {@link MercadoPagoApiProviderService.createPayment}. */
export type CreateMpApiPaymentArgs = {
  paymentSessionId: string;
  payload: PostStoreMercadopagoPaymentType['paymentData'];
  deviceSessionId?: string;
  /** Routing keys resolved from the cart (pick the collecting MP account). */
  salesChannelId?: string | null;
  branchCode?: string | null;
  siteId?: string | null;
  siteSlug?: string | null;
  /** Persisted on the MP payment metadata so the webhook can link back to the cart. */
  cartId?: string | null;
};

/**
 * MercadoPago **Checkout API** payment provider (embedded / tokenized).
 *
 * Registered with id "mercadopagoapi" and `static identifier = 'mercadopagoapi'`,
 * so the full Medusa provider_id becomes `pp_mercadopagoapi_mercadopagoapi`.
 *
 * Ported from `@nicogorga/medusa-payment-mercadopago` and adapted to this repo:
 *  - Distinct provider id so it coexists with the Express (Checkout Pro) provider.
 *  - Multi-tenant credential resolution per sales channel / branch (reusing the
 *    Express module's utils/accounts.ts) instead of a single global token.
 *
 * Payment flow (unlike Express, there is NO redirect):
 *  1. Storefront tokenizes the card with the Payment Brick and POSTs the token +
 *     installments + payment_method_id to `/store/mercadopago/payment`.
 *  2. `createPayment` creates the payment in MP (external_reference = payment
 *     session id, metadata.cart_id = cart id) with the sales channel's token.
 *  3. MP fires a webhook to `/mercado-pago-api?sc=...` which completes the cart
 *     and authorizes/captures the Medusa payment session.
 */
class MercadoPagoApiProviderService extends AbstractPaymentProvider<MercadoPagoApiOptions> {
  static identifier = 'mercadopagoapi';

  protected logger_: Logger;
  protected options_: MercadoPagoApiOptions;
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

  constructor(container: InjectedDependencies, options: MercadoPagoApiOptions) {
    super(container, options);
    this.logger_ = container.logger;
    this.options_ = options;
    this.accounts_ = parseMpAccounts(options.accounts);
    this.fallbackAccount_ = {
      accessToken: options.accessToken ?? '',
      webhookSecret: options.webhookSecret,
      publicKey: options.publicKey,
    };
  }

  static validateOptions(_options: Record<string, unknown>): void {
    // Credentials are configured after boot through the admin.
  }

  /** Resolves the MP account for the given routing keys, falling back to global. */
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

  /** A MercadoPago client authenticated with the account matching the routing keys. */
  clientFor(opts: {
    branchCode?: string | null;
    siteId?: string | null;
    siteSlug?: string | null;
    salesChannelId?: string | null;
  }): MercadoPagoConfig {
    const account = this.getAccount(opts);
    if (!account.accessToken) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        'Mercado Pago no está configurado para esta tienda.'
      );
    }
    return new MercadoPagoConfig({ accessToken: account.accessToken });
  }

  private clientForData(data?: Record<string, unknown> | null): MercadoPagoConfig {
    return this.clientFor({
      branchCode: (data?.branch_code as string | undefined) ?? null,
      siteId: (data?.site_id as string | undefined) ?? null,
      siteSlug: (data?.site_slug as string | undefined) ?? null,
      salesChannelId: (data?.sales_channel_id as string | undefined) ?? null,
    });
  }

  /**
   * No MP call at initiate time — the payment is only created once the buyer
   * submits the Brick. We persist the routing keys on the session data so
   * `createPayment` (and the later authorize/capture) can pick the right account.
   */
  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    // Los cobros de suscripción nacen fuera del checkout, mediante preapproval.
    // El webhook crea una sesión Medusa que referencia ese pago ya aprobado;
    // conservar estos datos permite que completeCart lo verifique y autorice sin
    // crear un segundo cobro ni persistir un token de tarjeta.
    if (input.data?.external_recurring_payment === true) {
      return {
        id: String(input.data.id ?? ''),
        data: { ...input.data, amount: input.amount },
      };
    }
    if (!isMercadoPagoCheckoutEnabled(true))
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, 'Checkout API está desactivado.');
    return {
      id: '',
      data: {
        amount: input.amount,
        sales_channel_id: (input.data?.sales_channel_id as string | undefined) ?? null,
        branch_code: (input.data?.branch_code as string | undefined) ?? null,
        site_id: (input.data?.site_id as string | undefined) ?? null,
        site_slug: (input.data?.site_slug as string | undefined) ?? null,
      },
    };
  }

  // Overload used by Medusa when a cart is available — stamps sales_channel_id
  // from the cart so credential resolution works without the storefront resending it.
  async initiatePaymentSession(
    cart: { sales_channel_id?: string | null } | undefined,
    input: InitiatePaymentInput
  ): Promise<InitiatePaymentOutput> {
    return this.initiatePayment({
      ...input,
      data: {
        ...input.data,
        sales_channel_id:
          (input.data?.sales_channel_id as string | undefined) ?? cart?.sales_channel_id ?? null,
      },
    });
  }

  /**
   * Creates the payment in MercadoPago from the tokenized Brick payload. Called
   * from the create-payment workflow step (NOT by Medusa's core flow).
   */
  async createPayment({
    paymentSessionId,
    payload,
    deviceSessionId,
    salesChannelId,
    branchCode,
    siteId,
    siteSlug,
    cartId,
  }: CreateMpApiPaymentArgs): Promise<PaymentResponse & { error_message: string | null }> {
    if (!isMercadoPagoCheckoutEnabled(true))
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, 'Checkout API está desactivado.');
    const client = this.clientFor({ salesChannelId, branchCode, siteId, siteSlug });
    const payment = new Payment(client);

    // Mismo contrato que Checkout Pro (ver `getNotificationUrl` en
    // `../mercado-pago/service.ts`): sin `notification_url` no hay webhook, y sin
    // webhook nadie se entera del desenlace del pago. Acá el riesgo es menos
    // obvio porque `payment.create` responde sincrónicamente, así que un
    // `approved` inmediato se resuelve solo — pero `in_process` (revisión
    // manual/antifraude) y los medios offline (ticket, Rapipago) se definen
    // MINUTOS U HORAS después, y ese desenlace llega ÚNICAMENTE por webhook.
    // Sin él quedan colgados para siempre: cobrados y sin orden.
    const base = this.options_.backendUrl?.replace(/\/$/, '');
    if (!base) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        'MercadoPago Checkout API: falta la URL del backend (MEDUSA_BACKEND_URL o ' +
          'BACKEND_URL), así que el pago se crearía sin notification_url y los pagos ' +
          'que no se aprueban en el acto (in_process, ticket, Rapipago) nunca ' +
          'llegarían a ser orden. Configurá MEDUSA_BACKEND_URL con la URL pública ' +
          'del backend y volvé a intentar.'
      );
    }
    const notificationUrl = `${base}/mercado-pago-api${salesChannelId ? `?sc=${encodeURIComponent(salesChannelId)}` : ''}`;

    let paymentResponse: PaymentResponse;
    try {
      paymentResponse = await payment.create({
        body: {
          ...payload,
          external_reference: paymentSessionId,
          notification_url: notificationUrl,
          metadata: {
            ...(payload as { metadata?: Record<string, unknown> }).metadata,
            cart_id: cartId ?? null,
            sales_channel_id: salesChannelId ?? null,
            // La tienda, además del canal: el webhook y el refund re-resuelven la
            // cuenta cobradora con esto, y sin ella caen al fallback global.
            site_id: siteId ?? null,
            payment_session_id: paymentSessionId,
          },
        } as unknown as PaymentCreateRequest,
        requestOptions: {
          // Device fingerprint from the storefront's security.js (improves approval
          // rates + fraud prevention); forwarded as the X-Meli-Session-Id header.
          ...(deviceSessionId ? { meliSessionId: deviceSessionId } : {}),
          idempotencyKey: paymentSessionId,
        },
      });
    } catch (err) {
      // Un throw del SDK de MP (400/401/403: método no habilitado, monto fuera
      // de rango, credenciales de otra cuenta, datos del pagador incompletos…)
      // NO es un MedusaError, así que el error handler lo degradaba a un 500
      // con "An unknown error occurred." — el comprador veía exactamente eso en
      // el Brick y en los logs no quedaba el motivo real.
      const detail = describeMpError(err);
      this.logger_.error(
        `MercadoPago API createPayment falló | session=${paymentSessionId} | cart=${cartId ?? '(none)'} | method=${(payload as { payment_method_id?: string }).payment_method_id ?? '(none)'} | amount=${(payload as { transaction_amount?: number }).transaction_amount ?? '(none)'} | ${detail.log}`
      );
      throw new MedusaError(MedusaError.Types.PAYMENT_AUTHORIZATION_ERROR, detail.message);
    }

    const result = paymentResponse as PaymentResponse & {
      error_message: string | null;
      sales_channel_id?: string | null;
      branch_code?: string | null;
      site_id?: string | null;
      site_slug?: string | null;
    };
    result.error_message = this.sanitizeErrorMessage(paymentResponse);
    // Persist routing keys on the object saved to the session data so the later
    // authorize/capture (via clientForData) resolve the same account.
    result.sales_channel_id = salesChannelId ?? null;
    result.branch_code = branchCode ?? null;
    // Sin estas dos, authorize/capture/refund re-resuelven la cuenta sin la tienda
    // y caen al fallback global — cobrando o devolviendo desde otra cuenta.
    result.site_id = siteId ?? null;
    result.site_slug = siteSlug ?? null;
    return result;
  }

  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    const data = (input.data ?? {}) as Record<string, unknown>;
    const paymentId = data.id as string | undefined;

    // Re-fetch the payment so the status is fresh (the session data was written
    // at createPayment time and may still say pending/in_process).
    if (paymentId) {
      try {
        const payment = new Payment(this.clientForData(data));
        const fresh = await payment.get({ id: paymentId });
        return {
          data: { ...data, ...(fresh as unknown as Record<string, unknown>) },
          status: this.mapMercadoPagoStatus(fresh.status),
        };
      } catch (err) {
        this.logger_.warn(
          `MercadoPago API authorize: could not refetch payment ${paymentId}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
    return {
      data,
      status: this.mapMercadoPagoStatus(data.status as string | undefined),
    };
  }

  protected mapMercadoPagoStatus(mpStatus?: string | null): PaymentSessionStatus {
    switch (mpStatus) {
      case 'approved':
        return PaymentSessionStatus.CAPTURED;
      case 'authorized':
        return PaymentSessionStatus.AUTHORIZED;
      case 'pending':
      case 'in_process':
        return PaymentSessionStatus.PENDING;
      case 'rejected':
        return PaymentSessionStatus.ERROR;
      case 'cancelled':
      case 'refunded':
      case 'charged_back':
        return PaymentSessionStatus.CANCELED;
      default:
        return PaymentSessionStatus.PENDING;
    }
  }

  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    const data = (input.data ?? {}) as Record<string, unknown>;
    const paymentId = data.id as string | undefined;
    if (!paymentId) {
      return { data };
    }
    try {
      const paymentClient = new Payment(this.clientForData(data));
      const paymentData = await paymentClient.get({ id: paymentId });
      // Only capture if still in the authorized (manual-capture) state.
      if (paymentData.status === 'authorized') {
        const captured = await paymentClient.capture({
          id: paymentId,
          transaction_amount: paymentData.transaction_amount,
        });
        return { data: captured as unknown as Record<string, unknown> };
      }
      return { data: paymentData as unknown as Record<string, unknown> };
    } catch (error) {
      this.logger_.error(`MercadoPago API error capturing payment ${paymentId}: ${error}`);
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Failed to capture MercadoPago payment: ${error}`
      );
    }
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    const data = (input.data ?? {}) as Record<string, unknown>;
    const id = data.id as string | undefined;
    if (!id) {
      return { data };
    }
    try {
      const { status } = await this.getPaymentStatus({ data });
      const idempotencyKey = (input.context as { idempotency_key?: string } | undefined)
        ?.idempotency_key;
      switch (status) {
        case 'authorized': {
          const paymentClient = new Payment(this.clientForData(data));
          const res = await paymentClient.cancel({ id, requestOptions: { idempotencyKey } });
          return { data: res as unknown as Record<string, unknown> };
        }
        case 'captured': {
          const refundClient = new PaymentRefund(this.clientForData(data));
          const res = await refundClient.total({
            payment_id: id,
            requestOptions: { idempotencyKey },
          });
          return { data: res as unknown as Record<string, unknown> };
        }
        default:
          return { data };
      }
    } catch (error) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `An error occurred in cancelPayment: ${error}`
      );
    }
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    await this.cancelPayment(input as unknown as CancelPaymentInput);
    return {};
  }

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    const data = (input.data ?? {}) as Record<string, unknown>;
    const paymentId = data.id as string | undefined;
    if (!paymentId) {
      return { status: 'pending', data };
    }
    const payment = new Payment(this.clientForData(data));
    const paymentData = (await payment.get({ id: paymentId })) as unknown as Record<
      string,
      unknown
    >;

    switch (paymentData.status) {
      case 'authorized':
        return { status: 'authorized', data: paymentData };
      case 'approved':
        return { status: 'captured', data: paymentData };
      case 'cancelled':
      case 'refunded':
        return { status: 'canceled', data: paymentData };
      case 'rejected':
        return {
          status: 'error',
          data: {
            ...paymentData,
            error_message: this.sanitizeErrorMessage(paymentData as unknown as PaymentResponse),
          },
        };
      default:
        return { status: 'pending', data: paymentData };
    }
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const data = (input.data ?? {}) as Record<string, unknown>;
    const paymentId = String(data.id ?? '');
    if (!paymentId) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, 'No payment id found in data');
    }
    const payment = new Payment(this.clientForData(data));
    const paymentData = await payment.get({ id: paymentId });

    const refundAmount = Number(input.amount);
    const isPartial = (paymentData.transaction_amount ?? refundAmount) > refundAmount;
    const refund = new PaymentRefund(this.clientForData(data));
    const refundData = await refund.create({
      payment_id: paymentId,
      body: { amount: isPartial ? refundAmount : undefined },
    });
    return { data: refundData as unknown as Record<string, unknown> };
  }

  async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    const data = (input.data ?? {}) as Record<string, unknown>;
    const paymentId = String(data.id ?? '');
    const payment = new Payment(this.clientForData(data));
    const paymentData = await payment.get({ id: paymentId });
    return { data: paymentData as unknown as Record<string, unknown> };
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    return { data: input.data };
  }

  /**
   * Native webhook entry (`/hooks/payment/pp_mercadopagoapi_mercadopagoapi`).
   * Single-tenant fallback (uses the global client). The multi-tenant flow uses
   * the custom `/mercado-pago-api` route which resolves the account per sales
   * channel; that route is what `createPayment` sets as notification_url.
   */
  async getWebhookActionAndData(
    payload: ProviderWebhookPayload['payload']
  ): Promise<WebhookActionResult> {
    this.validateWebhookSignature(payload);
    const body = payload.data as { action?: string; data?: { id?: string } };
    const eventType = body.action;

    try {
      if (eventType === 'payment.created' || eventType === 'payment.updated') {
        const payment = new Payment(this.client_);
        const paymentData = await payment.get({ id: body.data?.id as string });
        const sessionId = paymentData.external_reference;
        if (!sessionId) {
          throw new Error('No external_reference on MercadoPago payment');
        }
        if (['authorized', 'approved'].includes(paymentData.status ?? '')) {
          return {
            action:
              paymentData.status === 'approved'
                ? PaymentActions.SUCCESSFUL
                : PaymentActions.AUTHORIZED,
            data: { session_id: sessionId, amount: paymentData.transaction_amount! },
          };
        }
      }
      return { action: PaymentActions.NOT_SUPPORTED };
    } catch (error) {
      this.logger_.error(`MercadoPago API getWebhookActionAndData error: ${error}`);
      return { action: PaymentActions.FAILED };
    }
  }

  // ----- Account holders + saved cards (MP Customers) ------------------------
  // NOTE: these use the GLOBAL client. Saved cards are tied to the fallback MP
  // account; per-sales-channel saved cards are out of scope for this port.

  async createAccountHolder(input: CreateAccountHolderInput): Promise<CreateAccountHolderOutput> {
    // If Medusa already resolved an account holder (existing, linked to the
    // customer), just echo it back — no side effects, no collision.
    const existingId = input.context.account_holder?.data?.id as string | undefined;
    if (existingId) {
      return { id: existingId };
    }

    // Otherwise: intentional no-op. Medusa's `account_holder` table has a GLOBAL
    // unique index on (provider_id, external_id). MercadoPago customers are keyed
    // by email, so two Medusa customers sharing an MP email would resolve to the
    // SAME MP customer id and collide on that index — Medusa throws
    // "Account holder ... already exists" and the payment session init fails,
    // breaking checkout. Saved cards / account holders are out of scope for this
    // port (they'd use the global MP account anyway), and the actual charge does
    // not need one, so we skip creating them. Returning an empty object makes
    // Medusa's PaymentModuleService skip the account_holder INSERT
    // (`isPresent({}) === false`), so the embedded checkout proceeds normally.
    // The typed contract requires `id`, but the runtime explicitly tolerates an
    // empty result ("can be empty when ... an account holder wasn't created").
    return {} as CreateAccountHolderOutput;
  }

  async updateAccountHolder(input: UpdateAccountHolderInput): Promise<UpdateAccountHolderOutput> {
    const { account_holder, customer, idempotency_key } = input.context;
    const accountHolderId = account_holder?.data?.id as string | undefined;
    if (!accountHolderId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        'No account holder provided while updating'
      );
    }
    if (!customer) {
      return {};
    }
    try {
      const customerClient = new Customer(this.client_);
      const body: CustomerRequestBody = {
        first_name: customer.first_name ?? undefined,
        last_name: customer.last_name ?? undefined,
        phone: customer.phone ? { number: customer.phone } : undefined,
        identification:
          (account_holder.data?.identification as CustomerRequestBody['identification']) ??
          undefined,
      };
      if (!account_holder.data?.email) {
        body.email = customer.email;
      }
      const updated = await customerClient.update({
        customerId: accountHolderId,
        body,
        requestOptions: { idempotencyKey: idempotency_key },
      });
      return { data: updated as unknown as Record<string, unknown> };
    } catch {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        'An error occurred in updateAccountHolder'
      );
    }
  }

  async savePaymentMethod(input: SavePaymentMethodInput): Promise<SavePaymentMethodOutput> {
    const accountHolderId = input.context?.account_holder?.data?.id as string | undefined;
    if (!accountHolderId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        'Account holder not set while saving a payment method'
      );
    }
    const token = (input.data as { token?: string }).token;
    const card = new CustomerCard(this.client_);
    const created = await card.create({
      customerId: accountHolderId,
      body: { token },
      requestOptions: { idempotencyKey: input.context?.idempotency_key },
    });
    return { id: created.id!, data: created as unknown as Record<string, unknown> };
  }

  async listPaymentMethods(input: ListPaymentMethodsInput): Promise<ListPaymentMethodsOutput> {
    const accountHolderId = input.context?.account_holder?.data?.id as string | undefined;
    if (!accountHolderId) {
      return [];
    }
    const cardClient = new CustomerCard(this.client_);
    const cards = await cardClient.list({ customerId: accountHolderId });
    return cards.map((method) => ({
      id: method.id!,
      data: method as unknown as Record<string, unknown>,
    }));
  }

  // ----- helpers -------------------------------------------------------------

  /** Maps an MP rejection status_detail to a user-facing Spanish message. */
  sanitizeErrorMessage(payment: PaymentResponse): string | null {
    if (payment.status !== 'rejected' || !payment.status_detail) {
      return null;
    }
    switch (payment.status_detail) {
      case 'cc_rejected_bad_filled_card_number':
        return 'Número de tarjeta incorrecto.';
      case 'cc_rejected_bad_filled_date':
        return 'Fecha de expiración incorrecta.';
      case 'cc_rejected_bad_filled_security_code':
        return 'Código de seguridad incorrecto.';
      case 'cc_rejected_insufficient_amount':
      case 'insufficient_amount':
        return 'Saldo insuficiente.';
      case 'cc_rejected_max_attempts':
        return 'Superaste el máximo de intentos, probá con otra tarjeta.';
      case 'rejected_by_bank':
        return 'Tu banco rechazó el pago.';
      default:
        return 'No pudimos procesar el pago, intentá nuevamente o probá con otra tarjeta.';
    }
  }

  /** Exposes the resolved public key for a sales channel (used by the storefront Brick). */
  getPublicKey(opts: {
    branchCode?: string | null;
    salesChannelId?: string | null;
  }): string | undefined {
    return this.getAccount(opts).publicKey;
  }

  /** Verifies the HMAC of a native-route webhook using the global secret. */
  protected validateWebhookSignature(payload: ProviderWebhookPayload['payload']): void {
    const headers = payload.headers ?? {};
    const body = payload.data as { data?: { id?: string } };
    const check = verifyMpWebhookSignature({
      secret: this.options_.webhookSecret,
      xSignature: headers['x-signature'] as string | undefined,
      xRequestId: headers['x-request-id'] as string | undefined,
      dataId: body.data?.id ? String(body.data.id) : undefined,
    });
    if (!check.valid && check.reason !== 'no_secret_configured') {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Invalid MercadoPago signature');
    }
  }
}

export default MercadoPagoApiProviderService;
