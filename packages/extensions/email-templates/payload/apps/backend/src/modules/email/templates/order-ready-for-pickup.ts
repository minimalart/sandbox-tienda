import { copyrightLine, storeDisplayName, subjectWithStore } from './email-helpers';
import type { EmailTemplateFunction, EmailTemplateResult } from './types';

/**
 * order-ready-for-pickup — "tu pedido ya está listo para retirar".
 *
 * NO sale con la orden. Lo dispara una acción humana: el botón "Marcar listo
 * para retirar" del widget de la orden, o una transición de la ejecución de
 * entrega a `at_pickup_point`. Las dos puertas pasan por el mismo gate de
 * idempotencia (`order.metadata.ready_for_pickup_at`), así que el mail sale UNA
 * sola vez por orden — ver `workflows/mark-order-ready-for-pickup.ts`.
 *
 * Esta plantilla de CÓDIGO es la que se envía de verdad mientras la tienda no
 * publique una fila propia en `email_template` para esta clave. El branding
 * (logo, color, nombre) lo inyecta el provider desde la tienda, así que sale con
 * la identidad del cliente sin tocar nada.
 */
export type OrderReadyForPickupData = {
  order_id?: string;
  display_id?: string | number;
  custom_display_id?: string;
  customer_name?: string;
  sales_channel_id?: string;
  sales_channel_name?: string;
  logo_url?: string;
  cde_display_name?: string;
  primary_color?: string;
  pickup_store?: {
    name?: string;
    address?: string;
    phone?: string;
    hours?: string[];
    map_url?: string;
  };
  /** Qué presentar para retirar. Ausente/vacío = no se dibuja el bloque. */
  pickup_instructions?: string;
  [key: string]: unknown;
};

/**
 * Escapa el HTML. Importa de verdad acá: el nombre y la dirección de la sucursal
 * y las instrucciones los escribe un operador en el admin, y terminan dentro del
 * markup del mail sin pasar por Handlebars (que sí escaparía).
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const orderReadyForPickupTemplate: EmailTemplateFunction<OrderReadyForPickupData> = (
  data
): EmailTemplateResult => {
  const displayId = String(data.custom_display_id ?? data.display_id ?? data.order_id ?? '');
  const logoUrl = data.logo_url || '';
  const cdeDisplayName = storeDisplayName(data);
  const primaryColor = data.primary_color || '#2e7d32';
  const customerName = (data.customer_name || '').trim();
  const year = new Date().getFullYear();

  const store = data.pickup_store ?? {};
  const storeName = (store.name || '').trim();
  const storeAddress = (store.address || '').trim();
  const storePhone = (store.phone || '').trim();
  const hours = Array.isArray(store.hours) ? store.hours.filter(Boolean) : [];
  const mapUrl = (store.map_url || '').trim();
  const instructions = (data.pickup_instructions || '').trim();

  const subjectBase = `Tu pedido #${displayId} ya está listo para retirar`;

  // Sin logo y sin nombre de tienda, la cabecera se omite: un título de 24px
  // vacío deja un hueco, pero inventar una marca manda la de otro cliente.
  const brandHeader = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(cdeDisplayName)}" width="200" style="display:block;margin:0 auto;border:0;height:auto;">`
    : cdeDisplayName
      ? `<div style="font-size:24px;font-weight:700;color:${escapeHtml(primaryColor)};">${escapeHtml(cdeDisplayName)}</div>`
      : '';

  const hoursRows = hours
    .map(
      (line) =>
        `<p style="margin:0 0 4px 0;font-size:13px;color:#667085;">${escapeHtml(line)}</p>`
    )
    .join('');

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subjectBase)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;width:100%;font-family:'Inter',Arial,sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f5f5f5;font-family:'Inter',Arial,sans-serif;">
    <tr>
      <td style="padding:20px 0;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="600" style="margin:auto;background-color:#ffffff;max-width:600px;">
          <tr>
            <td style="padding:40px 20px 20px 20px;text-align:center;">
              ${brandHeader}
            </td>
          </tr>
          <tr>
            <td style="padding:10px 20px 6px 20px;text-align:center;">
              <h1 style="margin:0;font-size:28px;color:${escapeHtml(primaryColor)};font-weight:700;">${customerName ? `Ya podés retirarlo, ${escapeHtml(customerName)}` : 'Ya podés retirar tu pedido'}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:0 20px 24px 20px;text-align:center;">
              <p style="margin:0;font-size:15px;color:#667085;">Tu pedido <strong style="color:#1D2530;">#${escapeHtml(displayId)}</strong> ya está preparado y te espera en el local.</p>
            </td>
          </tr>
          ${storeName || storeAddress
            ? `<tr>
            <td style="padding:0 40px 24px 40px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border:1px solid #e5e7eb;border-radius:12px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 8px 0;font-size:12px;color:#667085;text-transform:uppercase;letter-spacing:0.04em;">Retiralo en</p>
                    ${storeName ? `<p style="margin:0 0 6px 0;font-size:17px;color:#1D2530;font-weight:700;">${escapeHtml(storeName)}</p>` : ''}
                    ${storeAddress ? `<p style="margin:0 0 6px 0;font-size:14px;color:#667085;">${escapeHtml(storeAddress)}</p>` : ''}
                    ${storePhone ? `<p style="margin:0 0 6px 0;font-size:13px;color:#667085;">Tel.: ${escapeHtml(storePhone)}</p>` : ''}
                    ${hoursRows ? `<p style="margin:14px 0 6px 0;font-size:13px;color:#1D2530;font-weight:600;">Horarios de atención</p>${hoursRows}` : ''}
                    ${mapUrl ? `<p style="margin:14px 0 0 0;"><a href="${escapeHtml(mapUrl)}" style="color:${escapeHtml(primaryColor)};font-size:13px;font-weight:600;text-decoration:none;">Ver cómo llegar</a></p>` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>`
            : ''}
          ${instructions
            ? `<tr>
            <td style="padding:0 40px 28px 40px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f9fafb;border-left:3px solid ${escapeHtml(primaryColor)};">
                <tr>
                  <td style="padding:14px 18px;">
                    <p style="margin:0 0 4px 0;font-size:13px;color:#1D2530;font-weight:600;">Para retirarlo</p>
                    <p style="margin:0;font-size:13px;color:#667085;">${escapeHtml(instructions)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`
            : ''}
          <tr>
            <td style="padding:20px;background-color:${escapeHtml(primaryColor)};text-align:center;">
              <p style="margin:0;color:#ffffff;font-size:12px;">${escapeHtml(copyrightLine(year, cdeDisplayName))}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  return {
    subject: subjectWithStore(subjectBase, data),
    html,
  };
};
