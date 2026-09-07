import type { EmailTemplateFunction, EmailTemplateResult } from './types';

export type OrderConfirmationData = {
  order_id?: string;
  display_id?: string;
  custom_display_id?: string;
  total?: string;
  customer_email?: string;
  [key: string]: unknown;
};

export const orderConfirmationTemplate: EmailTemplateFunction<OrderConfirmationData> = (
  data
): EmailTemplateResult => {
  const displayId = data.custom_display_id ?? data.display_id ?? data.order_id ?? '';
  return {
    subject: `Confirmación de pedido ${displayId}`,
    html: data.order_id
      ? `<p>Gracias por tu pedido. Nº de pedido: ${displayId}. Total: ${data.total ?? 'N/A'}.</p>`
      : '',
  };
};
