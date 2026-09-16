import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { AI_ASSISTANT_MODULE } from '../../../../../modules/ai-assistant';
import { encryptSecret } from '../../../../../modules/ai-assistant/crypto';
import type { AdminSaveMcpServerType } from '../../validators';
import { toPublicServer } from '../_serialize';

type AiService = any;

/** GET /admin/ai-assistant/mcp-servers/:id — detalle (sin secretos). */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const server = await service.retrieveMcpServer(req.params.id).catch(() => null);
  if (!server) {
    res.status(404).json({ message: 'Servidor MCP no encontrado.' });
    return;
  }
  res.json({ server: toPublicServer(server) });
};

/**
 * POST /admin/ai-assistant/mcp-servers/:id — actualiza el servidor. La `key` no se
 * cambia (la referencian las tools namespaced ya guardadas en allow-lists). El
 * secreto solo se pisa si llega uno nuevo no vacío.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest<AdminSaveMcpServerType>,
  res: MedusaResponse,
) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const existing = await service.retrieveMcpServer(req.params.id).catch(() => null);
  if (!existing) {
    res.status(404).json({ message: 'Servidor MCP no encontrado.' });
    return;
  }

  const body = req.validatedBody;
  const authType = body.auth_type ?? existing.auth_type;
  const patch: Record<string, any> = {
    id: existing.id,
    name: body.name.trim(),
    url: body.url.trim(),
    avatar_url: body.avatar_url?.trim() || null,
    transport: body.transport ?? existing.transport,
    auth_type: authType,
    auth_header_name: body.auth_header_name?.trim() || null,
    oauth_client_id: body.oauth_client_id?.trim() || null,
    oauth_scope: body.oauth_scope?.trim() || null,
    enabled: body.enabled ?? existing.enabled,
    trust_read_only_hints: body.trust_read_only_hints ?? existing.trust_read_only_hints ?? false,
  };
  if (body.url.trim() !== existing.url) {
    patch.tools_cache = null;
    patch.tools_count = 0;
    patch.health = 'unknown';
    patch.last_discovered_at = null;
    patch.trust_read_only_hints = body.trust_read_only_hints ?? false;
  }
  // Token estático: solo si llega no vacío. Si pasa a none/oauth, se limpia.
  if (authType === 'bearer' || authType === 'header') {
    if (body.secret) patch.auth_secret_enc = encryptSecret(body.secret);
  } else {
    patch.auth_secret_enc = null;
  }
  if (body.oauth_client_secret) {
    patch.oauth_client_secret_enc = encryptSecret(body.oauth_client_secret);
  }

  await service.updateMcpServers(patch);
  const server = await service.retrieveMcpServer(existing.id);
  res.json({ server: toPublicServer(server) });
};

/** DELETE /admin/ai-assistant/mcp-servers/:id — elimina (soft) el servidor. */
export const DELETE = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const existing = await service.retrieveMcpServer(req.params.id).catch(() => null);
  if (!existing) {
    res.status(404).json({ message: 'Servidor MCP no encontrado.' });
    return;
  }
  await service.deleteMcpServers(existing.id);
  res.json({ id: existing.id, deleted: true });
};
