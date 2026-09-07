import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { AI_ASSISTANT_MODULE } from '../../../../../../modules/ai-assistant';
import { refreshServerTools } from '../../../../../../modules/ai-assistant/ai/tool-registry';
import { toPublicServer } from '../../_serialize';

type AiService = any;

/**
 * POST /admin/ai-assistant/mcp-servers/:id/refresh — conecta al servidor, descubre
 * sus tools y refresca la cache + estado de salud. Es el botón "Probar/Refrescar".
 */
export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const existing = await service.retrieveMcpServer(req.params.id).catch(() => null);
  if (!existing) {
    res.status(404).json({ message: 'Servidor MCP no encontrado.' });
    return;
  }
  const result = await refreshServerTools(service, existing.id);
  const server = await service.retrieveMcpServer(existing.id).catch(() => null);
  res.json({ ...result, server: server ? toPublicServer(server) : null });
};
