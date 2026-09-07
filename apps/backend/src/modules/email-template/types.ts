export type EmailTemplateStatus = 'draft' | 'published';

export interface EmailTemplateVariable {
  name: string;
  description?: string;
}

export interface CreateEmailTemplateInput {
  key?: string;
  name: string;
  description?: string | null;
  subject: string;
  html: string;
  design?: Record<string, unknown> | null;
  status?: EmailTemplateStatus;
  locale?: string | null;
  variables?: EmailTemplateVariable[] | null;
  sample_data?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  created_by?: string;
  updated_by?: string;
  /**
   * La tienda dueña. Tiene que estar acá Y enumerarse en el step del workflow: el
   * paso arma el objeto campo por campo, así que un `site_id` que sólo viaje en el
   * input se descarta EN SILENCIO — la plantilla nace global y le cambia el texto a
   * todas las tiendas.
   */
  site_id?: string | null;
}

export type UpdateEmailTemplateInput = Partial<CreateEmailTemplateInput>;
