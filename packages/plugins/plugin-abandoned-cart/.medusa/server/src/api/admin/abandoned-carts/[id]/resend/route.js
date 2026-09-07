"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const abandoned_cart_1 = require("../../../../../modules/abandoned-cart");
const notify_abandoned_cart_1 = require("../../../../../workflows/notify-abandoned-cart");
/**
 * POST /admin/abandoned-carts/:id/resend — dispara manualmente un paso de la
 * secuencia para un tracking. Body opcional `{ step: number }`; por defecto usa
 * el próximo paso elegible. Reutiliza el mismo workflow que el cron (idempotente
 * por paso+canal, así que no duplica si ese paso ya se envió).
 */
async function POST(req, res) {
    const { id } = req.params;
    if (!id) {
        return res.status(400).json({ message: 'Falta el id del carrito abandonado' });
    }
    try {
        const service = req.scope.resolve(abandoned_cart_1.ABANDONED_CART_MODULE);
        // Valida que exista (404 claro si no).
        await service.retrieveAbandonedCart(id);
        const body = (req.body ?? {});
        const forceStep = typeof body.step === 'number' && body.step > 0 ? body.step : undefined;
        const { result } = await (0, notify_abandoned_cart_1.notifyAbandonedCartWorkflow)(req.scope).run({
            input: { abandonedCartId: id, forceStep },
        });
        return res.status(200).json({ result });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Error resending';
        console.error('[Admin AbandonedCarts] Error resending:', message);
        return res.status(400).json({ message });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2FiYW5kb25lZC1jYXJ0cy9baWRdL3Jlc2VuZC9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQVdBLG9CQXdCQztBQWxDRCwwRUFBOEU7QUFFOUUsMEZBQTZGO0FBRTdGOzs7OztHQUtHO0FBQ0ksS0FBSyxVQUFVLElBQUksQ0FBQyxHQUFrQixFQUFFLEdBQW1CO0lBQ2hFLE1BQU0sRUFBRSxFQUFFLEVBQUUsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDO0lBQzFCLElBQUksQ0FBQyxFQUFFLEVBQUUsQ0FBQztRQUNSLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLEVBQUUsb0NBQW9DLEVBQUUsQ0FBQyxDQUFDO0lBQ2pGLENBQUM7SUFDRCxJQUFJLENBQUM7UUFDSCxNQUFNLE9BQU8sR0FBK0IsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsc0NBQXFCLENBQUMsQ0FBQztRQUNyRix1Q0FBdUM7UUFDdkMsTUFBTSxPQUFPLENBQUMscUJBQXFCLENBQUMsRUFBRSxDQUFDLENBQUM7UUFFeEMsTUFBTSxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxJQUFJLEVBQUUsQ0FBc0IsQ0FBQztRQUNuRCxNQUFNLFNBQVMsR0FDYixPQUFPLElBQUksQ0FBQyxJQUFJLEtBQUssUUFBUSxJQUFJLElBQUksQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7UUFFekUsTUFBTSxFQUFFLE1BQU0sRUFBRSxHQUFHLE1BQU0sSUFBQSxtREFBMkIsRUFBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDO1lBQ2xFLEtBQUssRUFBRSxFQUFFLGVBQWUsRUFBRSxFQUFFLEVBQUUsU0FBUyxFQUFFO1NBQzFDLENBQUMsQ0FBQztRQUVILE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDO0lBQzFDLENBQUM7SUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1FBQ2YsTUFBTSxPQUFPLEdBQUcsS0FBSyxZQUFZLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsaUJBQWlCLENBQUM7UUFDM0UsT0FBTyxDQUFDLEtBQUssQ0FBQyx5Q0FBeUMsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUNsRSxPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLENBQUMsQ0FBQztJQUMzQyxDQUFDO0FBQ0gsQ0FBQyJ9