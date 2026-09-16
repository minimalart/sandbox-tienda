import { Modules, MedusaError, ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { ZodError } from 'zod';
import { siteFromRequest } from '../../../lib/multistore/request';
import { CheckoutError } from './assignments';

export async function authorizeCheckoutAdmin(req: any, siteId: string, documents = false, resolvedSite?: Awaited<ReturnType<typeof siteFromRequest>>) {
  const actorId = req.auth_context?.actor_id;
  if (!actorId) throw new MedusaError(MedusaError.Types.UNAUTHORIZED, 'Autenticación administrativa requerida.');
  const scope = resolvedSite ?? await siteFromRequest(req);
  if (scope.status === 'unknownSite' || (scope.status === 'site' && scope.site.id !== siteId)) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, 'Seleccioná la tienda correspondiente.');
  const user = await req.scope.resolve(Modules.USER).retrieveUser(actorId);
  const allowed = user.metadata?.checkout_site_ids;
  if (Array.isArray(allowed) && !allowed.includes(siteId)) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, 'No tenés acceso al checkout de esta tienda.');
  const documentSites = user.metadata?.checkout_document_site_ids;
  if (documents && (!Array.isArray(documentSites) || !documentSites.includes(siteId))) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, 'No tenés permiso para consultar documentos de esta tienda.');
  return actorId;
}
export function checkoutErrorResponse(res: any, error: unknown, req?: any) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (error instanceof CheckoutError) return res.status(error.code === 'CHECKOUT_REVISION_CONFLICT' ? 409 : 400).json({ code: error.code, message: error.message, block: error.block, units: error.units });
  if (error instanceof ZodError) return res.status(400).json({ code: 'CHECKOUT_INVALID_INPUT', message: 'Revisá los campos indicados.', errors: error.issues.map(i => ({ field: i.path.join('.'), message: i.message })) });
  if (MedusaError.isMedusaError(error)) throw error;
  // SQL/driver exceptions may contain query bindings. Never return or report
  // those exceptions with a recipient payload attached.
  try { req?.scope?.resolve(ContainerRegistrationKeys.LOGGER).error(`[CHECKOUT_DEBUG] 503 CHECKOUT_UNAVAILABLE: ${(error as Error)?.stack ?? String(error)}`); } catch {}
  return res.status(503).json({ code: 'CHECKOUT_UNAVAILABLE', message: 'No se pudo guardar el checkout. Volvé a intentar.' });
}
export async function checkoutModulePresent(scope: any) {
  try { scope.resolve('demo_store'); return true; } catch { return false; }
}
