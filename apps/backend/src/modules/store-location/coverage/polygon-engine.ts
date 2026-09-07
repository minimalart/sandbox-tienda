/**
 * Core geometric engine for branch coverage. Point-in-polygon via the Ray
 * Casting algorithm, with vertex/boundary detection. Pure TypeScript, zero
 * dependencies.
 *
 * Ported verbatim (logic-wise) from the AEC distributor module
 * (`feat-discovery-module-distributor`); only the type imports were localized.
 * The unit test in `__tests__/polygon-engine.test.ts` is the AEC `test-polygon.js`
 * fixture turned into assertions.
 */
import type { CoordinatePoint, GeoPoint, MatchGeoType, PolygonPoint } from './types';

export const POLYGON_EPSILON = 0.00001;

export const MATCH_PRIORITY = {
  vertex: 3,
  boundary: 2,
  inside: 1,
  outside: 0,
} as const;

export class PolygonEngine {
  static isAlmostEqual(a: number, b: number, epsilon = POLYGON_EPSILON): boolean {
    return Math.abs(a - b) < epsilon;
  }

  /** Converts a geocoder GeoPoint ({lat,lng}) to the engine's {x,y} (x=lng, y=lat). */
  static geoPointToCoordinate(point: GeoPoint): CoordinatePoint {
    return {
      x: typeof point.lng === 'number' ? point.lng : parseFloat(point.lng),
      y: typeof point.lat === 'number' ? point.lat : parseFloat(point.lat),
    };
  }

  /** Converts stored string PolygonPoints to numeric CoordinatePoints. */
  static polygonPointsToCoordinates(points: PolygonPoint[]): CoordinatePoint[] {
    return points.map((point) => ({
      x: parseFloat(point.x),
      y: parseFloat(point.y),
    }));
  }

  /**
   * Determines whether a point is inside a polygon using Ray Casting, also
   * detecting vertex and boundary hits. Returns 'inside' | 'outside' | 'vertex'
   * | 'boundary'. Polygons with fewer than 3 vertices are 'outside'.
   */
  static pointInPolygon(point: CoordinatePoint, vertices: CoordinatePoint[]): MatchGeoType {
    if (vertices.length < 3) return 'outside';

    if (this.pointOnVertex(point, vertices)) return 'vertex';

    let intersections = 0;
    for (let i = 1; i < vertices.length; i++) {
      const vertex1 = vertices[i - 1];
      const vertex2 = vertices[i];
      if (!vertex1 || !vertex2) continue;

      if (this.isPointOnBoundary(point, vertex1, vertex2)) {
        return 'boundary';
      }
      if (this.rayIntersectsEdge(point, vertex1, vertex2)) {
        intersections++;
      }
    }

    return intersections % 2 !== 0 ? 'inside' : 'outside';
  }

  private static pointOnVertex(point: CoordinatePoint, vertices: CoordinatePoint[]): boolean {
    return vertices.some(
      (vertex) =>
        this.isAlmostEqual(point.x, vertex.x) && this.isAlmostEqual(point.y, vertex.y),
    );
  }

  private static isPointOnBoundary(
    point: CoordinatePoint,
    vertex1: CoordinatePoint,
    vertex2: CoordinatePoint,
  ): boolean {
    // Horizontal edge.
    if (vertex1.y === vertex2.y && vertex1.y === point.y) {
      return (
        point.x > Math.min(vertex1.x, vertex2.x) && point.x < Math.max(vertex1.x, vertex2.x)
      );
    }
    // Non-horizontal edge.
    if (vertex1.y !== vertex2.y) {
      const xinters =
        ((point.y - vertex1.y) * (vertex2.x - vertex1.x)) / (vertex2.y - vertex1.y) + vertex1.x;
      return this.isAlmostEqual(xinters, point.x);
    }
    return false;
  }

  private static rayIntersectsEdge(
    point: CoordinatePoint,
    vertex1: CoordinatePoint,
    vertex2: CoordinatePoint,
  ): boolean {
    if (vertex1.y === vertex2.y) {
      return false;
    }
    const minY = Math.min(vertex1.y, vertex2.y);
    const maxY = Math.max(vertex1.y, vertex2.y);
    // Strictly above minY and at-or-below maxY: "ray up" convention, avoids
    // double-counting shared vertices.
    if (point.y <= minY || point.y > maxY) {
      return false;
    }
    const intersectionX =
      vertex1.x + ((point.y - vertex1.y) * (vertex2.x - vertex1.x)) / (vertex2.y - vertex1.y);
    return intersectionX > point.x;
  }

  /* ── Overlap polígono-polígono (detección de conflicto de zonas) ──────────── */

  /** Bounding box [minX,minY,maxX,maxY] de un anillo. */
  private static boundingBox(
    verts: CoordinatePoint[],
  ): { minX: number; minY: number; maxX: number; maxY: number } {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const v of verts) {
      if (v.x < minX) minX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.x > maxX) maxX = v.x;
      if (v.y > maxY) maxY = v.y;
    }
    return { minX, minY, maxX, maxY };
  }

  /** Orientación de la terna (p,q,r): 0 colineal, 1 horario, 2 antihorario. */
  private static orientation(
    p: CoordinatePoint,
    q: CoordinatePoint,
    r: CoordinatePoint,
  ): 0 | 1 | 2 {
    const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
    if (Math.abs(val) < POLYGON_EPSILON) return 0;
    return val > 0 ? 1 : 2;
  }

  /** True si q está sobre el segmento pr (asumiendo colinealidad). */
  private static onSegment(
    p: CoordinatePoint,
    q: CoordinatePoint,
    r: CoordinatePoint,
  ): boolean {
    return (
      q.x <= Math.max(p.x, r.x) + POLYGON_EPSILON &&
      q.x >= Math.min(p.x, r.x) - POLYGON_EPSILON &&
      q.y <= Math.max(p.y, r.y) + POLYGON_EPSILON &&
      q.y >= Math.min(p.y, r.y) - POLYGON_EPSILON
    );
  }

  /** True si los segmentos p1p2 y p3p4 se intersectan (incluye casos colineales). */
  static segmentsIntersect(
    p1: CoordinatePoint,
    p2: CoordinatePoint,
    p3: CoordinatePoint,
    p4: CoordinatePoint,
  ): boolean {
    const o1 = this.orientation(p1, p2, p3);
    const o2 = this.orientation(p1, p2, p4);
    const o3 = this.orientation(p3, p4, p1);
    const o4 = this.orientation(p3, p4, p2);

    if (o1 !== o2 && o3 !== o4) return true;

    if (o1 === 0 && this.onSegment(p1, p3, p2)) return true;
    if (o2 === 0 && this.onSegment(p1, p4, p2)) return true;
    if (o3 === 0 && this.onSegment(p3, p1, p4)) return true;
    if (o4 === 0 && this.onSegment(p3, p2, p4)) return true;

    return false;
  }

  /**
   * Determina si dos polígonos (anillos cerrados de CoordinatePoint) SE SOLAPAN:
   * comparten algún área o se tocan. Pura TS, sin dependencias.
   *
   * Estrategia:
   *  1) Rechazo rápido por bounding boxes disjuntos.
   *  2) Algún vértice de A dentro/borde de B (o viceversa) → uno contiene al otro
   *     o se cruzan.
   *  3) Alguna arista de A intersecta alguna arista de B → se cruzan los bordes.
   *
   * Polígonos con menos de 3 vértices no solapan.
   */
  static polygonsOverlap(a: CoordinatePoint[], b: CoordinatePoint[]): boolean {
    if (a.length < 3 || b.length < 3) return false;

    const ba = this.boundingBox(a);
    const bb = this.boundingBox(b);
    if (
      ba.maxX < bb.minX ||
      bb.maxX < ba.minX ||
      ba.maxY < bb.minY ||
      bb.maxY < ba.minY
    ) {
      return false;
    }

    for (const p of a) {
      if (this.pointInPolygon(p, b) !== 'outside') return true;
    }
    for (const p of b) {
      if (this.pointInPolygon(p, a) !== 'outside') return true;
    }

    // Aristas (anillos cerrados: el par (i, i+1) cubre la arista de cierre).
    for (let i = 0; i + 1 < a.length; i++) {
      const a1 = a[i];
      const a2 = a[i + 1];
      if (!a1 || !a2) continue;
      for (let j = 0; j + 1 < b.length; j++) {
        const b1 = b[j];
        const b2 = b[j + 1];
        if (!b1 || !b2) continue;
        if (this.segmentsIntersect(a1, a2, b1, b2)) return true;
      }
    }

    return false;
  }
}
