import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRoutes,
  type BuildableStop,
  type BuildableVehicle,
} from './route-builder.ts';

// Helpers: arman stops/vehicles con defaults razonables y override por campo.
const stop = (
  execution_id: string,
  over: Partial<BuildableStop> = {},
): BuildableStop => ({
  execution_id,
  weight_kg: 0,
  volume_m3: 0,
  order_count: 1,
  temperature: 'ambient',
  ...over,
});

const vehicle = (
  id: string,
  over: Partial<BuildableVehicle> = {},
): BuildableVehicle => ({
  id,
  capacity_kg: null,
  capacity_m3: null,
  max_orders: null,
  has_refrigeration: false,
  temperature_modes: null,
  ...over,
});

describe('buildRoutes — FFD ordena descendente', () => {
  it('mete primero el stop de mayor order_count', () => {
    // Vehículo con tope 2: con FFD el de order_count=2 entra primero y satura;
    // los dos de order_count=1 quedan unassigned (no entran en el viaje).
    const v = vehicle('veh_1', { max_orders: 2 });
    const stops: BuildableStop[] = [
      stop('e_small_a', { order_count: 1 }),
      stop('e_big', { order_count: 2 }),
      stop('e_small_b', { order_count: 1 }),
    ];
    const res = buildRoutes(stops, [v]);
    assert.equal(res.bins.length, 1);
    assert.deepEqual(res.bins[0]!.execution_ids, ['e_big']);
    assert.deepEqual(res.unassigned.sort(), ['e_small_a', 'e_small_b']);
  });

  it('a igual order_count desempata por weight_kg DESC', () => {
    const v = vehicle('veh_1');
    const stops: BuildableStop[] = [
      stop('e_light', { weight_kg: 1 }),
      stop('e_heavy', { weight_kg: 10 }),
      stop('e_mid', { weight_kg: 5 }),
    ];
    const res = buildRoutes(stops, [v]);
    assert.deepEqual(res.bins[0]!.execution_ids, ['e_heavy', 'e_mid', 'e_light']);
  });
});

describe('buildRoutes — fill_first', () => {
  it('llena el primer vehículo antes de pasar al siguiente', () => {
    const v1 = vehicle('veh_1', { capacity_kg: 100, max_orders: 10 });
    const v2 = vehicle('veh_2', { capacity_kg: 100, max_orders: 10 });
    const stops: BuildableStop[] = [
      stop('e1', { weight_kg: 10 }),
      stop('e2', { weight_kg: 10 }),
      stop('e3', { weight_kg: 10 }),
    ];
    const res = buildRoutes(stops, [v1, v2], { fill_priority: 'fill_first' });
    // Todo cabe en un solo vehículo → un solo bin.
    assert.equal(res.bins.length, 1);
    assert.equal(res.bins[0]!.execution_ids.length, 3);
    assert.equal(res.unassigned.length, 0);
  });

  it('desborda al segundo vehículo cuando el primero se satura', () => {
    const v1 = vehicle('veh_1', { max_orders: 2 });
    const v2 = vehicle('veh_2', { max_orders: 2 });
    const stops = [stop('e1'), stop('e2'), stop('e3')];
    const res = buildRoutes(stops, [v1, v2], { fill_priority: 'fill_first' });
    assert.equal(res.bins.length, 2);
    assert.equal(res.bins[0]!.execution_ids.length, 2);
    assert.equal(res.bins[1]!.execution_ids.length, 1);
    assert.equal(res.unassigned.length, 0);
  });
});

describe('buildRoutes — respeta capacidades', () => {
  it('max_orders por vehículo', () => {
    const v = vehicle('veh_1', { max_orders: 2 });
    const res = buildRoutes([stop('e1'), stop('e2'), stop('e3')], [v]);
    assert.equal(res.bins[0]!.totals.order_count, 2);
    assert.deepEqual(res.unassigned, ['e3']);
  });

  it('max_orders_per_vehicle global recorta el tope del vehículo', () => {
    const v = vehicle('veh_1', { max_orders: 10 });
    const res = buildRoutes([stop('e1'), stop('e2'), stop('e3')], [v], {
      max_orders_per_vehicle: 2,
    });
    assert.equal(res.bins[0]!.totals.order_count, 2);
    assert.deepEqual(res.unassigned, ['e3']);
  });

  it('capacity_kg', () => {
    const v = vehicle('veh_1', { capacity_kg: 15 });
    const stops = [
      stop('e1', { weight_kg: 10 }),
      stop('e2', { weight_kg: 10 }),
    ];
    const res = buildRoutes(stops, [v]);
    assert.equal(res.bins[0]!.execution_ids.length, 1);
    assert.equal(res.unassigned.length, 1);
  });

  it('capacity_m3', () => {
    const v = vehicle('veh_1', { capacity_m3: 1 });
    const stops = [
      stop('e1', { volume_m3: 0.6 }),
      stop('e2', { volume_m3: 0.6 }),
    ];
    const res = buildRoutes(stops, [v]);
    assert.equal(res.bins[0]!.execution_ids.length, 1);
    assert.equal(res.unassigned.length, 1);
  });
});

describe('buildRoutes — compatibilidad de temperatura', () => {
  it('refrigerated solo entra a vehículo apto (temperature_modes o has_refrigeration)', () => {
    const ambientOnly = vehicle('veh_amb');
    const refrig = vehicle('veh_refrig', { has_refrigeration: true });
    const res = buildRoutes(
      [stop('e_cold', { temperature: 'refrigerated' })],
      [ambientOnly, refrig],
    );
    assert.equal(res.bins.length, 1);
    assert.equal(res.bins[0]!.vehicle_id, 'veh_refrig');
    assert.equal(res.unassigned.length, 0);
  });

  it('frozen exige declararlo en temperature_modes (has_refrigeration no alcanza)', () => {
    const refrigOnly = vehicle('veh_refrig', { has_refrigeration: true });
    const freezer = vehicle('veh_freezer', {
      temperature_modes: ['refrigerated', 'frozen'],
    });
    const res = buildRoutes(
      [stop('e_frozen', { temperature: 'frozen' })],
      [refrigOnly, freezer],
    );
    assert.equal(res.bins[0]!.vehicle_id, 'veh_freezer');
  });

  it('un vehículo apto a frío PUEDE llevar ambient', () => {
    const freezer = vehicle('veh_freezer', {
      has_refrigeration: true,
      temperature_modes: ['refrigerated', 'frozen'],
    });
    const res = buildRoutes([stop('e_amb', { temperature: 'ambient' })], [freezer]);
    assert.equal(res.bins[0]!.vehicle_id, 'veh_freezer');
  });

  it('stop frío sin vehículo apto → unassigned', () => {
    const ambientOnly = vehicle('veh_amb');
    const res = buildRoutes(
      [stop('e_cold', { temperature: 'frozen' })],
      [ambientOnly],
    );
    assert.equal(res.bins.length, 0);
    assert.deepEqual(res.unassigned, ['e_cold']);
  });
});

describe('buildRoutes — balance', () => {
  it('reparte round-robin entre vehículos compatibles', () => {
    const v1 = vehicle('veh_1', { max_orders: 10 });
    const v2 = vehicle('veh_2', { max_orders: 10 });
    const stops = [stop('e1'), stop('e2'), stop('e3'), stop('e4')];
    const res = buildRoutes(stops, [v1, v2], { fill_priority: 'balance' });
    assert.equal(res.bins.length, 2);
    // Reparto parejo: 2 y 2 (no 4-0 como haría fill_first).
    assert.equal(res.bins[0]!.execution_ids.length, 2);
    assert.equal(res.bins[1]!.execution_ids.length, 2);
    assert.equal(res.unassigned.length, 0);
  });
});

describe('buildRoutes — determinismo', () => {
  it('misma entrada → misma salida en varias corridas', () => {
    const vehicles = [
      vehicle('veh_b', { capacity_kg: 50, max_orders: 3 }),
      vehicle('veh_a', { capacity_kg: 100, max_orders: 3 }),
    ];
    const stops = [
      stop('e3', { weight_kg: 20, order_count: 1 }),
      stop('e1', { weight_kg: 40, order_count: 2 }),
      stop('e2', { weight_kg: 30, order_count: 1 }),
      stop('e4', { weight_kg: 10, order_count: 1, temperature: 'refrigerated' }),
    ];
    const refrig = vehicle('veh_c', {
      has_refrigeration: true,
      max_orders: 5,
    });
    const first = buildRoutes(stops, [...vehicles, refrig]);
    for (let i = 0; i < 5; i++) {
      assert.deepEqual(buildRoutes(stops, [...vehicles, refrig]), first);
    }
  });
});

describe('buildRoutes — listas vacías', () => {
  it('sin stops → bins vacíos', () => {
    const res = buildRoutes([], [vehicle('veh_1')]);
    assert.deepEqual(res.bins, []);
    assert.deepEqual(res.unassigned, []);
  });

  it('sin vehículos → todo unassigned', () => {
    const res = buildRoutes([stop('e1'), stop('e2')], []);
    assert.deepEqual(res.bins, []);
    assert.deepEqual(res.unassigned.sort(), ['e1', 'e2']);
  });

  it('todo vacío → resultado vacío', () => {
    const res = buildRoutes([], []);
    assert.deepEqual(res.bins, []);
    assert.deepEqual(res.unassigned, []);
  });
});

describe('buildRoutes — stops sin coords se empacan igual', () => {
  it('lat/lng nulos no afectan el reparto', () => {
    const v = vehicle('veh_1', { max_orders: 5 });
    const stops = [
      stop('e1', { lat: null, lng: null }),
      stop('e2', { lat: -34.6, lng: -58.4 }),
    ];
    const res = buildRoutes(stops, [v]);
    assert.equal(res.bins[0]!.execution_ids.length, 2);
    assert.equal(res.unassigned.length, 0);
  });
});
