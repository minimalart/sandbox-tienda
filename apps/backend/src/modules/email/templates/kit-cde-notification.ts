import type { EmailTemplateFunction, EmailTemplateResult } from './types';

const MERCATTO_COLOR = '#2e7d32';
const MERCATTO_COLOR_BG = 'rgba(46,125,50,0.1)';

export interface KitCdeNotificationData {
  order_display_id?: string | number;
  order_date_formatted?: string;
  customer_name?: string;
  customer_email?: string;
  cde_name?: string;
  order_total_formatted?: string;
  order_items?: Array<{
    title: string;
    variant_title?: string;
    quantity: number;
    unit_price_formatted?: string;
    line_total_formatted?: string;
    thumbnail?: string;
  }>;
  pickup_url?: string;
  delivery_pin?: number | string | null;
  [key: string]: unknown;
}

export const kitCdeNotificationTemplate: EmailTemplateFunction<KitCdeNotificationData> = (
  data
): EmailTemplateResult => {
  const displayId = data.order_display_id ?? '—';
  const date = data.order_date_formatted ?? '';
  const customerName = data.customer_name ?? '—';
  const customerEmail = data.customer_email ?? '—';
  const cdeName = data.cde_name ?? 'Centro de distribución';
  const total = data.order_total_formatted ?? '—';
  const pickupUrl = data.pickup_url ?? '';
  const deliveryPinRaw = data.delivery_pin;
  const deliveryPin =
    deliveryPinRaw !== null && deliveryPinRaw !== undefined && String(deliveryPinRaw).trim() !== ''
      ? String(deliveryPinRaw)
      : '';
  const year = new Date().getFullYear();
  const bucketBase = (process.env.S3_PUBLIC_URL || '').replace(/\/$/, '');
  const mercattoLogoUrl = bucketBase ? `${bucketBase}/cde-logos/mercatto.png` : '';

  const itemsRows = (data.order_items ?? [])
    .map(
      (item) => `
                    <tr>
                        <td style="padding: 0 32px 12px 32px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8f9fa; border-radius: 8px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td style="padding: 15px; width: 80px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        ${item.thumbnail ? `<img src="${item.thumbnail}" alt="${item.title}" width="80" style="display: block; border-radius: 4px; -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none;">` : ''}
                                    </td>
                                    <td style="padding: 15px; vertical-align: middle; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        <p style="margin: 0 0 5px 0; font-size: 16px; color: #333333; font-weight: bold;">${item.title}</p>
                                        <p style="margin: 0; font-size: 14px; color: #666666;">${item.quantity} x $ ${item.unit_price_formatted ?? item.line_total_formatted ?? '—'}</p>
                                    </td>
                                    <td style="padding: 15px; text-align: right; vertical-align: middle; font-size: 16px; color: #333333; font-weight: bold; white-space: nowrap; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        $ ${item.line_total_formatted ?? '—'}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>`
    )
    .join('');

  const subject = `Nuevo pedido para preparar — Kit #${displayId}`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${subject}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; width: 100%; font-family: 'Inter', Arial, sans-serif;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5; font-family: 'Inter', Arial, sans-serif; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
        <tr>
            <td style="padding: 20px 0; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="600" style="margin: auto; background-color: #ffffff; max-width: 600px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">

                    <!-- Logo -->
                    ${mercattoLogoUrl ? `
                    <tr>
                        <td style="padding: 30px 20px 20px 20px; text-align: center; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <img src="${mercattoLogoUrl}" alt="Mercatto" width="180" style="display: block; margin: 0 auto; -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none;">
                        </td>
                    </tr>` : ''}

                    <!-- Header -->
                    <tr>
                        <td style="padding: 28px 32px; background-color: ${MERCATTO_COLOR}; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700;">📦 Nuevo kit para preparar</h1>
                            <p style="margin: 6px 0 0; color: rgba(255,255,255,0.75); font-size: 14px;">${cdeName}</p>
                        </td>
                    </tr>

                    <!-- Fecha y Número de pedido -->
                    <tr>
                        <td style="padding: 28px 32px 0 32px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            ${date ? `<p style="margin: 0 0 8px; font-size: 14px; color: #555555;">Fecha del pedido: <strong style="color: #333333;">${date}</strong></p>` : ''}
                            <p style="margin: 0 0 24px; font-size: 14px; color: #555555;">
                                Número de pedido:
                                <span style="display: inline-block; margin-left: 6px; padding: 4px 14px; background-color: ${MERCATTO_COLOR_BG}; border: 1.2px solid ${MERCATTO_COLOR}; border-radius: 20px; color: ${MERCATTO_COLOR}; font-size: 13px; font-weight: 700;">#${displayId}</span>
                            </p>
                        </td>
                    </tr>

                    <!-- Bloque Cliente -->
                    <tr>
                        <td style="padding: 0 32px 24px 32px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${MERCATTO_COLOR_BG}; border-left: 4px solid ${MERCATTO_COLOR}; border-radius: 4px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td style="padding: 14px 18px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        <p style="margin: 0 0 4px; font-size: 13px; font-weight: 700; color: ${MERCATTO_COLOR};">Cliente</p>
                                        <p style="margin: 0 0 2px; font-size: 14px; color: #111111;">${customerName}</p>
                                        <p style="margin: 0; font-size: 13px;"><a href="mailto:${customerEmail}" style="color: ${MERCATTO_COLOR}; text-decoration: none; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">${customerEmail}</a></p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Productos a preparar - título -->
                    <tr>
                        <td style="padding: 0 32px 12px 32px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <h2 style="margin: 0; font-size: 16px; font-weight: 700; color: ${MERCATTO_COLOR};">Productos a preparar</h2>
                        </td>
                    </tr>
                    ${itemsRows}

                    <!-- Total -->
                    <tr>
                        <td style="padding: 8px 32px 24px 32px; text-align: right; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <p style="margin: 0; font-size: 15px; font-weight: 700; color: #111111;">Total: $ ${total}</p>
                        </td>
                    </tr>

                    ${pickupUrl ? `
                    <!-- Validación de entrega -->
                    <tr>
                        <td style="padding: 0 32px 28px 32px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f0fdf4; border-left: 4px solid #16a34a; border-radius: 4px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td style="padding: 16px 20px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        <p style="margin: 0 0 6px; font-size: 13px; font-weight: 700; color: #15803d;">Validación de entrega</p>
                                        <p style="margin: 0 0 12px; font-size: 13px; color: #374151;">Cuando el cliente venga a retirar, usá este enlace para confirmar la entrega:</p>
                                        <a href="${pickupUrl}" style="display: inline-block; background-color: #16a34a; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; padding: 10px 20px; border-radius: 6px; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">Validar entrega →</a>
                                        ${deliveryPin ? `
                                        <p style="margin: 14px 0 6px; font-size: 13px; color: #374151;">Ingresá este PIN para confirmar la entrega:</p>
                                        <p style="margin: 0; font-size: 22px; font-weight: 700; color: #15803d; letter-spacing: 4px; font-family: 'Inter', Arial, sans-serif;">${deliveryPin}</p>` : ''}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>` : ''}

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 20px; background-color: ${MERCATTO_COLOR}; text-align: center; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <p style="margin: 0; color: #ffffff; font-size: 12px;">© ${year} Mercatto. Todos los derechos reservados.</p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>`.trim();

  return { subject, html };
};
