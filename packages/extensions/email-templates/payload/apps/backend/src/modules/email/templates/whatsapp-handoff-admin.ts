import { copyrightLine, storeDisplayName } from './email-helpers';
import type { EmailTemplateFunction, EmailTemplateResult } from './types';

export type WhatsappHandoffAdminData = {
  phone?: string;
  customer_name?: string | null;
  reason?: string | null;
  /** Resumen comercial (carrito en armado + último mensaje del cliente). */
  summary?: string | null;
  inbox_url?: string | null;
  [key: string]: unknown;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Aviso al staff de que el bot de WhatsApp derivó una conversación a atención
 * humana. Mensaje simple y accionable: quién, por qué y dónde responder (Inbox de
 * Kapso). El bot queda en pausa para ese teléfono hasta que se resuelva.
 */
export const whatsappHandoffAdminTemplate: EmailTemplateFunction<WhatsappHandoffAdminData> = (
  data,
): EmailTemplateResult => {
  const phone = escapeHtml(String(data.phone ?? '—'));
  const name = data.customer_name ? escapeHtml(String(data.customer_name)) : null;
  const reason = data.reason ? escapeHtml(String(data.reason)) : 'No especificado';
  const summaryHtml = data.summary
    ? escapeHtml(String(data.summary)).replace(/\n/g, '<br>')
    : null;
  const inboxUrl = typeof data.inbox_url === 'string' ? data.inbox_url : null;
  const year = new Date().getFullYear();
  const storeName = storeDisplayName(data);

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Atención humana solicitada</title></head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:Arial,sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f5f5f5;">
    <tr><td style="padding:24px 0;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="600" style="margin:auto;background-color:#ffffff;max-width:600px;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:24px 32px 8px 32px;">
          <h1 style="margin:0;font-size:20px;color:#25D366;">💬 Un cliente necesita atención humana</h1>
        </td></tr>
        <tr><td style="padding:8px 32px 24px 32px;color:#333;font-size:15px;line-height:1.6;">
          <p style="margin:0 0 12px 0;">El bot de WhatsApp no pudo resolver una consulta y la derivó al equipo. El bot quedó <strong>en pausa</strong> para este contacto hasta que la resuelvas.</p>
          <p style="margin:0 0 6px 0;"><strong>Cliente:</strong> ${name ?? '(sin nombre)'}</p>
          <p style="margin:0 0 6px 0;"><strong>Teléfono:</strong> ${phone}</p>
          <p style="margin:0 0 16px 0;"><strong>Motivo:</strong> ${reason}</p>
          ${summaryHtml ? `<div style="margin:0 0 16px 0;padding:12px 16px;background-color:#f8f9fa;border-radius:6px;color:#444;font-size:14px;line-height:1.5;">${summaryHtml}</div>` : ''}
          ${inboxUrl ? `<p style="margin:0;"><a href="${inboxUrl}" style="display:inline-block;background-color:#25D366;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-weight:bold;">Responder en el Inbox</a></p>` : `<p style="margin:0;color:#666;">Respondé desde el Inbox de WhatsApp en el backoffice.</p>`}
        </td></tr>
        <tr><td style="padding:16px 32px;background-color:#f8f9fa;text-align:center;color:#999;font-size:12px;">${copyrightLine(year, storeName)}</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

  return {
    subject: `💬 Atención humana WhatsApp — ${phone}`,
    html,
  };
};
