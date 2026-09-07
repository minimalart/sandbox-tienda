import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  haversineKm,
  optimizeStops,
  type GeoPoint,
  type OptimizerStop,
} from './route-optimizer.ts';

describe('haversineKm', () => {
  it('distancia 0 entre el mismo punto', () => {
    const p: GeoPoint = { lat: -34.6037, lng: -58.3816 };
    assert.equal(haversineKm(p, p), 0);
  });

  it('distancia conocida Buenos Aires → Córdoba (~646 km, tolerancia ±15 km)', () => {
    const ba: GeoPoint = { lat: -34.6037, lng: -58.3816 };
    const cba: GeoPoint = { lat: -31.4201, lng: -64.1888 };
    const d = haversineKm(ba, cba);
    assert.ok(Math.abs(d - 646) < 15, `esperado ~646km, obtuvo ${d}`);
  });

  it('distancia conocida 1 grado de latitud (~111.2 km, tolerancia ±1 km)', () => {
    const d = haversineKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    assert.ok(Math.abs(d - 111.2) < 1, `esperado ~111.2km, obtuvo ${d}`);
  });

  it('simetría: d(a,b) === d(b,a)', () => {
    const a: GeoPoint = { lat: -34.6, lng: -58.4 };
    const b: GeoPoint = { lat: -31.4, lng: -64.2 };
    assert.equal(haversineKm(a, b), haversineKm(b, a));
  });
});

describe('optimizeStops — determinismo', () => {
  it('misma entrada → misma salida en varias corridas', () => {
    const origin: GeoPoint = { lat: 0, lng: 0 };
    const stops: OptimizerStop[] = [
      { id: 's1', lat: 0, lng: 3 },
      { id: 's2', lat: 0, lng: 1 },
      { id: 's3', lat: 0, lng: 2 },
      { id: 's4', lat: 0, lng: 5 },
    ];
    const first = optimizeStops(origin, stops);
    for (let i = 0; i < 5; i++) {
      assert.deepEqual(optimizeStops(origin, stops), first);
    }
  });
});

describe('optimizeStops — 2-opt deshace un cruce', () => {
  it('caso en cruz: la salida mejora respecto al orden original', () => {
    // Origin en (0,0). Cuatro puntos sobre una línea, dados en orden cruzado.
    // El orden de entrada zigzaguea; el óptimo es monótono creciente.
    const origin: GeoPoint = { lat: 0, lng: 0 };
    const stops: OptimizerStop[] = [
      { id: 'far', lat: 0, lng: 10 },
      { id: 'near', lat: 0, lng: 1 },
      { id: 'mid_far', lat: 0, lng: 8 },
      { id: 'mid_near', lat: 0, lng: 3 },
    ];
    const res = optimizeStops(origin, stops);
    assert.ok(
      res.total_distance_km < res.original_distance_km,
      `optimizado ${res.total_distance_km} debe ser < original ${res.original_distance_km}`,
    );
    // El óptimo sobre una recta es el orden monótono por distancia.
    assert.deepEqual(res.ordered, ['near', 'mid_near', 'mid_far', 'far']);
    assert.ok(res.improvement_pct > 0);
  });
});

describe('optimizeStops — stops sin coords válidas', () => {
  it('null/NaN/fuera de rango van al final preservando orden relativo', () => {
    const origin: GeoPoint = { lat: 0, lng: 0 };
    const stops: OptimizerStop[] = [
      { id: 'valid_far', lat: 0, lng: 5 },
      { id: 'null_lat', lat: null, lng: 1 },
      { id: 'valid_near', lat: 0, lng: 1 },
      { id: 'nan', lat: NaN, lng: NaN },
      { id: 'out_of_range', lat: 200, lng: 0 },
    ];
    const res = optimizeStops(origin, stops);
    // Los unlocated quedan al final en su orden relativo de entrada.
    assert.deepEqual(res.ordered.slice(-3), ['null_lat', 'nan', 'out_of_range']);
    // Los located se ordenaron óptimo (near antes que far).
    assert.deepEqual(res.ordered.slice(0, 2), ['valid_near', 'valid_far']);
    assert.equal(res.optimized_count, 2);
    assert.equal(res.unlocated_count, 3);
  });

  it('la salida contiene TODOS los stops exactamente una vez', () => {
    const origin: GeoPoint = { lat: 0, lng: 0 };
    const stops: OptimizerStop[] = [
      { id: 'a', lat: 0, lng: 5 },
      { id: 'b', lat: null, lng: null },
      { id: 'c', lat: 0, lng: 1 },
      { id: 'd', lat: undefined, lng: undefined },
      { id: 'e', lat: 0, lng: 3 },
    ];
    const res = optimizeStops(origin, stops);
    assert.equal(res.ordered.length, stops.length);
    assert.deepEqual([...res.ordered].sort(), ['a', 'b', 'c', 'd', 'e']);
  });
});

describe('optimizeStops — <= 1 stop localizable (no-op)', () => {
  it('cero stops: no rompe', () => {
    const res = optimizeStops({ lat: 0, lng: 0 }, []);
    assert.deepEqual(res.ordered, []);
    assert.equal(res.total_distance_km, 0);
    assert.equal(res.improvement_pct, 0);
    assert.equal(res.optimized_count, 0);
  });

  it('un solo located + unlocated: orden estable, sin optimizar', () => {
    const origin: GeoPoint = { lat: 0, lng: 0 };
    const stops: OptimizerStop[] = [
      { id: 'only', lat: 0, lng: 4 },
      { id: 'no_coord', lat: null, lng: null },
    ];
    const res = optimizeStops(origin, stops);
    assert.deepEqual(res.ordered, ['only', 'no_coord']);
    assert.equal(res.optimized_count, 1);
    assert.equal(res.unlocated_count, 1);
    assert.equal(res.improvement_pct, 0);
    assert.equal(res.total_distance_km, res.original_distance_km);
  });
});

describe('optimizeStops — guardia de no-regresión', () => {
  it('nunca devuelve un orden peor que el original (improvement_pct >= 0)', () => {
    const origin: GeoPoint = { lat: 0, lng: 0 };
    // Orden ya óptimo de entrada: no debe empeorarlo.
    const alreadyOptimal: OptimizerStop[] = [
      { id: 's1', lat: 0, lng: 1 },
      { id: 's2', lat: 0, lng: 2 },
      { id: 's3', lat: 0, lng: 3 },
    ];
    const res = optimizeStops(origin, alreadyOptimal);
    assert.ok(res.improvement_pct >= 0);
    assert.ok(res.total_distance_km <= res.original_distance_km + 1e-9);
    assert.deepEqual(res.ordered, ['s1', 's2', 's3']);
  });

  it('total_distance_km nunca supera original_distance_km en un caso aleatorio fijo', () => {
    const origin: GeoPoint = { lat: -34.6, lng: -58.4 };
    const stops: OptimizerStop[] = [
      { id: 'p1', lat: -34.55, lng: -58.45 },
      { id: 'p2', lat: -34.7, lng: -58.3 },
      { id: 'p3', lat: -34.62, lng: -58.5 },
      { id: 'p4', lat: -34.58, lng: -58.38 },
      { id: 'p5', lat: -34.65, lng: -58.42 },
    ];
    const res = optimizeStops(origin, stops);
    assert.ok(res.total_distance_km <= res.original_distance_km + 1e-9);
  });
});
