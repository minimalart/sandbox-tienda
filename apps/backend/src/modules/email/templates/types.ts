export type EmailTemplateResult = {
  subject: string;
  html: string;
  templateId?: string;
};

export type EmailTemplateFunction<T = Record<string, unknown>> = (data: T) => EmailTemplateResult;

export type EmailTemplates = Record<string, EmailTemplateFunction<Record<string, unknown>>>;
