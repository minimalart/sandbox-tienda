import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
  MiddlewareRoute,
} from '@medusajs/framework/http';
import {
  authorizationServerMetadata,
  protectedResourceMetadata,
} from '../../../modules/ai-assistant/oauth';

/**
 * Middlewares del Authorization Server OAuth del MCP:
 * - CORS en /mcp/oauth/register y /token (los conectores los fetchean del browser).
 * - Metadata `.well-known` servida acá (handler que responde y NO llama next),
 *   para no depender de rutas con dir que empiece con punto.
 */

function setCors(req: MedusaRequest, res: MedusaResponse): void {
  res.setHeader('Access-Control-Allow-Origin', (req.headers.origin as string) || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

const cors = (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction): void => {
  setCors(req, res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
};

const protectedResource = (req: MedusaRequest, res: MedusaResponse): void => {
  setCors(req, res);
  res.json(protectedResourceMetadata());
};

const authServer = (req: MedusaRequest, res: MedusaResponse): void => {
  setCors(req, res);
  res.json(authorizationServerMetadata());
};

export const mcpOAuthMiddlewares: MiddlewareRoute[] = [
  {
    matcher: '/mcp/oauth/register',
    method: ['POST', 'OPTIONS'],
    middlewares: [cors],
  },
  {
    matcher: '/mcp/oauth/token',
    method: ['POST', 'OPTIONS'],
    middlewares: [cors],
  },
  // Discovery (RFC 9728 / 8414). Servido por el middleware (responde y corta).
  {
    matcher: '/.well-known/oauth-protected-resource',
    method: ['GET'],
    middlewares: [protectedResource],
  },
  {
    matcher: '/.well-known/oauth-protected-resource/mcp',
    method: ['GET'],
    middlewares: [protectedResource],
  },
  {
    matcher: '/.well-known/oauth-authorization-server',
    method: ['GET'],
    middlewares: [authServer],
  },
  {
    matcher: '/.well-known/openid-configuration',
    method: ['GET'],
    middlewares: [authServer],
  },
];
