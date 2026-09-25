import { copyrightLine, storeDisplayName, subjectWithStore } from './email-helpers';
import type { EmailTemplateFunction, EmailTemplateResult } from './types';

export type CustomerRegisterData = {
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  /** Nombre del canal (ej. "mercatto-b2c") para contexto */
  sales_channel_name?: string;
  /** URL absoluta del logo del CDE */
  logo_url?: string;
  /** Nombre visible de la tienda. Sin este dato el mail no nombra ninguna marca. */
  cde_display_name?: string;
  /** Color primario del tenant (hex) */
  primary_color?: string;
};

function fmt(value: string | undefined | null): string {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

/**
 * Plantilla de confirmación de registro / bienvenida.
 */
export const customerRegisterTemplate: EmailTemplateFunction<CustomerRegisterData> = (
  data
): EmailTemplateResult => {
  const name = [data.first_name, data.last_name].filter(Boolean).join(' ').trim() || 'Cliente';
  const email = fmt(data.email);
  const logoUrl = data.logo_url || '';
  const cdeDisplayName = storeDisplayName(data);
  const primaryColor = data.primary_color || '#2e7d32';
  const year = new Date().getFullYear();

  // Sin logo y sin nombre de tienda, la cabecera se omite: un título de 24px
  // vacío deja un hueco, pero inventar una marca manda la de otro cliente.
  const brandHeader = logoUrl
    ? `<img src="${logoUrl}" alt="${cdeDisplayName}" width="200" style="display: block; margin: 0 auto; -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none;">`
    : cdeDisplayName
      ? `<div style="font-size: 24px; font-weight: 700; color: ${primaryColor};">${cdeDisplayName}</div>`
      : '';

  const subject = 'Confirmación de registro';

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
                            <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 700; color: #111111;">¡Bienvenido${name !== 'Cliente' ? `, ${name}` : ''}!</h1>
                            <p style="margin: 0 0 16px; font-size: 18px; font-weight: 600; color: #111111;">Tu cuenta ha sido creada correctamente.</p>
                            <p style="margin: 0 0 12px; font-size: 14px; color: #555555;">Gracias por registrarte. A partir de ahora podés acceder con tu correo a nuestra tienda.</p>
                            <p style="margin: 0 0 24px; font-size: 14px; color: #555555;">Email registrado: <a href="mailto:${email}" style="color: ${primaryColor}; text-decoration: none; font-weight: 600; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">${email}</a></p>
                            <p style="margin: 0; font-size: 14px; color: #666666;">Si no realizaste este registro, podés ignorar este mensaje.</p>
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
