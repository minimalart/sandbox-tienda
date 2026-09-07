import type { MedusaContainer } from '@medusajs/framework/types';
import { getKapsoSettings } from '../kapso-whatsapp/settings';
import { RECURRING_ORDER_MODULE } from './types';
import type RecurringOrderModuleService from './service';
import { buildManageUrl, frequencyLabel, fullName } from './lib';

export type SubscriptionCommunicationTemplate =
  | 'recurring-order-created'
  | 'recurring-order-paused'
  | 'recurring-order-resumed'
  | 'recurring-order-skipped'
  | 'recurring-order-cancelled'
  | 'recurring-order-generated'
  | 'recurring-order-updated';

const whatsappTemplateEnabled = (
  template: SubscriptionCommunicationTemplate,
): boolean => {
  const templates = getKapsoSettings().templates;
  const value = {
    'recurring-order-created': templates.recurringOrderCreated,
    'recurring-order-paused': templates.recurringOrderPaused,
    'recurring-order-resumed': templates.recurringOrderResumed,
    'recurring-order-skipped': templates.recurringOrderSkipped,
    'recurring-order-cancelled': templates.recurringOrderCancelled,
    'recurring-order-generated': templates.recurringOrderGenerated,
    'recurring-order-updated': templates.recurringOrderUpdated,
  }[template];
  return Boolean(value);
};

/** Encola comunicaciones V2; no almacena datos sensibles ni duplica eventos. */
export async function enqueueSubscriptionCommunication(
  container: MedusaContainer,
  recurringOrder: any,
  template: SubscriptionCommunicationTemplate,
  data: Record<string, unknown> = {},
  dedupeSuffix: string = template,
): Promise<void> {
  if (!recurringOrder.plan_id) return;
  const service = container.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
  const address = recurringOrder.shipping_address ?? {};
  const payload = {
    sales_channel_id: recurringOrder.sales_channel_id ?? undefined,
    recurring_order_id: recurringOrder.id,
    customer_name: fullName(address.first_name, address.last_name) || undefined,
    frequency_label: frequencyLabel(
      recurringOrder.frequency_interval,
      recurringOrder.frequency_count,
    ),
    next_execution:
      recurringOrder.next_billing_at ?? recurringOrder.next_execution_at ?? undefined,
    manage_url: buildManageUrl(recurringOrder.country_code),
    ...data,
  };
  try {
    if (recurringOrder.email) {
      await service.enqueueNotification({
        dedupe_key: `${dedupeSuffix}:email:${recurringOrder.id}`,
        recurring_order_id: recurringOrder.id,
        sales_channel_id: recurringOrder.sales_channel_id,
        channel: 'email',
        recipient: recurringOrder.email,
        template,
        data: payload,
      });
    }
    const hasConsent = Boolean(
      (recurringOrder.metadata as { whatsapp_consent?: boolean } | null)?.whatsapp_consent,
    );
    if (
      hasConsent &&
      recurringOrder.phone &&
      whatsappTemplateEnabled(template)
    ) {
      await service.enqueueNotification({
      dedupe_key: `${dedupeSuffix}:whatsapp:${recurringOrder.id}`,
      recurring_order_id: recurringOrder.id,
      sales_channel_id: recurringOrder.sales_channel_id,
      channel: 'whatsapp',
      recipient: recurringOrder.phone,
      template,
      data: payload,
      });
    }
  } catch (error) {
    try {
      await service.upsertAlert({
        dedupe_key: `notification-enqueue:${dedupeSuffix}:${recurringOrder.id}`,
        sales_channel_id: recurringOrder.sales_channel_id,
        recurring_order_id: recurringOrder.id,
        type: 'notification',
        severity: 'warning',
        title: 'No se pudo encolar una comunicación de suscripción',
        message: (error as Error).message,
        data: { template, detected_at: new Date().toISOString() },
      });
    } catch {
      // La comunicación nunca revierte la operación comercial que la originó.
    }
  }
}
