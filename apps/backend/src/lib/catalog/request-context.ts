import { AsyncLocalStorage } from 'node:async_hooks';
import { publicJson } from './public-http';
export const publicCatalogRequests = new AsyncLocalStorage<{
  requests: number;
  shouldCancel?: () => Promise<boolean>;
}>();
/** Safe transport for existing public adapters without changing their legacy API. */
export async function safeCatalogResponse(url: string, init?: RequestInit): Promise<Response> {
  const context = publicCatalogRequests.getStore();
  if (context && (++context.requests > 3000 || (await context.shouldCancel?.())))
    throw new Error('Se detuvo la recuperación del catálogo.');
  if (init?.method && init.method !== 'GET')
    throw new Error('La importación normal sólo admite catálogos públicos por GET.');
  const result = await publicJson(url);
  return new Response(result.status === 204 ? null : JSON.stringify(result.body), {
    status: result.status,
    headers: { 'content-type': 'application/json' },
  });
}
