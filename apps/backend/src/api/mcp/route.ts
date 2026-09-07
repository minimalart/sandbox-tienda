import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { getMcpHandler } from './_loader';

/**
 * Endpoint MCP (Model Context Protocol) sobre Streamable HTTP, montado DENTRO del
 * backend de Medusa (mismo proceso, mismo deploy). Delega en el handler del
 * paquete `mcp-medusa`, que expone las tools de la Admin API.
 *
 * - POST   /mcp  → JSON-RPC (initialize, tools/list, tools/call, ...)
 * - GET    /mcp  → stream SSE para mensajes server-initiated (opcional)
 * - DELETE /mcp  → termina la sesión
 * - OPTIONS/mcp  → preflight CORS (lo resuelve el corsMiddleware)
 *
 * Auth y CORS los aplica el middleware del matcher (ver ./middlewares.ts). Los
 * tools llaman la Admin API por HTTP a `MEDUSA_BASE_URL` (loopback) con
 * `MEDUSA_API_KEY`.
 */
async function handle(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const handler = await getMcpHandler();
  await handler.handleRequest(req, res);
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
export const OPTIONS = handle;
