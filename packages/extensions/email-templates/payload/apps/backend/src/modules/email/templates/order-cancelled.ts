import type { EmailTemplateFunction, EmailTemplateResult } from './types';

export type OrderCancelledData = {
  order_id?: string;
  display_id?: string | number;
  custom_display_id?: string;
  customer_name?: string;
  sales_channel_id?: string;
  sales_channel_name?: string;
  logo_url?: string;
  cde_display_name?: string;
  order_date_formatted?: string;
  primary_color?: string;
  [key: string]: unknown;
};

const ALERT_RED = '#D92D20';

export const orderCancelledTemplate: EmailTemplateFunction<OrderCancelledData> = (
  data
): EmailTemplateResult => {
  const displayId = data.custom_display_id ?? data.display_id ?? data.order_id ?? '';
  const channelName = data.sales_channel_name || data.sales_channel_id || '';
  const logoUrl = data.logo_url || '';
  const cdeDisplayName = (data.cde_display_name || channelName || 'Mercatto').trim();
  const orderDate = data.order_date_formatted || '';
  const primaryColor = (data.primary_color as string | undefined) || '#2e7d32';
  const customerName = (data.customer_name || '').trim();
  const year = new Date().getFullYear();

  const subjectBase = `Tu pedido fue cancelado #${displayId}`;

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subjectBase}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;width:100%;font-family:'Inter',Arial,sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f5f5f5;font-family:'Inter',Arial,sans-serif;">
    <tr>
      <td style="padding:20px 0;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="600" style="margin:auto;background-color:#ffffff;max-width:600px;">
          <tr>
            <td style="padding:40px 20px 20px 20px;text-align:center;">
              ${logoUrl
                ? `<img src="${logoUrl}" alt="${cdeDisplayName}" width="200" style="display:block;margin:0 auto;border:0;height:auto;">`
                : `<div style="font-size:24px;font-weight:700;color:${primaryColor};">${cdeDisplayName}</div>`}
            </td>
          </tr>
          <tr>
            <td style="padding:10px 20px 6px 20px;text-align:center;">
              <h1 style="margin:0;font-size:28px;color:${ALERT_RED};font-weight:700;">${customerName ? `Tu pedido fue cancelado, ${customerName}` : 'Tu pedido fue cancelado'}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:0 20px 28px 20px;text-align:center;">
              <p style="margin:0;font-size:15px;color:#667085;">Si necesitás ayuda, escribinos y te asistimos con lo que necesites.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 30px 40px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#fff5f5;border:1px solid #fecaca;border-radius:12px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <p style="margin:0 0 6px 0;color:#1D2530;font-size:14px;"><strong>Pedido #${displayId}</strong></p>
                    ${orderDate ? `<p style="margin:0;color:#667085;font-size:13px;">Fecha: ${orderDate}</p>` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px;background-color:${primaryColor};text-align:center;">
              <p style="margin:0;color:#ffffff;font-size:12px;">© ${year} ${cdeDisplayName}. Todos los derechos reservados.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  return {
    subject: channelName ? `[${channelName}] ${subjectBase}` : `[Mercatto] ${subjectBase}`,
    html,
  };
};
