import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { MedusaError } from '@medusajs/framework/utils';
import { siteFromRequest } from '../../../../../lib/multistore/request';
import { assertRowInSite, type SiteColumnScope } from '../../../../../lib/multistore/scope';
import { STORE_CONFIG_MODULE } from '../../../../../modules/store-config';
import type StoreConfigModuleService from '../../../../../modules/store-config/service';
import { PostAdminUpdateMinimumPurchase } from '../validators';

/**
 * La misma pertenencia que filtra el listado hermano: la fila de la tienda activa o
 * la global (`site_id IS NULL`). Si el listado la muestra, acá se puede editar; si
 * no, 404 — es el principio de `lib/multistore/scope.ts`.
 *
 * `empty: 'global'` a propósito: con una tienda elegida, la serie global sigue siendo
 * la que hereda esa tienda cuando no tiene la suya, y el operador la ve en la tabla.
 * Esconderla acá sería un 404 sobre una fila que tiene delante de los ojos.
 */
const MINIMUM_PURCHASE_SITE_SCOPE: SiteColumnScope = {
  kind: 'site_column',
  table: 'minimum_purchase',
  column: 'site_id',
  empty: 'global',
};

const notFound = () => new MedusaError(MedusaError.Types.NOT_FOUND, 'Minimum purchase not found');

const statusOf = (error: unknown): number => {
  if (error instanceof MedusaError && error.type === MedusaError.Types.NOT_FOUND) return 404;
  return 400;
};

/**
 * Lee la fila y verifica que pertenezca al alcance de la request. `retrieve*` tira
 * su propio NOT_FOUND cuando el id no existe; lo unificamos para no filtrar por el
 * mensaje si el id es de otra tienda.
 */
const loadInScope = async (req: MedusaRequest, service: StoreConfigModuleService) => {
  const id = req.params.id as string;
  const row = await service.retrieveMinimumPurchase(id).catch(() => null);
  if (!row) throw notFound();
  assertRowInSite(row as Record<string, unknown>, await siteFromRequest(req), MINIMUM_PURCHASE_SITE_SCOPE);
  return row;
};

/**
 * POST /admin/store-config/minimum-purchase/:id — edit a record in place.
 *
 * El historial dejó de ser sólo de alta: un monto mal tipeado o una vigencia
 * equivocada se corrigen sobre la misma fila en vez de sumar un registro nuevo.
 * `updated_at` queda como rastro de que se tocó.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const validated = PostAdminUpdateMinimumPurchase.parse(req.body);
    const service: StoreConfigModuleService = req.scope.resolve(STORE_CONFIG_MODULE);
    const current = await loadInScope(req, service);

    // La vigencia se valida sobre los valores MERGEADOS: el body puede traer sólo
    // uno de los dos extremos y el otro viene de la fila guardada.
    const startsAt = validated.starts_at ? new Date(validated.starts_at) : new Date(current.starts_at);
    const endsAt =
      validated.ends_at === undefined
        ? current.ends_at
          ? new Date(current.ends_at)
          : null
        : validated.ends_at
          ? new Date(validated.ends_at)
          : null;
    if (endsAt && endsAt.getTime() <= startsAt.getTime()) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, 'ends_at must be after starts_at');
    }

    const minimum_purchase = await service.updateMinimumPurchases({
      id: current.id,
      ...(validated.amount !== undefined ? { amount: validated.amount } : {}),
      ...(validated.currency_code !== undefined ? { currency_code: validated.currency_code } : {}),
      starts_at: startsAt,
      ends_at: endsAt,
      ...(validated.note !== undefined ? { note: validated.note } : {}),
    });

    return res.status(200).json({ minimum_purchase });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error updating minimum purchase';
    console.error('[Admin StoreConfig] Error updating minimum purchase:', message);
    return res.status(statusOf(error)).json({ message });
  }
}

/**
 * DELETE /admin/store-config/minimum-purchase/:id — remove a record.
 *
 * Borrado físico. Si la fila era el mínimo vigente, el storefront pasa al que
 * corresponda por fecha (o a ninguno) en cuanto expire su caché de 60 s.
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  try {
    const service: StoreConfigModuleService = req.scope.resolve(STORE_CONFIG_MODULE);
    const current = await loadInScope(req, service);

    await service.deleteMinimumPurchases(current.id);

    return res.status(200).json({ id: current.id, object: 'minimum_purchase', deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error deleting minimum purchase';
    console.error('[Admin StoreConfig] Error deleting minimum purchase:', message);
    return res.status(statusOf(error)).json({ message });
  }
}
