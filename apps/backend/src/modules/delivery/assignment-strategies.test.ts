import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  pickDriver,
  pickVehicle,
  isValidAssignStrategy,
  type AssignStrategy,
  type EligibleDriver,
  type EligibleVehicle,
} from './assignment-strategies.ts';

const drv = (id: string, load = 0): EligibleDriver => ({ id, load });

describe('pickDriver — first_available', () => {
  it('elige el primero por id ascendente, ignorando el orden de entrada', () => {
    const eligible = [drv('drv_c'), drv('drv_a'), drv('drv_b')];
    assert.equal(pickDriver(eligible, 'first_available'), 'drv_a');
  });

  it('ignora la carga', () => {
    const eligible = [drv('drv_a', 9), drv('drv_b', 0)];
    assert.equal(pickDriver(eligible, 'first_available'), 'drv_a');
  });

  it('lista vacía → null', () => {
    assert.equal(pickDriver([], 'first_available'), null);
  });
});

describe('pickDriver — least_load', () => {
  it('elige el de menor carga', () => {
    const eligible = [drv('drv_a', 5), drv('drv_b', 1), drv('drv_c', 3)];
    assert.equal(pickDriver(eligible, 'least_load'), 'drv_b');
  });

  it('empate de carga → desempata por id ascendente', () => {
    const eligible = [drv('drv_c', 2), drv('drv_a', 2), drv('drv_b', 2)];
    assert.equal(pickDriver(eligible, 'least_load'), 'drv_a');
  });

  it('es determinístico ante cualquier orden de entrada', () => {
    const a = [drv('drv_x', 2), drv('drv_y', 2)];
    const b = [drv('drv_y', 2), drv('drv_x', 2)];
    assert.equal(pickDriver(a, 'least_load'), pickDriver(b, 'least_load'));
    assert.equal(pickDriver(a, 'least_load'), 'drv_x');
  });

  it('lista vacía → null', () => {
    assert.equal(pickDriver([], 'least_load'), null);
  });
});

describe('pickDriver — round_robin', () => {
  const eligible = [drv('drv_a'), drv('drv_b'), drv('drv_c')];

  it('sin estado previo → primero por id asc', () => {
    assert.equal(pickDriver(eligible, 'round_robin', {}), 'drv_a');
    assert.equal(
      pickDriver(eligible, 'round_robin', { last_assigned_driver_id: null }),
      'drv_a',
    );
  });

  it('elige el primero con id mayor al último asignado', () => {
    assert.equal(
      pickDriver(eligible, 'round_robin', { last_assigned_driver_id: 'drv_a' }),
      'drv_b',
    );
    assert.equal(
      pickDriver(eligible, 'round_robin', { last_assigned_driver_id: 'drv_b' }),
      'drv_c',
    );
  });

  it('wrap: si el último es el mayor, vuelve al primero', () => {
    assert.equal(
      pickDriver(eligible, 'round_robin', { last_assigned_driver_id: 'drv_c' }),
      'drv_a',
    );
  });

  it('wrap: si el último ya no es elegible y es mayor que todos, vuelve al primero', () => {
    assert.equal(
      pickDriver(eligible, 'round_robin', { last_assigned_driver_id: 'drv_z' }),
      'drv_a',
    );
  });

  it('rota correctamente completando un ciclo completo (determinismo)', () => {
    let last: string | null = null;
    const seq: string[] = [];
    for (let i = 0; i < 4; i++) {
      const chosen = pickDriver(eligible, 'round_robin', {
        last_assigned_driver_id: last,
      });
      seq.push(chosen!);
      last = chosen;
    }
    // a -> b -> c -> a (wrap)
    assert.deepEqual(seq, ['drv_a', 'drv_b', 'drv_c', 'drv_a']);
  });

  it('es independiente del orden de entrada', () => {
    const shuffled = [drv('drv_c'), drv('drv_a'), drv('drv_b')];
    assert.equal(
      pickDriver(shuffled, 'round_robin', { last_assigned_driver_id: 'drv_a' }),
      'drv_b',
    );
  });

  it('lista vacía → null', () => {
    assert.equal(pickDriver([], 'round_robin', { last_assigned_driver_id: 'drv_a' }), null);
  });
});

describe('pickVehicle', () => {
  const veh = (id: string, capacity_kg?: number | null): EligibleVehicle => ({
    id,
    capacity_kg,
  });

  it('sin info de capacidad → primero por id asc', () => {
    const eligible = [veh('veh_c'), veh('veh_a'), veh('veh_b')];
    assert.equal(pickVehicle(eligible), 'veh_a');
  });

  it('capacity null/undefined tratado como sin info', () => {
    const eligible = [veh('veh_b', null), veh('veh_a', undefined)];
    assert.equal(pickVehicle(eligible), 'veh_a');
  });

  it('best-fit: menor capacidad entre los que la declaran', () => {
    const eligible = [veh('veh_a', 500), veh('veh_b', 100), veh('veh_c', 250)];
    assert.equal(pickVehicle(eligible), 'veh_b');
  });

  it('best-fit: empate de capacidad → id ascendente', () => {
    const eligible = [veh('veh_c', 100), veh('veh_a', 100)];
    assert.equal(pickVehicle(eligible), 'veh_a');
  });

  it('mezcla con/sin capacidad: prioriza los que declaran capacidad', () => {
    const eligible = [veh('veh_a'), veh('veh_b', 100)];
    assert.equal(pickVehicle(eligible), 'veh_b');
  });

  it('lista vacía → null', () => {
    assert.equal(pickVehicle([]), null);
  });

  it('es determinístico ante cualquier orden de entrada', () => {
    const a = [veh('veh_a', 300), veh('veh_b', 100)];
    const b = [veh('veh_b', 100), veh('veh_a', 300)];
    assert.equal(pickVehicle(a), pickVehicle(b));
  });
});

describe('isValidAssignStrategy', () => {
  it('reconoce las estrategias válidas', () => {
    for (const s of ['round_robin', 'first_available', 'least_load'] as AssignStrategy[]) {
      assert.equal(isValidAssignStrategy(s), true);
    }
  });

  it('rechaza desconocidas', () => {
    assert.equal(isValidAssignStrategy('random'), false);
    assert.equal(isValidAssignStrategy(''), false);
  });
});
