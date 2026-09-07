import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { AI_ASSISTANT_MODULE } from '../../../../../../../modules/ai-assistant';
import { buildAuthorizationUrl } from '../../../../../../../modules/ai-assistant/ai/mcp-oauth';
import { getAiAssistantSettings } from '../../../../../../../modules/ai-assistant/settings';

type AiService = any;

/**
 * POST /admin/ai-assistant/mcp-servers/:id/oauth/start — arranca el flujo OAuth:
 * descubre el AS, registra el cliente (DCR si hace falta) y devuelve la
 * authorization URL. El front la abre (popup/redirect); el AS redirige al
 * callback público `/mcp-oauth/callback`.
 */
export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const existing = await service.retrieveMcpServer(req.params.id).catch(() => null);
  if (!existing) {
    res.status(404).json({ message: 'Servidor MCP no encontrado.' });
    return;
  }

  // El callback debe ser una URL pública alcanzable por el navegador. Preferimos
  // el ajuste explícito (DB > MCP_OAUTH_REDIRECT_BASE); si no, las env de backend
  // compartidas y, por último, los headers (detrás del proxy de prod).
  //
  // MEDUSA_BACKEND_URL / BACKEND_URL / MEDUSA_BASE_URL se quedan como
  // `process.env` a propósito: las comparte todo el repo, así que no puede
  // adueñárselas este namespace. La única que se gestiona acá es la específica.
  const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0] || 'https';
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || '';
  const base = (
    getAiAssistantSettings().mcpOauthRedirectBase ||
    process.env.MEDUSA_BACKEND_URL ||
    process.env.BACKEND_URL ||
    process.env.MEDUSA_BASE_URL ||
    `${proto}://${host}`
  ).replace(/\/+$/, '');
  const redirectUri = `${base}/mcp-oauth/callback`;

  const result = await buildAuthorizationUrl(service, existing.id, redirectUri);
  if (!result.url) {
    res.status(400).json({ message: result.error ?? 'No se pudo iniciar el flujo OAuth.' });
    return;
  }
  res.json({ authorization_url: result.url, redirect_uri: redirectUri });
};
