import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { STORE_CONFIG_MODULE } from '../../../../modules/store-config';
import type StoreConfigModuleService from '../../../../modules/store-config/service';
import { chatComplete } from '../../../../modules/ai-assistant/ai/chat-client';
import type { ApiMessage } from '../../../../modules/ai-assistant/ai/types';
import type { AdminDraftAgentType } from '../validators';

/**
 * POST /admin/ai-assistant/draft-agent — "Generar con IA" del builder de agentes.
 * A partir de una descripción en una línea, devuelve un borrador
 * { name, description, instructions } para precargar el form de creación
 * (estilo "describí tu GPT y lo armo"). No persiste nada: el humano revisa y
 * guarda. El parseo del JSON es defensivo (saca fences, recorta al objeto) y, si
 * falla, cae a usar el texto crudo como instrucciones.
 */

const SYSTEM = `Diseñás agentes de IA para el backoffice de una tienda Medusa (ventas, catálogo, órdenes, clientes, promociones). A partir de la descripción del usuario, definí UN agente.
Devolvé SOLO un objeto JSON válido (sin texto extra, sin fences) con esta forma exacta:
{"name": string, "description": string, "instructions": string}
Reglas:
- "name": 2 a 4 palabras, en español.
- "description": una sola línea que diga qué hace y cuándo conviene usarlo.
- "instructions": el system prompt del agente, en segunda persona del singular ("Sos el agente de…"), 3 a 6 oraciones, indicando su dominio, en qué se enfoca y cuándo derivar a otro agente.`;

type AgentDraft = { name: string; description: string; instructions: string };

function parseDraft(raw: string | null): AgentDraft {
  const fallback: AgentDraft = {
    name: '',
    description: '',
    instructions: (raw ?? '').trim(),
  };
  if (!raw) return fallback;
  let txt = raw.trim();
  const fence = txt.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) txt = fence[1].trim();
  const start = txt.indexOf('{');
  const end = txt.lastIndexOf('}');
  if (start >= 0 && end > start) txt = txt.slice(start, end + 1);
  try {
    const o = JSON.parse(txt) as Record<string, unknown>;
    return {
      name: typeof o.name === 'string' ? o.name.trim() : '',
      description: typeof o.description === 'string' ? o.description.trim() : '',
      instructions:
        typeof o.instructions === 'string' && o.instructions.trim()
          ? o.instructions.trim()
          : fallback.instructions,
    };
  } catch {
    return fallback;
  }
}

export const POST = async (
  req: AuthenticatedMedusaRequest<AdminDraftAgentType>,
  res: MedusaResponse,
) => {
  const { prompt } = req.validatedBody;

  let chatModel: string | undefined;
  try {
    const storeConfig: StoreConfigModuleService = req.scope.resolve(STORE_CONFIG_MODULE);
    const ai = await storeConfig.getAiConfig();
    chatModel = ai?.chat_model;
  } catch {
    chatModel = undefined; // chatComplete cae al modelo por defecto del env.
  }

  const messages: ApiMessage[] = [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: prompt },
  ];

  try {
    const result = await chatComplete({
      model: chatModel,
      messages,
      maxTokens: 4000,
      reasoningEffort: 'low',
    });
    res.json({ draft: parseDraft(result.content) });
  } catch (e) {
    const err = e as { message?: string; status?: number };
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 502;
    res.status(status).json({ message: err.message ?? 'No se pudo generar el agente.' });
  }
};
