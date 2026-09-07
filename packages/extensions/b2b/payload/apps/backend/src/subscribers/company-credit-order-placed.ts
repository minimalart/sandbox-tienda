import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Logger } from '@medusajs/framework/types';
import { COMPANY_MODULE } from '../modules/company';
import type CompanyModuleService from '../modules/company/service';
import { COMPANY_CREDIT_MODULE } from '../modules/company-credit';
import type CompanyCreditModuleService from '../modules/company-credit/service';
import { CUENTA_CORRIENTE_PROVIDER_ID } from '../modules/company-credit-payment/constants';

type OrderGraphResult = {
  id: string;
  customer_id: string | null;
  total: number;
  currency_code: string | null;
  payment_collections?: Array<{
    payments?: Array<{ provider_id?: string | null }> | null;
  }> | null;
};

/**
 * Al colocarse una orden pagada con "Cuenta Corriente", registra el movimiento
 * de COMPRA (sube el saldo utilizado de la empresa). Idempotente por order_id:
 * si ya hay una compra para esa orden, no la duplica ante re-emits de order.placed.
 */
export default async function handleCompanyCreditOrderPlaced({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const orderId = event.data.id;
  if (!orderId) return;

  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve<{
    graph: (input: unknown) => Promise<{ data: unknown[] }>;
  }>(ContainerRegistrationKeys.QUERY);

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const loadOrder = async (): Promise<OrderGraphResult | undefined> => {
    const { data } = (await query.graph({
      entity: 'order',
      fields: [
        'id',
        'customer_id',
        'total',
        'currency_code',
        'payment_collections.payments.provider_id',
      ],
      filters: { id: orderId },
    })) as { data: OrderGraphResult[] };
    return data[0];
  };
  const providersOf = (order?: OrderGraphResult): string[] =>
    (order?.payment_collections ?? [])
      .flatMap((pc) => pc.payments ?? [])
      .map((p) => p.provider_id)
      .filter(Boolean) as string[];

  // El link order → payment_collection puede no estar commiteado todavía cuando
  // se emite `order.placed` (se crea en un paso posterior de completeCartWorkflow).
  // Reintentar unas pocas veces evita el falso "no hay pagos" que dejaba la compra
  // sin registrar. Idempotente: si al final no aparece, no hacemos nada.
  let order = await loadOrder();
  if (!order || !order.customer_id) return;

  let providerIds = providersOf(order);
  for (let attempt = 0; attempt < 5 && providerIds.length === 0; attempt++) {
    await sleep(500);
    order = await loadOrder();
    providerIds = providersOf(order);
  }

  // Solo si la orden se pagó con Cuenta Corriente. `customer_id` se revalida acá
  // (el loop de reintentos reasigna `order`, así que el guard inicial no alcanza
  // para estrecharlo a no-null).
  if (!order || !order.customer_id || !providerIds.includes(CUENTA_CORRIENTE_PROVIDER_ID))
    return;

  const amount = Number(order.total) || 0;
  if (amount <= 0) return;

  try {
    const companyService = container.resolve<CompanyModuleService>(COMPANY_MODULE);
    const creditService =
      container.resolve<CompanyCreditModuleService>(COMPANY_CREDIT_MODULE);

    const membership = await companyService.getMembershipByCustomer(order.customer_id);
    if (!membership) {
      logger.warn(
        `[cuenta_corriente] Orden ${order.id} pagó con cuenta corriente pero el customer ${order.customer_id} no pertenece a ninguna empresa.`,
      );
      return;
    }

    const account = await creditService.getAccountByCompany(membership.company_id);
    if (!account) {
      logger.warn(
        `[cuenta_corriente] Empresa ${membership.company_id} sin cuenta corriente; no se registra la compra de la orden ${order.id}.`,
      );
      return;
    }

    // Idempotencia: no duplicar la compra si ya existe para esta orden.
    const existing = await creditService.listCompanyCreditTransactions({
      order_id: order.id,
      type: 'compra',
    });
    if (existing.length > 0) return;

    await creditService.applyTransaction({
      accountId: account.id,
      type: 'compra',
      amount,
      order_id: order.id,
      created_by: 'system',
      notes: `Compra — orden ${order.id}`,
    });
    logger.info(
      `[cuenta_corriente] Compra ${amount} registrada para empresa ${membership.company_id} (orden ${order.id}).`,
    );
  } catch (error) {
    logger.error(
      `[cuenta_corriente] Falló registrar la compra de la orden ${order.id}: ${
        (error as Error).message
      }`,
    );
  }
}

export const config: SubscriberConfig = {
  event: 'order.placed',
};
