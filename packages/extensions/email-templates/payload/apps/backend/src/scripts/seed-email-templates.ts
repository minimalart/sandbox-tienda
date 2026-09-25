/**
 * Seed the email_template DB module with the 12 hardcoded email templates.
 *
 * Imports the code templates living in src/modules/email/templates/ into the
 * `email_template` module so they become editable from the backoffice. Each
 * template is seeded with status 'draft' so it does NOT override the code
 * template until a human reviews and publishes it.
 *
 * The script is idempotent: it upserts by `key`. On update it PRESERVES the
 * existing row's `status` — a published row is never clobbered back to draft.
 *
 * The HTML/subject below are the Handlebars equivalents of the JS template
 * literals: `${data.foo}` -> `{{foo}}`, ternaries -> `{{#if}}…{{else}}…{{/if}}`,
 * and `.map()` loops over arrays -> `{{#each items}}…{{/each}}`. Raw HTML values
 * (logo tags, addresses) use the triple-stache `{{{var}}}`.
 *
 * Run with:
 *   pnpm seed:email-templates
 *   or: dotenv -e .env -- medusa exec ./src/scripts/seed-email-templates.ts
 *
 * Los productos de ejemplo abajo (`order_items`, `items`…) son del boilerplate
 * y quedan escritos en `sample_data` para siempre — este script no se re-corre
 * en un deploy. `preview`/`test-send` los cambian en runtime por productos
 * reales de la tienda activa: ver `modules/email-template/catalog-sample-data.ts`.
 */
import type { ExecArgs, Logger } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { EMAIL_TEMPLATE_MODULE } from '../modules/email-template';
import type EmailTemplateModuleService from '../modules/email-template/service';
import { renderPuckEmailHtml } from '../modules/email-template/render-email';
import { EMAIL_TEMPLATE_DESIGNS } from './email-template-designs';

/**
 * key → logical event + audience, persisted on `template.metadata` so the admin
 * can group rows by event and show Usuario/Admin tabs. This is kept INLINE (not
 * imported from the admin events-catalog) because the backend tsconfig excludes
 * `src/admin`; the admin catalog is the UI-side mirror of this same mapping.
 */
const KEY_META: Record<string, { event: string; audience: 'user' | 'admin' }> = {
  'order-confirmation': { event: 'order-placed', audience: 'user' },
  'order-notification-admin': { event: 'order-placed', audience: 'admin' },
  'customer-register': { event: 'customer-register', audience: 'user' },
  'company-register': { event: 'company-register', audience: 'user' },
  'company-register-admin': { event: 'company-register', audience: 'admin' },
  'corporate-register': { event: 'corporate-register', audience: 'user' },
  'corporate-register-admin': { event: 'corporate-register', audience: 'admin' },
  'b2b-client-approved': { event: 'corporate-approved', audience: 'user' },
  'contact-received': { event: 'contact', audience: 'user' },
  'contact-notification-admin': { event: 'contact', audience: 'admin' },
  'company-invite': { event: 'company-invite', audience: 'user' },
  'corporate-invite': { event: 'corporate-invite', audience: 'user' },
  'gift-card-issued': { event: 'gift-card-issued', audience: 'user' },
  'gift-card-delivery': { event: 'gift-card-delivery', audience: 'user' },
  'gift-card-resend': { event: 'gift-card-resend', audience: 'user' },
  'gift-card-delivery-failed-buyer': { event: 'gift-card-delivery-failed', audience: 'user' },
  'gift-card-claimed': { event: 'gift-card-claimed', audience: 'user' },
  'gift-card-balance-reminder': { event: 'gift-card-balance', audience: 'user' },
  'gift-card-expiring': { event: 'gift-card-expiring', audience: 'user' },
  'order-tracking': { event: 'order-tracking', audience: 'user' },
  'order-cancelled': { event: 'order-cancelled', audience: 'user' },
  'password-reset': { event: 'password-reset', audience: 'user' },
  'cart-abandoned-1': { event: 'cart-abandoned', audience: 'user' },
  'cart-abandoned-2': { event: 'cart-abandoned', audience: 'user' },
  'cart-abandoned-3': { event: 'cart-abandoned', audience: 'user' },
  'recurring-order-created': { event: 'recurring-order', audience: 'user' },
  'recurring-renewal-ready': { event: 'recurring-order', audience: 'user' },
  'recurring-renewal-reminder': { event: 'recurring-order', audience: 'user' },
  'recurring-order-generated': { event: 'recurring-order', audience: 'user' },
  'recurring-order-paused': { event: 'recurring-order', audience: 'user' },
  'recurring-order-resumed': { event: 'recurring-order', audience: 'user' },
  'recurring-order-skipped': { event: 'recurring-order', audience: 'user' },
  'recurring-order-updated': { event: 'recurring-order', audience: 'user' },
  'recurring-order-cancelled': { event: 'recurring-order', audience: 'user' },
  'recurring-order-failed': { event: 'recurring-order', audience: 'user' },
  'recurring-renewal-upcoming': { event: 'recurring-order', audience: 'user' },
  'recurring-stock-unavailable': { event: 'recurring-order', audience: 'user' },
  'recurring-stock-skipped': { event: 'recurring-order', audience: 'user' },
  'recurring-payment-failed': { event: 'recurring-order', audience: 'user' },
  'recurring-stock-alert': { event: 'recurring-order', audience: 'admin' },
  'quotation-notification-admin': { event: 'quotation', audience: 'admin' },
  'quotation-rejected-admin': { event: 'quotation', audience: 'admin' },
  'kit-cde-notification': { event: 'operational', audience: 'admin' },
  'stock-sync-report': { event: 'operational', audience: 'admin' },
};

type SeedVariable = { name: string; description: string };

type SeedEntry = {
  key: string;
  name: string;
  description: string;
  subject: string;
  html: string;
  variables: SeedVariable[];
  sample_data: Record<string, unknown>;
  status: 'draft' | 'published';
  locale: string | null;
  // Optional Puck block document. When present, the seeded `html` is DERIVED
  // from it (React Email) instead of using the literal `html` above — keeping
  // the block editor's source of truth and the sent HTML in sync.
  design?: Record<string, unknown> | null;
  // Optional grouping metadata. When omitted, it is DERIVED from the events
  // catalog by `key` (see the upsert loop). Stored on `template.metadata` so the
  // admin can group rows by logical event + audience (Usuario / Admin tabs).
  metadata?: Record<string, unknown> | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// company-register
// ─────────────────────────────────────────────────────────────────────────────
const COMPANY_REGISTER_HTML = `<p>Hola,</p><p>¡Bienvenido! Tu empresa <strong>{{nombre_empresa}}</strong> ha sido registrada correctamente.</p><p>Email de contacto: {{email}}</p>`;

// ─────────────────────────────────────────────────────────────────────────────
// customer-register
// ─────────────────────────────────────────────────────────────────────────────
const CUSTOMER_REGISTER_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{subject}}</title>
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
                            {{#if logo_url}}<img src="{{logo_url}}" alt="{{cde_display_name}}" width="200" style="display: block; margin: 0 auto; -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none;">{{else}}<div style="font-size: 24px; font-weight: 700; color: {{primary_color}};">{{cde_display_name}}</div>{{/if}}
                        </td>
                    </tr>

                    <!-- Contenido -->
                    <tr>
                        <td style="padding: 20px 40px 32px 40px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 700; color: #111111;">¡Bienvenido{{#if name}}, {{name}}{{/if}}!</h1>
                            <p style="margin: 0 0 16px; font-size: 18px; font-weight: 600; color: #111111;">Tu cuenta ha sido creada correctamente.</p>
                            <p style="margin: 0 0 12px; font-size: 14px; color: #555555;">Gracias por registrarte. A partir de ahora podés acceder con tu correo a nuestra tienda.</p>
                            <p style="margin: 0 0 24px; font-size: 14px; color: #555555;">Email registrado: <a href="mailto:{{email}}" style="color: {{primary_color}}; text-decoration: none; font-weight: 600; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">{{email}}</a></p>
                            <p style="margin: 0; font-size: 14px; color: #666666;">Si no realizaste este registro, podés ignorar este mensaje.</p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 20px; background-color: {{primary_color}}; text-align: center; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <p style="margin: 0; color: #ffffff; font-size: 12px;">© {{year}} {{cde_display_name}}. Todos los derechos reservados.</p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

// ─────────────────────────────────────────────────────────────────────────────
// b2b-client-approved
// ─────────────────────────────────────────────────────────────────────────────
const B2B_CLIENT_APPROVED_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
</head>
<body style="margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; background:#f5f5f5;">
  <div style="max-width:600px; margin:0 auto; background:#fff; padding:32px;">
    {{#if logo_url}}<div style="margin-bottom:24px;"><img src="{{logo_url}}" alt="{{cde_display_name}}" style="max-height:48px; width:auto;" /></div>{{else}}<div style="margin-bottom:24px; font-size:24px; font-weight:700; color:#111;">{{cde_display_name}}</div>{{/if}}

    <h1 style="margin:0 0 8px; font-size:24px; font-weight:700; color:#111;">¡Registro Aprobado{{#if name}}, {{name}}{{/if}}!</h1>

    <p style="margin:0 0 16px; font-size:16px; color:#333;">
      Nos complace informarte que tu solicitud de registro para <strong>{{company_name}}</strong> ha sido <span style="color:#10b981; font-weight:600;">aprobada exitosamente</span>.
    </p>

    <p style="margin:24px 0 0; padding-top:16px; border-top:1px solid #e5e7eb; font-size:13px; color:#6b7280;">
      ¿Necesitás ayuda? Contactanos en <a href="mailto:soporte@mercatto.com" style="color:#2563eb; text-decoration:none;">soporte@mercatto.com</a>
    </p>
  </div>

  <div style="max-width:600px; margin:16px auto; text-align:center;">
    <p style="margin:0; font-size:11px; color:#9ca3af; line-height:1.5;">
      Este email fue enviado a {{email}} porque tu registro fue aprobado.<br>
      Si no realizaste esta solicitud, por favor contactá a nuestro equipo de soporte.
    </p>
  </div>
</body>
</html>`;

// ─────────────────────────────────────────────────────────────────────────────
// password-reset
// ─────────────────────────────────────────────────────────────────────────────
const PASSWORD_RESET_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{subject}}</title>
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
                            {{#if logo_url}}<img src="{{logo_url}}" alt="{{cde_display_name}}" width="200" style="display: block; margin: 0 auto; -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none;">{{else}}<div style="font-size: 24px; font-weight: 700; color: {{primary_color}};">{{cde_display_name}}</div>{{/if}}
                        </td>
                    </tr>

                    <!-- Contenido -->
                    <tr>
                        <td style="padding: 20px 40px 32px 40px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 700; color: #111111;">Restablecer contraseña</h1>
                            <p style="margin: 0 0 16px; font-size: 18px; font-weight: 600; color: #111111;">Recibimos una solicitud para restablecer tu contraseña.</p>
                            <p style="margin: 0 0 28px; font-size: 14px; color: #555555;">Hacé clic en el botón para crear una nueva contraseña. El enlace expira en 15 minutos.</p>

                            {{#if link_reseteo}}
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td style="border-radius: 6px; background-color: {{primary_color}}; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        <a href="{{link_reseteo}}" style="display: inline-block; padding: 12px 28px; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; border-radius: 6px; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">Restablecer contraseña</a>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin: 20px 0 0; font-size: 12px; color: #666666;">O copiá este enlace en tu navegador:<br><a href="{{link_reseteo}}" style="color: {{primary_color}}; word-break: break-all; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">{{link_reseteo}}</a></p>
                            {{else}}<p style="color: #cc0000;">Enlace de restablecimiento no disponible.</p>{{/if}}

                            <p style="margin: 24px 0 0; font-size: 14px; color: #666666;">Si no solicitaste este cambio, podés ignorar este correo. Tu contraseña no será modificada.</p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 20px; background-color: {{primary_color}}; text-align: center; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <p style="margin: 0; color: #ffffff; font-size: 12px;">© {{year}} {{cde_display_name}}. Todos los derechos reservados.</p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

// ─────────────────────────────────────────────────────────────────────────────
// order-confirmation
// ─────────────────────────────────────────────────────────────────────────────
const ORDER_CONFIRMATION_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{subject}}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; width: 100%; font-family: 'Inter', Arial, sans-serif;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5; font-family: 'Inter', Arial, sans-serif; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
        <tr>
            <td style="padding: 20px 0; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="600" style="margin: auto; background-color: #ffffff; max-width: 600px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">

                    <!-- Logo -->
                    <tr>
                        <td style="padding: 40px 40px 12px 40px; text-align: center; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            {{#if logo_url}}<img src="{{logo_url}}" alt="{{cde_display_name}}" width="180" style="display: block; margin: 0 auto; -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none;">{{else}}<div style="font-size: 24px; font-weight: 700; color: {{primary_color}};">{{cde_display_name}}</div>{{/if}}
                        </td>
                    </tr>

                    <!-- Título -->
                    <tr>
                        <td style="padding: 8px 40px 4px 40px; text-align: center; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <h1 style="margin: 0; font-size: 24px; color: #111111; font-weight: bold;">¡Gracias por tu compra!</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 0 40px 24px 40px; text-align: center; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <p style="margin: 0; font-size: 14px; color: #666666;">Recibimos tu pedido y ya lo estamos procesando. Te avisaremos por correo cuando haya novedades.</p>
                        </td>
                    </tr>

                    <!-- Pedido y Fecha -->
                    <tr>
                        <td style="padding: 0 40px 20px 40px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td style="text-align: left; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        <span style="display: inline-block; padding: 8px 18px; background-color: {{primary_color_bg}}; border: 1.2px solid {{primary_color}}; border-radius: 20px; color: {{primary_color}}; font-size: 13px; font-weight: bold;">Pedido <span style="font-weight: bold;">#{{display_id}}</span></span>
                                    </td>
                                    {{#if order_date_formatted}}<td style="text-align: right; color: #666666; font-size: 13px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">{{order_date_formatted}}</td>{{/if}}
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Resumen del pedido -->
                    {{#if order_items}}
                    <tr>
                        <td style="padding: 4px 40px 12px 40px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <h2 style="margin: 0; font-size: 16px; color: {{primary_color}}; font-weight: bold;">Resumen del pedido</h2>
                        </td>
                    </tr>
                    {{#each order_items}}
                    <tr>
                        <td style="padding: 0 40px 12px 40px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8f9fa; border-radius: 8px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td style="padding: 12px; width: 80px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        {{#if this.thumbnail}}<img src="{{this.thumbnail}}" alt="{{this.title}}" width="68" style="display: block; border-radius: 4px; -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none;">{{/if}}
                                    </td>
                                    <td style="padding: 12px 12px 12px 4px; vertical-align: middle; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        <p style="margin: 0 0 4px 0; font-size: 15px; color: #333333; font-weight: bold;">{{this.title}}</p>
                                        <p style="margin: 0; font-size: 13px; color: #666666;">{{this.quantity}} x $ {{this.unit_price_formatted}}</p>
                                    </td>
                                    <td style="padding: 12px; text-align: right; vertical-align: middle; font-size: 15px; color: #333333; font-weight: bold; white-space: nowrap; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        $ {{this.line_total_formatted}}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    {{/each}}

                    <!-- Subtotal y Envío -->
                    <tr>
                        <td style="padding: 4px 40px 8px 40px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td style="padding: 6px 0; color: #666666; font-size: 14px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">Subtotal</td>
                                    <td style="padding: 6px 0; text-align: right; color: #666666; font-size: 14px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">$ {{subtotal_formatted}}</td>
                                </tr>
                                {{#each discounts}}
                                <tr>
                                    <td style="padding: 6px 0; color: #15803d; font-size: 14px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">{{this.label}}</td>
                                    <td style="padding: 6px 0; text-align: right; color: #15803d; font-size: 14px; font-weight: 600; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">{{#if this.makes_free}}Gratis{{else}}-$ {{this.amount_formatted}}{{/if}}</td>
                                </tr>
                                {{/each}}
                                <tr>
                                    <td style="padding: 6px 0; color: #666666; font-size: 14px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">Envío</td>
                                    <td style="padding: 6px 0; text-align: right; color: #666666; font-size: 14px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">{{shipping_display}}</td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    {{/if}}

                    <!-- Total -->
                    <tr>
                        <td style="padding: 8px 40px 24px 40px; border-top: 1px solid #e5e7eb; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td style="padding: 8px 0; color: #111111; font-size: 18px; font-weight: bold; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">Total</td>
                                    <td style="padding: 8px 0; text-align: right; color: #111111; font-size: 18px; font-weight: bold; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">$ {{total}}</td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Datos del envío -->
                    {{#if shipping_address_one_line}}
                    <tr>
                        <td style="padding: 0 40px 24px 40px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border: 1px solid #e5e7eb; border-radius: 14px; border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td style="padding: 20px 24px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        <h3 style="margin: 0 0 12px 0; font-size: 16px; color: {{primary_color}}; font-weight: bold;">Datos del envío</h3>
                                        <p style="margin: 0 0 6px; font-size: 13px; color: #333333;">{{shipping_address_one_line}}</p>
                                        {{#if shipping_method_name}}<p style="margin: 0; font-size: 13px; color: #333333;"><span style="color:#666666;">Método de envío:</span> <strong>{{shipping_method_name}}</strong></p>{{/if}}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    {{/if}}

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 18px; background-color: {{primary_color}}; text-align: center; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <p style="margin: 0; color: #ffffff; font-size: 12px;">© {{year}} {{cde_display_name}}. Todos los derechos reservados.</p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

// ─────────────────────────────────────────────────────────────────────────────
// order-notification-admin
// ─────────────────────────────────────────────────────────────────────────────
const ORDER_NOTIFICATION_ADMIN_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{subject}}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; width: 100%; font-family: 'Inter', Arial, sans-serif;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5; font-family: 'Inter', Arial, sans-serif; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
        <tr>
            <td style="padding: 20px 0; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="600" style="margin: auto; background-color: #ffffff; max-width: 600px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">

                    <!-- Logo -->
                    <tr>
                        <td style="padding: 40px 40px 16px 40px; text-align: center; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            {{#if logo_url}}<img src="{{logo_url}}" alt="{{cde_display_name}}" width="150" style="display: block; margin: 0 auto; -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none;">{{else}}<div style="font-size: 24px; font-weight: 700; color: {{primary_color}};">{{cde_display_name}}</div>{{/if}}
                        </td>
                    </tr>

                    <!-- Alerta: nueva orden -->
                    <tr>
                        <td style="padding: 0 40px 24px 40px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: {{primary_color_bg}}; border-left: 4px solid {{primary_color}}; border-radius: 8px; border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td style="padding: 20px 24px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        <h1 style="margin: 0 0 6px 0; font-size: 22px; color: {{primary_color}}; font-weight: bold;">Nueva orden recibida</h1>
                                        <p style="margin: 0; font-size: 14px; color: #333333;">Un cliente realizó un nuevo pedido en la tienda. Revisá los detalles a continuación.</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Pedido y Fecha -->
                    <tr>
                        <td style="padding: 0 40px 20px 40px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td style="text-align: left; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        <span style="display: inline-block; padding: 8px 18px; background-color: #ffffff; border: 1.2px solid {{primary_color}}; border-radius: 20px; color: {{primary_color}}; font-size: 13px; font-weight: bold;">Pedido <span style="font-weight: bold;">#{{display_id}}</span></span>
                                    </td>
                                    {{#if order_date_formatted}}<td style="text-align: right; color: #666666; font-size: 13px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">{{order_date_formatted}}</td>{{/if}}
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Datos del cliente -->
                    <tr>
                        <td style="padding: 0 40px 20px 40px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border: 1px solid #e5e7eb; border-radius: 14px; border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td style="padding: 20px 24px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        <h3 style="margin: 0 0 12px 0; font-size: 16px; color: {{primary_color}}; font-weight: bold;">Datos del cliente</h3>
                                        <p style="margin: 0 0 4px; font-size: 13px; color: #333333;">{{customer_name}}</p>
                                        {{#if customer_email}}<p style="margin: 0 0 4px; font-size: 13px; color: #333333;">{{customer_email}}</p>{{/if}}
                                        {{#if customer_phone}}<p style="margin: 0; font-size: 13px; color: #333333;">{{customer_phone}}</p>{{/if}}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Resumen del pedido -->
                    {{#if order_items}}
                    <tr>
                        <td style="padding: 4px 40px 12px 40px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <h2 style="margin: 0; font-size: 16px; color: {{primary_color}}; font-weight: bold;">Resumen del pedido</h2>
                        </td>
                    </tr>
                    {{#each order_items}}
                    <tr>
                        <td style="padding: 0 40px 12px 40px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8f9fa; border-radius: 8px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td style="padding: 12px; width: 80px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        {{#if this.thumbnail}}<img src="{{this.thumbnail}}" alt="{{this.title}}" width="68" style="display: block; border-radius: 4px; -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none;">{{/if}}
                                    </td>
                                    <td style="padding: 12px 12px 12px 4px; vertical-align: middle; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        <p style="margin: 0 0 4px 0; font-size: 15px; color: #333333; font-weight: bold;">{{this.title}}</p>
                                        <p style="margin: 0; font-size: 13px; color: #666666;">{{this.quantity}} x $ {{this.unit_price_formatted}}</p>
                                    </td>
                                    <td style="padding: 12px; text-align: right; vertical-align: middle; font-size: 15px; color: #333333; font-weight: bold; white-space: nowrap; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        $ {{this.line_total_formatted}}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    {{/each}}

                    <!-- Subtotal y Envío -->
                    <tr>
                        <td style="padding: 4px 40px 8px 40px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td style="padding: 6px 0; color: #666666; font-size: 14px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">Subtotal</td>
                                    <td style="padding: 6px 0; text-align: right; color: #666666; font-size: 14px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">$ {{subtotal_formatted}}</td>
                                </tr>
                                {{#each discounts}}
                                <tr>
                                    <td style="padding: 6px 0; color: #15803d; font-size: 14px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">{{this.label}}</td>
                                    <td style="padding: 6px 0; text-align: right; color: #15803d; font-size: 14px; font-weight: 600; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">{{#if this.makes_free}}Gratis{{else}}-$ {{this.amount_formatted}}{{/if}}</td>
                                </tr>
                                {{/each}}
                                <tr>
                                    <td style="padding: 6px 0; color: #666666; font-size: 14px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">Envío</td>
                                    <td style="padding: 6px 0; text-align: right; color: #666666; font-size: 14px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">{{shipping_display}}</td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    {{/if}}

                    <!-- Total -->
                    <tr>
                        <td style="padding: 8px 40px 24px 40px; border-top: 1px solid #e5e7eb; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td style="padding: 8px 0; color: #111111; font-size: 18px; font-weight: bold; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">Total del pedido</td>
                                    <td style="padding: 8px 0; text-align: right; color: #111111; font-size: 18px; font-weight: bold; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">$ {{total}}</td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Datos del envío -->
                    {{#if shipping_address_one_line}}
                    <tr>
                        <td style="padding: 0 40px 20px 40px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border: 1px solid #e5e7eb; border-radius: 14px; border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td style="padding: 20px 24px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        <h3 style="margin: 0 0 12px 0; font-size: 16px; color: {{primary_color}}; font-weight: bold;">Datos del envío</h3>
                                        <p style="margin: 0 0 6px; font-size: 13px; color: #333333;">{{shipping_address_one_line}}</p>
                                        {{#if shipping_method_name}}<p style="margin: 0 0 6px; font-size: 13px; color: #333333;"><span style="color:#666666;">Método de envío:</span> <strong>{{shipping_method_name}}</strong></p>{{/if}}
                                        {{#if payment_method_name}}<p style="margin: 0; font-size: 13px; color: #333333;"><span style="color:#666666;">Método de pago:</span> <strong>{{payment_method_name}}</strong></p>{{/if}}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    {{/if}}

                    <!-- Observaciones -->
                    {{#if order_notes}}
                    <tr>
                        <td style="padding: 0 40px 20px 40px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border: 1px solid #e5e7eb; border-radius: 14px; border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td style="padding: 20px 24px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        <h3 style="margin: 0 0 12px 0; font-size: 16px; color: {{primary_color}}; font-weight: bold;">Observaciones</h3>
                                        <p style="margin: 0; color: #333333; font-size: 14px; line-height: 1.5; white-space: pre-wrap;">{{order_notes}}</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    {{/if}}

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 18px; background-color: {{primary_color}}; text-align: center; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <p style="margin: 0; color: #ffffff; font-size: 12px;">© {{year}} {{cde_display_name}}. Todos los derechos reservados.</p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

// ─────────────────────────────────────────────────────────────────────────────
// quotation-notification-admin
// ─────────────────────────────────────────────────────────────────────────────
const QUOTATION_NOTIFICATION_ADMIN_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{subject}}</title>
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
                            {{#if logo_url}}<img src="{{logo_url}}" alt="{{cde_display_name}}" width="200" style="display: block; margin: 0 auto; -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none;">{{else}}<div style="font-size: 24px; font-weight: 700; color: {{primary_color}};">{{cde_display_name}}</div>{{/if}}
                        </td>
                    </tr>

                    <!-- Título -->
                    <tr>
                        <td style="padding: 20px 20px 10px 20px; text-align: center; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <h1 style="margin: 0; font-size: 28px; color: #333333; font-weight: bold;">Se generó una nueva cotización</h1>
                        </td>
                    </tr>

                    <!-- Subtítulo -->
                    <tr>
                        <td style="padding: 0 20px 30px 20px; text-align: center; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <p style="margin: 0; font-size: 16px; color: #666666;">Detalles de la cotización a continuación.</p>
                        </td>
                    </tr>

                    <!-- Cotización y Fecha -->
                    <tr>
                        <td style="padding: 20px 40px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td style="text-align: left; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        <span style="display: inline-block; padding: 10px 20px; background-color: {{primary_color_bg}}; border: 1.2px solid {{primary_color}}; border-radius: 20px; color: {{primary_color}}; font-size: 14px; font-weight: bold;">Cotización #{{display_id}}</span>
                                    </td>
                                    {{#if order_date_formatted}}<td style="text-align: right; color: #666666; font-size: 14px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">{{order_date_formatted}}</td>{{/if}}
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Resumen -->
                    {{#if order_items}}
                    <tr>
                        <td style="padding: 20px 40px 10px 40px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <h2 style="margin: 0; font-size: 18px; color: {{primary_color}}; font-weight: bold;">Resumen de la cotización</h2>
                        </td>
                    </tr>
                    {{#each order_items}}
                    <tr>
                        <td style="padding: 0 40px 20px 40px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8f9fa; border-radius: 8px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td style="padding: 15px; width: 80px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        {{#if this.thumbnail}}<img src="{{this.thumbnail}}" alt="{{this.title}}" width="80" style="display: block; border-radius: 4px; -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none;">{{/if}}
                                    </td>
                                    <td style="padding: 15px; vertical-align: middle; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        <p style="margin: 0 0 5px 0; font-size: 16px; color: #333333; font-weight: bold;">{{this.title}}</p>
                                        <p style="margin: 0; font-size: 14px; color: #666666;">{{this.quantity}} x $ {{this.unit_price_formatted}}</p>
                                    </td>
                                    <td style="padding: 15px; text-align: right; vertical-align: middle; font-size: 16px; color: #333333; font-weight: bold; white-space: nowrap; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        $ {{this.line_total_formatted}}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    {{/each}}

                    <!-- Subtotal y Envío -->
                    <tr>
                        <td style="padding: 0 40px 15px 40px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td style="padding: 8px 0; color: #666666; font-size: 14px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">Subtotal</td>
                                    <td style="padding: 8px 0; text-align: right; color: #666666; font-size: 14px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">$ {{subtotal_formatted}}</td>
                                </tr>
                                {{#each discounts}}
                                <tr>
                                    <td style="padding: 8px 0; color: #15803d; font-size: 14px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">{{this.label}}</td>
                                    <td style="padding: 8px 0; text-align: right; color: #15803d; font-size: 14px; font-weight: 600; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">{{#if this.makes_free}}Gratis{{else}}-$ {{this.amount_formatted}}{{/if}}</td>
                                </tr>
                                {{/each}}
                                <tr>
                                    <td style="padding: 8px 0; color: #666666; font-size: 14px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">Envío estimado</td>
                                    <td style="padding: 8px 0; text-align: right; color: #666666; font-size: 14px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">{{shipping_formatted}}</td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    {{/if}}

                    <!-- Total -->
                    <tr>
                        <td style="padding: 15px 40px 30px 40px; border-top: 1px solid #EFEFEF; border-bottom: 1px solid #e0e0e0; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td style="padding: 10px 0; color: #333333; font-size: 18px; font-weight: bold; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">Total de la cotización</td>
                                    <td style="padding: 10px 0; text-align: right; color: #333333; font-size: 18px; font-weight: bold; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">$ {{total}}</td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 20px; background-color: {{primary_color}}; text-align: center; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <p style="margin: 0; color: #ffffff; font-size: 12px;">© {{year}} {{cde_display_name}}. Todos los derechos reservados.</p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

// ─────────────────────────────────────────────────────────────────────────────
// quotation-rejected-admin
// ─────────────────────────────────────────────────────────────────────────────
const QUOTATION_REJECTED_ADMIN_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{subject}}</title>
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
                            {{#if logo_url}}<img src="{{logo_url}}" alt="{{cde_display_name}}" width="200" style="display: block; margin: 0 auto; -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none;">{{else}}<div style="font-size: 24px; font-weight: 700; color: {{primary_color}};">{{cde_display_name}}</div>{{/if}}
                        </td>
                    </tr>

                    <!-- Título -->
                    <tr>
                        <td style="padding: 20px 20px 10px 20px; text-align: center; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <h1 style="margin: 0; font-size: 28px; color: #333333; font-weight: bold;">La cotización fue rechazada</h1>
                        </td>
                    </tr>

                    <!-- Subtítulo -->
                    <tr>
                        <td style="padding: 0 20px 10px 20px; text-align: center; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <p style="margin: 0; font-size: 16px; color: #666666;">La cotización no fue aceptada. Detalles a continuación.</p>
                        </td>
                    </tr>

                    <!-- Motivo del rechazo -->
                    {{#if rejection_reason}}
                    <tr>
                        <td style="padding: 10px 40px 30px 40px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #fff3f3; border-left: 3px solid #cc0000; border-radius: 4px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td style="padding: 12px 16px; font-size: 14px; color: #555555; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        <strong style="color: #cc0000;">Motivo:</strong> {{rejection_reason}}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    {{/if}}

                    <!-- Cotización y Fecha -->
                    <tr>
                        <td style="padding: 20px 40px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td style="text-align: left; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        <span style="display: inline-block; padding: 10px 20px; background-color: {{primary_color_bg}}; border: 1.2px solid {{primary_color}}; border-radius: 20px; color: {{primary_color}}; font-size: 14px; font-weight: bold;">Cotización #{{display_id}}</span>
                                    </td>
                                    {{#if order_date_formatted}}<td style="text-align: right; color: #666666; font-size: 14px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">{{order_date_formatted}}</td>{{/if}}
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Resumen -->
                    {{#if order_items}}
                    <tr>
                        <td style="padding: 20px 40px 10px 40px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <h2 style="margin: 0; font-size: 18px; color: {{primary_color}}; font-weight: bold;">Resumen de la cotización</h2>
                        </td>
                    </tr>
                    {{#each order_items}}
                    <tr>
                        <td style="padding: 0 40px 20px 40px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8f9fa; border-radius: 8px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td style="padding: 15px; width: 80px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        {{#if this.thumbnail}}<img src="{{this.thumbnail}}" alt="{{this.title}}" width="80" style="display: block; border-radius: 4px; -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none;">{{/if}}
                                    </td>
                                    <td style="padding: 15px; vertical-align: middle; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        <p style="margin: 0 0 5px 0; font-size: 16px; color: #333333; font-weight: bold;">{{this.title}}</p>
                                        <p style="margin: 0; font-size: 14px; color: #666666;">{{this.quantity}} x $ {{this.unit_price_formatted}}</p>
                                    </td>
                                    <td style="padding: 15px; text-align: right; vertical-align: middle; font-size: 16px; color: #333333; font-weight: bold; white-space: nowrap; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        $ {{this.line_total_formatted}}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    {{/each}}

                    <!-- Subtotal y Envío -->
                    <tr>
                        <td style="padding: 0 40px 15px 40px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td style="padding: 8px 0; color: #666666; font-size: 14px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">Subtotal</td>
                                    <td style="padding: 8px 0; text-align: right; color: #666666; font-size: 14px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">$ {{subtotal_formatted}}</td>
                                </tr>
                                {{#each discounts}}
                                <tr>
                                    <td style="padding: 8px 0; color: #15803d; font-size: 14px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">{{this.label}}</td>
                                    <td style="padding: 8px 0; text-align: right; color: #15803d; font-size: 14px; font-weight: 600; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">{{#if this.makes_free}}Gratis{{else}}-$ {{this.amount_formatted}}{{/if}}</td>
                                </tr>
                                {{/each}}
                                <tr>
                                    <td style="padding: 8px 0; color: #666666; font-size: 14px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">Envío estimado</td>
                                    <td style="padding: 8px 0; text-align: right; color: #666666; font-size: 14px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">{{shipping_formatted}}</td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    {{/if}}

                    <!-- Total -->
                    <tr>
                        <td style="padding: 15px 40px 30px 40px; border-top: 1px solid #EFEFEF; border-bottom: 1px solid #e0e0e0; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td style="padding: 10px 0; color: #333333; font-size: 18px; font-weight: bold; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">Total</td>
                                    <td style="padding: 10px 0; text-align: right; color: #333333; font-size: 18px; font-weight: bold; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">$ {{total}}</td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 20px; background-color: {{primary_color}}; text-align: center; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <p style="margin: 0; color: #ffffff; font-size: 12px;">© {{year}} {{cde_display_name}}. Todos los derechos reservados.</p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

// ─────────────────────────────────────────────────────────────────────────────
// kit-cde-notification
// ─────────────────────────────────────────────────────────────────────────────
const KIT_CDE_NOTIFICATION_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{subject}}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; width: 100%; font-family: 'Inter', Arial, sans-serif;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5; font-family: 'Inter', Arial, sans-serif; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
        <tr>
            <td style="padding: 20px 0; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="600" style="margin: auto; background-color: #ffffff; max-width: 600px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">

                    <!-- Logo -->
                    {{#if logo_url}}
                    <tr>
                        <td style="padding: 30px 20px 20px 20px; text-align: center; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <img src="{{logo_url}}" alt="Mercatto" width="180" style="display: block; margin: 0 auto; -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none;">
                        </td>
                    </tr>
                    {{/if}}

                    <!-- Header -->
                    <tr>
                        <td style="padding: 28px 32px; background-color: #2e7d32; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700;">📦 Nuevo kit para preparar</h1>
                            <p style="margin: 6px 0 0; color: rgba(255,255,255,0.75); font-size: 14px;">{{cde_name}}</p>
                        </td>
                    </tr>

                    <!-- Fecha y Número de pedido -->
                    <tr>
                        <td style="padding: 28px 32px 0 32px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            {{#if order_date_formatted}}<p style="margin: 0 0 8px; font-size: 14px; color: #555555;">Fecha del pedido: <strong style="color: #333333;">{{order_date_formatted}}</strong></p>{{/if}}
                            <p style="margin: 0 0 24px; font-size: 14px; color: #555555;">
                                Número de pedido:
                                <span style="display: inline-block; margin-left: 6px; padding: 4px 14px; background-color: rgba(46,125,50,0.1); border: 1.2px solid #2e7d32; border-radius: 20px; color: #2e7d32; font-size: 13px; font-weight: 700;">#{{order_display_id}}</span>
                            </p>
                        </td>
                    </tr>

                    <!-- Bloque Cliente -->
                    <tr>
                        <td style="padding: 0 32px 24px 32px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: rgba(46,125,50,0.1); border-left: 4px solid #2e7d32; border-radius: 4px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td style="padding: 14px 18px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        <p style="margin: 0 0 4px; font-size: 13px; font-weight: 700; color: #2e7d32;">Cliente</p>
                                        <p style="margin: 0 0 2px; font-size: 14px; color: #111111;">{{customer_name}}</p>
                                        <p style="margin: 0; font-size: 13px;"><a href="mailto:{{customer_email}}" style="color: #2e7d32; text-decoration: none; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">{{customer_email}}</a></p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Productos a preparar - título -->
                    <tr>
                        <td style="padding: 0 32px 12px 32px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <h2 style="margin: 0; font-size: 16px; font-weight: 700; color: #2e7d32;">Productos a preparar</h2>
                        </td>
                    </tr>
                    {{#each order_items}}
                    <tr>
                        <td style="padding: 0 32px 12px 32px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8f9fa; border-radius: 8px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td style="padding: 15px; width: 80px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        {{#if this.thumbnail}}<img src="{{this.thumbnail}}" alt="{{this.title}}" width="80" style="display: block; border-radius: 4px; -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none;">{{/if}}
                                    </td>
                                    <td style="padding: 15px; vertical-align: middle; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        <p style="margin: 0 0 5px 0; font-size: 16px; color: #333333; font-weight: bold;">{{this.title}}</p>
                                        <p style="margin: 0; font-size: 14px; color: #666666;">{{this.quantity}} x $ {{this.unit_price_formatted}}</p>
                                    </td>
                                    <td style="padding: 15px; text-align: right; vertical-align: middle; font-size: 16px; color: #333333; font-weight: bold; white-space: nowrap; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        $ {{this.line_total_formatted}}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    {{/each}}

                    <!-- Total -->
                    <tr>
                        <td style="padding: 8px 32px 24px 32px; text-align: right; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <p style="margin: 0; font-size: 15px; font-weight: 700; color: #111111;">Total: $ {{order_total_formatted}}</p>
                        </td>
                    </tr>

                    <!-- Validación de entrega -->
                    {{#if pickup_url}}
                    <tr>
                        <td style="padding: 0 32px 28px 32px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f0fdf4; border-left: 4px solid #16a34a; border-radius: 4px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td style="padding: 16px 20px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        <p style="margin: 0 0 6px; font-size: 13px; font-weight: 700; color: #15803d;">Validación de entrega</p>
                                        <p style="margin: 0 0 12px; font-size: 13px; color: #374151;">Cuando el cliente venga a retirar, usá este enlace para confirmar la entrega:</p>
                                        <a href="{{pickup_url}}" style="display: inline-block; background-color: #16a34a; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; padding: 10px 20px; border-radius: 6px; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">Validar entrega →</a>
                                        {{#if delivery_pin}}
                                        <p style="margin: 14px 0 6px; font-size: 13px; color: #374151;">Ingresá este PIN para confirmar la entrega:</p>
                                        <p style="margin: 0; font-size: 22px; font-weight: 700; color: #15803d; letter-spacing: 4px; font-family: 'Inter', Arial, sans-serif;">{{delivery_pin}}</p>
                                        {{/if}}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    {{/if}}

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 20px; background-color: #2e7d32; text-align: center; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <p style="margin: 0; color: #ffffff; font-size: 12px;">© {{year}} Mercatto. Todos los derechos reservados.</p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

// ─────────────────────────────────────────────────────────────────────────────
// order-tracking
// ─────────────────────────────────────────────────────────────────────────────
const ORDER_TRACKING_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;width:100%;font-family:'Inter',Arial,sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f5f5f5;font-family:'Inter',Arial,sans-serif;mso-table-lspace:0pt;mso-table-rspace:0pt;">
    <tr>
      <td style="padding:20px 0;mso-table-lspace:0pt;mso-table-rspace:0pt;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="600" style="margin:auto;background-color:#ffffff;max-width:600px;mso-table-lspace:0pt;mso-table-rspace:0pt;">

          <tr>
            <td style="padding:40px 20px 20px 20px;text-align:center;mso-table-lspace:0pt;mso-table-rspace:0pt;">
              {{#if logo_url}}<img src="{{logo_url}}" alt="{{cde_display_name}}" width="200" style="display:block;margin:0 auto;-ms-interpolation-mode:bicubic;border:0;height:auto;line-height:100%;outline:none;text-decoration:none;">{{else}}<div style="font-size:24px;font-weight:700;color:{{primary_color}};">{{cde_display_name}}</div>{{/if}}
            </td>
          </tr>

          <tr>
            <td style="padding:10px 20px 6px 20px;text-align:center;mso-table-lspace:0pt;mso-table-rspace:0pt;">
              <h1 style="margin:0;font-size:26px;color:#13354F;font-weight:bold;">{{title_main}}{{#if customer_name}}, {{customer_name}}{{/if}}</h1>
            </td>
          </tr>

          <tr>
            <td style="padding:0 20px 28px 20px;text-align:center;mso-table-lspace:0pt;mso-table-rspace:0pt;">
              <p style="margin:0;font-size:15px;color:#666666;">{{title_sub}}</p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 40px 28px 40px;mso-table-lspace:0pt;mso-table-rspace:0pt;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="mso-table-lspace:0pt;mso-table-rspace:0pt;">
                <tr>
                  <td style="mso-table-lspace:0pt;mso-table-rspace:0pt;">
                    <span style="display:inline-block;padding:8px 18px;background-color:{{primary_color_bg}};border:1.2px solid {{primary_color}};border-radius:20px;color:{{primary_color}};font-size:14px;font-weight:bold;">Pedido #{{display_id}}</span>
                  </td>
                  {{#if order_date_formatted}}<td style="text-align:right;color:#666666;font-size:13px;mso-table-lspace:0pt;mso-table-rspace:0pt;">{{order_date_formatted}}</td>{{/if}}
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

                {{#if shipping_name}}
                <tr>
                  <td style="padding:16px 20px 0 20px;mso-table-lspace:0pt;mso-table-rspace:0pt;">
                    <p style="margin:0 0 4px 0;font-size:12px;font-weight:600;letter-spacing:0.02em;color:#13354F;">Dirección de envío</p>
                    {{#if shipping_name}}<p style="margin:0;font-size:14px;color:#1D2530;">{{shipping_name}}</p>{{/if}}
                    {{#if shipping_street}}<p style="margin:0;font-size:14px;color:#1D2530;">{{shipping_street}}</p>{{/if}}
                    {{#if shipping_city}}<p style="margin:0;font-size:14px;color:#1D2530;">{{shipping_city}}</p>{{/if}}
                  </td>
                </tr>
                {{/if}}

                <tr>
                  <td style="padding:16px 20px 20px 20px;mso-table-lspace:0pt;mso-table-rspace:0pt;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="mso-table-lspace:0pt;mso-table-rspace:0pt;">
                      {{#each timeline_steps}}
                      <tr>
                        <td style="width:40px;text-align:center;vertical-align:top;padding:0;mso-table-lspace:0pt;mso-table-rspace:0pt;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="mso-table-lspace:0pt;mso-table-rspace:0pt;">
                            <tr>
                              <td style="width:32px;height:32px;border-radius:50%;background-color:{{#if this.done}}#1C82AD{{else}}#ffffff{{/if}};border:2px solid {{#if this.done}}#1C82AD{{else}}#E5E7EB{{/if}};text-align:center;vertical-align:middle;mso-table-lspace:0pt;mso-table-rspace:0pt;line-height:0;">
                                {{#if this.icon_url}}<img src="{{this.icon_url}}" alt="" width="14" height="14" style="display:block;margin:0 auto;border:0;line-height:100%;outline:none;text-decoration:none;">{{else}}&#8226;{{/if}}
                              </td>
                            </tr>
                          </table>
                        </td>
                        <td style="padding:0 0 16px 12px;vertical-align:top;mso-table-lspace:0pt;mso-table-rspace:0pt;">
                          <p style="margin:0;font-size:14px;color:{{#if this.done}}#1D2530{{else}}#8899A8{{/if}};font-weight:{{#if this.done}}500{{else}}400{{/if}};line-height:1.4;">{{this.label}}</p>
                          {{#if this.date_formatted}}<p style="margin:4px 0 0 0;font-size:12px;color:#8899A8;">{{this.date_formatted}}</p>{{/if}}
                        </td>
                      </tr>
                      {{/each}}
                    </table>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:20px;background-color:{{primary_color}};text-align:center;mso-table-lspace:0pt;mso-table-rspace:0pt;">
              <p style="margin:0;color:#ffffff;font-size:12px;">© {{year}} {{cde_display_name}}. Todos los derechos reservados.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

// ─────────────────────────────────────────────────────────────────────────────
// order-cancelled
// ─────────────────────────────────────────────────────────────────────────────
const ORDER_CANCELLED_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;width:100%;font-family:'Inter',Arial,sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f5f5f5;font-family:'Inter',Arial,sans-serif;">
    <tr>
      <td style="padding:20px 0;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="600" style="margin:auto;background-color:#ffffff;max-width:600px;">
          <tr>
            <td style="padding:40px 20px 20px 20px;text-align:center;">
              {{#if logo_url}}<img src="{{logo_url}}" alt="{{cde_display_name}}" width="200" style="display:block;margin:0 auto;border:0;height:auto;">{{else}}<div style="font-size:24px;font-weight:700;color:{{primary_color}};">{{cde_display_name}}</div>{{/if}}
            </td>
          </tr>
          <tr>
            <td style="padding:10px 20px 6px 20px;text-align:center;">
              <h1 style="margin:0;font-size:28px;color:#D92D20;font-weight:700;">Tu pedido fue cancelado{{#if customer_name}}, {{customer_name}}{{/if}}</h1>
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
                    <p style="margin:0 0 6px 0;color:#1D2530;font-size:14px;"><strong>Pedido #{{display_id}}</strong></p>
                    {{#if order_date_formatted}}<p style="margin:0;color:#667085;font-size:13px;">Fecha: {{order_date_formatted}}</p>{{/if}}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px;background-color:{{primary_color}};text-align:center;">
              <p style="margin:0;color:#ffffff;font-size:12px;">© {{year}} {{cde_display_name}}. Todos los derechos reservados.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

// ─────────────────────────────────────────────────────────────────────────────
// stock-sync-report
// ─────────────────────────────────────────────────────────────────────────────
const STOCK_SYNC_REPORT_HTML = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>{{subject}}</title></head>
<body style="margin:0;padding:20px;background:#f5f5f5;font-family:Inter,Arial,sans-serif;">
  <table cellspacing="0" cellpadding="0" border="0" align="center" width="600" style="margin:auto;background:#fff;max-width:600px;">
    <tr>
      <td style="padding:24px 32px;border-bottom:3px solid {{status_color}};">
        <h1 style="margin:0;font-size:20px;color:#333;">Sync Stock CRM → Medusa</h1>
        <p style="margin:6px 0 0 0;color:{{status_color}};font-size:16px;font-weight:600;">{{status_label}}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 32px;">
        {{#if error_message}}
        <div style="background:#fff3f3;border-left:3px solid #cc0000;padding:12px 16px;margin:0 0 16px 0;border-radius:4px;">
          <strong style="color:#cc0000;">Error:</strong>
          <span style="color:#333;">{{error_message}}</span>
        </div>
        {{/if}}
        <table cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr><td style="padding:6px 12px;color:#666;font-size:14px;border-bottom:1px solid #eee;">Inicio</td><td style="padding:6px 12px;color:#333;font-size:14px;font-weight:600;border-bottom:1px solid #eee;text-align:right;">{{#if started_at}}{{started_at}}{{else}}—{{/if}}</td></tr>
          <tr><td style="padding:6px 12px;color:#666;font-size:14px;border-bottom:1px solid #eee;">Fin</td><td style="padding:6px 12px;color:#333;font-size:14px;font-weight:600;border-bottom:1px solid #eee;text-align:right;">{{#if finished_at}}{{finished_at}}{{else}}—{{/if}}</td></tr>
          <tr><td style="padding:6px 12px;color:#666;font-size:14px;border-bottom:1px solid #eee;">Duración (s)</td><td style="padding:6px 12px;color:#333;font-size:14px;font-weight:600;border-bottom:1px solid #eee;text-align:right;">{{#if duration_seconds}}{{duration_seconds}}{{else}}—{{/if}}</td></tr>
          <tr><td style="padding:6px 12px;color:#666;font-size:14px;border-bottom:1px solid #eee;">Total registros CRM</td><td style="padding:6px 12px;color:#333;font-size:14px;font-weight:600;border-bottom:1px solid #eee;text-align:right;">{{#if total_crm}}{{total_crm}}{{else}}—{{/if}}</td></tr>
          <tr><td style="padding:6px 12px;color:#666;font-size:14px;border-bottom:1px solid #eee;">Matcheados</td><td style="padding:6px 12px;color:#333;font-size:14px;font-weight:600;border-bottom:1px solid #eee;text-align:right;">{{#if matched}}{{matched}}{{else}}—{{/if}}</td></tr>
          <tr><td style="padding:6px 12px;color:#666;font-size:14px;border-bottom:1px solid #eee;">Levels actualizados</td><td style="padding:6px 12px;color:#333;font-size:14px;font-weight:600;border-bottom:1px solid #eee;text-align:right;">{{#if updated}}{{updated}}{{else}}—{{/if}}</td></tr>
          <tr><td style="padding:6px 12px;color:#666;font-size:14px;border-bottom:1px solid #eee;">Levels creados</td><td style="padding:6px 12px;color:#333;font-size:14px;font-weight:600;border-bottom:1px solid #eee;text-align:right;">{{#if created_levels}}{{created_levels}}{{else}}—{{/if}}</td></tr>
          <tr><td style="padding:6px 12px;color:#666;font-size:14px;border-bottom:1px solid #eee;">SKUs sin variante en Medusa</td><td style="padding:6px 12px;color:#333;font-size:14px;font-weight:600;border-bottom:1px solid #eee;text-align:right;">{{#if not_found_count}}{{not_found_count}}{{else}}—{{/if}}</td></tr>
          <tr><td style="padding:6px 12px;color:#666;font-size:14px;border-bottom:1px solid #eee;">Productos afectados</td><td style="padding:6px 12px;color:#333;font-size:14px;font-weight:600;border-bottom:1px solid #eee;text-align:right;">{{#if affected_products_count}}{{affected_products_count}}{{else}}—{{/if}}</td></tr>
          <tr><td style="padding:6px 12px;color:#666;font-size:14px;border-bottom:1px solid #eee;">Errores</td><td style="padding:6px 12px;color:#333;font-size:14px;font-weight:600;border-bottom:1px solid #eee;text-align:right;">{{#if errors_count}}{{errors_count}}{{else}}—{{/if}}</td></tr>
          <tr><td style="padding:6px 12px;color:#666;font-size:14px;border-bottom:1px solid #eee;">Stock Location</td><td style="padding:6px 12px;color:#333;font-size:14px;font-weight:600;border-bottom:1px solid #eee;text-align:right;">{{#if location_id}}{{location_id}}{{else}}—{{/if}}</td></tr>
        </table>
        {{#if not_found_skus_sample}}
        <h3 style="font-size:14px;margin:24px 0 8px 0;color:#333;">SKUs no encontrados (muestra)</h3>
        <pre style="background:#f7f7f7;padding:10px;border-radius:4px;font-size:12px;color:#333;white-space:pre-wrap;word-break:break-all;">{{not_found_skus_joined}}</pre>
        {{/if}}
        {{#if errors_sample}}
        <h3 style="font-size:14px;margin:24px 0 8px 0;color:#cc0000;">Errores (muestra)</h3>
        <pre style="background:#fff3f3;padding:10px;border-radius:4px;font-size:12px;color:#333;white-space:pre-wrap;">{{#each errors_sample}}{{this.sku}}: {{this.error}}
{{/each}}</pre>
        {{/if}}
      </td>
    </tr>
    <tr>
      <td style="padding:16px 32px;background:#fafafa;color:#999;font-size:12px;text-align:center;">
        Reporte automático del job sync-stock-from-crm.
      </td>
    </tr>
  </table>
</body>
</html>`;

// ─────────────────────────────────────────────────────────────────────────────
// company-register-admin
// ─────────────────────────────────────────────────────────────────────────────
const COMPANY_REGISTER_ADMIN_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{subject}}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; width: 100%; font-family: 'Inter', Arial, sans-serif;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5; font-family: 'Inter', Arial, sans-serif; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
        <tr>
            <td style="padding: 20px 0; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="600" style="margin: auto; background-color: #ffffff; max-width: 600px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">

                    <!-- Logo -->
                    <tr>
                        <td style="padding: 40px 20px 12px 20px; text-align: center; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            {{#if logo_url}}<img src="{{logo_url}}" alt="{{cde_display_name}}" width="170" style="display: block; margin: 0 auto; -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none;">{{else}}<div style="font-size: 24px; font-weight: 700; color: {{primary_color}};">{{cde_display_name}}</div>{{/if}}
                        </td>
                    </tr>

                    <!-- Título -->
                    <tr>
                        <td style="padding: 12px 20px 8px 20px; text-align: center; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <h1 style="margin: 0; font-size: 24px; color: #111111; font-weight: bold;">Nueva empresa registrada</h1>
                        </td>
                    </tr>

                    <!-- Subtítulo -->
                    <tr>
                        <td style="padding: 0 20px 24px 20px; text-align: center; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <p style="margin: 0; font-size: 14px; color: #666666;">Se registró una nueva empresa en la tienda.</p>
                        </td>
                    </tr>

                    <!-- Datos de la empresa -->
                    <tr>
                        <td style="padding: 0 40px 24px 40px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border: 1px solid #e5e7eb; border-radius: 14px; border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td style="padding: 20px 24px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        <h3 style="margin: 0 0 12px 0; font-size: 16px; color: {{primary_color}}; font-weight: bold;">Datos de la empresa</h3>
                                        <p style="margin: 0 0 6px; font-size: 14px; color: #333333;"><span style="color:#666666;">Empresa:</span> <strong>{{nombre_empresa}}</strong></p>
                                        <p style="margin: 0 0 6px; font-size: 13px; color: #333333;"><span style="color:#666666;">Email:</span> <a href="mailto:{{email}}" style="color: {{primary_color}}; text-decoration: none; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">{{email}}</a></p>
                                        {{#if legal_name}}<p style="margin: 0 0 6px; font-size: 13px; color: #333333;"><span style="color:#666666;">Razón social:</span> {{legal_name}}</p>{{/if}}
                                        {{#if tax_id}}<p style="margin: 0; font-size: 13px; color: #333333;"><span style="color:#666666;">CUIT / Tax ID:</span> {{tax_id}}</p>{{/if}}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 18px; background-color: {{primary_color}}; text-align: center; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <p style="margin: 0; color: #ffffff; font-size: 12px;">© {{year}} {{cde_display_name}}. Todos los derechos reservados.</p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

// ─────────────────────────────────────────────────────────────────────────────
// corporate-register (acuse al usuario / empresa)
// ─────────────────────────────────────────────────────────────────────────────
const CORPORATE_REGISTER_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{subject}}</title>
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
                            {{#if logo_url}}<img src="{{logo_url}}" alt="{{cde_display_name}}" width="200" style="display: block; margin: 0 auto; -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none;">{{else}}<div style="font-size: 24px; font-weight: 700; color: {{primary_color}};">{{cde_display_name}}</div>{{/if}}
                        </td>
                    </tr>

                    <!-- Contenido -->
                    <tr>
                        <td style="padding: 20px 40px 32px 40px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 700; color: #111111;">Recibimos tu solicitud{{#if nombre_empresa}}, {{nombre_empresa}}{{/if}}</h1>
                            <p style="margin: 0 0 16px; font-size: 18px; font-weight: 600; color: #111111;">Tu solicitud de registro corporativo está en revisión.</p>
                            <p style="margin: 0 0 12px; font-size: 14px; color: #555555;">Gracias por tu interés. Nuestro equipo revisará tu solicitud y te avisaremos por este medio cuando sea aprobada o rechazada.</p>
                            <p style="margin: 0 0 24px; font-size: 14px; color: #555555;">Email de contacto: <a href="mailto:{{email}}" style="color: {{primary_color}}; text-decoration: none; font-weight: 600; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">{{email}}</a></p>
                            <p style="margin: 0; font-size: 14px; color: #666666;">Si no realizaste esta solicitud, podés ignorar este mensaje.</p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 20px; background-color: {{primary_color}}; text-align: center; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <p style="margin: 0; color: #ffffff; font-size: 12px;">© {{year}} {{cde_display_name}}. Todos los derechos reservados.</p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

// ─────────────────────────────────────────────────────────────────────────────
// corporate-register-admin
// ─────────────────────────────────────────────────────────────────────────────
const CORPORATE_REGISTER_ADMIN_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{subject}}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; width: 100%; font-family: 'Inter', Arial, sans-serif;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5; font-family: 'Inter', Arial, sans-serif; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
        <tr>
            <td style="padding: 20px 0; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="600" style="margin: auto; background-color: #ffffff; max-width: 600px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">

                    <!-- Logo -->
                    <tr>
                        <td style="padding: 40px 20px 12px 20px; text-align: center; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            {{#if logo_url}}<img src="{{logo_url}}" alt="{{cde_display_name}}" width="170" style="display: block; margin: 0 auto; -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none;">{{else}}<div style="font-size: 24px; font-weight: 700; color: {{primary_color}};">{{cde_display_name}}</div>{{/if}}
                        </td>
                    </tr>

                    <!-- Título -->
                    <tr>
                        <td style="padding: 12px 20px 8px 20px; text-align: center; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <h1 style="margin: 0; font-size: 24px; color: #111111; font-weight: bold;">Nueva solicitud corporativa</h1>
                        </td>
                    </tr>

                    <!-- Subtítulo -->
                    <tr>
                        <td style="padding: 0 20px 8px 20px; text-align: center; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <p style="margin: 0; font-size: 14px; color: #666666;">Una cuenta corporativa solicitó registrarse y está pendiente de aprobación.</p>
                        </td>
                    </tr>

                    <!-- Badge pendiente -->
                    <tr>
                        <td style="padding: 4px 20px 24px 20px; text-align: center; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <span style="display: inline-block; padding: 6px 16px; background-color: #fff7ed; border: 1.2px solid #f59e0b; border-radius: 20px; color: #b45309; font-size: 13px; font-weight: bold;">Pendiente de aprobación</span>
                        </td>
                    </tr>

                    <!-- Datos de la solicitud -->
                    <tr>
                        <td style="padding: 0 40px 24px 40px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border: 1px solid #e5e7eb; border-radius: 14px; border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td style="padding: 20px 24px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        <h3 style="margin: 0 0 12px 0; font-size: 16px; color: {{primary_color}}; font-weight: bold;">Datos de la solicitud</h3>
                                        <p style="margin: 0 0 6px; font-size: 14px; color: #333333;"><span style="color:#666666;">Empresa:</span> <strong>{{nombre_empresa}}</strong></p>
                                        <p style="margin: 0 0 6px; font-size: 13px; color: #333333;"><span style="color:#666666;">Email:</span> <a href="mailto:{{email}}" style="color: {{primary_color}}; text-decoration: none; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">{{email}}</a></p>
                                        {{#if email_domain}}<p style="margin: 0 0 6px; font-size: 13px; color: #333333;"><span style="color:#666666;">Dominio de email:</span> {{email_domain}}</p>{{/if}}
                                        {{#if legal_name}}<p style="margin: 0 0 6px; font-size: 13px; color: #333333;"><span style="color:#666666;">Razón social:</span> {{legal_name}}</p>{{/if}}
                                        {{#if tax_id}}<p style="margin: 0; font-size: 13px; color: #333333;"><span style="color:#666666;">CUIT / Tax ID:</span> {{tax_id}}</p>{{/if}}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 18px; background-color: {{primary_color}}; text-align: center; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <p style="margin: 0; color: #ffffff; font-size: 12px;">© {{year}} {{cde_display_name}}. Todos los derechos reservados.</p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

// ─────────────────────────────────────────────────────────────────────────────
// contact-received (acuse al usuario)
// ─────────────────────────────────────────────────────────────────────────────
const CONTACT_RECEIVED_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{subject}}</title>
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
                            {{#if logo_url}}<img src="{{logo_url}}" alt="{{cde_display_name}}" width="200" style="display: block; margin: 0 auto; -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none;">{{else}}<div style="font-size: 24px; font-weight: 700; color: {{primary_color}};">{{cde_display_name}}</div>{{/if}}
                        </td>
                    </tr>

                    <!-- Contenido -->
                    <tr>
                        <td style="padding: 20px 40px 24px 40px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 700; color: #111111;">Recibimos tu mensaje{{#if first_name}}, {{first_name}}{{/if}}</h1>
                            <p style="margin: 0 0 16px; font-size: 18px; font-weight: 600; color: #111111;">Gracias por escribirnos.</p>
                            <p style="margin: 0 0 12px; font-size: 14px; color: #555555;">Recibimos tu mensaje y te responderemos a la brevedad. Una copia de lo que nos enviaste:</p>
                        </td>
                    </tr>

                    <!-- Mensaje enviado -->
                    {{#if message}}
                    <tr>
                        <td style="padding: 0 40px 24px 40px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8f9fa; border-left: 3px solid {{primary_color}}; border-radius: 4px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td style="padding: 16px 18px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        <p style="margin: 0; font-size: 14px; color: #333333; line-height: 1.5; white-space: pre-wrap;">{{message}}</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    {{/if}}

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 20px; background-color: {{primary_color}}; text-align: center; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <p style="margin: 0; color: #ffffff; font-size: 12px;">© {{year}} {{cde_display_name}}. Todos los derechos reservados.</p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

// ─────────────────────────────────────────────────────────────────────────────
// contact-notification-admin
// ─────────────────────────────────────────────────────────────────────────────
const CONTACT_NOTIFICATION_ADMIN_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{subject}}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; width: 100%; font-family: 'Inter', Arial, sans-serif;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5; font-family: 'Inter', Arial, sans-serif; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
        <tr>
            <td style="padding: 20px 0; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="600" style="margin: auto; background-color: #ffffff; max-width: 600px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">

                    <!-- Logo -->
                    <tr>
                        <td style="padding: 40px 20px 12px 20px; text-align: center; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            {{#if logo_url}}<img src="{{logo_url}}" alt="{{cde_display_name}}" width="170" style="display: block; margin: 0 auto; -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none;">{{else}}<div style="font-size: 24px; font-weight: 700; color: {{primary_color}};">{{cde_display_name}}</div>{{/if}}
                        </td>
                    </tr>

                    <!-- Título -->
                    <tr>
                        <td style="padding: 12px 20px 8px 20px; text-align: center; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <h1 style="margin: 0; font-size: 24px; color: #111111; font-weight: bold;">Nuevo mensaje de contacto</h1>
                        </td>
                    </tr>

                    <!-- Subtítulo -->
                    <tr>
                        <td style="padding: 0 20px 24px 20px; text-align: center; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <p style="margin: 0; font-size: 14px; color: #666666;">Se recibió una nueva consulta desde el formulario de contacto.</p>
                        </td>
                    </tr>

                    <!-- Datos del remitente -->
                    <tr>
                        <td style="padding: 0 40px 20px 40px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border: 1px solid #e5e7eb; border-radius: 14px; border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td style="padding: 20px 24px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        <h3 style="margin: 0 0 12px 0; font-size: 16px; color: {{primary_color}}; font-weight: bold;">Datos del remitente</h3>
                                        <p style="margin: 0 0 6px; font-size: 14px; color: #333333;"><span style="color:#666666;">Nombre:</span> <strong>{{first_name}}{{#if last_name}} {{last_name}}{{/if}}</strong></p>
                                        <p style="margin: 0 0 6px; font-size: 13px; color: #333333;"><span style="color:#666666;">Email:</span> <a href="mailto:{{email}}" style="color: {{primary_color}}; text-decoration: none; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">{{email}}</a></p>
                                        {{#if phone}}<p style="margin: 0; font-size: 13px; color: #333333;"><span style="color:#666666;">Teléfono:</span> {{phone}}</p>{{/if}}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Mensaje -->
                    {{#if message}}
                    <tr>
                        <td style="padding: 0 40px 24px 40px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8f9fa; border-left: 3px solid {{primary_color}}; border-radius: 4px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td style="padding: 16px 18px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        <p style="margin: 0 0 6px; font-size: 13px; font-weight: 700; color: {{primary_color}};">Mensaje</p>
                                        <p style="margin: 0; font-size: 14px; color: #333333; line-height: 1.5; white-space: pre-wrap;">{{message}}</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    {{/if}}

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 18px; background-color: {{primary_color}}; text-align: center; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <p style="margin: 0; color: #ffffff; font-size: 12px;">© {{year}} {{cde_display_name}}. Todos los derechos reservados.</p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

// ─────────────────────────────────────────────────────────────────────────────
// SEED
// ─────────────────────────────────────────────────────────────────────────────
const GIFT_CARD_EMAIL_HTML = `<!doctype html><html lang="es"><body style="margin:0;background:#f3f4f6;font-family:Arial,sans-serif;color:#111827"><table role="presentation" width="100%"><tr><td style="padding:32px 16px"><table role="presentation" width="600" style="max-width:600px;margin:auto;background:#fff;border-radius:20px;overflow:hidden"><tr><td style="padding:36px;background:{{primary_color}};color:#fff;text-align:center"><h1 style="margin:0 0 12px">Tu gift card</h1>{{#if balance}}<p style="margin:0;font-size:28px;font-weight:bold">Saldo: {{balance}} {{currency_code}}</p>{{else}}<p style="margin:0;font-size:28px;font-weight:bold">{{value}} {{currency_code}}</p>{{/if}}</td></tr><tr><td style="padding:32px;text-align:center">{{#if sender_name}}<p><strong>{{sender_name}}</strong> te envió un regalo.</p>{{/if}}{{#if message}}<p style="font-size:18px;color:#4b5563">“{{message}}”</p>{{/if}}{{#if days_remaining}}<p>Quedan <strong>{{days_remaining}} días</strong> para reclamarla.</p>{{/if}}{{#if landing_url}}<a href="{{landing_url}}" style="display:inline-block;margin-top:18px;padding:14px 24px;border-radius:10px;background:{{primary_color}};color:#fff;text-decoration:none;font-weight:bold">Ver y acreditar mi regalo</a>{{/if}}{{#if wallet_url}}<a href="{{wallet_url}}" style="display:inline-block;margin-top:18px;padding:14px 24px;border-radius:10px;background:{{primary_color}};color:#fff;text-decoration:none;font-weight:bold">Ver mi saldo</a>{{/if}}{{#if merchandising_url}}<p><a href="{{merchandising_url}}" style="color:{{primary_color}}">Ver qué puedo comprar</a></p>{{/if}}<p style="margin-top:24px;font-size:12px;color:#6b7280">Por seguridad, el código completo no se incluye en este email.</p></td></tr></table></td></tr></table></body></html>`;

const giftCardSeed = (key: string, name: string, subject: string): SeedEntry => ({
  key,
  name,
  description: 'Comunicación operativa de Gift Card Experience.',
  subject,
  html: GIFT_CARD_EMAIL_HTML,
  variables: [
    { name: 'landing_url', description: 'Enlace seguro de recepción' },
    { name: 'value', description: 'Valor acreditado' },
    { name: 'currency_code', description: 'Moneda' },
    { name: 'sender_name', description: 'Remitente visible' },
    { name: 'message', description: 'Mensaje del regalo' },
    { name: 'wallet_url', description: 'Enlace a la billetera del cliente' },
    { name: 'merchandising_url', description: 'Destino de recomendaciones' },
    { name: 'balance', description: 'Saldo atribuido disponible' },
    { name: 'days_remaining', description: 'Días restantes para reclamar' },
  ],
  sample_data: { landing_url: 'https://example.com/ar/gift-card/example', wallet_url: 'https://example.com/ar/account/gift-cards', merchandising_url: 'https://example.com/ar/store', value: 50000, balance: 25000, currency_code: 'ARS', sender_name: 'Matías', message: '¡Que lo disfrutes!', days_remaining: 7 },
  status: 'draft',
  locale: 'es-AR',
});

const ORDER_READY_FOR_PICKUP_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tu pedido est&aacute; listo para retirar</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;width:100%;font-family:Arial,sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f5f5f5;">
    <tr>
      <td style="padding:20px 0;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="600" style="margin:auto;background-color:#ffffff;max-width:600px;">
          <tr><td style="padding:40px 20px 20px 20px;text-align:center;"><img src="{{logo_url}}" alt="{{cde_display_name}}" width="200" style="display:block;margin:0 auto;border:0;height:auto;"></td></tr>
          <tr><td style="padding:10px 20px 6px 20px;text-align:center;"><h1 style="margin:0;font-size:28px;color:{{primary_color}};font-weight:700;">Ya pod&eacute;s retirar tu pedido</h1></td></tr>
          <tr><td style="padding:0 20px 24px 20px;text-align:center;"><p style="margin:0;font-size:15px;color:#667085;">Tu pedido <strong style="color:#1D2530;">#{{display_id}}</strong> ya est&aacute; preparado y te espera en el local.</p></td></tr>
          <tr>
            <td style="padding:0 40px 24px 40px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border:1px solid #e5e7eb;border-radius:12px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 8px 0;font-size:12px;color:#667085;text-transform:uppercase;letter-spacing:0.04em;">Retiralo en</p>
                    {{#if pickup_store.name}}<p style="margin:0 0 6px 0;font-size:17px;color:#1D2530;font-weight:700;">{{pickup_store.name}}</p>{{/if}}
                    {{#if pickup_store.address}}<p style="margin:0 0 6px 0;font-size:14px;color:#667085;">{{pickup_store.address}}</p>{{/if}}
                    {{#if pickup_store.phone}}<p style="margin:0 0 6px 0;font-size:13px;color:#667085;">Tel.: {{pickup_store.phone}}</p>{{/if}}
                    {{#if pickup_hours}}<p style="margin:14px 0 6px 0;font-size:13px;color:#1D2530;font-weight:600;">Horarios de atenci&oacute;n</p>{{#each pickup_hours}}<p style="margin:0 0 4px 0;font-size:13px;color:#667085;">{{this}}</p>{{/each}}{{/if}}
                    {{#if pickup_store.map_url}}<p style="margin:14px 0 0 0;"><a href="{{pickup_store.map_url}}" style="color:{{primary_color}};font-size:13px;font-weight:600;text-decoration:none;">Ver c&oacute;mo llegar</a></p>{{/if}}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          {{#if pickup_instructions}}
          <tr>
            <td style="padding:0 40px 28px 40px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f9fafb;border-left:3px solid {{primary_color}};">
                <tr><td style="padding:14px 18px;"><p style="margin:0 0 4px 0;font-size:13px;color:#1D2530;font-weight:600;">Para retirarlo</p><p style="margin:0;font-size:13px;color:#667085;">{{pickup_instructions}}</p></td></tr>
              </table>
            </td>
          </tr>
          {{/if}}
          <tr><td style="padding:20px;background-color:{{primary_color}};text-align:center;"><p style="margin:0;color:#ffffff;font-size:12px;">&copy; {{year}} {{cde_display_name}}. Todos los derechos reservados.</p></td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const SEED: SeedEntry[] = [
  giftCardSeed('gift-card-delivery', 'Entrega de gift card', 'Recibiste un regalo'),
  giftCardSeed('gift-card-resend', 'Reenvío de gift card', 'Tu gift card, nuevamente'),
  giftCardSeed('gift-card-delivery-failed-buyer', 'Error de entrega al comprador', 'No pudimos entregar tu regalo'),
  giftCardSeed('gift-card-claimed', 'Gift card reclamada', 'Tu regalo fue acreditado'),
  giftCardSeed('gift-card-balance-reminder', 'Recordatorio de saldo', 'Todavía tenés saldo disponible'),
  giftCardSeed('gift-card-expiring', 'Próximo vencimiento', 'Tu gift card está por vencer'),
  {
    key: 'company-register',
    name: 'Registro de Empresa',
    description: 'Email de bienvenida enviado cuando se registra una nueva empresa.',
    subject: '¡Bienvenido!',
    html: COMPANY_REGISTER_HTML,
    variables: [
      { name: 'nombre_empresa', description: 'Nombre de la empresa registrada' },
      { name: 'email', description: 'Email de contacto de la empresa' },
    ],
    sample_data: {
      nombre_empresa: 'Distribuidora del Sur S.A.',
      email: 'contacto@distribuidoradelsur.com',
    },
    status: 'draft',
    locale: 'es-AR',
  },
  {
    key: 'customer-register',
    name: 'Registro de Cliente',
    description: 'Email de confirmación de registro / bienvenida para clientes.',
    subject: '[{{sales_channel_name}}] Confirmación de registro',
    html: CUSTOMER_REGISTER_HTML,
    variables: [
      { name: 'subject', description: 'Asunto del email (usado en el <title>)' },
      { name: 'name', description: 'Nombre completo del cliente (vacío si no hay)' },
      { name: 'email', description: 'Email registrado del cliente' },
      { name: 'logo_url', description: 'URL absoluta del logo del CDE' },
      { name: 'cde_display_name', description: 'Nombre del CDE / tienda' },
      { name: 'sales_channel_name', description: 'Nombre del canal de venta' },
      { name: 'primary_color', description: 'Color primario del tenant (hex)' },
      { name: 'year', description: 'Año actual para el footer' },
    ],
    sample_data: {
      subject: 'Confirmación de registro',
      name: 'Juan Pérez',
      email: 'juan.perez@example.com',
      logo_url: '',
      cde_display_name: 'Mercatto',
      sales_channel_name: 'Mercatto B2C',
      primary_color: '#2e7d32',
      year: 2026,
    },
    status: 'draft',
    locale: 'es-AR',
  },
  {
    key: 'b2b-client-approved',
    name: 'Cliente B2B Aprobado',
    description: 'Email enviado cuando un cliente B2B es aprobado por un administrador.',
    subject: '[{{cde_display_name}}] ¡Tu registro fue aprobado!',
    html: B2B_CLIENT_APPROVED_HTML,
    variables: [
      { name: 'subject', description: 'Asunto del email (usado en el <title>)' },
      { name: 'name', description: 'Nombre del cliente (vacío si no hay)' },
      { name: 'email', description: 'Email del cliente aprobado' },
      { name: 'company_name', description: 'Nombre de la empresa del cliente' },
      { name: 'logo_url', description: 'URL absoluta del logo del CDE' },
      { name: 'cde_display_name', description: 'Nombre del CDE / organización' },
    ],
    sample_data: {
      subject: '¡Tu registro fue aprobado!',
      name: 'María González',
      email: 'maria.gonzalez@empresa.com',
      company_name: 'Empresa Demo S.A.',
      logo_url: '',
      cde_display_name: 'Mercatto',
    },
    status: 'draft',
    locale: 'es-AR',
  },
  {
    key: 'password-reset',
    name: 'Restablecer Contraseña',
    description: 'Email con el enlace para restablecer la contraseña del cliente.',
    subject: '[{{sales_channel_name}}] Restablecer tu contraseña',
    html: PASSWORD_RESET_HTML,
    variables: [
      { name: 'subject', description: 'Asunto del email (usado en el <title>)' },
      { name: 'link_reseteo', description: 'URL de restablecimiento de contraseña' },
      { name: 'logo_url', description: 'URL absoluta del logo del CDE' },
      { name: 'cde_display_name', description: 'Nombre del CDE / tienda' },
      { name: 'sales_channel_name', description: 'Nombre del canal de venta' },
      { name: 'primary_color', description: 'Color primario del tenant (hex)' },
      { name: 'year', description: 'Año actual para el footer' },
    ],
    sample_data: {
      subject: 'Restablecer tu contraseña',
      link_reseteo: 'https://mercatto.app/reset-password?token=abc123',
      logo_url: '',
      cde_display_name: 'Mercatto',
      sales_channel_name: 'Mercatto B2C',
      primary_color: '#2e7d32',
      year: 2026,
    },
    status: 'draft',
    locale: 'es-AR',
  },
  {
    key: 'order-confirmation',
    name: 'Confirmación de Pedido',
    description: 'Recibo de compra para el cliente con resumen de items, totales y datos de envío.',
    subject: '¡Gracias por tu compra! Pedido #{{display_id}}',
    html: ORDER_CONFIRMATION_HTML,
    variables: [
      { name: 'display_id', description: 'Número de pedido a mostrar' },
      { name: 'logo_url', description: 'URL absoluta del logo del CDE' },
      { name: 'cde_display_name', description: 'Nombre del CDE / tienda' },
      { name: 'primary_color', description: 'Color primario del tenant (hex)' },
      { name: 'primary_color_bg', description: 'Color primario con opacidad (rgba) para fondos' },
      { name: 'order_date_formatted', description: 'Fecha del pedido formateada' },
      { name: 'order_items', description: 'Array de items {title, quantity, unit_price_formatted, line_total_formatted, thumbnail}' },
      { name: 'subtotal_formatted', description: 'Subtotal formateado' },
      { name: 'discounts', description: 'Array de descuentos {label, amount_formatted, makes_free}' },
      { name: 'shipping_display', description: 'Costo de envío a mostrar ("Gratis" o "$ x")' },
      { name: 'total', description: 'Total del pedido formateado' },
      { name: 'shipping_address_one_line', description: 'Dirección de envío en una línea' },
      { name: 'shipping_method_name', description: 'Nombre del método de envío' },
      { name: 'year', description: 'Año actual para el footer' },
    ],
    sample_data: {
      display_id: '1042',
      logo_url: '',
      cde_display_name: 'Mercatto',
      primary_color: '#2e7d32',
      primary_color_bg: 'rgba(46,125,50,0.1)',
      order_date_formatted: '16 jun 2026, 14:30',
      order_items: [
        {
          title: 'Yerba Mate Premium 1kg',
          quantity: 2,
          unit_price_formatted: '3.500',
          line_total_formatted: '7.000',
          thumbnail: '',
        },
        {
          title: 'Termo Acero Inoxidable',
          quantity: 1,
          unit_price_formatted: '12.500',
          line_total_formatted: '12.500',
          thumbnail: '',
        },
      ],
      subtotal_formatted: '19.500',
      discounts: [{ label: 'Descuento bienvenida', amount_formatted: '1.000', makes_free: false }],
      shipping_display: 'Gratis',
      total: '18.500',
      shipping_address_one_line: 'Av. Corrientes 1234, CABA, Buenos Aires, 1043',
      shipping_method_name: 'Envío a domicilio',
      year: 2026,
    },
    status: 'draft',
    locale: 'es-AR',
  },
  {
    key: 'order-notification-admin',
    name: 'Notificación de Orden',
    description: 'Aviso interno al admin de que llegó una nueva orden, con datos de cliente, envío, items y totales.',
    subject: '[Nueva orden] Pedido #{{display_id}}',
    html: ORDER_NOTIFICATION_ADMIN_HTML,
    variables: [
      { name: 'display_id', description: 'Número de pedido a mostrar' },
      { name: 'logo_url', description: 'URL absoluta del logo del CDE' },
      { name: 'cde_display_name', description: 'Nombre del CDE / tienda' },
      { name: 'primary_color', description: 'Color primario del tenant (hex)' },
      { name: 'primary_color_bg', description: 'Color primario con opacidad (rgba) para fondos' },
      { name: 'order_date_formatted', description: 'Fecha del pedido formateada' },
      { name: 'customer_name', description: 'Nombre del cliente' },
      { name: 'customer_email', description: 'Email del cliente' },
      { name: 'customer_phone', description: 'Teléfono del cliente' },
      { name: 'order_items', description: 'Array de items {title, quantity, unit_price_formatted, line_total_formatted, thumbnail, stock_status, stock_status_label, stock_status_color, stock_available_label}. Los campos stock_* sólo viajan acá, nunca al mail del cliente' },
      { name: 'subtotal_formatted', description: 'Subtotal formateado' },
      { name: 'discounts', description: 'Array de descuentos {label, amount_formatted, makes_free}' },
      { name: 'shipping_display', description: 'Costo de envío a mostrar ("Gratis" o "$ x")' },
      { name: 'total', description: 'Total del pedido formateado' },
      { name: 'shipping_address_one_line', description: 'Dirección de envío en una línea' },
      { name: 'shipping_method_name', description: 'Nombre del método de envío' },
      { name: 'payment_method_name', description: 'Nombre del método de pago' },
      { name: 'order_notes', description: 'Observaciones del pedido' },
      { name: 'stock_location_name', description: 'Nombre de la sucursal/depósito cuyo stock se evaluó en order_items' },
      { name: 'has_stock_issues', description: 'True si alguna línea de order_items quedó insufficient o none' },
      { name: 'year', description: 'Año actual para el footer' },
    ],
    sample_data: {
      display_id: '1042',
      logo_url: '',
      cde_display_name: 'Mercatto',
      primary_color: '#2e7d32',
      primary_color_bg: 'rgba(46,125,50,0.1)',
      order_date_formatted: '16 jun 2026, 14:30',
      customer_name: 'Juan Pérez',
      customer_email: 'juan.perez@example.com',
      customer_phone: '+54 11 5555-1234',
      order_items: [
        {
          title: 'Yerba Mate Premium 1kg',
          quantity: 2,
          unit_price_formatted: '3.500',
          line_total_formatted: '7.000',
          thumbnail: '',
          stock_status: 'available',
          stock_status_label: 'Stock disponible',
          stock_status_color: '#15803d',
          stock_available_label: '12',
        },
        {
          title: 'Termo Acero Inoxidable',
          quantity: 1,
          unit_price_formatted: '12.500',
          line_total_formatted: '12.500',
          thumbnail: '',
          stock_status: 'insufficient',
          stock_status_label: 'Stock insuficiente',
          stock_status_color: '#b45309',
          stock_available_label: '0',
        },
      ],
      subtotal_formatted: '19.500',
      discounts: [{ label: 'Descuento bienvenida', amount_formatted: '1.000', makes_free: false }],
      shipping_display: 'Gratis',
      total: '18.500',
      shipping_address_one_line: 'Av. Corrientes 1234, CABA, Buenos Aires, 1043',
      shipping_method_name: 'Envío a domicilio',
      payment_method_name: 'Tarjeta de crédito',
      order_notes: 'Entregar en horario de la tarde.',
      stock_location_name: 'Depósito Central',
      has_stock_issues: true,
      year: 2026,
    },
    status: 'draft',
    locale: 'es-AR',
  },
  {
    key: 'quotation-notification-admin',
    name: 'Notificación de Cotización',
    description: 'Notificación de nueva cotización (draft order) con resumen de productos y totales.',
    subject: '[{{sales_channel_name}}] Se generó una nueva cotización #{{display_id}}',
    html: QUOTATION_NOTIFICATION_ADMIN_HTML,
    variables: [
      { name: 'subject', description: 'Asunto del email (usado en el <title>)' },
      { name: 'display_id', description: 'Número de cotización a mostrar' },
      { name: 'logo_url', description: 'URL absoluta del logo del CDE' },
      { name: 'cde_display_name', description: 'Nombre del CDE / tienda' },
      { name: 'sales_channel_name', description: 'Nombre del canal de venta' },
      { name: 'primary_color', description: 'Color primario del tenant (hex)' },
      { name: 'primary_color_bg', description: 'Color primario con opacidad (rgba) para fondos' },
      { name: 'order_date_formatted', description: 'Fecha de la cotización formateada' },
      { name: 'order_items', description: 'Array de items {title, quantity, unit_price_formatted, line_total_formatted, thumbnail}' },
      { name: 'subtotal_formatted', description: 'Subtotal formateado' },
      { name: 'discounts', description: 'Array de descuentos {label, amount_formatted, makes_free}' },
      { name: 'shipping_formatted', description: 'Envío estimado formateado' },
      { name: 'total', description: 'Total de la cotización formateado' },
      { name: 'year', description: 'Año actual para el footer' },
    ],
    sample_data: {
      subject: 'Se generó una nueva cotización',
      display_id: 'COT-0087',
      logo_url: '',
      cde_display_name: 'Mercatto',
      sales_channel_name: 'Mercatto B2B',
      primary_color: '#2e7d32',
      primary_color_bg: 'rgba(46,125,50,0.1)',
      order_date_formatted: '16 jun 2026, 10:15',
      order_items: [
        {
          title: 'Caja de Vinos x6',
          quantity: 4,
          unit_price_formatted: '18.000',
          line_total_formatted: '72.000',
          thumbnail: '',
        },
      ],
      subtotal_formatted: '72.000',
      discounts: [],
      shipping_formatted: '2.500',
      total: '74.500',
      year: 2026,
    },
    status: 'draft',
    locale: 'es-AR',
  },
  {
    key: 'quotation-rejected-admin',
    name: 'Cotización Rechazada',
    description: 'Notificación de cotización rechazada con motivo y resumen de la cotización.',
    subject: '[{{sales_channel_name}}] La cotización fue rechazada #{{display_id}}',
    html: QUOTATION_REJECTED_ADMIN_HTML,
    variables: [
      { name: 'subject', description: 'Asunto del email (usado en el <title>)' },
      { name: 'display_id', description: 'Número de cotización a mostrar' },
      { name: 'rejection_reason', description: 'Motivo del rechazo (opcional)' },
      { name: 'logo_url', description: 'URL absoluta del logo del CDE' },
      { name: 'cde_display_name', description: 'Nombre del CDE / tienda' },
      { name: 'sales_channel_name', description: 'Nombre del canal de venta' },
      { name: 'primary_color', description: 'Color primario del tenant (hex)' },
      { name: 'primary_color_bg', description: 'Color primario con opacidad (rgba) para fondos' },
      { name: 'order_date_formatted', description: 'Fecha de la cotización formateada' },
      { name: 'order_items', description: 'Array de items {title, quantity, unit_price_formatted, line_total_formatted, thumbnail}' },
      { name: 'subtotal_formatted', description: 'Subtotal formateado' },
      { name: 'discounts', description: 'Array de descuentos {label, amount_formatted, makes_free}' },
      { name: 'shipping_formatted', description: 'Envío estimado formateado' },
      { name: 'total', description: 'Total de la cotización formateado' },
      { name: 'year', description: 'Año actual para el footer' },
    ],
    sample_data: {
      subject: 'La cotización fue rechazada',
      display_id: 'COT-0087',
      rejection_reason: 'Stock insuficiente para uno de los productos solicitados.',
      logo_url: '',
      cde_display_name: 'Mercatto',
      sales_channel_name: 'Mercatto B2B',
      primary_color: '#2e7d32',
      primary_color_bg: 'rgba(46,125,50,0.1)',
      order_date_formatted: '16 jun 2026, 10:15',
      order_items: [
        {
          title: 'Caja de Vinos x6',
          quantity: 4,
          unit_price_formatted: '18.000',
          line_total_formatted: '72.000',
          thumbnail: '',
        },
      ],
      subtotal_formatted: '72.000',
      discounts: [],
      shipping_formatted: '2.500',
      total: '74.500',
      year: 2026,
    },
    status: 'draft',
    locale: 'es-AR',
  },
  {
    key: 'kit-cde-notification',
    name: 'Notificación de Kit al CDE',
    description: 'Notificación al centro de distribución de un nuevo kit para preparar.',
    subject: 'Nuevo pedido para preparar — Kit #{{order_display_id}}',
    html: KIT_CDE_NOTIFICATION_HTML,
    variables: [
      { name: 'subject', description: 'Asunto del email (usado en el <title>)' },
      { name: 'logo_url', description: 'URL absoluta del logo de Mercatto' },
      { name: 'cde_name', description: 'Nombre del centro de distribución' },
      { name: 'order_display_id', description: 'Número de pedido a mostrar' },
      { name: 'order_date_formatted', description: 'Fecha del pedido formateada' },
      { name: 'customer_name', description: 'Nombre del cliente' },
      { name: 'customer_email', description: 'Email del cliente' },
      { name: 'order_items', description: 'Array de items {title, quantity, unit_price_formatted, line_total_formatted, thumbnail}' },
      { name: 'order_total_formatted', description: 'Total del pedido formateado' },
      { name: 'pickup_url', description: 'URL de validación de entrega' },
      { name: 'delivery_pin', description: 'PIN de entrega (opcional)' },
      { name: 'year', description: 'Año actual para el footer' },
    ],
    sample_data: {
      subject: 'Nuevo pedido para preparar — Kit #1042',
      logo_url: '',
      cde_name: 'CDE Palermo',
      order_display_id: '1042',
      order_date_formatted: '16 jun 2026, 14:30',
      customer_name: 'Juan Pérez',
      customer_email: 'juan.perez@example.com',
      order_items: [
        {
          title: 'Yerba Mate Premium 1kg',
          quantity: 2,
          unit_price_formatted: '3.500',
          line_total_formatted: '7.000',
          thumbnail: '',
        },
      ],
      order_total_formatted: '7.000',
      pickup_url: 'https://mercatto.app/pickup/validate/abc123',
      delivery_pin: '4821',
      year: 2026,
    },
    status: 'draft',
    locale: 'es-AR',
  },
  {
    key: 'order-tracking',
    name: 'Seguimiento de Pedido',
    description: 'Email de actualización de estado del pedido con timeline de seguimiento.',
    subject: '[{{sales_channel_name}}] {{subject}} #{{display_id}}',
    html: ORDER_TRACKING_HTML,
    variables: [
      { name: 'subject', description: 'Asunto según el hito (milestone) actual' },
      { name: 'title_main', description: 'Título principal según el hito' },
      { name: 'title_sub', description: 'Subtítulo según el hito' },
      { name: 'display_id', description: 'Número de pedido a mostrar' },
      { name: 'logo_url', description: 'URL absoluta del logo del CDE' },
      { name: 'cde_display_name', description: 'Nombre del CDE / tienda' },
      { name: 'sales_channel_name', description: 'Nombre del canal de venta' },
      { name: 'primary_color', description: 'Color primario del tenant (hex)' },
      { name: 'primary_color_bg', description: 'Color primario con opacidad (rgba) para el badge' },
      { name: 'order_date_formatted', description: 'Fecha del pedido formateada' },
      { name: 'customer_name', description: 'Nombre del cliente' },
      { name: 'shipping_name', description: 'Nombre del destinatario del envío' },
      { name: 'shipping_street', description: 'Calle y número del envío' },
      { name: 'shipping_city', description: 'Ciudad y código postal del envío' },
      { name: 'timeline_steps', description: 'Array de pasos {label, done, date_formatted, icon_url}' },
      { name: 'year', description: 'Año actual para el footer' },
    ],
    sample_data: {
      subject: 'Tu pedido fue enviado',
      title_main: '¡Tu pedido fue enviado!',
      title_sub: 'Tu pedido está en camino. ¡Pronto lo tendrás en tu puerta!',
      display_id: '1042',
      logo_url: '',
      cde_display_name: 'Mercatto',
      sales_channel_name: 'Mercatto B2C',
      primary_color: '#2e7d32',
      primary_color_bg: 'rgba(46,125,50,0.1)',
      order_date_formatted: '16 jun 2026, 14:30',
      customer_name: 'Juan',
      shipping_name: 'Juan Pérez',
      shipping_street: 'Av. Corrientes 1234',
      shipping_city: 'CABA, CP 1043',
      timeline_steps: [
        { label: 'Pago confirmado', done: true, date_formatted: '16 jun 2026, 14:30', icon_url: '' },
        { label: 'En preparación', done: true, date_formatted: '16 jun 2026, 16:00', icon_url: '' },
        { label: 'Enviado', done: true, date_formatted: '17 jun 2026, 09:00', icon_url: '' },
        { label: 'Entregado', done: false, date_formatted: '', icon_url: '' },
      ],
      year: 2026,
    },
    status: 'draft',
    locale: 'es-AR',
  },
  {
    key: 'order-ready-for-pickup',
    // 'draft' como todas: una fila publicada PISA a la plantilla de código, y
    // acá la de código es justamente la que queremos que salga por defecto.
    status: 'draft',
    locale: 'es-AR',
    name: 'Pedido listo para retirar',
    description:
      'Email al cliente cuando su pedido de retiro en tienda ya está preparado. NO sale con la orden: lo dispara el botón "Marcar listo para retirar" del detalle de la orden, o la transición de la entrega a at_pickup_point.',
    subject: '[{{sales_channel_name}}] Tu pedido #{{display_id}} ya está listo para retirar',
    html: ORDER_READY_FOR_PICKUP_HTML,
    variables: [
      { name: 'display_id', description: 'Número de pedido a mostrar' },
      { name: 'customer_name', description: 'Nombre del cliente' },
      { name: 'pickup_store', description: 'Sucursal elegida {name, address, phone, hours[], map_url}' },
      { name: 'pickup_hours', description: 'Horarios de atención ya agrupados (array de strings). Vacío si la sucursal no los tiene cargados' },
      { name: 'pickup_instructions', description: 'Qué presentar para retirar. Se configura en Emails → Retiro en tienda; ausente no dibuja el bloque' },
      { name: 'logo_url', description: 'URL absoluta del logo del CDE' },
      { name: 'cde_display_name', description: 'Nombre del CDE / tienda' },
      { name: 'sales_channel_name', description: 'Nombre del canal de venta' },
      { name: 'primary_color', description: 'Color primario del tenant (hex)' },
      { name: 'year', description: 'Año actual para el footer' },
    ],
    sample_data: {
      display_id: '1042',
      customer_name: 'Juan',
      pickup_store: {
        name: 'Sucursal Centro',
        address: 'Av. Siempreviva 742, San Carlos de Bariloche, Río Negro',
        phone: '+54 9 2944 00-0000',
        map_url: 'https://www.google.com/maps/search/?api=1&query=-41.13,-71.30',
      },
      pickup_hours: ['Lunes a Viernes: 09:00 a 18:00', 'Sábado: 09:00 a 13:00'],
      pickup_instructions: 'Presentá tu DNI y el número de pedido.',
      // Sin branding (logo_url, cde_display_name, primary_color, year): los
      // inyecta el provider con fillEmpty desde la tienda. Mandarlos acá haría
      // que la vista previa de CUALQUIER tienda muestre la marca de Mercatto.
    },
  },
  {
    key: 'order-cancelled',
    name: 'Pedido Cancelado',
    description: 'Email enviado al cliente cuando su pedido es cancelado.',
    subject: '[{{sales_channel_name}}] Tu pedido fue cancelado #{{display_id}}',
    html: ORDER_CANCELLED_HTML,
    variables: [
      { name: 'subject', description: 'Asunto del email (usado en el <title>)' },
      { name: 'display_id', description: 'Número de pedido a mostrar' },
      { name: 'customer_name', description: 'Nombre del cliente' },
      { name: 'logo_url', description: 'URL absoluta del logo del CDE' },
      { name: 'cde_display_name', description: 'Nombre del CDE / tienda' },
      { name: 'sales_channel_name', description: 'Nombre del canal de venta' },
      { name: 'primary_color', description: 'Color primario del tenant (hex)' },
      { name: 'order_date_formatted', description: 'Fecha del pedido formateada' },
      { name: 'year', description: 'Año actual para el footer' },
    ],
    sample_data: {
      subject: 'Tu pedido fue cancelado #1042',
      display_id: '1042',
      customer_name: 'Juan',
      // Placeholder logo (data-URI) so the preview shows the logo slot. Only used
      // for preview/test — never sent. Replace with the tenant's real logo URL.
      logo_url:
        "data:image/svg+xml;charset=utf-8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='60'><rect width='200' height='60' rx='8' fill='%232e7d32'/><text x='100' y='38' font-family='Arial,sans-serif' font-size='22' font-weight='bold' fill='white' text-anchor='middle'>Mercatto</text></svg>",
      cde_display_name: 'Mercatto',
      sales_channel_name: 'Mercatto B2C',
      primary_color: '#2e7d32',
      order_date_formatted: '16 jun 2026, 14:30',
      year: 2026,
    },
    // Recomposed as real blocks (demo of the Puck block model). The styled,
    // conditional order-detail card stays as a RawHtml block; everything else
    // is a first-class block. Handlebars tokens are preserved for send time.
    design: {
      root: {
        props: {
          backgroundColor: '#f5f5f5',
          contentBackground: '#ffffff',
          width: 600,
        },
      },
      content: [
        {
          type: 'Logo',
          props: {
            id: 'oc-logo',
            src: '{{logo_url}}',
            href: '',
            width: 200,
            align: 'center',
          },
        },
        {
          type: 'Heading',
          props: {
            id: 'oc-title',
            text: 'Tu pedido fue cancelado{{#if customer_name}}, {{customer_name}}{{/if}}',
            level: 'h1',
            align: 'center',
            color: '#D92D20',
          },
        },
        {
          type: 'Text',
          props: {
            id: 'oc-subtitle',
            text: 'Si necesitás ayuda, escribinos y te asistimos con lo que necesites.',
            align: 'center',
            color: '#667085',
          },
        },
        {
          type: 'RawHtml',
          props: {
            id: 'oc-order-box',
            html: `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#fff5f5;border:1px solid #fecaca;border-radius:12px;">
  <tr>
    <td style="padding:18px 20px;">
      <p style="margin:0 0 6px 0;color:#1D2530;font-size:14px;"><strong>Pedido #{{display_id}}</strong></p>
      {{#if order_date_formatted}}<p style="margin:0;color:#667085;font-size:13px;">Fecha: {{order_date_formatted}}</p>{{/if}}
    </td>
  </tr>
</table>`,
          },
        },
        {
          type: 'Footer',
          props: {
            id: 'oc-footer',
            text: '© {{year}} {{cde_display_name}}. Todos los derechos reservados.',
            backgroundColor: '{{primary_color}}',
            textColor: '#ffffff',
          },
        },
      ],
    },
    status: 'draft',
    locale: 'es-AR',
  },
  {
    key: 'stock-sync-report',
    name: 'Reporte de Sync de Stock',
    description: 'Reporte automático del job de sincronización de stock CRM → Medusa.',
    subject: '[Sync Stock] {{status_label}} — {{finished_at}}',
    html: STOCK_SYNC_REPORT_HTML,
    variables: [
      { name: 'subject', description: 'Asunto del email (usado en el <title>)' },
      { name: 'status_label', description: 'Etiqueta de estado ("OK" o "Falló")' },
      { name: 'status_color', description: 'Color del estado (hex)' },
      { name: 'error_message', description: 'Mensaje de error si el sync falló' },
      { name: 'started_at', description: 'Timestamp de inicio del sync' },
      { name: 'finished_at', description: 'Timestamp de fin del sync' },
      { name: 'duration_seconds', description: 'Duración en segundos' },
      { name: 'total_crm', description: 'Total de registros en el CRM' },
      { name: 'matched', description: 'Cantidad de SKUs matcheados' },
      { name: 'updated', description: 'Levels de stock actualizados' },
      { name: 'created_levels', description: 'Levels de stock creados' },
      { name: 'not_found_count', description: 'SKUs sin variante en Medusa' },
      { name: 'affected_products_count', description: 'Productos afectados' },
      { name: 'errors_count', description: 'Cantidad de errores' },
      { name: 'location_id', description: 'ID del stock location' },
      { name: 'not_found_skus_joined', description: 'SKUs no encontrados (string unido por coma)' },
      { name: 'errors_sample', description: 'Array de errores {sku, error}' },
    ],
    sample_data: {
      subject: '[Sync Stock] OK — 2026-06-16T03:00:00.000Z',
      status_label: 'OK',
      status_color: '#1b9c4f',
      error_message: '',
      started_at: '2026-06-16T02:59:30.000Z',
      finished_at: '2026-06-16T03:00:00.000Z',
      duration_seconds: 30,
      total_crm: 1250,
      matched: 1180,
      updated: 920,
      created_levels: 12,
      not_found_count: 70,
      affected_products_count: 540,
      errors_count: 2,
      location_id: 'sloc_01ABCXYZ',
      not_found_skus_joined: 'SKU-001, SKU-014, SKU-220',
      errors_sample: [
        { sku: 'SKU-555', error: 'Variante sin precio base' },
        { sku: 'SKU-777', error: 'Timeout al actualizar level' },
      ],
    },
    status: 'draft',
    locale: null,
  },
  {
    key: 'company-register-admin',
    name: 'Registro de Empresa (Admin)',
    description: 'Notificación al administrador cuando se registra una nueva empresa.',
    subject: '[{{cde_display_name}}] Nueva empresa registrada: {{nombre_empresa}}',
    html: COMPANY_REGISTER_ADMIN_HTML,
    variables: [
      { name: 'subject', description: 'Asunto del email (usado en el <title>)' },
      { name: 'nombre_empresa', description: 'Nombre de la empresa registrada' },
      { name: 'email', description: 'Email de contacto de la empresa' },
      { name: 'legal_name', description: 'Razón social de la empresa (opcional)' },
      { name: 'tax_id', description: 'CUIT / Tax ID de la empresa (opcional)' },
      { name: 'logo_url', description: 'URL absoluta del logo del CDE' },
      { name: 'cde_display_name', description: 'Nombre del CDE / tienda' },
      { name: 'primary_color', description: 'Color primario del tenant (hex)' },
      { name: 'year', description: 'Año actual para el footer' },
    ],
    sample_data: {
      subject: 'Nueva empresa registrada',
      nombre_empresa: 'Distribuidora del Sur S.A.',
      email: 'contacto@distribuidoradelsur.com',
      legal_name: 'Distribuidora del Sur Sociedad Anónima',
      tax_id: '30-71234567-9',
      logo_url: '',
      cde_display_name: 'Mercatto',
      primary_color: '#2e7d32',
      year: 2026,
    },
    status: 'draft',
    locale: 'es-AR',
  },
  {
    key: 'corporate-register',
    name: 'Solicitud Corporativa Recibida',
    description: 'Acuse al solicitante de que su registro corporativo está en revisión.',
    subject: '[{{cde_display_name}}] Recibimos tu solicitud de registro corporativo',
    html: CORPORATE_REGISTER_HTML,
    variables: [
      { name: 'subject', description: 'Asunto del email (usado en el <title>)' },
      { name: 'nombre_empresa', description: 'Nombre de la empresa solicitante (vacío si no hay)' },
      { name: 'email', description: 'Email de contacto de la empresa' },
      { name: 'logo_url', description: 'URL absoluta del logo del CDE' },
      { name: 'cde_display_name', description: 'Nombre del CDE / tienda' },
      { name: 'primary_color', description: 'Color primario del tenant (hex)' },
      { name: 'year', description: 'Año actual para el footer' },
    ],
    sample_data: {
      subject: 'Recibimos tu solicitud de registro corporativo',
      nombre_empresa: 'Distribuidora del Sur S.A.',
      email: 'contacto@distribuidoradelsur.com',
      logo_url: '',
      cde_display_name: 'Mercatto',
      primary_color: '#2e7d32',
      year: 2026,
    },
    status: 'draft',
    locale: 'es-AR',
  },
  {
    key: 'corporate-register-admin',
    name: 'Solicitud Corporativa (Admin)',
    description: 'Notificación al administrador de una solicitud corporativa pendiente de aprobación.',
    subject: '[{{cde_display_name}}] Solicitud corporativa pendiente: {{nombre_empresa}}',
    html: CORPORATE_REGISTER_ADMIN_HTML,
    variables: [
      { name: 'subject', description: 'Asunto del email (usado en el <title>)' },
      { name: 'nombre_empresa', description: 'Nombre de la empresa solicitante' },
      { name: 'email', description: 'Email de contacto de la empresa' },
      { name: 'legal_name', description: 'Razón social de la empresa (opcional)' },
      { name: 'tax_id', description: 'CUIT / Tax ID de la empresa (opcional)' },
      { name: 'email_domain', description: 'Dominio del email de la empresa (opcional)' },
      { name: 'logo_url', description: 'URL absoluta del logo del CDE' },
      { name: 'cde_display_name', description: 'Nombre del CDE / tienda' },
      { name: 'primary_color', description: 'Color primario del tenant (hex)' },
      { name: 'year', description: 'Año actual para el footer' },
    ],
    sample_data: {
      subject: 'Solicitud corporativa pendiente',
      nombre_empresa: 'Distribuidora del Sur S.A.',
      email: 'contacto@distribuidoradelsur.com',
      legal_name: 'Distribuidora del Sur Sociedad Anónima',
      tax_id: '30-71234567-9',
      email_domain: 'distribuidoradelsur.com',
      logo_url: '',
      cde_display_name: 'Mercatto',
      primary_color: '#2e7d32',
      year: 2026,
    },
    status: 'draft',
    locale: 'es-AR',
  },
  {
    key: 'contact-received',
    name: 'Acuse de Contacto',
    description: 'Acuse al usuario de que su mensaje del formulario de contacto fue recibido.',
    subject: '[{{cde_display_name}}] Recibimos tu mensaje',
    html: CONTACT_RECEIVED_HTML,
    variables: [
      { name: 'subject', description: 'Asunto del email (usado en el <title>)' },
      { name: 'first_name', description: 'Nombre del remitente' },
      { name: 'last_name', description: 'Apellido del remitente (opcional)' },
      { name: 'email', description: 'Email del remitente' },
      { name: 'message', description: 'Mensaje enviado por el remitente' },
      { name: 'logo_url', description: 'URL absoluta del logo del CDE' },
      { name: 'cde_display_name', description: 'Nombre del CDE / tienda' },
      { name: 'primary_color', description: 'Color primario del tenant (hex)' },
      { name: 'year', description: 'Año actual para el footer' },
    ],
    sample_data: {
      subject: 'Recibimos tu mensaje',
      first_name: 'Juan',
      last_name: 'Pérez',
      email: 'juan.perez@example.com',
      message: 'Hola, quería consultar por la disponibilidad de productos al por mayor. ¡Gracias!',
      logo_url: '',
      cde_display_name: 'Mercatto',
      primary_color: '#2e7d32',
      year: 2026,
    },
    status: 'draft',
    locale: 'es-AR',
  },
  {
    key: 'contact-notification-admin',
    name: 'Nuevo Contacto (Admin)',
    description: 'Notificación al administrador de una nueva consulta del formulario de contacto.',
    subject: '[{{cde_display_name}}] Nuevo mensaje de contacto de {{first_name}}',
    html: CONTACT_NOTIFICATION_ADMIN_HTML,
    variables: [
      { name: 'subject', description: 'Asunto del email (usado en el <title>)' },
      { name: 'first_name', description: 'Nombre del remitente' },
      { name: 'last_name', description: 'Apellido del remitente (opcional)' },
      { name: 'email', description: 'Email del remitente' },
      { name: 'phone', description: 'Teléfono del remitente (opcional)' },
      { name: 'message', description: 'Mensaje enviado por el remitente' },
      { name: 'logo_url', description: 'URL absoluta del logo del CDE' },
      { name: 'cde_display_name', description: 'Nombre del CDE / tienda' },
      { name: 'primary_color', description: 'Color primario del tenant (hex)' },
      { name: 'year', description: 'Año actual para el footer' },
    ],
    sample_data: {
      subject: 'Nuevo mensaje de contacto',
      first_name: 'Juan',
      last_name: 'Pérez',
      email: 'juan.perez@example.com',
      phone: '+54 11 5555-1234',
      message: 'Hola, quería consultar por la disponibilidad de productos al por mayor. ¡Gracias!',
      logo_url: '',
      cde_display_name: 'Mercatto',
      primary_color: '#2e7d32',
      year: 2026,
    },
    status: 'draft',
    locale: 'es-AR',
  },
  ...([
    {
      key: 'cart-abandoned-1',
      name: 'Carrito abandonado · paso 1 (1h)',
      subject: 'Te quedaron productos en el carrito 🛒',
      lead: 'Guardamos tu carrito con {{item_count}} producto(s). ¿Querés terminar tu compra?',
    },
    {
      key: 'cart-abandoned-2',
      name: 'Carrito abandonado · paso 2 (24h)',
      subject: 'Tu carrito sigue esperándote',
      lead: 'Todavía podés completar tu compra por un total de {{total}} {{currency_code}}.',
    },
    {
      key: 'cart-abandoned-3',
      name: 'Carrito abandonado · paso 3 (72h)',
      subject: 'Última oportunidad para tu carrito',
      lead: 'Estamos por liberar el stock de tu carrito. Completalo antes de que se agote.',
    },
  ] as const).map<SeedEntry>((s) => ({
    key: s.key,
    name: s.name,
    description: 'Recordatorio de carrito abandonado (secuencia de recuperación).',
    subject: s.subject,
    html: `<p>Hola {{customer_name}},</p><p>${s.lead}</p><p><a href="{{recovery_url}}">Retomá tu compra</a></p>`,
    variables: [
      { name: 'customer_name', description: 'Nombre del cliente (vacío si no hay)' },
      { name: 'total', description: 'Total del carrito formateado' },
      { name: 'currency_code', description: 'Moneda del carrito' },
      { name: 'item_count', description: 'Cantidad de productos en el carrito' },
      { name: 'recovery_url', description: 'Link para retomar el carrito' },
    ],
    sample_data: {
      customer_name: 'Juan Pérez',
      total: '12.500,00',
      currency_code: 'CLP',
      item_count: 3,
      recovery_url: 'https://tienda.example.com/cl/cart/recover?cart_id=cart_123',
    },
    status: 'draft',
    locale: 'es-AR',
  })),
  // ───────────────────────────────────────────────────────────────────────────
  // Compras recurrentes (módulo recurring-order). Los `data` los emiten el
  // workflow create-recurring-order, process-renewal-cycle, el job
  // process-recurring-renewals y el subscriber recurring-order-placed.
  {
    key: 'recurring-order-created',
    name: 'Compra recurrente · alta',
    description: 'Confirmación de que la suscripción de reposición quedó creada.',
    subject: '¡Tu compra recurrente quedó creada! 🔁',
    html: `<p>Hola {{customer_name}},</p><p>Tu compra recurrente quedó activa: la vas a recibir <b>{{frequency_label}}</b>.</p><ul>{{#each items}}<li>{{this.title}} ×{{this.quantity}}</li>{{/each}}</ul><p>Antes de cada entrega te mandamos un link para confirmar y pagar con los precios y promociones vigentes.</p><p><a href="{{manage_url}}">Gestionar mis compras recurrentes</a></p>`,
    variables: [
      { name: 'customer_name', description: 'Nombre del cliente (vacío si no hay)' },
      { name: 'frequency_label', description: 'Frecuencia elegida (ej. "todas las semanas")' },
      { name: 'next_execution', description: 'Fecha ISO de la primera ejecución' },
      { name: 'items', description: 'Lista de items ({title, quantity})' },
      { name: 'manage_url', description: 'Link a "Mis compras recurrentes"' },
    ],
    sample_data: {
      customer_name: 'Juan Pérez',
      frequency_label: 'todas las semanas',
      next_execution: '2026-07-13T12:00:00.000Z',
      items: [
        { title: 'Leche entera 1L', quantity: 6 },
        { title: 'Pan lactal integral', quantity: 2 },
      ],
      manage_url: 'https://tienda.example.com/ar/account/subscriptions',
    },
    status: 'draft',
    locale: 'es-AR',
  },
  {
    key: 'recurring-renewal-ready',
    name: 'Compra recurrente · lista para confirmar',
    description: 'La renovación quedó armada: link para confirmar y pagar la entrega.',
    subject: 'Tu pedido recurrente está listo: confirmalo 🛒',
    html: `<p>Hola {{customer_name}},</p><p>Preparamos tu pedido recurrente ({{frequency_label}}) con {{item_count}} producto(s) por un total de <b>{{total}} {{currency_code}}</b> con los precios y promos de hoy.</p>{{#if savings}}<p>🎉 Tu descuento por suscripción ya está aplicado: ahorrás <b>{{savings}} {{currency_code}}</b> en esta entrega.</p>{{/if}}{{#if price_warning}}<p>⚠️ {{price_warning}}</p>{{/if}}<p><a href="{{confirmation_url}}">Confirmar y pagar</a></p><p>El link vence el {{expires_at}}. Si no confirmás, esta entrega se omite y tu suscripción sigue normalmente.</p>`,
    variables: [
      { name: 'customer_name', description: 'Nombre del cliente (vacío si no hay)' },
      { name: 'frequency_label', description: 'Frecuencia de la suscripción' },
      { name: 'savings', description: 'Ahorro por el descuento de suscripción (vacío si no hay oferta)' },
      { name: 'price_warning', description: 'Aviso de suba de precio vs la entrega anterior (política warn_over_threshold)' },
      { name: 'total', description: 'Total del carrito de renovación formateado' },
      { name: 'currency_code', description: 'Moneda' },
      { name: 'item_count', description: 'Cantidad de líneas incluidas' },
      { name: 'confirmation_url', description: 'Link para confirmar y pagar' },
      { name: 'expires_at', description: 'Fecha ISO de vencimiento del link' },
    ],
    sample_data: {
      customer_name: 'Juan Pérez',
      frequency_label: 'todas las semanas',
      savings: '1.890,00',
      total: '18.900,00',
      currency_code: 'ARS',
      item_count: 8,
      confirmation_url:
        'https://tienda.example.com/ar/subscriptions/renew?cart_id=cart_123&cycle_id=rcyc_123',
      expires_at: '2026-07-16T12:00:00.000Z',
    },
    status: 'draft',
    locale: 'es-AR',
  },
  {
    key: 'recurring-renewal-reminder',
    name: 'Compra recurrente · recordatorio de pago',
    description: 'Recordatorio único cuando el link de pago sigue pendiente.',
    subject: 'Te espera tu pedido recurrente ⏰',
    html: `<p>Hola {{customer_name}},</p><p>Tu pedido recurrente ({{frequency_label}}) sigue esperando tu confirmación.</p><p><a href="{{confirmation_url}}">Confirmar y pagar</a></p><p>El link vence el {{expires_at}}.</p>`,
    variables: [
      { name: 'customer_name', description: 'Nombre del cliente (vacío si no hay)' },
      { name: 'frequency_label', description: 'Frecuencia de la suscripción' },
      { name: 'confirmation_url', description: 'Link para confirmar y pagar' },
      { name: 'expires_at', description: 'Fecha ISO de vencimiento del link' },
    ],
    sample_data: {
      customer_name: 'Juan Pérez',
      frequency_label: 'todas las semanas',
      confirmation_url:
        'https://tienda.example.com/ar/subscriptions/renew?cart_id=cart_123&cycle_id=rcyc_123',
      expires_at: '2026-07-16T12:00:00.000Z',
    },
    status: 'draft',
    locale: 'es-AR',
  },
  {
    key: 'recurring-order-generated',
    name: 'Compra recurrente · pedido generado',
    description: 'El cliente confirmó y pagó: el pedido de la renovación quedó creado.',
    subject: '¡Listo! Tu pedido recurrente quedó confirmado ✅',
    html: `<p>Hola {{customer_name}},</p><p>Tu pedido <b>#{{order_display_id}}</b> quedó confirmado y ya lo estamos preparando.</p><p>La próxima entrega está programada para el {{next_execution}}.</p><p><a href="{{manage_url}}">Gestionar mis compras recurrentes</a></p>`,
    variables: [
      { name: 'customer_name', description: 'Nombre del cliente (vacío si no hay)' },
      { name: 'order_display_id', description: 'Número visible del pedido generado' },
      { name: 'next_execution', description: 'Fecha ISO de la próxima ejecución' },
      { name: 'manage_url', description: 'Link a "Mis compras recurrentes"' },
    ],
    sample_data: {
      customer_name: 'Juan Pérez',
      order_display_id: 1042,
      next_execution: '2026-07-20T12:00:00.000Z',
      manage_url: 'https://tienda.example.com/ar/account/subscriptions',
    },
    status: 'draft',
    locale: 'es-AR',
  },
  {
    key: 'recurring-order-paused',
    name: 'Compra recurrente · pausada',
    description: 'Aviso de pausa de la suscripción (por el cliente o el admin).',
    subject: 'Pausaste tu compra recurrente ⏸️',
    html: `<p>Hola {{customer_name}},</p><p>Tu compra recurrente ({{frequency_label}}) quedó pausada: no vamos a generar nuevas entregas hasta que la reanudes desde tu cuenta.</p>`,
    variables: [
      { name: 'customer_name', description: 'Nombre del cliente (vacío si no hay)' },
      { name: 'frequency_label', description: 'Frecuencia de la suscripción' },
    ],
    sample_data: {
      customer_name: 'Juan Pérez',
      frequency_label: 'todas las semanas',
    },
    status: 'draft',
    locale: 'es-AR',
  },
  {
    key: 'recurring-order-cancelled',
    name: 'Compra recurrente · cancelada',
    description: 'Confirmación de cancelación definitiva de la suscripción.',
    subject: 'Cancelaste tu compra recurrente',
    html: `<p>Hola {{customer_name}},</p><p>Tu compra recurrente ({{frequency_label}}) quedó cancelada. Podés crear una nueva cuando quieras desde cualquier producto o desde tu carrito.</p>`,
    variables: [
      { name: 'customer_name', description: 'Nombre del cliente (vacío si no hay)' },
      { name: 'frequency_label', description: 'Frecuencia de la suscripción' },
    ],
    sample_data: {
      customer_name: 'Juan Pérez',
      frequency_label: 'todas las semanas',
    },
    status: 'draft',
    locale: 'es-AR',
  },
  {
    key: 'recurring-order-resumed',
    name: 'Suscripción · reanudada',
    description: 'Confirma que los cobros y entregas futuras vuelven a estar activos.',
    subject: 'Reanudaste tu suscripción',
    html: `<p>Hola {{customer_name}},</p><p>Tu suscripción quedó activa nuevamente. La próxima entrega está prevista para {{next_execution}}.</p><p><a href="{{manage_url}}">Administrar suscripción</a></p>`,
    variables: [
      { name: 'customer_name', description: 'Nombre del cliente' },
      { name: 'next_execution', description: 'Próxima fecha prevista' },
      { name: 'manage_url', description: 'Link de autogestión' },
    ],
    sample_data: { customer_name: 'Juan Pérez', next_execution: '2026-10-01', manage_url: 'https://tienda.example.com/ar/account/subscriptions' },
    status: 'draft',
    locale: 'es-AR',
  },
  {
    key: 'recurring-order-skipped',
    name: 'Suscripción · entrega omitida',
    description: 'Confirma la omisión de un ciclo sin cancelar el contrato.',
    subject: 'Omitimos tu próxima entrega',
    html: `<p>Hola {{customer_name}},</p><p>Omitimos esta entrega. Tu suscripción sigue activa y la próxima está prevista para {{next_execution}}.</p><p><a href="{{manage_url}}">Administrar suscripción</a></p>`,
    variables: [
      { name: 'customer_name', description: 'Nombre del cliente' },
      { name: 'next_execution', description: 'Próxima fecha prevista' },
      { name: 'manage_url', description: 'Link de autogestión' },
    ],
    sample_data: { customer_name: 'Juan Pérez', next_execution: '2026-10-01', manage_url: 'https://tienda.example.com/ar/account/subscriptions' },
    status: 'draft',
    locale: 'es-AR',
  },
  {
    key: 'recurring-order-updated',
    name: 'Suscripción · datos actualizados',
    description: 'Confirma cambios de productos, cantidad, frecuencia, dirección o medio de pago.',
    subject: 'Actualizamos tu suscripción',
    html: `<p>Hola {{customer_name}},</p><p>Actualizamos estos datos de tu suscripción: {{changed_fields}}.</p><p>Próxima entrega: {{next_execution}}.</p><p><a href="{{manage_url}}">Revisar suscripción</a></p>`,
    variables: [
      { name: 'customer_name', description: 'Nombre del cliente' },
      { name: 'changed_fields', description: 'Campos modificados' },
      { name: 'next_execution', description: 'Próxima fecha prevista' },
      { name: 'manage_url', description: 'Link de autogestión' },
    ],
    sample_data: { customer_name: 'Juan Pérez', changed_fields: 'frequency, address', next_execution: '2026-10-01', manage_url: 'https://tienda.example.com/ar/account/subscriptions' },
    status: 'draft',
    locale: 'es-AR',
  },
  {
    key: 'recurring-order-failed',
    name: 'Compra recurrente · requiere atención',
    description:
      'La suscripción se desactivó por renovaciones fallidas/expiradas consecutivas.',
    subject: 'Tu compra recurrente necesita atención ⚠️',
    html: `<p>Hola {{customer_name}},</p><p>No pudimos completar las últimas entregas de tu compra recurrente ({{frequency_label}}), así que la desactivamos por ahora.</p><p>Podés reanudarla desde tu cuenta cuando quieras.</p>`,
    variables: [
      { name: 'customer_name', description: 'Nombre del cliente (vacío si no hay)' },
      { name: 'frequency_label', description: 'Frecuencia de la suscripción' },
    ],
    sample_data: {
      customer_name: 'Juan Pérez',
      frequency_label: 'todas las semanas',
    },
    status: 'draft',
    locale: 'es-AR',
  },
  {
    key: 'recurring-renewal-upcoming',
    name: 'Suscripción · próximo cobro automático',
    description: 'Resumen previo al cobro automático de una renovación.',
    subject: 'Tu próxima entrega se cobra pronto',
    html: `<p>Hola {{customer_name}},</p><p>Tu próxima entrega ({{frequency_label}}) está preparada por <b>{{total}} {{currency_code}}</b>.</p>{{#if savings}}<p>Tu ahorro en este ciclo es de <b>{{savings}} {{currency_code}}</b>.</p>{{/if}}{{#if price_warning}}<p>⚠️ {{price_warning}}</p>{{/if}}<p>Podés revisar o administrar la suscripción desde tu cuenta.</p>`,
    variables: [
      { name: 'customer_name', description: 'Nombre del cliente' },
      { name: 'frequency_label', description: 'Frecuencia contratada' },
      { name: 'total', description: 'Total cotizado' },
      { name: 'currency_code', description: 'Moneda' },
      { name: 'savings', description: 'Ahorro aplicado' },
      { name: 'price_warning', description: 'Aviso de variación de precio' },
    ],
    sample_data: { customer_name: 'Juan Pérez', frequency_label: 'cada mes', total: '18.900,00', currency_code: 'ARS', savings: '1.890,00' },
    status: 'draft',
    locale: 'es-AR',
  },
  {
    key: 'recurring-stock-unavailable',
    name: 'Suscripción · esperando stock',
    description: 'La canasta completa no tiene stock y se reintentará sin cobrar.',
    subject: 'Tu próxima entrega está esperando stock',
    html: `<p>No pudimos reservar todos los productos de tu suscripción.</p><p>No hicimos ningún cobro. Vamos a reintentar hasta el {{retry_until}} y te avisaremos cuando se resuelva.</p>`,
    variables: [
      { name: 'recurring_order_id', description: 'ID de la suscripción' },
      { name: 'cycle_id', description: 'ID del ciclo' },
      { name: 'retry_at', description: 'Próximo reintento' },
      { name: 'retry_until', description: 'Fin de la ventana de reintentos' },
    ],
    sample_data: { recurring_order_id: 'rord_123', cycle_id: 'rcyc_123', retry_at: '2026-09-05T12:00:00Z', retry_until: '2026-09-08T12:00:00Z' },
    status: 'draft',
    locale: 'es-AR',
  },
  {
    key: 'recurring-stock-skipped',
    name: 'Suscripción · ciclo omitido por stock',
    description: 'La ventana de stock terminó; el ciclo se omite y conserva la cadencia.',
    subject: 'Omitimos esta entrega sin cobrarte',
    html: `<p>No recuperamos a tiempo el stock de toda tu canasta, por eso omitimos esta entrega.</p><p>No hicimos ningún cobro y tu suscripción conserva su fecha habitual para el próximo ciclo.</p>`,
    variables: [
      { name: 'recurring_order_id', description: 'ID de la suscripción' },
      { name: 'cycle_id', description: 'ID del ciclo omitido' },
    ],
    sample_data: { recurring_order_id: 'rord_123', cycle_id: 'rcyc_123' },
    status: 'draft',
    locale: 'es-AR',
  },
  {
    key: 'recurring-payment-failed',
    name: 'Suscripción · cobro rechazado',
    description: 'Cobro recurrente rechazado con acceso a la autogestión.',
    subject: 'No pudimos cobrar tu próxima entrega',
    html: `<p>El cobro automático de tu suscripción fue rechazado.</p><p>Vamos a reintentar dentro del período de gracia. Podés <a href="{{manage_url}}">actualizar la tarjeta desde Mis suscripciones</a>.</p>`,
    variables: [
      { name: 'recurring_order_id', description: 'ID de la suscripción' },
      { name: 'cycle_id', description: 'ID del ciclo' },
      { name: 'manage_url', description: 'Link seguro a la cuenta del cliente' },
    ],
    sample_data: { recurring_order_id: 'rord_123', cycle_id: 'rcyc_123', manage_url: 'https://tienda.example.com/ar/account/subscriptions' },
    status: 'draft',
    locale: 'es-AR',
  },
  {
    key: 'recurring-stock-alert',
    name: 'Suscripción · alerta administrativa de stock',
    description: 'Déficit previsto por variante a 14 o 30 días.',
    subject: 'Alerta de stock para próximas suscripciones',
    html: `<p>La variante <b>{{variant_id}}</b> tiene {{available}} unidades disponibles.</p><p>Demanda: {{required_14d}} a 14 días y {{required_30d}} a 30 días. Déficit máximo: {{deficit_30d}}.</p>`,
    variables: [
      { name: 'variant_id', description: 'ID de la variante' },
      { name: 'available', description: 'Stock disponible neto' },
      { name: 'required_14d', description: 'Demanda recurrente a 14 días' },
      { name: 'required_30d', description: 'Demanda recurrente a 30 días' },
      { name: 'deficit_14d', description: 'Déficit a 14 días' },
      { name: 'deficit_30d', description: 'Déficit a 30 días' },
    ],
    sample_data: { variant_id: 'variant_123', available: 8, required_14d: 12, required_30d: 20, deficit_14d: 4, deficit_30d: 12 },
    status: 'draft',
    locale: 'es-AR',
  },
];

export default async function seedEmailTemplates({ container }: ExecArgs) {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const service = container.resolve<EmailTemplateModuleService>(EMAIL_TEMPLATE_MODULE);

  logger.info('================================================');
  logger.info(`Seeding ${SEED.length} email templates (idempotent upsert by key)`);
  logger.info('================================================');

  let created = 0;
  let updated = 0;

  for (const entry of SEED) {
    const existing = await service.listEmailTemplates({ key: entry.key });
    const current = existing?.[0];

    // When a Puck design exists (inline on the entry, or in the shared designs
    // map keyed by template key), the sent HTML is the render of that design
    // (React Email) — not the literal `html` — so block edits and the outgoing
    // email stay in sync.
    const design = entry.design ?? EMAIL_TEMPLATE_DESIGNS[entry.key] ?? null;
    const html = design ? await renderPuckEmailHtml(design) : entry.html;

    // Grouping metadata: prefer an explicit `metadata` on the entry, otherwise
    // DERIVE it from the events catalog by key. Stored on `template.metadata` so
    // the admin can group rows by logical event + audience (Usuario / Admin).
    const metadata = entry.metadata ?? KEY_META[entry.key] ?? null;

    if (current) {
      // Preserve the existing status — never clobber a published row back to draft.
      await (service as any).updateEmailTemplates({
        id: current.id,
        name: entry.name,
        description: entry.description,
        subject: entry.subject,
        html,
        design,
        variables: entry.variables,
        sample_data: entry.sample_data,
        metadata,
        locale: entry.locale,
        status: current.status,
      });
      updated += 1;
      logger.info(`[email-template] updated "${entry.key}" (status preserved: ${current.status})`);
    } else {
      await (service as any).createEmailTemplates({
        key: entry.key,
        name: entry.name,
        description: entry.description,
        subject: entry.subject,
        html,
        design,
        variables: entry.variables,
        sample_data: entry.sample_data,
        metadata,
        locale: entry.locale,
        status: entry.status,
      });
      created += 1;
      logger.info(`[email-template] created "${entry.key}" (status: ${entry.status})`);
    }
  }

  logger.info('================================================');
  logger.info(`Done ✓ — created: ${created}, updated: ${updated}, total: ${SEED.length}`);
  logger.info('================================================');
}
