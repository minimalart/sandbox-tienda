import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

/**
 * Readiness check del endpoint MCP, sin auth. Útil para confirmar que la ruta
 * está montada sin exponer ninguna tool. El health general del backend sigue
 * estando en su ruta propia.
 */
export function GET(_req: MedusaRequest, res: MedusaResponse): void {
  res.status(200).json({ status: 'ok', mcp: true });
}
