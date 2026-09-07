import { AbstractPaymentProvider, MedusaError } from '@medusajs/framework/utils';
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
import { COMPANY_MODULE } from '../company';
import type CompanyModuleService from '../company/service';
import { COMPANY_CREDIT_MODULE } from '../company-credit';
import type CompanyCreditModuleService from '../company-credit/service';

type InjectedDependencies = {
  logger: Logger;
};

/**
 * Medio de pago "Cuenta Corriente" (crédito comercial B2B).
 *
 * Registrado con id "cuenta_corriente" → provider_id completo
 * `pp_cuenta_corriente_cuenta_corriente`.
 *
 * No procesa ningún cobro real: valida que la empresa del comprador tenga cuenta
 * ACTIVA y crédito suficiente, y deja la orden "autorizada". El movimiento de
 * COMPRA (que sube el saldo utilizado) lo crea el subscriber de `order.placed`
 * (idempotente por order_id), no este provider.
 *
 * La validación cruza módulos (company + company_credit) resolviéndolos del
 * container. Es best-effort defensivo: si por aislamiento de módulos no se
 * pudiera resolver, loguea y deja pasar — el gate primario de disponibilidad
 * vive en el storefront/checkout + la API de store.
 */
class CuentaCorrienteProviderService extends AbstractPaymentProvider {
  static identifier = 'cuenta_corriente';

  protected logger_: Logger;
  protected container_: InjectedDependencies & {
    resolve: (key: string) => unknown;
  };

  constructor(container: InjectedDependencies, options: unknown) {
    super(container, options as Record<string, unknown>);
    this.logger_ = container.logger;
    this.container_ = container as InjectedDependencies & {
      resolve: (key: string) => unknown;
    };
  }

  /**
   * Resuelve la cuenta corriente de la empresa a la que pertenece un customer.
   * Devuelve null si no hay customer, membership o cuenta — o si la resolución
   * cruzada de módulos no está disponible (degradación silenciosa).
   */
  private async resolveAccountForCustomer(
    customerId: string | null | undefined,
  ): Promise<{
    account: Awaited<ReturnType<CompanyCreditModuleService['getAccountByCompany']>>;
    creditService: CompanyCreditModuleService;
  } | null> {
    if (!customerId) return null;
    try {
      const companyService = this.container_.resolve(
        COMPANY_MODULE,
      ) as CompanyModuleService;
      const creditService = this.container_.resolve(
        COMPANY_CREDIT_MODULE,
      ) as CompanyCreditModuleService;

      const membership = await companyService.getMembershipByCustomer(customerId);
      if (!membership) return null;
      const account = await creditService.getAccountByCompany(membership.company_id);
      if (!account) return null;
      return { account, creditService };
    } catch (err) {
      this.logger_.warn(
        `[cuenta_corriente] No se pudo resolver la cuenta del customer ${customerId}: ${
          err instanceof Error ? err.message : String(err)
        }. Se omite la validación dura (gate en storefront).`,
      );
      return null;
    }
  }

  private customerIdFromContext(
    input: InitiatePaymentInput | AuthorizePaymentInput,
  ): string | null {
    const ctx = (input as { context?: Record<string, any> }).context ?? {};
    return (
      (ctx.customer?.id as string | undefined) ??
      (ctx.account_holder?.data?.id as string | undefined) ??
      ((input.data as Record<string, any> | undefined)?.customer_id as
        | string
        | undefined) ??
      null
    );
  }

  /**
   * Valida que la cuenta esté activa y con crédito suficiente para `amount`.
   * Lanza MedusaError con el motivo si falla. No-op si no se pudo resolver.
   */
  private async assertCanCharge(
    customerId: string | null,
    amount: number,
  ): Promise<Record<string, unknown>> {
    const resolved = await this.resolveAccountForCustomer(customerId);
    if (!resolved || !resolved.account) return {};

    const { account, creditService } = resolved;
    if (account.status !== 'active') {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        'La cuenta corriente de la empresa no está activa.',
      );
    }
    if (!creditService.canCharge(account, amount)) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        'El crédito disponible de la empresa no alcanza para esta compra.',
      );
    }
    return { company_id: account.company_id, account_id: account.id };
  }

  static validateOptions(): void {
    // Sin opciones: es un medio interno, no requiere credenciales.
  }

  async initiatePayment(
    input: InitiatePaymentInput,
  ): Promise<InitiatePaymentOutput> {
    const amount =
      typeof input.amount === 'number' ? input.amount : Number(input.amount);
    const customerId = this.customerIdFromContext(input);
    const extra = await this.assertCanCharge(customerId, amount);

    return {
      // No hay id externo: usamos un marcador estable.
      id: 'cuenta_corriente',
      data: {
        ...(input.data ?? {}),
        ...extra,
        amount,
        currency_code: input.currency_code,
      },
    };
  }

  async authorizePayment(
    input: AuthorizePaymentInput,
  ): Promise<AuthorizePaymentOutput> {
    // Guarda dura en server: si el crédito no alcanza o la cuenta no está
    // activa, esto lanza y la orden no se completa.
    const amount = Number((input.data as Record<string, any>)?.amount ?? 0);
    const customerId = this.customerIdFromContext(input);
    if (amount > 0) {
      await this.assertCanCharge(customerId, amount);
    }
    return {
      data: { ...(input.data ?? {}) },
      status: 'authorized',
    };
  }

  async capturePayment(
    input: CapturePaymentInput,
  ): Promise<CapturePaymentOutput> {
    // No se procesa cobro: solo marcamos capturado para cerrar el flujo.
    return { data: { ...(input.data ?? {}), status: 'captured' } };
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    return { data: { ...(input.data ?? {}), status: 'cancelled' } };
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return { data: { ...(input.data ?? {}) } };
  }

  async getPaymentStatus(
    _input: GetPaymentStatusInput,
  ): Promise<GetPaymentStatusOutput> {
    return { status: 'authorized' };
  }

  async retrievePayment(
    input: RetrievePaymentInput,
  ): Promise<RetrievePaymentOutput> {
    return { ...(input.data ?? {}) };
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    return { data: { ...(input.data ?? {}) } };
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    // Los reversos reales se registran como nota de crédito manual desde el
    // backoffice (fuera de MVP a nivel provider).
    return { data: { ...(input.data ?? {}) } };
  }

  async getWebhookActionAndData(
    _payload: ProviderWebhookPayload['payload'],
  ): Promise<WebhookActionResult> {
    // Medio interno sin webhooks.
    return { action: 'not_supported' };
  }
}

export default CuentaCorrienteProviderService;
