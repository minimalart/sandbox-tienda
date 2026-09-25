import type { EmailTemplateFunction, EmailTemplateResult } from './types';
import { copyrightLine, hexToRgba, storeDisplayName, subjectWithStore } from './email-helpers';

export type PasswordResetData = {
  link_reseteo: string;
  logo_url?: string;
  cde_display_name?: string;
  sales_channel_name?: string;
  primary_color?: string;
};

export const passwordResetTemplate: EmailTemplateFunction<PasswordResetData> = (
  data
): EmailTemplateResult => {
  const cdeDisplayName = storeDisplayName(data);
  const logoUrl = data.logo_url || '';
  const primaryColor = data.primary_color || '#2e7d32';
  const primaryColorBg = hexToRgba(primaryColor, 0.1);
  void primaryColorBg;
  const subject = 'Restablecer tu contraseña';
  const year = new Date().getFullYear();

  // Sin logo y sin nombre de tienda, la cabecera se omite: un título de 24px
  // vacío deja un hueco, pero inventar una marca manda la de otro cliente.
  const brandHeader = logoUrl
    ? `<img src="${logoUrl}" alt="${cdeDisplayName}" width="200" style="display: block; margin: 0 auto; -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none;">`
    : cdeDisplayName
      ? `<div style="font-size: 24px; font-weight: 700; color: ${primaryColor};">${cdeDisplayName}</div>`
      : '';

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
                            <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 700; color: #111111;">Restablecer contraseña</h1>
                            <p style="margin: 0 0 16px; font-size: 18px; font-weight: 600; color: #111111;">Recibimos una solicitud para restablecer tu contraseña.</p>
                            <p style="margin: 0 0 28px; font-size: 14px; color: #555555;">Hacé clic en el botón para crear una nueva contraseña. El enlace expira en 15 minutos.</p>

                            ${data.link_reseteo ? `
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td style="border-radius: 6px; background-color: ${primaryColor}; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        <a href="${data.link_reseteo}" style="display: inline-block; padding: 12px 28px; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; border-radius: 6px; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">Restablecer contraseña</a>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin: 20px 0 0; font-size: 12px; color: #666666;">O copiá este enlace en tu navegador:<br><a href="${data.link_reseteo}" style="color: ${primaryColor}; word-break: break-all; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">${data.link_reseteo}</a></p>
                            ` : `<p style="color: #cc0000;">Enlace de restablecimiento no disponible.</p>`}

                            <p style="margin: 24px 0 0; font-size: 14px; color: #666666;">Si no solicitaste este cambio, podés ignorar este correo. Tu contraseña no será modificada.</p>
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
