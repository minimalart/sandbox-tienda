import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { RemoteQueryFunction } from '@medusajs/framework/types';
import { deleteLineItemsWorkflow } from '@medusajs/core-flows';
import { z } from 'zod';
import { selectBundleInstanceLineItemIds } from './_select-line-items';

const RemoveSchema = z.object({
  cart_id: z.string().min(1),
  bundle_instance_id: z.string().min(1),
});

/**
 * POST /store/bundles/remove — saca un kit entero del carrito en UNA operación.
 *
 * Antes el storefront borraba las líneas del kit una por una con el
 * `DELETE /store/carts/:id/line-items/:line_id` de Medusa: N requests, N
 * recálculos de totales y N veces el lock del carrito para un kit de N
 * productos. Acá se resuelven las líneas de la instancia en el servidor y se
 * pasan todas juntas a `deleteLineItemsWorkflow`, que es el mismo workflow que
 * usa la ruta core pero acepta varios ids: un lock, un borrado y un refresh.
 *
 * Los ids NO vienen del cliente: se derivan de `(cart_id, bundle_instance_id)`,
 * así la ruta no puede borrar una línea que no sea de ese carrito y ese kit.
 *
 * Validación inline como en `reconfigure`: los middlewares de la extensión se
 * generan desde el composer y esta ruta no está en esa lista.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const parsed = RemoveSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ code: 'BUNDLE_REMOVE_INVALID', issues: parsed.error.issues });
    return;
  }
  const { cart_id, bundle_instance_id } = parsed.data;

  const query = req.scope.resolve<Omit<RemoteQueryFunction, symbol>>(
    ContainerRegistrationKeys.QUERY,
  );
  const { data } = await query.graph({
    entity: 'cart',
    fields: ['id', 'completed_at', 'items.id', 'items.metadata'],
    filters: { id: cart_id },
  });
  const cart = data?.[0] as
    | {
        completed_at?: string | null;
        items?: Array<{ id: string; metadata?: Record<string, unknown> | null }>;
      }
    | undefined;

  if (!cart) {
    res.status(404).json({ code: 'CART_NOT_FOUND', message: 'No encontramos el carrito.' });
    return;
  }
  if (cart.completed_at) {
    res.status(400).json({
      code: 'CART_COMPLETED',
      message: 'El carrito ya se convirtió en una orden.',
    });
    return;
  }

  const ids = selectBundleInstanceLineItemIds(cart.items, bundle_instance_id);
  if (!ids.length) {
    // Idempotente: si el kit ya no está (doble click, otra pestaña), no hay
    // nada que borrar y el resultado que quería el comprador ya se cumplió.
    res.status(200).json({ cart_id, bundle_instance_id, removed_line_item_ids: [] });
    return;
  }

  await deleteLineItemsWorkflow(req.scope).run({ input: { cart_id, ids } });

  res.status(200).json({ cart_id, bundle_instance_id, removed_line_item_ids: ids });
}
