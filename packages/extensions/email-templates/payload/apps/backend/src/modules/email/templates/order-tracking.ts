import type { EmailTemplateFunction, EmailTemplateResult } from './types';
import { hexToRgba, getIconSrc } from './email-helpers';

export type TrackingMilestone =
    | 'payment_confirmed'
    | 'in_preparation'
    | 'shipped'
    | 'delivered'
    | 'cancelled';

/**
 * Paso del timeline igual al B2C (`order-details-template.tsx`): label, done, fecha ISO opcional,
 * icono lógico para el SVG en el email (check/dollar en índices 0–1 según regla del storefront).
 */
export interface TrackingTimelineStep {
    index: number;
    label: string;
    done: boolean;
    /** ISO8601; la plantilla formatea con es-AR igual que el storefront. */
    date_iso?: string | null;
    /** Icono base del paso (el storefront muestra check en índice 0 y en 1 si done). */
    icon: 'dollar' | 'package' | 'truck' | 'pin';
}

/** Misma función de fecha que el storefront `formatStepDate`. */
export function formatTrackingStepDate(dateStr?: string | null): string | null {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('es-AR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/** Mismo teal que el storefront (`bg-[#1C82AD]`). */
const TIMELINE_TEAL = '#1C82AD';
const TIMELINE_BORDER_PENDING = '#E5E7EB';
const TIMELINE_TEXT_DONE = '#1D2530';
const TIMELINE_TEXT_MUTED = '#8899A8';
const TIMELINE_DATE_MUTED = '#8899A8';

export type OrderTrackingData = {
  order_id?: string;
  display_id?: string | number;
  custom_display_id?: string;
  total?: string | number;
  customer_name?: string;
  customer_email?: string;
  sales_channel_id?: string;
  sales_channel_name?: string;
  logo_url?: string;
  cde_display_name?: string;
  order_date_formatted?: string;
  primary_color?: string;
  current_milestone?: TrackingMilestone;
  timeline_steps?: TrackingTimelineStep[];
  shipping_address?: {
    first_name?: string;
    last_name?: string;
    address_1?: string;
    address_2?: string;
    city?: string;
    postal_code?: string;
    province?: string;
  } | null;
  [key: string]: unknown;
};

const MILESTONE_SUBJECT: Record<TrackingMilestone, string> = {
  payment_confirmed: 'Tu pago fue confirmado',
  in_preparation: 'Tu pedido está en preparación',
  shipped: 'Tu pedido fue enviado',
  delivered: '¡Tu pedido fue entregado!',
  cancelled: 'Tu pedido fue cancelado',
};

const MILESTONE_TITLE: Record<TrackingMilestone, string> = {
  payment_confirmed: '¡Pago confirmado!',
  in_preparation: 'Tu pedido está en preparación',
  shipped: '¡Tu pedido fue enviado!',
  delivered: '¡Tu pedido fue entregado!',
  cancelled: 'Tu pedido fue cancelado',
};

const MILESTONE_SUBTITLE: Record<TrackingMilestone, string> = {
  payment_confirmed: 'Recibimos tu pago y estamos procesando tu pedido.',
  in_preparation: 'Estamos preparando tu pedido para despacharlo.',
  shipped: 'Tu pedido está en camino. ¡Pronto lo tendrás en tu puerta!',
  delivered: 'Tu pedido fue entregado. ¡Esperamos que disfrutes tu compra!',
  cancelled: 'La orden fue cancelada. Si tenés dudas, contactanos por nuestros canales de atención.',
};

/** Nombres de archivo en el bucket `email-icons/` (subir con `yarn upload-email-icons`). */
function resolveTimelineIconFilename(step: TrackingTimelineStep): string {
  const { index, done, icon } = step;
  if (done && index < 2) return 'check-icon.png';
  if (index === 1 && !done) return 'dollar-sign.png';
  switch (icon) {
    case 'package':
      return 'preparation-icon.png';
    case 'truck':
      return 'truck-icon.png';
    case 'pin':
      return 'delivered-icon.png';
    default:
      return 'dollar-sign.png';
  }
}

function timelineIconImg(filename: string): string {
  const src = getIconSrc(filename);
  if (!src) return '';
  return `<img src="${src}" alt="" width="14" height="14" style="display:block;margin:0 auto;-ms-interpolation-mode:bicubic;border:0;line-height:100%;outline:none;text-decoration:none;">`;
}

/**
 * Iconos desde el bucket (EMAIL_ICONS_BASE_URL/email-icons/…).
 * Fallback SVG si el nombre no está en la allowlist (no debería ocurrir).
 */
function stepCircleInner(step: TrackingTimelineStep): string {
  const filename = resolveTimelineIconFilename(step);
  const img = timelineIconImg(filename);
  if (img) return img;
  return '&#8226;';
}

function stepCircleHtml(step: TrackingTimelineStep): string {
  const done = step.done;
  const bg = done ? TIMELINE_TEAL : '#ffffff';
  const border = done ? `2px solid ${TIMELINE_TEAL}` : `2px solid ${TIMELINE_BORDER_PENDING}`;
  const inner = stepCircleInner(step);
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="mso-table-lspace:0pt;mso-table-rspace:0pt;">
      <tr>
        <td style="width:32px;height:32px;border-radius:50%;background-color:${bg};border:${border};text-align:center;vertical-align:middle;mso-table-lspace:0pt;mso-table-rspace:0pt;line-height:0;">
          ${inner}
        </td>
      </tr>
    </table>`;
}

function connectorHtml(stepDone: boolean): string {
  const color = stepDone ? TIMELINE_TEAL : TIMELINE_BORDER_PENDING;
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="mso-table-lspace:0pt;mso-table-rspace:0pt;">
      <tr>
        <td style="width:2px;height:20px;background-color:${color};font-size:0;line-height:0;mso-table-lspace:0pt;mso-table-rspace:0pt;">&nbsp;</td>
      </tr>
    </table>`;
}

export const orderTrackingTemplate: EmailTemplateFunction<OrderTrackingData> = (
  data
): EmailTemplateResult => {
  const milestone = (data.current_milestone as TrackingMilestone | undefined) ?? 'payment_confirmed';
  const displayId = data.custom_display_id ?? data.display_id ?? data.order_id ?? '';
  const channelName = data.sales_channel_name || data.sales_channel_id || '';
  const logoUrl = data.logo_url || '';
  const cdeDisplayName = (data.cde_display_name || channelName || 'CDE').trim();
  const orderDate = data.order_date_formatted || '';
  const primaryColor = (data.primary_color as string | undefined) || '#2e7d32';
  const customerName = (data.customer_name || '').trim();
  const steps: TrackingTimelineStep[] = Array.isArray(data.timeline_steps) ? data.timeline_steps : [];
  const shipping = data.shipping_address ?? null;

  const subject = MILESTONE_SUBJECT[milestone] ?? 'Actualización de tu pedido';
  const titleMain = MILESTONE_TITLE[milestone] ?? 'Actualización de tu pedido';
  const titleSub = MILESTONE_SUBTITLE[milestone] ?? '';

  const year = new Date().getFullYear();

  const shippingName = [shipping?.first_name, shipping?.last_name].filter(Boolean).join(' ').trim();
  const shippingStreet = [shipping?.address_1, shipping?.address_2].filter(Boolean).join(', ').trim();
  const shippingCity = [shipping?.city, shipping?.postal_code ? `CP ${shipping.postal_code}` : ''].filter(Boolean).join(', ').trim();
  const hasShipping = !!(shippingName || shippingStreet || shippingCity);

  const timelineRows = steps
    .map((step, idx) => {
      const isLast = idx === steps.length - 1;
      const labelColor = step.done ? TIMELINE_TEXT_DONE : TIMELINE_TEXT_MUTED;
      const fontWeight = step.done ? '500' : '400';
      const dateStr = formatTrackingStepDate(step.date_iso ?? null);

      return `
      <tr>
        <td style="width:40px;text-align:center;vertical-align:top;padding:0;mso-table-lspace:0pt;mso-table-rspace:0pt;">
          ${stepCircleHtml(step)}
          ${!isLast ? connectorHtml(step.done) : ''}
        </td>
        <td style="padding:0 0 ${isLast ? '0' : '16px'} 12px;vertical-align:top;mso-table-lspace:0pt;mso-table-rspace:0pt;">
          <p style="margin:0;font-size:14px;color:${labelColor};font-weight:${fontWeight};line-height:1.4;">${step.label}</p>
          ${dateStr ? `<p style="margin:4px 0 0 0;font-size:12px;color:${TIMELINE_DATE_MUTED};">${dateStr}</p>` : ''}
        </td>
      </tr>`;
    })
    .join('');

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;width:100%;font-family:'Inter',Arial,sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f5f5f5;font-family:'Inter',Arial,sans-serif;mso-table-lspace:0pt;mso-table-rspace:0pt;">
    <tr>
      <td style="padding:20px 0;mso-table-lspace:0pt;mso-table-rspace:0pt;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="600" style="margin:auto;background-color:#ffffff;max-width:600px;mso-table-lspace:0pt;mso-table-rspace:0pt;">

          <tr>
            <td style="padding:40px 20px 20px 20px;text-align:center;mso-table-lspace:0pt;mso-table-rspace:0pt;">
              ${logoUrl
                ? `<img src="${logoUrl}" alt="${cdeDisplayName}" width="200" style="display:block;margin:0 auto;-ms-interpolation-mode:bicubic;border:0;height:auto;line-height:100%;outline:none;text-decoration:none;">`
                : `<div style="font-size:24px;font-weight:700;color:${primaryColor};">${cdeDisplayName}</div>`}
            </td>
          </tr>

          <tr>
            <td style="padding:10px 20px 6px 20px;text-align:center;mso-table-lspace:0pt;mso-table-rspace:0pt;">
              <h1 style="margin:0;font-size:26px;color:#13354F;font-weight:bold;">${customerName ? `${titleMain}, ${customerName}` : titleMain}</h1>
            </td>
          </tr>

          <tr>
            <td style="padding:0 20px 28px 20px;text-align:center;mso-table-lspace:0pt;mso-table-rspace:0pt;">
              <p style="margin:0;font-size:15px;color:#666666;">${titleSub}</p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 40px 28px 40px;mso-table-lspace:0pt;mso-table-rspace:0pt;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="mso-table-lspace:0pt;mso-table-rspace:0pt;">
                <tr>
                  <td style="mso-table-lspace:0pt;mso-table-rspace:0pt;">
                    <span style="display:inline-block;padding:8px 18px;background-color:${hexToRgba(primaryColor, 0.1)};border:1.2px solid ${primaryColor};border-radius:20px;color:${primaryColor};font-size:14px;font-weight:bold;">Pedido #${displayId}</span>
                  </td>
                  ${orderDate ? `<td style="text-align:right;color:#666666;font-size:13px;mso-table-lspace:0pt;mso-table-rspace:0pt;">${orderDate}</td>` : ''}
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:0 40px 30px 40px;mso-table-lspace:0pt;mso-table-rspace:0pt;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#ffffff;border:1px solid #E0E5EB;border-radius:12px;box-shadow:0px 1px 2px 0px rgba(0,0,0,0.05);mso-table-lspace:0pt;mso-table-rspace:0pt;">

                <tr>
                  <td style="padding:16px 20px 12px 20px;border-bottom:1px solid #E0E5EB;mso-table-lspace:0pt;mso-table-rspace:0pt;">
                    <h2 style="margin:0;font-size:16px;color:#13354F;font-weight:bold;">Seguimiento del envío</h2>
                  </td>
                </tr>

                ${hasShipping ? `
                <tr>
                  <td style="padding:16px 20px 0 20px;mso-table-lspace:0pt;mso-table-rspace:0pt;">
                    <p style="margin:0 0 4px 0;font-size:12px;font-weight:600;letter-spacing:0.02em;color:#13354F;">Dirección de envío</p>
                    ${shippingName ? `<p style="margin:0;font-size:14px;color:#1D2530;">${shippingName}</p>` : ''}
                    ${shippingStreet ? `<p style="margin:0;font-size:14px;color:#1D2530;">${shippingStreet}</p>` : ''}
                    ${shippingCity ? `<p style="margin:0;font-size:14px;color:#1D2530;">${shippingCity}</p>` : ''}
                  </td>
                </tr>` : ''}

                <tr>
                  <td style="padding:16px 20px 20px 20px;mso-table-lspace:0pt;mso-table-rspace:0pt;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="mso-table-lspace:0pt;mso-table-rspace:0pt;">
                      ${timelineRows}
                    </table>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:20px;background-color:${primaryColor};text-align:center;mso-table-lspace:0pt;mso-table-rspace:0pt;">
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
    subject: channelName
      ? `[${channelName}] ${subject} #${displayId}`
      : `[Mercatto] ${subject} #${displayId}`,
    html,
  };
};
