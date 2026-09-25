import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { STORE_CONFIG_MODULE } from '../../../modules/store-config';
import type StoreConfigModuleService from '../../../modules/store-config/service';
import { siteIdFromPublishableKey } from '../../../lib/multistore/publishable-key';

/**
 * GET /store/minimum-purchase — público, devuelve el mínimo VIGENTE.
 *
 * La resolución (ventana de fechas en JS, `$or` para alcanzar la fila global y
 * precedencia tienda → global) vive en `getEffectiveMinimumPurchase`, que es el
 * único dueño de la regla: la comparten esta ruta, el "Mínimo vigente" del admin
 * y el checkout del bot de WhatsApp. Los tres tramos y por qué son así están
 * documentados en el service.
 *
 * `site_id` sale de la publishable key, igual que en el admin
 * (`admin/store-config/minimum-purchase` resuelve con `siteFromRequest`). Devuelve
 * `null` no sólo en un proyecto mono-tienda: también cuando la key trae un canal
 * que ninguna tienda posee, y ahí se cae a la serie global.
 *
 * Shape: { minimum_purchase: { amount, currency_code, starts_at, ends_at } | null }
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const service: StoreConfigModuleService = req.scope.resolve(STORE_CONFIG_MODULE);
    const siteId = await siteIdFromPublishableKey(req);
    const current = await service.getEffectiveMinimumPurchase(siteId);

    return res.status(200).json({
      minimum_purchase: current
        ? {
            amount: current.amount,
            currency_code: current.currency_code,
            starts_at: current.starts_at,
            ends_at: current.ends_at,
          }
        : null,
    });
  } catch (error) {
    console.error('[Store MinimumPurchase] Error fetching current minimum purchase:', error);
    return res.status(200).json({ minimum_purchase: null });
  }
}
