import type { EmailTemplateFunction, EmailTemplateResult } from './types';

export type B2BClientApprovedData = {
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string;
  /** Nombre del canal (ej. "mercatto-b2b") para contexto */
  sales_channel_name?: string;
  /** URL absoluta del logo del CDE */
  logo_url?: string;
  /** Nombre del CDE para fallback en texto (ej. "Mercatto") */
  cde_display_name?: string;
  /** Subdomain de la organización para links */
  organization_subdomain?: string;
  /** Nombre de la organización */
  organization_name?: string;
};

function fmt(value: string | undefined | null): string {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

/**
 * Plantilla de aprobación de registro B2B.
 * Enviada cuando un cliente B2B es aprobado por un administrador.
 */
export const b2bClientApprovedTemplate: EmailTemplateFunction<B2BClientApprovedData> = (
  data
): EmailTemplateResult => {
  const name = [data.first_name, data.last_name].filter(Boolean).join(' ').trim() || 'Cliente';
  const email = fmt(data.email);
  const companyName = fmt(data.company_name) || 'su empresa';
  const logoUrl = data.logo_url || '';
  const cdeDisplayName = (data.cde_display_name || data.organization_name || 'Mercatto').trim();
  const channelName = data.sales_channel_name || '';
  const orgSubdomain = data.organization_subdomain || 'mercatto-b2b';
  const loginUrl = `https://${orgSubdomain}.mercatto.app/sign-in`;
  void loginUrl;

  const subject = '¡Tu registro fue aprobado!';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; background:#f5f5f5;">
  <div style="max-width:600px; margin:0 auto; background:#fff; padding:32px;">
    ${logoUrl ? `<div style="margin-bottom:24px;"><img src="${logoUrl}" alt="${cdeDisplayName}" style="max-height:48px; width:auto;" /></div>` : `<div style="margin-bottom:24px; font-size:24px; font-weight:700; color:#111;">${cdeDisplayName}</div>`}

    <h1 style="margin:0 0 8px; font-size:24px; font-weight:700; color:#111;">¡Registro Aprobado${name !== 'Cliente' ? `, ${name}` : ''}!</h1>

    <p style="margin:0 0 16px; font-size:16px; color:#333;">
      Nos complace informarte que tu solicitud de registro para <strong>${companyName}</strong> ha sido <span style="color:#10b981; font-weight:600;">aprobada exitosamente</span>.
    </p>

    <p style="margin:24px 0 0; padding-top:16px; border-top:1px solid #e5e7eb; font-size:13px; color:#6b7280;">
      ¿Necesitás ayuda? Contactanos en <a href="mailto:soporte@mercatto.com" style="color:#2563eb; text-decoration:none;">soporte@mercatto.com</a>
    </p>
  </div>

  <div style="max-width:600px; margin:16px auto; text-align:center;">
    <p style="margin:0; font-size:11px; color:#9ca3af; line-height:1.5;">
      Este email fue enviado a ${email} porque tu registro fue aprobado.<br>
      Si no realizaste esta solicitud, por favor contactá a nuestro equipo de soporte.
    </p>
  </div>
</body>
</html>`.trim();

  return {
    subject: channelName ? `[${channelName}] ${subject}` : `[${cdeDisplayName}] ${subject}`,
    html,
  };
};
