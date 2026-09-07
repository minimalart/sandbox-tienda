import type { EmailTemplateFunction, EmailTemplateResult } from './types';
import type { OrderItemForEmail } from './order-notification-admin';
import { formatLineTotalForEmail, hexToRgba } from './email-helpers';

export type QuotationRejectedAdminData = {
  order_id?: string;
  display_id?: string | number;
  custom_display_id?: string;
  total?: string | number;
  customer_email?: string;
  sales_channel_id?: string;
  sales_channel_name?: string;
  logo_url?: string;
  cde_display_name?: string;
  order_date_formatted?: string;
  order_items?: OrderItemForEmail[];
  subtotal_formatted?: string;
  shipping_formatted?: string;
  tax_formatted?: string;
  discounts?: Array<{label: string; amount_formatted: string; makes_free?: boolean}>;
  discount_total_formatted?: string;
  /** Razón del rechazo (opcional) */
  rejection_reason?: string;
  primary_color?: string;
  [key: string]: unknown;
};

function fmt(value: string | number | undefined): string {
  if (value === undefined || value === null) return '—';
  return String(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Plantilla para notificación de cotización rechazada.
 * Mensaje: "La cotización fue rechazada" con resumen de la cotización.
 */
export const quotationRejectedAdminTemplate: EmailTemplateFunction<QuotationRejectedAdminData> = (
  data
): EmailTemplateResult => {
  const displayId = data.custom_display_id ?? data.display_id ?? data.order_id ?? '';
  const total = fmt(data.total);
  const channelName = data.sales_channel_name || data.sales_channel_id || '';
  const logoUrl = data.logo_url || '';
  const cdeDisplayName = (data.cde_display_name || channelName || 'CDE').trim();
  const orderDate = data.order_date_formatted || '';
  const items = Array.isArray(data.order_items) ? data.order_items : [];
  const subtotal = data.subtotal_formatted ?? total;
  const discounts = Array.isArray(data.discounts)
    ? data.discounts.filter((d) => d && d.amount_formatted && d.amount_formatted !== '—' && d.amount_formatted !== '0')
    : [];
  const hasDiscounts = discounts.length > 0;
  const shipping = data.shipping_formatted ?? '—';
  const rejectionReason = (data.rejection_reason || '').trim();
  const primaryColor = (data.primary_color as string | undefined) || '#2e7d32';
  const primaryColorBg = hexToRgba(primaryColor, 0.1);

  const subject = 'La cotización fue rechazada';
  const titleMain = 'La cotización fue rechazada';
  const titleSub = 'La cotización no fue aceptada. Detalles a continuación.';

  const year = new Date().getFullYear();

  const itemsRows = items
    .map(
      (item) => `
                    <tr>
                        <td style="padding: 0 40px 20px 40px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8f9fa; border-radius: 8px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td style="padding: 15px; width: 80px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        ${item.thumbnail ? `<img src="${item.thumbnail}" alt="${fmt(item.title)}" width="80" style="display: block; border-radius: 4px; -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none;">` : ''}
                                    </td>
                                    <td style="padding: 15px; vertical-align: middle; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        <p style="margin: 0 0 5px 0; font-size: 16px; color: #333333; font-weight: bold;">${fmt(item.title)}</p>
                                        <p style="margin: 0; font-size: 14px; color: #666666;">${fmt(item.quantity)} x $ ${fmt(item.unit_price_formatted ?? item.unit_price)}</p>
                                    </td>
                                    <td style="padding: 15px; text-align: right; vertical-align: middle; font-size: 16px; color: #333333; font-weight: bold; white-space: nowrap; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        ${formatLineTotalForEmail(item.line_total_formatted ?? item.unit_price_formatted ?? item.unit_price)}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>`
    )
    .join('');

  const hasItems = itemsRows.length > 0;

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; width: 100%; font-family: 'Inter', Arial, sans-serif;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5; font-family: 'Inter', Arial, sans-serif; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
        <tr>
            <td style="padding: 20px 0; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="600" style="margin: auto; background-color: #ffffff; max-width: 600px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">

                    <!-- Logo -->
                    <tr>
                        <td style="padding: 40px 20px 20px 20px; text-align: center; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            ${logoUrl ? `<img src="${logoUrl}" alt="${cdeDisplayName}" width="200" style="display: block; margin: 0 auto; -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none;">` : `<div style="font-size: 24px; font-weight: 700; color: ${primaryColor};">${cdeDisplayName}</div>`}
                        </td>
                    </tr>

                    <!-- Título -->
                    <tr>
                        <td style="padding: 20px 20px 10px 20px; text-align: center; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <h1 style="margin: 0; font-size: 28px; color: #333333; font-weight: bold;">${titleMain}</h1>
                        </td>
                    </tr>

                    <!-- Subtítulo -->
                    <tr>
                        <td style="padding: 0 20px 10px 20px; text-align: center; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <p style="margin: 0; font-size: 16px; color: #666666;">${titleSub}</p>
                        </td>
                    </tr>

                    ${rejectionReason ? `
                    <!-- Motivo del rechazo -->
                    <tr>
                        <td style="padding: 10px 40px 30px 40px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #fff3f3; border-left: 3px solid #cc0000; border-radius: 4px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td style="padding: 12px 16px; font-size: 14px; color: #555555; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        <strong style="color: #cc0000;">Motivo:</strong> ${rejectionReason}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    ` : `<tr><td style="padding: 0 20px 30px 20px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;"></td></tr>`}

                    <!-- Cotización y Fecha -->
                    <tr>
                        <td style="padding: 20px 40px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td style="text-align: left; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        <span style="display: inline-block; padding: 10px 20px; background-color: ${primaryColorBg}; border: 1.2px solid ${primaryColor}; border-radius: 20px; color: ${primaryColor}; font-size: 14px; font-weight: bold;">Cotización #${displayId}</span>
                                    </td>
                                    ${orderDate ? `<td style="text-align: right; color: #666666; font-size: 14px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">${orderDate}</td>` : ''}
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Resumen -->
                    ${hasItems ? `
                    <tr>
                        <td style="padding: 20px 40px 10px 40px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <h2 style="margin: 0; font-size: 18px; color: ${primaryColor}; font-weight: bold;">Resumen de la cotización</h2>
                        </td>
                    </tr>
                    ${itemsRows}
                    ` : ''}

                    <!-- Subtotal y Envío -->
                    ${hasItems ? `
                    <tr>
                        <td style="padding: 0 40px 15px 40px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td style="padding: 8px 0; color: #666666; font-size: 14px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">Subtotal</td>
                                    <td style="padding: 8px 0; text-align: right; color: #666666; font-size: 14px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">$ ${subtotal}</td>
                                </tr>
                                ${hasDiscounts ? discounts.map((d) => `
                                <tr>
                                    <td style="padding: 8px 0; color: #15803d; font-size: 14px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">${escapeHtml(d.label)}</td>
                                    <td style="padding: 8px 0; text-align: right; color: #15803d; font-size: 14px; font-weight: 600; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">${d.makes_free ? 'Gratis' : `-$ ${escapeHtml(d.amount_formatted)}`}</td>
                                </tr>`).join('') : ''}
                                <tr>
                                    <td style="padding: 8px 0; color: #666666; font-size: 14px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">Envío estimado</td>
                                    <td style="padding: 8px 0; text-align: right; color: #666666; font-size: 14px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">${shipping}</td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    ` : ''}

                    <!-- Total -->
                    <tr>
                        <td style="padding: 15px 40px 30px 40px; border-top: 1px solid #EFEFEF; border-bottom: 1px solid #e0e0e0; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td style="padding: 10px 0; color: #333333; font-size: 18px; font-weight: bold; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">Total</td>
                                    <td style="padding: 10px 0; text-align: right; color: #333333; font-size: 18px; font-weight: bold; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">$ ${total}</td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 20px; background-color: ${primaryColor}; text-align: center; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <p style="margin: 0; color: #ffffff; font-size: 12px;">© ${year} ${cdeDisplayName}. Todos los derechos reservados.</p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>`.trim();

  return {
    subject: channelName ? `[${channelName}] ${subject} #${displayId}` : `[Mercatto] ${subject} #${displayId}`,
    html,
  };
};
