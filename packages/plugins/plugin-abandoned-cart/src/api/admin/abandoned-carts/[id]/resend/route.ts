import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { ABANDONED_CART_MODULE } from '../../../../../modules/abandoned-cart';
import type AbandonedCartModuleService from '../../../../../modules/abandoned-cart/service';
import { notifyAbandonedCartWorkflow } from '../../../../../workflows/notify-abandoned-cart';

/**
 * POST /admin/abandoned-carts/:id/resend — dispara manualmente un paso de la
 * secuencia para un tracking. Body opcional `{ step: number }`; por defecto usa
 * el próximo paso elegible. Reutiliza el mismo workflow que el cron (idempotente
 * por paso+canal, así que no duplica si ese paso ya se envió).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ message: 'Falta el id del carrito abandonado' });
  }
  try {
    const service: AbandonedCartModuleService = req.scope.resolve(ABANDONED_CART_MODULE);
    // Valida que exista (404 claro si no).
    await service.retrieveAbandonedCart(id);

    const body = (req.body ?? {}) as { step?: number };
    const forceStep =
      typeof body.step === 'number' && body.step > 0 ? body.step : undefined;

    const { result } = await notifyAbandonedCartWorkflow(req.scope).run({
      input: { abandonedCartId: id, forceStep },
    });

    return res.status(200).json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error resending';
    console.error('[Admin AbandonedCarts] Error resending:', message);
    return res.status(400).json({ message });
  }
}
