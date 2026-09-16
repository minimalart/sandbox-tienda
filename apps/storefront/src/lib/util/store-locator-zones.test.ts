import assert from 'node:assert/strict';
import { test } from 'node:test';
import { matchesZone } from './store-locator-zones';
import type { StoreLocatorZone } from '../types/store-locator';
const outer = [
  [10, 20],
  [14, 20],
  [14, 24],
  [10, 24],
  [10, 20],
];
const zone: StoreLocatorZone = {
  id: 'zone',
  label: 'Zona',
  geometry: { type: 'Polygon', coordinates: [outer] },
};
test('GeoJSON uses longitude then latitude and includes borders', () => {
  assert.equal(matchesZone(22, 12, zone), true);
  assert.equal(matchesZone(12, 22, zone), false);
  assert.equal(matchesZone(20, 12, zone), true);
  assert.equal(matchesZone(20, 10, zone), true);
  assert.equal(matchesZone(25, 12, zone), false);
});
test('holes and disjoint MultiPolygon regions', () => {
  const hole = [
    [11, 21],
    [13, 21],
    [13, 23],
    [11, 23],
    [11, 21],
  ];
  const withHole: StoreLocatorZone = {
    ...zone,
    geometry: { type: 'Polygon', coordinates: [outer, hole] },
  };
  assert.equal(matchesZone(22, 12, withHole), false);
  assert.equal(matchesZone(20.5, 12, withHole), true);
  const multi: StoreLocatorZone = {
    ...zone,
    geometry: {
      type: 'MultiPolygon',
      coordinates: [
        [outer, hole],
        [
          [
            [-5, -5],
            [-1, -5],
            [-1, -1],
            [-5, -1],
            [-5, -5],
          ],
        ],
      ],
    },
  };
  assert.equal(matchesZone(-3, -3, multi), true);
  assert.equal(matchesZone(0, 0, multi), false);
  assert.equal(matchesZone(22, 12, multi), false);
});
test('missing and invalid coordinates never match a selected zone', () => {
  assert.equal(matchesZone(null, 12, zone), false);
  assert.equal(matchesZone(22, null, zone), false);
  assert.equal(matchesZone(NaN, 12, zone), false);
});
