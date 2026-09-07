import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { AI_ASSISTANT_MODULE } from '../../../../modules/ai-assistant';
import { generateToken } from '../../../../modules/ai-assistant/mcp-keys';
import type { AdminCreateMcpKeyType } from '../validators';

type AiService = any;

function toPublic(k: any) {
  return {
    id: k.id,
    name: k.name,
    token_prefix: k.token_prefix,
    last_used_at: k.last_used_at,
    request_count: k.request_count,
    revoked: k.revoked,
    created_at: k.created_at,
  };
}

/** GET /admin/ai-assistant/keys — lista las API keys del usuario actual (sin exponer el token). */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const createdBy = req.auth_context?.actor_id ?? 'unknown';
  const keys = await service.listMcpApiKeys(
    { created_by: createdBy },
    { order: { created_at: 'DESC' }, take: 200 },
  );
  res.json({ keys: keys.map((k: any) => toPublic(k)) });
};

/**
 * POST /admin/ai-assistant/keys — genera una API key nueva. Devuelve el token en
 * claro UNA sola vez (solo se guarda el hash).
 */
export const POST = async (
  req: AuthenticatedMedusaRequest<AdminCreateMcpKeyType>,
  res: MedusaResponse,
) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const createdBy = req.auth_context?.actor_id ?? null;
  const { token, hash, prefix } = generateToken();

  const key = await service.createMcpApiKeys({
    name: req.validatedBody.name.trim(),
    token_hash: hash,
    token_prefix: prefix,
    revoked: false,
    request_count: 0,
    created_by: createdBy,
  });

  res.status(201).json({ key: toPublic(key), token });
};
