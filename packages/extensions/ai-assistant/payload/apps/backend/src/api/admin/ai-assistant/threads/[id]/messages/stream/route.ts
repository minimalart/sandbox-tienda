import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { AI_ASSISTANT_MODULE } from '../../../../../../../modules/ai-assistant';
import { STORE_CONFIG_MODULE } from '../../../../../../../modules/store-config';
import type StoreConfigModuleService from '../../../../../../../modules/store-config/service';
import {
  loadThreadView,
  runUserTurn,
  memoryOptionsFromConfig,
  type AiStore,
} from '../../../../../../../modules/ai-assistant/ai/agent';
import {
  decorateUserMessage,
  type SkillId,
} from '../../../../../../../modules/ai-assistant/ai/prompt';
import {
  parseCampaignStep,
  summarizeCampaignStep,
  upsertCampaign,
} from '../../../../../../../modules/ai-assistant/ai/campaign';
import type { AgentEvent, ChatAttachment } from '../../../../../../../modules/ai-assistant/ai/types';
import {
  extractDocumentText,
  isSupportedDocumentMime,
} from '../../../../../../../modules/ai-assistant/ai/document-parse';
import type { AdminSendMessageType, AdminChatAttachmentType } from '../../../../validators';

type AiService = any;

const ATTACHMENT_FETCH_TIMEOUT_MS = 15000;

/** Resuelve una URL (relativa o local) a absoluta para que el server la baje. */
function toAbsoluteUrl(url: string): string {
  if (url.startsWith('http')) return url;
  const base = (process.env.MEDUSA_BACKEND_URL || 'http://localhost:9000').replace(/\/$/, '');
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}

/**
 * Procesa los adjuntos del mensaje: a los documentos (PDF/TXT/MD) les extrae el
 * texto (baja el archivo de su URL y lo parsea) para inyectarlo como contexto; las
 * imágenes se dejan tal cual (las consume el modelo como image_url). Best-effort:
 * si un documento no se puede bajar/parsear, se guarda sin texto (no rompe el turno).
 */
async function processChatAttachments(
  attachments: AdminChatAttachmentType[] | undefined,
): Promise<ChatAttachment[]> {
  if (!attachments?.length) return [];
  return Promise.all(
    attachments.map(async (a): Promise<ChatAttachment> => {
      const base: ChatAttachment = {
        kind: a.kind,
        url: a.url,
        file_id: a.file_id ?? null,
        filename: a.filename,
        mime_type: a.mime_type,
      };
      if (a.kind !== 'document' || !isSupportedDocumentMime(a.mime_type)) return base;
      try {
        const fetched = await fetch(toAbsoluteUrl(a.url), {
          signal: AbortSignal.timeout(ATTACHMENT_FETCH_TIMEOUT_MS),
        });
        if (!fetched.ok) return base;
        const buf = Buffer.from(await fetched.arrayBuffer());
        const text = await extractDocumentText(buf, a.mime_type);
        return { ...base, text: text || null };
      } catch {
        return base;
      }
    }),
  );
}

/**
 * POST /admin/ai-assistant/threads/:id/messages/stream — igual que `messages`
 * pero devuelve la respuesta en streaming SSE: emite los eventos del loop
 * (token/tool_call/tool_result/handoff/step) a medida que ocurren y, al final,
 * un evento `done` con la vista del hilo (mensajes persistidos + pendientes) para
 * que el cliente reconcilie. La persistencia es idéntica a la route sincrónica;
 * el flujo de confirmación (HITL) sigue por `/confirm` sin streaming.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest<AdminSendMessageType>,
  res: MedusaResponse,
) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const { id } = req.params;
  const createdBy = req.auth_context?.actor_id ?? 'unknown';

  const thread = await service.retrieveChatThread(id).catch(() => null);
  if (!thread || thread.created_by !== createdBy) {
    res.status(404).json({ message: 'Hilo no encontrado.' });
    return;
  }

  const { text, model, skill, period, attachments, agent_key } = req.validatedBody;
  const processedAttachments = await processChatAttachments(attachments);

  // Mención `@agente` del composer: fija ese agente como activo del hilo ANTES de
  // correr el turno (el loop re-resuelve el agente activo en cada vuelta, así que
  // el turno arranca directo con el mencionado; después puede derivar igual).
  // Best-effort: una key inexistente o deshabilitada no rompe el turno.
  if (agent_key) {
    const targets = await service
      .listAgents({ key: agent_key, enabled: true }, { take: 1 })
      .catch(() => [] as Array<{ id: string }>);
    if (targets[0]?.id) {
      await service
        .updateChatThreads({ id: thread.id, active_agent_id: targets[0].id })
        .catch(() => undefined);
    }
  }

  // Wizard de campaña: si el mensaje es un <campaign_step>, persistimos el patch en
  // ai_campaign (determinístico, sin que el LLM parsee el form) y mostramos un
  // resumen legible como contenido del mensaje del usuario.
  const campaignStep = parseCampaignStep(text ?? '');
  let userContent: string;
  if (campaignStep) {
    const row = await upsertCampaign({
      store: service as AiStore,
      threadId: thread.id,
      createdBy,
      patch: campaignStep.patch,
    });
    userContent = summarizeCampaignStep(campaignStep.step, row.state);
  } else {
    userContent = decorateUserMessage(text ?? '', { skill: skill as SkillId, period });
  }

  await service.createChatMessages({
    thread_id: thread.id,
    role: 'user',
    content: userContent,
    status: 'complete',
    attachments: processedAttachments.length > 0 ? processedAttachments : null,
  });

  if (!thread.title || thread.title === 'Nuevo chat') {
    const title = (text && text.trim()) || processedAttachments[0]?.filename || 'Archivo adjunto';
    await service.updateChatThreads({ id: thread.id, title: title.slice(0, 80) });
  }

  // Cabeceras SSE. `X-Accel-Buffering: no` evita que un proxy (nginx) bufferee.
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const flush = (res as unknown as { flush?: () => void }).flush;
  const send = (ev: AgentEvent | { type: 'done' | 'error'; [k: string]: unknown }) => {
    res.write(`data: ${JSON.stringify(ev)}\n\n`);
    // Si hay compresión (Express `compression`), forzar el envío del frame ahora.
    flush?.call(res);
  };

  try {
    const storeConfig: StoreConfigModuleService = req.scope.resolve(STORE_CONFIG_MODULE);
    const ai = await storeConfig.getAiConfig();
    const result = await runUserTurn({
      store: service as AiStore,
      threadId: thread.id,
      model: model || ai.chat_model,
      maxTokens: ai.chat_max_tokens,
      reasoningEffort: ai.chat_reasoning_effort,
      validationEnabled: ai.chat_validation_enabled,
      onEvent: send,
      nativeCtx: {
        container: req.scope,
        store: service as AiStore,
        onEvent: send,
        createdBy,
        threadId: thread.id,
      },
      memory: memoryOptionsFromConfig(ai, createdBy),
    });
    const view = await loadThreadView(service as AiStore, thread.id);
    send({ type: 'done', status: result.status, ...view });
  } catch (e) {
    console.error('[ai-assistant] stream turn failed:', (e as Error).message, e);
    send({ type: 'error', message: (e as Error).message });
  } finally {
    res.end();
  }
};
