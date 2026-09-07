import type { MedusaRequest } from '@medusajs/framework';
import { DATABASE_EXPLORER_MODULE } from '../../../modules/database-explorer';
import type DatabaseExplorerModuleService from '../../../modules/database-explorer/service';

export function databaseExplorerService(req: MedusaRequest) {
  return req.scope.resolve<DatabaseExplorerModuleService>(DATABASE_EXPLORER_MODULE);
}

export function actorId(req: MedusaRequest) {
  return (req as { auth_context?: { actor_id?: string } }).auth_context?.actor_id ?? null;
}

export function queryString(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}

export function parseFilters(value: unknown): Record<string, unknown> {
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
