import type { EmailTemplateFunction, EmailTemplateResult } from './types';

export type CompanyRegisterData = {
  nombre_empresa: string;
  email: string;
};

export const companyRegisterTemplate: EmailTemplateFunction<CompanyRegisterData> = (
  data
): EmailTemplateResult => ({
  subject: '¡Bienvenido!',
  html: `<p>Hola,</p><p>¡Bienvenido! Tu empresa <strong>${data.nombre_empresa ?? ''}</strong> ha sido registrada correctamente.</p><p>Email de contacto: ${data.email ?? ''}</p>`,
});
