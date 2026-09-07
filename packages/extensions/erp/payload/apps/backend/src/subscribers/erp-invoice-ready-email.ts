import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import type { Logger } from '@medusajs/framework/types';
import { ERP_INVOICE_READY } from '../modules/erp/outbox/invoice-fetch';

/**
 * URL pública del storefront, con la misma precedencia que
 * `modules/seo-geo/lib/storefront-url.ts` y que
 * `GET /admin/store-config/storefront-url`.
 *
 * Se repite acá en vez de importarse a propósito, y no es pereza: el composer
 * atribuye cada subscriber a la extensión cuyos módulos importa, y un archivo
 * con DOS dueños (`erp` y `seo-geo`) se saltea EN SILENCIO — el subscriber
 * desaparecería del payload de la extensión y en un proyecto nuevo el cliente no
 * recibiría nunca el aviso del comprobante, sin ningún error que lo delate. Es
 * el mismo criterio que ya documenta `resolveSiteStorefrontUrl` para su literal
 * de ruta.
 */
const isLocal = (url: string): boolean =>
  /\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/i.test(url);
const isNonStorefront = (url: string): boolean => /medusajs\.com/i.test(url);

function resolveStorefrontUrl(): string {
  const origins = (process.env.STORE_CORS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const publicOrigins = origins.filter((origin) => !isLocal(origin) && !isNonStorefront(origin));
  const fromCors =
    publicOrigins.find((origin) => origin.startsWith('https://')) ||
    publicOrigins[0] ||
    origins[0];
  const raw =
    process.env.STOREFRONT_URL?.trim() ||
    process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
    fromCors ||
    'http://localhost:3000';
  return raw.replace(/\/+$/, '');
}

/**
 * Avisa al cliente que su comprobante ya está disponible.
 *
 * Se dispara con `erp.invoice_ready`, que emite el poll del comprobante cuando
 * el ERP terminó de facturar. No se puede colgar de `order.placed` ni del
 * fulfillment: en ese momento el comprobante todavía no existe.
 *
 * Manda un LINK, no un adjunto. El provider de email del repo
 * (`modules/email/service.ts`) sólo hace `sgMail.send({ subject, html })` o con
 * `templateId`: no soporta `attachments`. Y el link es preferible igual — la
 * descarga pasa por un proxy que verifica que el pedido sea del cliente
 * autenticado, así que un mail reenviado no filtra el comprobante.
 *
 * NUNCA lanza: un fallo de mail no puede afectar la facturación, que ya ocurrió.
 */
export default async function erpInvoiceReadyEmailHandler({
  event,
  container,
}: SubscriberArgs<{
  order_id?: string;
  numero_comp?: number | null;
  tipo_comp?: string | null;
  letra?: string | null;
  has_pdf?: boolean;
}>): Promise<void> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  try {
    const orderId = event.data?.order_id;
    if (!orderId) return;

    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const { data: orders } = (await query.graph({
      entity: 'order',
      fields: ['id', 'display_id', 'email', 'customer.first_name', 'customer.last_name'],
      filters: { id: orderId },
    })) as {
      data: Array<{
        id: string;
        display_id?: number | null;
        email?: string | null;
        customer?: { first_name?: string | null; last_name?: string | null } | null;
      }>;
    };
    const order = orders[0];
    if (!order?.email) {
      logger.warn(`[erp] comprobante de la orden ${orderId}: la orden no tiene email, no se avisa.`);
      return;
    }

    const label = [event.data.tipo_comp, event.data.letra, event.data.numero_comp]
      .filter((part) => part !== null && part !== undefined && part !== '')
      .join(' ');
    const customerName = [order.customer?.first_name, order.customer?.last_name]
      .filter(Boolean)
      .join(' ')
      .trim();

    // Sólo se ofrece el link si hay PDF: mandar a una descarga que va a dar 404
    // es peor que no mandar link. El template cae a "lo encontrás en Mi cuenta".
    const invoiceUrl = event.data.has_pdf
      ? `${resolveStorefrontUrl()}/account/orders/details/${order.id}`
      : null;

    const notificationService = container.resolve(Modules.NOTIFICATION);
    await notificationService.createNotifications({
      to: order.email,
      channel: 'email',
      template: 'order-invoice',
      data: {
        order_id: order.id,
        display_id: order.display_id ?? undefined,
        customer_name: customerName || undefined,
        invoice_label: label || null,
        invoice_url: invoiceUrl,
      },
    });
  } catch (error) {
    logger.warn(
      `[erp] no se pudo avisar el comprobante por email (no afecta la facturación): ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export const config: SubscriberConfig = {
  event: ERP_INVOICE_READY,
};
