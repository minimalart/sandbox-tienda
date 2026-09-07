/**
 * Geo primitives for branch coverage. Ported from the AEC distributor module
 * (`feat-discovery-module-distributor`) and made self-contained.
 */

/** Numeric coordinate used by the polygon math. */
export interface CoordinatePoint {
  x: number;
  y: number;
}

/** A geographic point as captured by the storefront/geocoder (string lat/lng). */
export interface GeoPoint {
  lat: string | number;
  lng: string | number;
}

/**
 * A polygon vertex as stored on `BranchCoverage.polygon` — strings, matching the
 * AEC storage format `{ "x": "-58.52123", "y": "-34.43211" }` (x = lng, y = lat).
 */
export interface PolygonPoint {
  x: string;
  y: string;
}

export type MatchGeoType = 'vertex' | 'boundary' | 'inside' | 'outside';
