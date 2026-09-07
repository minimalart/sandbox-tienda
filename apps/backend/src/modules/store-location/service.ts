import { MedusaService } from '@medusajs/framework/utils';
import { StoreLocation, BranchCoverage, BranchDelivery } from './models';
import { PolygonEngine, MATCH_PRIORITY } from './coverage/polygon-engine';
import type { GeoPoint, MatchGeoType, PolygonPoint } from './coverage/types';

export interface BranchResolution {
  store_location_id: string;
  coverage_id: string;
  coverage_name: string;
  match_type: MatchGeoType;
  priority: number;
}

class StoreLocationModuleService extends MedusaService({
  StoreLocation,
  BranchCoverage,
  BranchDelivery,
}) {
  /**
   * Resolves which branch serves a given lat/lng by testing it against every
   * active coverage polygon of every active branch. Returns the best match or
   * `null` when the point is outside all coverages.
   *
   * Ranking: match type (vertex > boundary > inside) first, then coverage
   * `priority` (desc). The caller maps `store_location_id` → sales channel.
   */
  async resolveByPoint(point: GeoPoint): Promise<BranchResolution | null> {
    const target = PolygonEngine.geoPointToCoordinate(point);
    if (Number.isNaN(target.x) || Number.isNaN(target.y)) {
      return null;
    }

    const coverages = await this.listBranchCoverages({ active: true });
    if (!coverages.length) return null;

    // Only consider coverages whose branch is active.
    const branchIds = Array.from(new Set(coverages.map((c) => c.store_location_id)));
    const branches = await this.listStoreLocations({ id: branchIds, active: true });
    const activeBranchIds = new Set(branches.map((b) => b.id));

    const matches: BranchResolution[] = [];
    for (const coverage of coverages) {
      if (!activeBranchIds.has(coverage.store_location_id)) continue;

      const polygon = coverage.polygon as unknown as PolygonPoint[] | null;
      if (!Array.isArray(polygon) || polygon.length < 3) continue;

      const vertices = PolygonEngine.polygonPointsToCoordinates(polygon);
      const matchType = PolygonEngine.pointInPolygon(target, vertices);
      if (matchType === 'outside') continue;

      matches.push({
        store_location_id: coverage.store_location_id,
        coverage_id: coverage.id,
        coverage_name: coverage.name,
        match_type: matchType,
        priority: coverage.priority ?? 0,
      });
    }

    if (!matches.length) return null;

    matches.sort((a, b) => {
      const byType = MATCH_PRIORITY[b.match_type] - MATCH_PRIORITY[a.match_type];
      if (byType !== 0) return byType;
      return (b.priority ?? 0) - (a.priority ?? 0);
    });

    return matches[0] ?? null;
  }
}

export default StoreLocationModuleService;
