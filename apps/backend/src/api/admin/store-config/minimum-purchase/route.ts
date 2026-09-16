import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { STORE_CONFIG_MODULE } from '../../../../modules/store-config';
import type StoreConfigModuleService from '../../../../modules/store-config/service';
import { PostAdminCreateMinimumPurchase } from './validators';

import { siteFromRequest } from '../../../../lib/multistore/request';


/** `null` = la fila GLOBAL, el mínimo que hereda toda tienda sin serie propia. */
const siteOf = async (req: MedusaRequest): Promise<string | null> => {
  const resolution = await siteFromRequest(req);
  return resolution.status === 'site' ? resolution.site.id : null;
};

/**
 * GET /admin/store-config/minimum-purchase — paginated history.
 *
 * Ordered by created_at DESC (most recent change first).
 * Returns { minimum_purchases, count, limit, offset }.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const service: StoreConfigModuleService = req.scope.resolve(STORE_CONFIG_MODULE);
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const offset = req.query.offset ? Number(req.query.offset) : 0;

    // Una sola resolución: llamarla dos veces en la misma expresión son dos consultas
    // y abre la puerta a que devuelvan cosas distintas.
    const siteId = await siteOf(req);

    const [minimum_purchases, count] = await service.listAndCountMinimumPurchases(
      {
        // La serie de la tienda MÁS la global: el operador tiene que ver de dónde sale
        // el mínimo vigente, y una tienda sin serie propia hereda el global.
        //
        // `$or` y no `[siteId, null]`: el array se emite como `IN (..., NULL)`, que no
        // matchea `IS NULL`, así que con una tienda elegida el historial escondía las
        // filas globales — las que el storefront estaba aplicando. Mismo arreglo que en
        // `siteColumnFilter` y en la ruta store hermana.
        ...(siteId ? { $or: [{ site_id: siteId }, { site_id: null }] } : { site_id: null }),
      },
      {
        skip: offset,
        take: limit,
        order: { created_at: 'DESC' },
      },
    );

    return res.status(200).json({ minimum_purchases, count, limit, offset });
  } catch (error) {
    console.error('[Admin StoreConfig] Error listing minimum purchases:', error);
    return res.status(500).json({ message: 'Error fetching minimum purchases' });
  }
}

/**
 * POST /admin/store-config/minimum-purchase — add a new minimum purchase record.
 *
 * Un cambio de mínimo es un registro NUEVO con su vigencia: así el historial dice
 * cuánto rigió y cuándo. Corregir un registro (monto mal tipeado, vigencia
 * equivocada) o borrarlo va por `./[id]/route.ts`.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const validated = PostAdminCreateMinimumPurchase.parse(req.body);
    const service: StoreConfigModuleService = req.scope.resolve(STORE_CONFIG_MODULE);

    // El registro nuevo arranca la serie de la tienda activa. Sin esto, cambiar el
    // mínimo desde una tienda se lo cambiaría a todas las que heredan el global.
    const minimum_purchase = await service.createMinimumPurchases({
      site_id: await siteOf(req),
      amount: validated.amount,
      currency_code: validated.currency_code ?? 'ars',
      starts_at: new Date(validated.starts_at),
      ends_at: validated.ends_at ? new Date(validated.ends_at) : null,
      note: validated.note ?? null,
    });

    return res.status(201).json({ minimum_purchase });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error creating minimum purchase';
    console.error('[Admin StoreConfig] Error creating minimum purchase:', message);
    return res.status(400).json({ message });
  }
}
