import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { AI_ASSISTANT_MODULE } from '../../../../modules/ai-assistant';
import { slugifyKey } from '../../../../modules/ai-assistant/ai/agent-manifest';
import { encryptSecret } from '../../../../modules/ai-assistant/crypto';
import type { AdminSaveMcpServerType } from '../validators';
import { toPublicServer } from './_serialize';

type AiService = any;

/** GET /admin/ai-assistant/mcp-servers — lista de servidores (sin secretos). */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const servers = await service.listMcpServers({}, { order: { created_at: 'ASC' }, take: 200 });
  res.json({ servers: servers.map((s: any) => toPublicServer(s)) });
};

/** POST /admin/ai-assistant/mcp-servers — registra un servidor MCP externo. */
export const POST = async (
  req: AuthenticatedMedusaRequest<AdminSaveMcpServerType>,
  res: MedusaResponse,
) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const body = req.validatedBody;
  const key = slugifyKey(body.key || body.name);
  if (!key) {
    res.status(400).json({ message: 'La key (o el nombre) es obligatoria.' });
    return;
  }
  const existing = await service.listMcpServers({ key }, { take: 1 });
  if (existing?.[0]) {
    res.status(409).json({ message: `Ya existe un servidor con key "${key}".` });
    return;
  }

  const authType = body.auth_type ?? 'none';
  const data: Record<string, any> = {
    key,
    name: body.name.trim(),
    url: body.url.trim(),
    avatar_url: body.avatar_url?.trim() || null,
    transport: body.transport ?? 'http',
    auth_type: authType,
    auth_header_name: body.auth_header_name?.trim() || null,
    oauth_client_id: body.oauth_client_id?.trim() || null,
    oauth_scope: body.oauth_scope?.trim() || null,
    enabled: body.enabled ?? true,
    trust_read_only_hints: body.trust_read_only_hints ?? false,
    health: 'unknown',
    created_by: req.auth_context?.actor_id ?? null,
  };
  if (body.secret && (authType === 'bearer' || authType === 'header')) {
    data.auth_secret_enc = encryptSecret(body.secret);
  }
  if (body.oauth_client_secret) {
    data.oauth_client_secret_enc = encryptSecret(body.oauth_client_secret);
  }

  const server = await service.createMcpServers(data);
  res.status(201).json({ server: toPublicServer(server) });
};
