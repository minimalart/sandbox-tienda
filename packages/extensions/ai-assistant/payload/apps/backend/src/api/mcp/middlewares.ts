import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
  MiddlewareRoute,
} from '@medusajs/framework/http';
import { AI_ASSISTANT_MODULE } from '../../modules/ai-assistant';
import { bearerFromHeader, hashToken } from '../../modules/ai-assistant/mcp-keys';
import { baseUrl } from '../../modules/ai-assistant/oauth';
import { getAiAssistantSettings } from '../../modules/ai-assistant/settings';

/**
 * Middlewares del endpoint `/mcp`. Como `/mcp` queda FUERA de `/admin` y `/store`,
 * Medusa no le aplica auth de actor: validamos con **API keys gestionadas** desde
 * la pestaña Configuración del Asistente IA (se guarda el hash en DB). Como
 * fallback opcional se acepta un token compartido, por compatibilidad: sale de
 * `app-settings` con la precedencia DB > env (`MCP_AUTH_TOKEN`).
 *
 * `/mcp/health` queda sin auth (no matchea estos middlewares).
 */

function applyCors(req: MedusaRequest, res: MedusaResponse): void {
  const origin = (req.headers.origin as string) || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, Mcp-Session-Id, Last-Event-ID',
  );
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
  res.setHeader('Access-Control-Max-Age', '86400');
}

const cors = (
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
): void => {
  applyCors(req, res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
};

function unauthorized(res: MedusaResponse): void {
  // El header permite al cliente OAuth descubrir el AS (MCP auth spec).
  res.setHeader(
    'WWW-Authenticate',
    `Bearer resource_metadata="${baseUrl()}/.well-known/oauth-protected-resource"`,
  );
  res.status(401).json({ error: 'Unauthorized' });
}

const auth = async (
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
): Promise<void> => {
  if (req.method === 'OPTIONS') {
    next();
    return;
  }

  const token = bearerFromHeader(req.headers.authorization as string | undefined);
  if (!token) {
    unauthorized(res);
    return;
  }

  try {
    const service: any = req.scope.resolve(AI_ASSISTANT_MODULE);
    const tokenHash = hashToken(token);

    // 1) API key gestionada (hash en DB, no revocada).
    const [key] = await service.listMcpApiKeys(
      { token_hash: tokenHash, revoked: false },
      { take: 1 },
    );
    if (key) {
      // Métricas por key (best-effort, no bloquea la request).
      service
        .updateMcpApiKeys({
          id: key.id,
          last_used_at: new Date(),
          request_count: (key.request_count ?? 0) + 1,
        })
        .catch(() => undefined);
      next();
      return;
    }

    // 2) Access token OAuth (hash en DB, no revocado, no vencido).
    const [oauth] = await service.listOAuthTokens(
      { token_hash: tokenHash, revoked: false },
      { take: 1 },
    );
    if (oauth && new Date(oauth.expires_at).getTime() > Date.now()) {
      next();
      return;
    }
  } catch {
    // Si falla el lookup, caemos al fallback de env.
  }

  // 2) Fallback opcional: token compartido (DB > env).
  const sharedToken = getAiAssistantSettings().mcpAuthToken;
  if (sharedToken && token === sharedToken) {
    next();
    return;
  }

  unauthorized(res);
};

export const mcpMiddlewares: MiddlewareRoute[] = [
  {
    matcher: '/mcp',
    method: ['POST', 'GET', 'DELETE', 'OPTIONS'],
    middlewares: [cors, auth],
  },
];
