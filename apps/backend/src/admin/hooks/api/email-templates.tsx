import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
/*
  `fetchJson` compartido, NO una copia local. `admin/email-templates` y su `[id]`
  están declaradas `scoped`, pero la copia local mandaba sólo `Content-Type`: sin
  `x-site-id`, `siteFromRequest` resolvía `allSites` y el filtro quedaba en no-op.
  Acá lo que se mezcla es la plantilla del mail transaccional de cada tienda —
  logo, remitente y copy distintos— y `publish` opera por id sobre lo que la lista
  devolvió: publicar la plantilla de otra tienda no da ningún error.

  `preview` y `test-send` van por el MISMO helper y no por `siteHeaders`: ambas
  devuelven JSON (`{ subject, html }` y `{ sent, to }`), el HTML viaja adentro del
  cuerpo. No hay ninguna llamada de blob ni de upload en este archivo — se
  verificó, y si alguna vez se agrega una, va con `siteHeaders` a mano.
*/
import { fetchJson } from '../../lib/http';

const BASE_URL = '/admin/email-templates';

// ─── Types ──────────────────────────────────────────────────────────────────

export type EmailTemplateStatus = 'draft' | 'published';

export type EmailTemplateVariable = {
  name: string;
  description?: string;
};

export type EmailTemplate = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  subject: string;
  html: string;
  design?: Record<string, unknown> | null;
  status: EmailTemplateStatus;
  locale?: string | null;
  variables?: EmailTemplateVariable[] | null;
  sample_data?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  published_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type EmailTemplateCreateInput = {
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
};

export type EmailTemplateUpdateInput = Partial<EmailTemplateCreateInput>;

// ─── Query keys ───────────────────────────────────────────────────────────────

export const EMAIL_TEMPLATES_QUERY_KEY = ['email-templates'] as const;
export const emailTemplateQueryKey = (id: string) =>
  ['email-templates', id] as const;

// ─── Fetch helper ─────────────────────────────────────────────────────────────

// ─── Hooks ────────────────────────────────────────────────────────────────────

export type EmailTemplatesListResponse = {
  email_templates: EmailTemplate[];
  count: number;
};

export function useEmailTemplates(params?: {
  limit?: number;
  offset?: number;
  status?: string;
  q?: string;
}) {
  const qs = new URLSearchParams();
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.offset != null) qs.set('offset', String(params.offset));
  if (params?.status) qs.set('status', params.status);
  if (params?.q) qs.set('q', params.q);
  const url = qs.toString() ? `${BASE_URL}?${qs.toString()}` : BASE_URL;

  return useQuery({
    queryKey: [...EMAIL_TEMPLATES_QUERY_KEY, params ?? {}],
    queryFn: () => fetchJson<EmailTemplatesListResponse>(url),
  });
}

export function useEmailTemplate(id: string) {
  return useQuery({
    queryKey: emailTemplateQueryKey(id),
    queryFn: () =>
      fetchJson<{ email_template: EmailTemplate }>(`${BASE_URL}/${id}`).then(
        (d) => d.email_template,
      ),
    enabled: !!id,
  });
}

export function useCreateEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: EmailTemplateCreateInput) =>
      fetchJson<{ email_template: EmailTemplate }>(BASE_URL, {
        method: 'POST',
        body: JSON.stringify(data),
      }).then((d) => d.email_template),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: EMAIL_TEMPLATES_QUERY_KEY }),
  });
}

export function useUpdateEmailTemplate(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: EmailTemplateUpdateInput) =>
      fetchJson<{ email_template: EmailTemplate }>(`${BASE_URL}/${id}`, {
        method: 'POST',
        body: JSON.stringify(data),
      }).then((d) => d.email_template),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: EMAIL_TEMPLATES_QUERY_KEY });
      qc.invalidateQueries({ queryKey: emailTemplateQueryKey(id) });
    },
  });
}

export function useDeleteEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ deleted: boolean }>(`${BASE_URL}/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: EMAIL_TEMPLATES_QUERY_KEY }),
  });
}

export function usePublishEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ email_template: EmailTemplate }>(`${BASE_URL}/${id}/publish`, {
        method: 'POST',
      }).then((d) => d.email_template),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: EMAIL_TEMPLATES_QUERY_KEY }),
  });
}

export function useUnpublishEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ email_template: EmailTemplate }>(
        `${BASE_URL}/${id}/unpublish`,
        { method: 'POST' },
      ).then((d) => d.email_template),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: EMAIL_TEMPLATES_QUERY_KEY }),
  });
}

// ─── Preview & test send (server-side render) ─────────────────────────────────

export type PreviewResponse = { subject: string; html: string };

export function usePreviewEmailTemplate(id: string) {
  return useMutation({
    mutationFn: (input: {
      subject?: string;
      html?: string;
      design?: Record<string, unknown> | null;
      data?: Record<string, unknown>;
    }) =>
      fetchJson<PreviewResponse>(`${BASE_URL}/${id}/preview`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });
}

export function useTestSendEmailTemplate(id: string) {
  return useMutation({
    mutationFn: (input: { to: string; data?: Record<string, unknown> }) =>
      fetchJson<{ sent: boolean; to: string }>(`${BASE_URL}/${id}/test-send`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });
}

// ─── Envíos reales (valores con los que salió el mail) ────────────────────────

/**
 * OJO con la confusión que esto viene a cerrar: lo de arriba (`preview`,
 * `test-send`, `sample_data`) son valores de DEMO que escribe el operador. Lo de acá
 * son los valores REALES que `notification.data` guardó de cada envío. Son dos
 * fuentes distintas y la pantalla tiene que decirlo con todas las letras — el
 * usuario las confundía, y con razón: las dos se llamaban "variables".
 */

export type SendVariableState = 'ok' | 'empty' | 'missing';

export type SendVariable = {
  name: string;
  description?: string;
  /** El valor real del payload. `undefined` cuando el estado es `missing`. */
  value?: unknown;
  state: SendVariableState;
  /** El backend recortó un token: lo que se ve NO es el valor literal. */
  masked: boolean;
};

export type TemplateSend = {
  id: string;
  to: string;
  created_at: string;
  status: string;
  provider_id: string;
  variables: SendVariable[];
  undeclared: SendVariable[];
  counts: { ok: number; empty: number; missing: number; undeclared: number };
};

export type TemplateSendsResponse = {
  sends: TemplateSend[];
  count: number;
  limit: number;
  declared: Array<{ name: string; description?: string }>;
  /** Envíos ocultos porque su payload no permite atribuirlos a la tienda activa. */
  unattributed: number;
};

export const emailTemplateSendsQueryKey = (id: string, limit: number) =>
  ['email-templates', id, 'sends', limit] as const;

export function useEmailTemplateSends(id: string, limit = 10) {
  return useQuery({
    queryKey: emailTemplateSendsQueryKey(id, limit),
    queryFn: () =>
      fetchJson<TemplateSendsResponse>(
        `${BASE_URL}/${id}/sends?limit=${limit}`,
      ),
    enabled: !!id,
    /**
     * Cero caché: es una pantalla de diagnóstico. El operador entra justo después de
     * disparar un mail para ver con qué salió, y un dato de hace cinco minutos le
     * contesta sobre el envío anterior. Ese es exactamente el modo de falla que la
     * feature vino a eliminar, así que no lo reintroducimos en el cliente.
     */
    staleTime: 0,
  });
}
