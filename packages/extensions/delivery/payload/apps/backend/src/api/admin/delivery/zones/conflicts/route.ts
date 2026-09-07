import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { DELIVERY_MODULE } from '../../../../../modules/delivery';
import type DeliveryModuleService from '../../../../../modules/delivery/service';
import { STORE_LOCATION_MODULE } from '../../../../../modules/store-location';
import type StoreLocationModuleService from '../../../../../modules/store-location/service';
import { PolygonEngine } from '../../../../../modules/store-location/coverage/polygon-engine';
import type {
  CoordinatePoint,
  PolygonPoint,
} from '../../../../../modules/store-location/coverage/types';

import { siteFromRequest } from '../../../../../lib/multistore/request';
import { siteFilter } from '../../../../../lib/multistore/scope';
import { DELIVERY_ZONE_SITE_SCOPE } from '../../../../../modules/delivery/site-scope';

/**
 * GET /admin/delivery/zones/conflicts — detección de zonas en conflicto.
 *
 * Dos zonas están en conflicto cuando los polígonos de sus coberturas
 * (BranchCoverage) SE SOLAPAN geométricamente. Zonas que comparten la MISMA
 * cobertura no cuentan (referencian el mismo polígono a propósito).
 *
 * Devuelve, además de los pares en conflicto, la geometría de cada zona activa
 * con cobertura (para pintar el mapa del admin coloreado por sucursal).
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const delivery = req.scope.resolve<DeliveryModuleService>(DELIVERY_MODULE);
  const storeLocation = req.scope.resolve<StoreLocationModuleService>(
    STORE_LOCATION_MODULE,
  );

  // 1) Zonas activas con cobertura asignada.
  // Los conflictos de cobertura sólo tienen sentido dentro de una tienda: dos zonas
  // que se pisan pero pertenecen a tiendas distintas NO son un conflicto, y reportarlo
  // como tal manda al operador a "arreglar" una zona que no es suya.
  const zones = (await delivery.listDeliveryZones(
    {
      active: true,
      ...(await siteFilter(req.scope, await siteFromRequest(req), DELIVERY_ZONE_SITE_SCOPE)),
    },
    { take: 1000 },
  )) as Array<{
    id: string;
    name: string;
    store_location_id: string | null;
    branch_coverage_id: string | null;
  }>;

  const withCoverage = zones.filter((z) => !!z.branch_coverage_id);
  const coverageIds = Array.from(
    new Set(withCoverage.map((z) => z.branch_coverage_id as string)),
  );

  // 2) Coberturas (polígonos) y sucursales para resolver nombres.
  const coverages = coverageIds.length
    ? ((await storeLocation.listBranchCoverages({
        id: coverageIds,
      })) as unknown as Array<{
        id: string;
        name: string;
        store_location_id: string | null;
        polygon: PolygonPoint[] | null;
      }>)
    : [];
  const coverageById = new Map(coverages.map((c) => [c.id, c]));

  const storeIds = Array.from(
    new Set(
      zones
        .map((z) => z.store_location_id)
        .filter((id): id is string => !!id),
    ),
  );
  const stores = storeIds.length
    ? ((await storeLocation.listStoreLocations({ id: storeIds })) as Array<{
        id: string;
        name: string;
      }>)
    : [];
  const storeNameById = new Map(stores.map((s) => [s.id, s.name]));

  // 3) Entradas de zona con su anillo numérico (para overlap y para el mapa).
  type ZoneEntry = {
    zone_id: string;
    zone_name: string;
    store_location_id: string | null;
    store_name: string | null;
    branch_coverage_id: string;
    coverage_name: string | null;
    polygon: PolygonPoint[];
    ring: CoordinatePoint[];
  };

  const entries: ZoneEntry[] = [];
  for (const z of withCoverage) {
    const cov = coverageById.get(z.branch_coverage_id as string);
    const polygon = Array.isArray(cov?.polygon) ? (cov?.polygon as PolygonPoint[]) : [];
    if (polygon.length < 3) continue;
    entries.push({
      zone_id: z.id,
      zone_name: z.name,
      store_location_id: z.store_location_id,
      store_name: z.store_location_id
        ? (storeNameById.get(z.store_location_id) ?? null)
        : null,
      branch_coverage_id: z.branch_coverage_id as string,
      coverage_name: cov?.name ?? null,
      polygon,
      ring: PolygonEngine.polygonPointsToCoordinates(polygon),
    });
  }

  // 4) Pares en conflicto (overlap geométrico, distinta cobertura).
  const conflicts: Array<{
    zone_a_id: string;
    zone_a_name: string;
    zone_b_id: string;
    zone_b_name: string;
    store_a_name: string | null;
    store_b_name: string | null;
  }> = [];
  const byZone: Record<string, string[]> = {};
  const addByZone = (a: string, b: string) => {
    (byZone[a] ??= []).push(b);
  };

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i];
      const b = entries[j];
      if (!a || !b) continue;
      // Misma cobertura = mismo polígono a propósito: no es conflicto.
      if (a.branch_coverage_id === b.branch_coverage_id) continue;
      if (!PolygonEngine.polygonsOverlap(a.ring, b.ring)) continue;
      conflicts.push({
        zone_a_id: a.zone_id,
        zone_a_name: a.zone_name,
        zone_b_id: b.zone_id,
        zone_b_name: b.zone_name,
        store_a_name: a.store_name,
        store_b_name: b.store_name,
      });
      addByZone(a.zone_id, b.zone_id);
      addByZone(b.zone_id, a.zone_id);
    }
  }

  // El mapa no necesita el anillo numérico (lo recalcula el front desde polygon).
  const zonesForMap = entries.map(({ ring: _ring, ...rest }) => rest);

  res.status(200).json({ zones: zonesForMap, conflicts, by_zone: byZone });
}
