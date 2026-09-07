import axios, { type AxiosInstance } from 'axios';
import { MedusaError } from '@medusajs/framework/utils';

import { getKapsoSettings } from './settings';

export type KapsoMessagePayload = {
  messaging_product: 'whatsapp';
  to: string;
  type: string;
  [key: string]: unknown;
};

export type KapsoSendResult = {
  /** WhatsApp message id (wamid...) when Kapso/Meta accept the message. */
  id?: string;
  raw: unknown;
};

/** Representación de un message template tal como lo devuelve Meta/Kapso. */
export type KapsoTemplate = {
  id?: string;
  name: string;
  language: string;
  category: string;
  status?: string;
  components?: Array<Record<string, unknown>>;
};

export type KapsoTemplateInput = {
  name: string;
  language: string;
  category: string;
  components: Array<Record<string, unknown>>;
};

/**
 * Cliente REST mínimo para la API de Kapso (proxy de la WhatsApp Cloud API de
 * Meta). Solo cubre el envío de mensajes; se autentica con el header `X-API-Key`.
 */
export class KapsoClient {
  private http: AxiosInstance;

  constructor(opts: { apiKey: string; baseUrl?: string }) {
    this.http = axios.create({
      baseURL: opts.baseUrl || 'https://api.kapso.ai',
      headers: {
        'X-API-Key': opts.apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 15_000,
    });
  }

  /**
   * POST /meta/whatsapp/v24.0/{phoneNumberId}/messages — body compatible con la
   * Cloud API de Meta. Devuelve el id del primer mensaje aceptado.
   */
  async sendMessage(
    phoneNumberId: string,
    payload: KapsoMessagePayload,
  ): Promise<KapsoSendResult> {
    const res = await this.http.post(
      `/meta/whatsapp/v24.0/${phoneNumberId}/messages`,
      payload,
    );
    const id = (res.data as { messages?: { id?: string }[] })?.messages?.[0]?.id;
    return { id, raw: res.data };
  }

  /**
   * Marca un mensaje entrante como leído y (opcional) muestra el indicador de
   * "escribiendo…" mientras se prepara la respuesta. El indicador se descarta al
   * enviar un mensaje o a los ~25s. Best-effort desde el caller.
   */
  async markRead(
    phoneNumberId: string,
    messageId: string,
    opts?: { typing?: boolean },
  ): Promise<void> {
    await this.http.post(`/meta/whatsapp/v24.0/${phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
      ...(opts?.typing ? { typing_indicator: { type: 'text' } } : {}),
    });
  }

  /**
   * GET /meta/whatsapp/v24.0/{wabaId}/message_templates — lista los templates del
   * WhatsApp Business Account, con su estado de aprobación de Meta.
   */
  async listTemplates(wabaId: string): Promise<KapsoTemplate[]> {
    const res = await this.http.get(
      `/meta/whatsapp/v24.0/${wabaId}/message_templates`,
    );
    return (res.data as { data?: KapsoTemplate[] })?.data ?? [];
  }

  /**
   * POST /meta/whatsapp/v24.0/{wabaId}/message_templates — crea (envía a revisión)
   * un template. Queda en estado PENDING hasta que Meta lo aprueba.
   */
  async createTemplate(
    wabaId: string,
    input: KapsoTemplateInput,
  ): Promise<KapsoTemplate> {
    const res = await this.http.post(
      `/meta/whatsapp/v24.0/${wabaId}/message_templates`,
      input,
    );
    return res.data as KapsoTemplate;
  }

  /**
   * POST /meta/whatsapp/v24.0/{templateId} — edita un template EXISTENTE por su id
   * de Meta. Solo se pueden cambiar `category` y/o `components` (el nombre y el
   * idioma son inmutables). Editar una plantilla APPROVED la manda de vuelta a
   * revisión (PENDING); las que están PENDING/IN_APPEAL/DISABLED no se pueden
   * editar y Meta responde con error.
   */
  async updateTemplate(
    templateId: string,
    input: { category?: string; components?: Array<Record<string, unknown>> },
  ): Promise<unknown> {
    const res = await this.http.post(`/meta/whatsapp/v24.0/${templateId}`, input);
    return res.data;
  }

  /**
   * DELETE /meta/whatsapp/v24.0/{wabaId}/message_templates?name={name} — elimina
   * el template (todas sus traducciones) por nombre.
   */
  async deleteTemplate(wabaId: string, name: string): Promise<void> {
    await this.http.delete(`/meta/whatsapp/v24.0/${wabaId}/message_templates`, {
      params: { name },
    });
  }
}

/**
 * Construye un cliente de Kapso junto con el WABA id necesario para gestionar
 * templates, resolviendo la configuración con la precedencia **DB > env >
 * default** de `app-settings`. Lanza un error claro (NOT_ALLOWED) si falta
 * configuración — las rutas de admin lo traducen a un 4xx legible.
 *
 * Se sigue llamando `kapsoFromEnv` para no tocar los seis call sites de las
 * rutas de admin; el nombre quedó viejo, el comportamiento no.
 */
export function kapsoFromEnv(): { client: KapsoClient; wabaId: string } {
  const { apiKey, businessAccountId: wabaId, baseUrl } = getKapsoSettings();
  if (!apiKey || !wabaId) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'Kapso no está configurado para gestionar plantillas: faltan la API key y/o el ID de ' +
        'la cuenta de WhatsApp Business. Configuralos en Admin → WhatsApp → Ajustes.',
    );
  }
  return { client: new KapsoClient({ apiKey, baseUrl }), wabaId };
}

/**
 * Extrae el mensaje de error más útil de una falla de la API de Kapso/Meta
 * (axios). Sirve para devolver al admin el detalle real (ej. el error de sandbox
 * o el motivo de rechazo de Meta) en lugar de un 500 opaco.
 */
export function kapsoErrorMessage(error: unknown): string {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  if (data) {
    if (typeof data === 'string') return data;
    const obj = data as { error?: unknown; message?: string };
    if (typeof obj.error === 'string') return obj.error;
    const nested = obj.error as { message?: string; error_user_msg?: string } | undefined;
    if (nested?.error_user_msg) return nested.error_user_msg;
    if (nested?.message) return nested.message;
    if (obj.message) return obj.message;
    return JSON.stringify(data);
  }
  return (error as Error)?.message ?? 'Error desconocido al llamar a Kapso';
}
