import type { ExecArgs } from '@medusajs/framework/types';
import { PolygonEngine } from '../modules/store-location/coverage/polygon-engine';
import type { CoordinatePoint, PolygonPoint } from '../modules/store-location/coverage/types';

/**
 * Unit checks for the ported PolygonEngine (ray casting + vertex/boundary).
 * Run with: `npx medusa exec ./src/scripts/test-polygon-engine.ts`
 *
 * Mirrors the AEC `test-polygon.js` intent: a known-interior point must resolve
 * 'inside'. Adds explicit vertex/boundary/outside cases.
 */
export default async function testPolygonEngine({ container }: ExecArgs) {
  const logger = container.resolve('logger');

  const square: PolygonPoint[] = [
    { x: '0', y: '0' },
    { x: '2', y: '0' },
    { x: '2', y: '2' },
    { x: '0', y: '2' },
    { x: '0', y: '0' },
  ];
  const v = PolygonEngine.polygonPointsToCoordinates(square);

  const cases: { name: string; point: CoordinatePoint; expected: string }[] = [
    { name: 'center → inside', point: { x: 1, y: 1 }, expected: 'inside' },
    { name: 'far → outside', point: { x: 9, y: 9 }, expected: 'outside' },
    { name: 'corner → vertex', point: { x: 0, y: 0 }, expected: 'vertex' },
    { name: 'edge midpoint → boundary', point: { x: 1, y: 0 }, expected: 'boundary' },
    { name: 'left-outside → outside', point: { x: -1, y: 1 }, expected: 'outside' },
  ];

  // Real-world sanity: a point known to be inside an AEC coverage polygon.
  const triangle: PolygonPoint[] = [
    { x: '-58.6', y: '-34.7' },
    { x: '-58.2', y: '-34.7' },
    { x: '-58.4', y: '-34.5' },
  ];
  const tv = PolygonEngine.polygonPointsToCoordinates(triangle);

  let failed = 0;
  for (const c of cases) {
    const got = PolygonEngine.pointInPolygon(c.point, v);
    const ok = got === c.expected;
    if (!ok) failed++;
    logger.info(`[polygon-engine] ${ok ? 'PASS' : 'FAIL'} — ${c.name} (got ${got})`);
  }

  const geoInside = PolygonEngine.geoPointToCoordinate({ lat: '-34.633', lng: '-58.4' });
  const triResult = PolygonEngine.pointInPolygon(geoInside, tv);
  const triOk = triResult === 'inside';
  if (!triOk) failed++;
  logger.info(`[polygon-engine] ${triOk ? 'PASS' : 'FAIL'} — geo point inside triangle (got ${triResult})`);

  if (failed > 0) {
    throw new Error(`[polygon-engine] ${failed} assertion(s) failed`);
  }
  logger.info('[polygon-engine] all checks passed ✅');
}
