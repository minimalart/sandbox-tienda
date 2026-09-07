import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DELIVERY_TRANSITIONS,
  DELIVERY_TERMINAL_STATUSES,
  POD_REQUIRED_PROVIDER_TYPES,
  isTerminalDeliveryStatus,
  isValidDeliveryTransition,
  requiresProofOfDelivery,
  type DeliveryExecutionStatus,
} from './types.ts';

describe('DELIVERY_TRANSITIONS — estructura del mapa', () => {
  it('los estados terminales (delivered, canceled) no tienen transiciones de salida', () => {
    assert.deepEqual(DELIVERY_TRANSITIONS.delivered, []);
    assert.deepEqual(DELIVERY_TRANSITIONS.canceled, []);
    for (const terminal of DELIVERY_TERMINAL_STATUSES) {
      assert.deepEqual(DELIVERY_TRANSITIONS[terminal], [], `${terminal} debe ser terminal`);
    }
  });

  it('todo estado no terminal puede cancelarse', () => {
    const allStates = Object.keys(DELIVERY_TRANSITIONS) as DeliveryExecutionStatus[];
    for (const state of allStates) {
      if (isTerminalDeliveryStatus(state)) continue;
      assert.ok(
        DELIVERY_TRANSITIONS[state].includes('canceled'),
        `${state} debe permitir → canceled`,
      );
    }
  });

  it('ningún estado puede transicionar a sí mismo', () => {
    const allStates = Object.keys(DELIVERY_TRANSITIONS) as DeliveryExecutionStatus[];
    for (const state of allStates) {
      assert.ok(
        !DELIVERY_TRANSITIONS[state].includes(state),
        `${state} no debe transicionar a sí mismo`,
      );
    }
  });

  /**
   * Coherencia estructural: un estado NO terminal siempre tiene salida. Es la
   * invariante que hace que agregar aristas nuevas (las de Correo) sea seguro —
   * ninguna puede dejar una ejecución sin camino. El caso concreto que motiva la
   * guarda: mapear `devolución` a `canceled` (terminal, `[]`) en vez de a
   * `failed_attempt` dejaría al operador sin ninguna acción posible.
   */
  it('todo destino no terminal tiene al menos una transición de salida', () => {
    const allStates = Object.keys(DELIVERY_TRANSITIONS) as DeliveryExecutionStatus[];
    for (const state of allStates) {
      for (const target of DELIVERY_TRANSITIONS[state]) {
        if (isTerminalDeliveryStatus(target)) continue;
        assert.ok(
          DELIVERY_TRANSITIONS[target].length > 0,
          `${state} → ${target}, pero ${target} no es terminal y no tiene salida`,
        );
      }
    }
  });

  it('todo destino declarado es un estado conocido del mapa', () => {
    const allStates = Object.keys(DELIVERY_TRANSITIONS) as DeliveryExecutionStatus[];
    for (const state of allStates) {
      for (const target of DELIVERY_TRANSITIONS[state]) {
        assert.ok(allStates.includes(target), `${state} → ${target} desconocido`);
      }
    }
  });
});

/**
 * Los dos carriers de tercero quedan FUERA del gate de POD, y no por olvido: la
 * entrega la confirma el carrier vía tracking, no un repartidor nuestro. Exigir
 * evidencia dejaría toda ejecución de Correo/Andreani trabada antes de
 * 'delivered', porque el POD nunca va a llegar.
 */
describe('POD_REQUIRED_PROVIDER_TYPES', () => {
  it('solo flota propia exige prueba de entrega', () => {
    assert.deepEqual(POD_REQUIRED_PROVIDER_TYPES, ['own_fleet']);
    assert.equal(requiresProofOfDelivery('own_fleet'), true);
  });

  it('los carriers de tercero NO la exigen', () => {
    assert.equal(requiresProofOfDelivery('correo_argentino'), false);
    assert.equal(requiresProofOfDelivery('andreani'), false);
  });

  it('store_pickup tampoco (su evidencia es el POD "pin" de validate-pickup)', () => {
    assert.equal(requiresProofOfDelivery('store_pickup'), false);
  });
});

describe('isValidDeliveryTransition — transiciones válidas', () => {
  it('ruta operativa manual feliz', () => {
    assert.equal(isValidDeliveryTransition('pending', 'ready'), true);
    assert.equal(isValidDeliveryTransition('ready', 'assigned'), true);
    assert.equal(isValidDeliveryTransition('assigned', 'picked_up'), true);
    assert.equal(isValidDeliveryTransition('picked_up', 'in_transit'), true);
    assert.equal(isValidDeliveryTransition('in_transit', 'delivered'), true);
  });

  it('saltos de carrier externo: pending/ready avanzan directo a hitos de tránsito/entrega', () => {
    // Andreani puede reportar picked_up/in_transit/delivered sobre una ejecución
    // todavía pending o ready, sin pasar por la asignación interna.
    assert.equal(isValidDeliveryTransition('pending', 'picked_up'), true);
    assert.equal(isValidDeliveryTransition('pending', 'in_transit'), true);
    assert.equal(isValidDeliveryTransition('pending', 'delivered'), true);
    assert.equal(isValidDeliveryTransition('ready', 'in_transit'), true);
    assert.equal(isValidDeliveryTransition('ready', 'delivered'), true);
  });

  it('flujo de punto de retiro (at_pickup_point)', () => {
    assert.equal(isValidDeliveryTransition('in_transit', 'at_pickup_point'), true);
    assert.equal(isValidDeliveryTransition('at_pickup_point', 'delivered'), true);
    assert.equal(isValidDeliveryTransition('at_pickup_point', 'failed_attempt'), true);
  });

  // ⚠️ CORREO ARGENTINO. Su normalizador mapea `caduco` (CAU) y `devolución` a
  // `failed_attempt`, y esos eventos pueden llegar sobre una ejecución que la
  // máquina nunca avanzó: `preImposición` proyecta a null, así que la ejecución
  // sigue en `pending`. Sin estas aristas, `service.transition()` tira NOT_ALLOWED
  // y el job reintenta la misma transición imposible cada hora, para siempre.
  it('un carrier puede reportar un intento fallido antes de cualquier otro hito', () => {
    assert.equal(isValidDeliveryTransition('pending', 'failed_attempt'), true);
    assert.equal(isValidDeliveryTransition('ready', 'failed_attempt'), true);
    assert.equal(isValidDeliveryTransition('assigned', 'failed_attempt'), true);
  });

  it('failed_attempt reintenta o aborta', () => {
    assert.equal(isValidDeliveryTransition('failed_attempt', 'in_transit'), true);
    assert.equal(isValidDeliveryTransition('failed_attempt', 'at_pickup_point'), true);
    assert.equal(isValidDeliveryTransition('failed_attempt', 'assigned'), true);
    assert.equal(isValidDeliveryTransition('failed_attempt', 'delivered'), true);
    assert.equal(isValidDeliveryTransition('failed_attempt', 'canceled'), true);
  });
});

describe('isValidDeliveryTransition — transiciones inválidas', () => {
  it('estados terminales no admiten salida', () => {
    assert.equal(isValidDeliveryTransition('delivered', 'pending'), false);
    assert.equal(isValidDeliveryTransition('delivered', 'canceled'), false);
    assert.equal(isValidDeliveryTransition('delivered', 'in_transit'), false);
    assert.equal(isValidDeliveryTransition('canceled', 'pending'), false);
    assert.equal(isValidDeliveryTransition('canceled', 'delivered'), false);
  });

  it('no se puede retroceder en el flujo', () => {
    assert.equal(isValidDeliveryTransition('in_transit', 'pending'), false);
    assert.equal(isValidDeliveryTransition('in_transit', 'ready'), false);
    assert.equal(isValidDeliveryTransition('assigned', 'pending'), false);
    assert.equal(isValidDeliveryTransition('picked_up', 'assigned'), false);
  });

  it('estado de origen desconocido → false (no rompe)', () => {
    assert.equal(isValidDeliveryTransition('bogus', 'delivered'), false);
    assert.equal(isValidDeliveryTransition('', 'pending'), false);
  });

  it('estado destino desconocido → false', () => {
    assert.equal(isValidDeliveryTransition('pending', 'bogus'), false);
  });
});

describe('isTerminalDeliveryStatus', () => {
  it('true solo para delivered y canceled', () => {
    assert.equal(isTerminalDeliveryStatus('delivered'), true);
    assert.equal(isTerminalDeliveryStatus('canceled'), true);
  });
  it('false para estados no terminales y desconocidos', () => {
    assert.equal(isTerminalDeliveryStatus('pending'), false);
    assert.equal(isTerminalDeliveryStatus('in_transit'), false);
    assert.equal(isTerminalDeliveryStatus('failed_attempt'), false);
    assert.equal(isTerminalDeliveryStatus('bogus'), false);
  });
});
