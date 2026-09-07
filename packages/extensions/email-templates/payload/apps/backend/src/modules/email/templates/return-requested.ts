import type { EmailTemplateFunction, EmailTemplateResult } from './types';

export type ReturnRequestedData = {
  display_id?: string | number;
  customer_name?: string | null;
  item_count?: number;
  primary_color?: string;
  logo_url?: string | null;
  [key: string]: unknown;
};

/** Confirmación al cliente de que se registró su solicitud de devolución. */
export const returnRequestedTemplate: EmailTemplateFunction<ReturnRequestedData> = (
  data,
): EmailTemplateResult => {
  const displayId = data.display_id ?? '';
  const name = (data.customer_name ?? '').toString().trim();
  const primary = (data.primary_color as string | undefined) || '#2e7d32';
  const logo = data.logo_url || '';
  const year = new Date().getFullYear();

  const html = `
<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Solicitud de devolución recibida</title></head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:Arial,sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f5f5f5;">
    <tr><td style="padding:24px 0;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="600" style="margin:auto;background-color:#ffffff;max-width:600px;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:32px 32px 8px 32px;text-align:center;">
          ${logo ? `<img src="${logo}" alt="" width="180" style="display:block;margin:0 auto;border:0;">` : `<div style="font-size:22px;font-weight:700;color:${primary};">Mercatto</div>`}
        </td></tr>
        <tr><td style="padding:8px 32px;text-align:center;">
          <h1 style="margin:0;font-size:22px;color:#333;">Recibimos tu solicitud de devolución</h1>
        </td></tr>
        <tr><td style="padding:8px 32px 24px 32px;color:#444;font-size:15px;line-height:1.6;">
          <p style="margin:0 0 12px 0;">${name ? `Hola ${name}, ` : ''}registramos tu solicitud de devolución del pedido <strong>#${displayId}</strong>.</p>
          <p style="margin:0 0 12px 0;">Nuestro equipo la va a revisar y te vamos a contactar con los próximos pasos para el envío de retorno y el reembolso.</p>
          <p style="margin:0;color:#666;">Si no fuiste vos o tenés una duda, respondé este email y te ayudamos.</p>
        </td></tr>
        <tr><td style="padding:16px 32px;background-color:${primary};text-align:center;color:#fff;font-size:12px;">© ${year} Mercatto</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`.trim();

  return { subject: `Solicitud de devolución recibida — pedido #${displayId}`, html };
};
