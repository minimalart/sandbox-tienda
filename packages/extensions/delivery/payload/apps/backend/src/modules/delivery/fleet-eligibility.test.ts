import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isDriverEligible,
  isVehicleEligible,
  selectEligible,
  temperatureRank,
  type DriverCandidate,
  type FleetRequirement,
  type VehicleCandidate,
} from './fleet-eligibility.ts';

/** Requerimiento base; cada test sobreescribe lo que necesita. */
const req = (overrides: Partial<FleetRequirement> = {}): FleetRequirement => ({
  weight_kg: 10,
  volume_m3: null,
  item_count: 3,
  temperature: 'ambient',
  zone_id: 'zone_1',
  now_hhmm: '14:30',
  day_of_week: 3,
  ...overrides,
});

const driver = (o: Partial<DriverCandidate> = {}): DriverCandidate => ({
  id: 'drv_1',
  status: 'available',
  active: true,
  max_active_deliveries: null,
  active_deliveries: 0,
  shifts: [],
  zone_ids: null,
  ...o,
});

const vehicle = (o: Partial<VehicleCandidate> = {}): VehicleCandidate => ({
  id: 'veh_1',
  active: true,
  type: 'van',
  capacity_kg: 100,
  capacity_m3: 5,
  max_orders: 20,
  has_refrigeration: false,
  temperature_modes: null,
  zone_ids: null,
  ...o,
});

const shift = (day: number, start: string, end: string, active = true) => ({
  day_of_week: day,
  start_time: start,
  end_time: end,
  active,
});

describe('temperatureRank', () => {
  it('frozen > refrigerated > ambient', () => {
    assert.equal(temperatureRank('ambient'), 0);
    assert.equal(temperatureRank('refrigerated'), 1);
    assert.equal(temperatureRank('frozen'), 2);
  });
});

describe('isDriverEligible', () => {
  it('elegible: activo, available, sin tope, sin turnos, zona libre', () => {
    assert.deepEqual(isDriverEligible(driver(), req()), { ok: true });
  });

  it('on_route SE PERMITE (solo offline excluye)', () => {
    assert.equal(isDriverEligible(driver({ status: 'on_route' }), req()).ok, true);
  });

  it('inactivo → rechazado', () => {
    assert.deepEqual(isDriverEligible(driver({ active: false }), req()), {
      ok: false,
      reason: 'inactive',
    });
  });

  it('offline → rechazado', () => {
    assert.deepEqual(isDriverEligible(driver({ status: 'offline' }), req()), {
      ok: false,
      reason: 'offline',
    });
  });

  it('sobrecargado (carga >= tope) → rechazado', () => {
    const d = driver({ max_active_deliveries: 2, active_deliveries: 2 });
    assert.deepEqual(isDriverEligible(d, req()), { ok: false, reason: 'overloaded' });
  });

  it('con tope pero bajo carga → elegible', () => {
    const d = driver({ max_active_deliveries: 2, active_deliveries: 1 });
    assert.equal(isDriverEligible(d, req()).ok, true);
  });

  it('SIN turnos = elegible por horario (default permisivo documentado)', () => {
    assert.equal(isDriverEligible(driver({ shifts: [] }), req()).ok, true);
  });

  it('dentro de turno (día y franja vigente) → elegible', () => {
    const d = driver({ shifts: [shift(3, '09:00', '18:00')] });
    assert.equal(isDriverEligible(d, req({ day_of_week: 3, now_hhmm: '14:30' })).ok, true);
  });

  it('fuera de turno por hora → off_shift', () => {
    const d = driver({ shifts: [shift(3, '09:00', '12:00')] });
    assert.deepEqual(isDriverEligible(d, req({ now_hhmm: '14:30' })), {
      ok: false,
      reason: 'off_shift',
    });
  });

  it('fuera de turno por día → off_shift', () => {
    const d = driver({ shifts: [shift(2, '00:00', '23:59')] });
    assert.deepEqual(isDriverEligible(d, req({ day_of_week: 3 })), {
      ok: false,
      reason: 'off_shift',
    });
  });

  it('extremos de franja inclusivos (lexicográfico HH:mm)', () => {
    const d = driver({ shifts: [shift(3, '09:00', '18:00')] });
    assert.equal(isDriverEligible(d, req({ now_hhmm: '09:00' })).ok, true);
    assert.equal(isDriverEligible(d, req({ now_hhmm: '18:00' })).ok, true);
  });

  it('turnos partidos: matchea el segundo tramo', () => {
    const d = driver({ shifts: [shift(3, '08:00', '12:00'), shift(3, '16:00', '20:00')] });
    assert.equal(isDriverEligible(d, req({ now_hhmm: '17:00' })).ok, true);
    assert.equal(isDriverEligible(d, req({ now_hhmm: '13:00' })).ok, false);
  });

  it('todos los turnos inactivos → off_shift (grilla desactivada)', () => {
    const d = driver({ shifts: [shift(3, '00:00', '23:59', false)] });
    assert.deepEqual(isDriverEligible(d, req()), { ok: false, reason: 'off_shift' });
  });

  it('zona no habilitada → zone_not_allowed', () => {
    const d = driver({ zone_ids: ['zone_2'] });
    assert.deepEqual(isDriverEligible(d, req({ zone_id: 'zone_1' })), {
      ok: false,
      reason: 'zone_not_allowed',
    });
  });

  it('zona habilitada explícita → elegible', () => {
    const d = driver({ zone_ids: ['zone_1', 'zone_2'] });
    assert.equal(isDriverEligible(d, req({ zone_id: 'zone_1' })).ok, true);
  });

  it('restringido por zona pero orden sin zona → zone_not_allowed', () => {
    const d = driver({ zone_ids: ['zone_1'] });
    assert.equal(isDriverEligible(d, req({ zone_id: null })).reason, 'zone_not_allowed');
  });

  it('sin restricción de zona (null) + orden sin zona → elegible', () => {
    assert.equal(isDriverEligible(driver({ zone_ids: null }), req({ zone_id: null })).ok, true);
  });
});

describe('isVehicleEligible', () => {
  it('elegible: capacidad de sobra, ambient, zona libre', () => {
    assert.deepEqual(isVehicleEligible(vehicle(), req()), { ok: true });
  });

  it('inactivo → rechazado', () => {
    assert.deepEqual(isVehicleEligible(vehicle({ active: false }), req()), {
      ok: false,
      reason: 'inactive',
    });
  });

  it('peso excedido → over_weight', () => {
    const v = vehicle({ capacity_kg: 5 });
    assert.deepEqual(isVehicleEligible(v, req({ weight_kg: 10 })), {
      ok: false,
      reason: 'over_weight',
    });
  });

  it('peso null en la orden → no filtra por peso', () => {
    const v = vehicle({ capacity_kg: 1 });
    assert.equal(isVehicleEligible(v, req({ weight_kg: null })).ok, true);
  });

  it('capacidad null en el vehículo → no filtra por peso', () => {
    const v = vehicle({ capacity_kg: null });
    assert.equal(isVehicleEligible(v, req({ weight_kg: 9999 })).ok, true);
  });

  it('volumen excedido → over_volume', () => {
    const v = vehicle({ capacity_m3: 2 });
    assert.deepEqual(isVehicleEligible(v, req({ volume_m3: 5 })), {
      ok: false,
      reason: 'over_volume',
    });
  });

  it('cantidad excedida → over_orders', () => {
    const v = vehicle({ max_orders: 2 });
    assert.deepEqual(isVehicleEligible(v, req({ item_count: 3 })), {
      ok: false,
      reason: 'over_orders',
    });
  });

  it('max_orders null → no filtra por cantidad', () => {
    const v = vehicle({ max_orders: null });
    assert.equal(isVehicleEligible(v, req({ item_count: 9999 })).ok, true);
  });

  it('refrigerated: vehículo sin frío ni modos → no_temperature_support', () => {
    const v = vehicle({ has_refrigeration: false, temperature_modes: null });
    assert.deepEqual(isVehicleEligible(v, req({ temperature: 'refrigerated' })), {
      ok: false,
      reason: 'no_temperature_support',
    });
  });

  it('refrigerated: has_refrigeration true alcanza', () => {
    const v = vehicle({ has_refrigeration: true, temperature_modes: null });
    assert.equal(isVehicleEligible(v, req({ temperature: 'refrigerated' })).ok, true);
  });

  it('refrigerated: declarado en temperature_modes alcanza', () => {
    const v = vehicle({ has_refrigeration: false, temperature_modes: ['refrigerated'] });
    assert.equal(isVehicleEligible(v, req({ temperature: 'refrigerated' })).ok, true);
  });

  it('frozen: has_refrigeration NO alcanza (exige declarar frozen)', () => {
    const v = vehicle({ has_refrigeration: true, temperature_modes: ['refrigerated'] });
    assert.deepEqual(isVehicleEligible(v, req({ temperature: 'frozen' })), {
      ok: false,
      reason: 'no_temperature_support',
    });
  });

  it('frozen: declarado en temperature_modes → elegible', () => {
    const v = vehicle({ has_refrigeration: false, temperature_modes: ['frozen'] });
    assert.equal(isVehicleEligible(v, req({ temperature: 'frozen' })).ok, true);
  });

  it('ambient: no exige frío aunque el vehículo no lo tenga', () => {
    const v = vehicle({ has_refrigeration: false, temperature_modes: null });
    assert.equal(isVehicleEligible(v, req({ temperature: 'ambient' })).ok, true);
  });

  it('zona no habilitada → zone_not_allowed', () => {
    const v = vehicle({ zone_ids: ['zone_9'] });
    assert.deepEqual(isVehicleEligible(v, req({ zone_id: 'zone_1' })), {
      ok: false,
      reason: 'zone_not_allowed',
    });
  });

  it('orden de evaluación: peso pesa antes que temperatura', () => {
    const v = vehicle({ capacity_kg: 1, has_refrigeration: false });
    assert.equal(
      isVehicleEligible(v, req({ weight_kg: 10, temperature: 'frozen' })).reason,
      'over_weight',
    );
  });
});

describe('selectEligible — mezcla y determinismo', () => {
  it('separa elegibles de rechazados con motivos, preservando orden', () => {
    const drivers = [
      driver({ id: 'd_ok', active_deliveries: 2 }),
      driver({ id: 'd_offline', status: 'offline' }),
      driver({ id: 'd_full', max_active_deliveries: 1, active_deliveries: 1 }),
      driver({ id: 'd_zone', zone_ids: ['zone_2'] }),
    ];
    const vehicles = [
      vehicle({ id: 'v_ok' }),
      vehicle({ id: 'v_heavy', capacity_kg: 1 }),
      vehicle({ id: 'v_cold', temperature_modes: ['frozen'] }),
    ];
    const res = selectEligible(drivers, vehicles, req({ weight_kg: 10, temperature: 'ambient' }));

    assert.deepEqual(res.eligible_drivers, [{ id: 'd_ok', load: 2 }]);
    assert.deepEqual(res.eligible_vehicles, [{ id: 'v_ok' }, { id: 'v_cold' }]);
    assert.deepEqual(res.rejected, [
      { resource_type: 'driver', id: 'd_offline', reason: 'offline' },
      { resource_type: 'driver', id: 'd_full', reason: 'overloaded' },
      { resource_type: 'driver', id: 'd_zone', reason: 'zone_not_allowed' },
      { resource_type: 'vehicle', id: 'v_heavy', reason: 'over_weight' },
    ]);
  });

  it('elegible_drivers reporta la carga para priorización', () => {
    const drivers = [
      driver({ id: 'd_busy', active_deliveries: 5 }),
      driver({ id: 'd_free', active_deliveries: 0 }),
    ];
    const res = selectEligible(drivers, [], req());
    assert.deepEqual(res.eligible_drivers, [
      { id: 'd_busy', load: 5 },
      { id: 'd_free', load: 0 },
    ]);
  });

  it('determinismo: misma entrada → misma salida', () => {
    const drivers = [driver({ id: 'a' }), driver({ id: 'b', status: 'offline' })];
    const vehicles = [vehicle({ id: 'x' })];
    const r1 = selectEligible(drivers, vehicles, req());
    const r2 = selectEligible(drivers, vehicles, req());
    assert.deepEqual(r1, r2);
  });

  it('listas vacías → resultado vacío', () => {
    const res = selectEligible([], [], req());
    assert.deepEqual(res, { eligible_drivers: [], eligible_vehicles: [], rejected: [] });
  });
});
