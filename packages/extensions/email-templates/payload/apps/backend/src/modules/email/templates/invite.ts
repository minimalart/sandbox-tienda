import type { EmailTemplateFunction, EmailTemplateResult } from './types';

export type InviteData = {
  link_invitacion: string;
  invited_email?: string;
  logo_url?: string;
  cde_display_name?: string;
  sales_channel_name?: string;
  primary_color?: string;
};

/**
 * Admin user invitation email. Sent by the `invite.created` / `invite.resent`
 * subscriber with `link_invitacion` pointing at the backoffice accept page
 * (`/app/invite?token=...`). Branding (logo/color) is injected by the email
 * service as defaults.
 */
export const inviteTemplate: EmailTemplateFunction<InviteData> = (
  data
): EmailTemplateResult => {
  const cdeDisplayName =
    (data.cde_display_name || data.sales_channel_name || 'Mercatto')
      .trim()
      .replace(/[-\s]b2[cb]$/i, '')
      .trim() || 'Mercatto';
  const logoUrl = data.logo_url || '';
  const channelName = data.sales_channel_name || '';
  const primaryColor = data.primary_color || '#2e7d32';
  const subject = `Te invitaron a administrar ${cdeDisplayName}`;
  const year = new Date().getFullYear();

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
                            ${logoUrl ? `<img src="${logoUrl}" alt="${cdeDisplayName}" width="200" style="display: block; margin: 0 auto; -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none;">` : `<div style="font-size: 24px; font-weight: 700; color: ${primaryColor};">${cdeDisplayName}</div>`}
                        </td>
                    </tr>

                    <!-- Contenido -->
                    <tr>
                        <td style="padding: 20px 40px 32px 40px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 700; color: #111111;">Te invitaron al panel de ${cdeDisplayName}</h1>
                            <p style="margin: 0 0 16px; font-size: 18px; font-weight: 600; color: #111111;">Creá tu cuenta de administrador para empezar.</p>
                            <p style="margin: 0 0 28px; font-size: 14px; color: #555555;">Hacé clic en el botón para aceptar la invitación y definir tu contraseña. Por seguridad, el enlace tiene una validez limitada.</p>

                            ${data.link_invitacion ? `
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td style="border-radius: 6px; background-color: ${primaryColor}; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        <a href="${data.link_invitacion}" style="display: inline-block; padding: 12px 28px; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; border-radius: 6px; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">Aceptar invitación</a>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin: 20px 0 0; font-size: 12px; color: #666666;">O copiá este enlace en tu navegador:<br><a href="${data.link_invitacion}" style="color: ${primaryColor}; word-break: break-all; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">${data.link_invitacion}</a></p>
                            ` : `<p style="color: #cc0000;">Enlace de invitación no disponible.</p>`}

                            <p style="margin: 24px 0 0; font-size: 14px; color: #666666;">Si no esperabas esta invitación, podés ignorar este correo.</p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 20px; background-color: ${primaryColor}; text-align: center; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <p style="margin: 0; color: #ffffff; font-size: 12px;">© ${year} ${cdeDisplayName}. Todos los derechos reservados.</p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>`.trim();

  return {
    subject: channelName ? `[${channelName}] ${subject}` : `[Mercatto] ${subject}`,
    html,
  };
};
