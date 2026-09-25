import { copyrightLine, storeDisplayName } from './email-helpers';
import type { EmailTemplateFunction, EmailTemplateResult } from './types';

export type OrderInvoiceData = {
  display_id?: string | number;
  customer_name?: string | null;
  /** Etiqueta del comprobante ya armada, p.ej. "Factura B 0001-00012345". */
  invoice_label?: string | null;
  invoice_date?: string | null;
  /**
   * URL de descarga en el storefront (Mi cuenta → pedido).
   *
   * Es un LINK y no un adjunto porque el provider de email de este repo no
   * soporta adjuntos: `modules/email/service.ts` sólo hace
   * `sgMail.send({ subject, html })` o `{ templateId, dynamicTemplateData }`.
   * Además el link es mejor: la descarga pasa por un proxy autenticado que
   * verifica que el pedido sea del cliente, así que un mail reenviado no filtra
   * el comprobante.
   */
  invoice_url?: string | null;
  primary_color?: string;
  logo_url?: string | null;
  [key: string]: unknown;
};

/** Aviso al cliente de que el comprobante de su compra ya está disponible. */
export const orderInvoiceTemplate: EmailTemplateFunction<OrderInvoiceData> = (
  data,
): EmailTemplateResult => {
  const displayId = data.display_id ?? '';
  const name = (data.customer_name ?? '').toString().trim();
  const label = (data.invoice_label ?? '').toString().trim();
  const date = (data.invoice_date ?? '').toString().trim();
  const url = (data.invoice_url ?? '').toString().trim();
  const primary = (data.primary_color as string | undefined) || '#2e7d32';
  const logo = data.logo_url || '';
  const year = new Date().getFullYear();
  const storeName = storeDisplayName(data);

  // La marca estaba escrita a mano acá: sin logo, el mail encabezaba con el
  // nombre de otra empresa. Sin tienda conocida la cabecera se OMITE.
  const brandHeader = logo
    ? `<img src="${logo}" alt="${storeName}" width="180" style="display:block;margin:0 auto;border:0;">`
    : storeName
      ? `<div style="font-size:22px;font-weight:700;color:${primary};">${storeName}</div>`
      : '';

  const html = `
<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Tu comprobante está listo</title></head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:Arial,sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f5f5f5;">
    <tr><td style="padding:24px 0;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="600" style="margin:auto;background-color:#ffffff;max-width:600px;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:32px 32px 8px 32px;text-align:center;">
          ${brandHeader}
        </td></tr>
        <tr><td style="padding:8px 32px;text-align:center;">
          <h1 style="margin:0;font-size:22px;color:#333;">Tu comprobante ya está disponible</h1>
        </td></tr>
        <tr><td style="padding:8px 32px 8px 32px;color:#444;font-size:15px;line-height:1.6;">
          <p style="margin:0 0 12px 0;">${name ? `Hola ${name}, ` : ''}emitimos el comprobante de tu pedido <strong>#${displayId}</strong>.</p>
          ${label ? `<p style="margin:0 0 4px 0;"><strong>${label}</strong></p>` : ''}
          ${date ? `<p style="margin:0 0 12px 0;color:#666;">Fecha: ${date}</p>` : ''}
        </td></tr>
        ${
          url
            ? `<tr><td style="padding:8px 32px 24px 32px;text-align:center;">
          <a href="${url}" style="display:inline-block;padding:12px 24px;background-color:${primary};color:#ffffff;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;">Descargar comprobante</a>
          <p style="margin:12px 0 0 0;color:#666;font-size:13px;">También lo encontrás en Mi cuenta → Pedidos.</p>
        </td></tr>`
            : `<tr><td style="padding:8px 32px 24px 32px;color:#444;font-size:15px;line-height:1.6;">
          <p style="margin:0;">Lo podés descargar desde Mi cuenta → Pedidos.</p>
        </td></tr>`
        }
        <tr><td style="padding:16px 32px;background-color:${primary};text-align:center;color:#fff;font-size:12px;">${copyrightLine(year, storeName)}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`.trim();

  const subject = label
    ? `${label} — pedido #${displayId}`
    : `Tu comprobante del pedido #${displayId}`;
  return { subject, html };
};
