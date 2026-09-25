import { copyrightLine, storeDisplayName, subjectWithStore } from './email-helpers';
import type { EmailTemplateFunction, EmailTemplateResult } from './types';

export type OrderTransferRequestData = {
  link_vinculacion: string;
  display_id?: number | string;
  order_date?: string;
  /** Sólo cuando la solicitud pidió cambiar el email de la orden. */
  claiming_email?: string;
  logo_url?: string;
  cde_display_name?: string;
  sales_channel_name?: string;
  primary_color?: string;
};

/**
 * "Alguien quiere vincular este pedido a una cuenta" (DESDEELSUR-61).
 *
 * Lo manda `subscribers/order-transfer-requested-email.ts` al email DE LA ORDEN
 * cuando alguien aprieta "Vincular a mi cuenta" sobre una compra hecha como
 * invitado.
 *
 * El texto es deliberadamente el de una CONFIRMACIÓN y no el de un aviso: este
 * mail es el único candado entre "registré una cuenta con el mail de otra
 * persona" y "me quedé con su pedido". Por eso dice qué pasa si no fuiste vos, y
 * por eso no se puede reescribir como un "listo, ya lo vinculamos".
 */
export const orderTransferRequestTemplate: EmailTemplateFunction<OrderTransferRequestData> = (
  data,
): EmailTemplateResult => {
  const cdeDisplayName = storeDisplayName(data);
  const logoUrl = data.logo_url || '';
  const primaryColor = data.primary_color || '#2e7d32';
  const orderLabel = data.display_id ? `#${data.display_id}` : '';
  const subject = orderLabel ? `Vincular el pedido ${orderLabel} a una cuenta` : 'Vincular tu pedido a una cuenta';
  const year = new Date().getFullYear();

  // Sin logo y sin nombre de tienda, la cabecera se omite: un título de 24px
  // vacío deja un hueco, pero inventar una marca manda la de otro cliente.
  const brandHeader = logoUrl
    ? `<img src="${logoUrl}" alt="${cdeDisplayName}" width="200" style="display: block; margin: 0 auto; -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none;">`
    : cdeDisplayName
      ? `<div style="font-size: 24px; font-weight: 700; color: ${primaryColor};">${cdeDisplayName}</div>`
      : '';

  const orderDate = (() => {
    if (!data.order_date) return '';
    const date = new Date(data.order_date);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
  })();

  const meta = [orderLabel ? `Pedido ${orderLabel}` : '', orderDate].filter(Boolean).join(' · ');

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
                    <tr>
                        <td style="padding: 40px 40px 20px 40px; text-align: center; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            ${brandHeader}
                        </td>
                    </tr>

                    <!-- Contenido -->
                    <tr>
                        <td style="padding: 20px 40px 32px 40px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 700; color: #111111;">Vincular tu pedido a una cuenta</h1>
                            <p style="margin: 0 0 16px; font-size: 18px; font-weight: 600; color: #111111;">Esta compra se hizo sin iniciar sesión${data.claiming_email ? ` y se pidió vincularla a la cuenta de ${data.claiming_email}` : ''}.</p>
                            ${meta ? `<p style="margin: 0 0 16px; font-size: 14px; color: #555555;">${meta}</p>` : ''}
                            <p style="margin: 0 0 28px; font-size: 14px; color: #555555;">Si fuiste vos, confirmá con el botón y el pedido va a aparecer en "Mis pedidos", con su seguimiento y su comprobante.</p>

                            ${data.link_vinculacion ? `
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td style="border-radius: 6px; background-color: ${primaryColor}; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        <a href="${data.link_vinculacion}" style="display: inline-block; padding: 12px 28px; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; border-radius: 6px; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">Confirmar la vinculación</a>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin: 20px 0 0; font-size: 12px; color: #666666;">O copiá este enlace en tu navegador:<br><a href="${data.link_vinculacion}" style="color: ${primaryColor}; word-break: break-all; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">${data.link_vinculacion}</a></p>
                            ` : `<p style="color: #cc0000;">Enlace de vinculación no disponible.</p>`}

                            <p style="margin: 24px 0 0; font-size: 14px; color: #666666;">Si no fuiste vos, ignorá este correo: sin esta confirmación el pedido no se vincula a ninguna cuenta y sigue siendo tuyo.</p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 20px; background-color: ${primaryColor}; text-align: center; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <p style="margin: 0; color: #ffffff; font-size: 12px;">${copyrightLine(year, cdeDisplayName)}</p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>`.trim();

  return {
    subject: subjectWithStore(subject, data),
    html,
  };
};
