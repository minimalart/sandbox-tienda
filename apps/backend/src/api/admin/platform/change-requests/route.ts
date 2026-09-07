import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { z } from 'zod';
import { getConfiguredPlatformConnection, platformAuthHeaders } from '../../../../lib/platform/connection';

const BodySchema = z.object({
  action: z.enum(['install', 'update', 'switch-template']),
  component_id: z.string().regex(/^[a-z0-9-]+$/),
  target_version: z.string().min(1).optional(),
});

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  const current = getConfiguredPlatformConnection();
  if (!current) return res.status(503).json({ message: 'This project is not connected to Mercatto Platform' });
  const headers = platformAuthHeaders(current);
  const [catalogResponse, changesResponse] = await Promise.all([
    fetch(`${current.platformUrl}/v1/catalog`), fetch(`${current.platformUrl}/v1/change-requests`, { headers }),
  ]);
  const catalog = await catalogResponse.json();
  const changes = await changesResponse.json() as Record<string, unknown>;
  return res.status(changesResponse.ok ? 200 : changesResponse.status).json({ catalog, ...changes });
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const current = getConfiguredPlatformConnection();
  if (!current) {
    return res.status(503).json({ message: 'This project is not connected to Mercatto Platform' });
  }
  const body = BodySchema.parse(req.body);
  const response = await fetch(`${current.platformUrl}/v1/change-requests`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...platformAuthHeaders(current) },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({ message: 'Invalid platform response' }));
  return res.status(response.status).json(payload);
}
