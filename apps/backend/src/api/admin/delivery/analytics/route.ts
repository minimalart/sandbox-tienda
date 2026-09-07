import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { DELIVERY_MODULE } from '../../../../modules/delivery/types';
import type DeliveryModuleService from '../../../../modules/delivery/service';
import type { AdminDeliveryMetricsType } from '../validators';

import { siteFromRequest } from '../../../../lib/multistore/request';
import { siteFilter } from '../../../../lib/multistore/scope';
import { STORE_LOCATION_SITE_SCOPE } from '../../../../modules/store-location/site-scope';

// GET /admin/delivery/analytics — Control Tower (read-only).
//
// Computa los KPIs operativos del delivery sobre un rango de fechas. Es lectura
// pura sobre un SOLO módulo (delivery), así que resolvemos el service directo,
// igual que /admin/commerce-dashboard — no necesita workflow (no toca múltiples
// módulos ni muta estado).
//
// Decisión M9: on-the-fly (sin modelo/snapshot). El board es admin-only y los
// rangos son acotados; ver TODO de snapshots en modules/delivery/analytics.ts.
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const started = Date.now();
  const q = req.validatedQuery as unknown as AdminDeliveryMetricsType;

  try {
    const service: DeliveryModuleService = req.scope.resolve(DELIVERY_MODULE);

    /**
     * Las sucursales de la tienda activa acotan el universo del board.
     *
     * `siteFilter` devuelve `{}` cuando no hay que filtrar, y `{ id: [...] }` cuando
     * sí. Se extraen los ids para pasarlos al agregado: los KPIs se computan en SQL,
     * así que el predicado tiene que entrar ahí y no filtrarse después.
     */
    const locationWhere = await siteFilter(
      req.scope,
      await siteFromRequest(req),
      STORE_LOCATION_SITE_SCOPE,
    );
    const siteLocationIds = Array.isArray((locationWhere as { id?: unknown }).id)
      ? ((locationWhere as { id: string[] }).id)
      : null;

    const metrics = await service.getDeliveryMetrics({
      from: q.from,
      to: q.to,
      store_location_id: q.store_location_id ?? null,
      provider_type: q.provider_type ?? null,
      site_store_location_ids: siteLocationIds,
    });

    res.setHeader('Cache-Control', 'private, no-store');
    res.status(200).json({
      metrics,
      meta: {
        source: 'on_the_fly',
        response_time_ms: Date.now() - started,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error loading delivery analytics';
    console.error('[Admin Delivery Analytics] GET failed:', message);
    res.status(400).json({ message });
  }
}
