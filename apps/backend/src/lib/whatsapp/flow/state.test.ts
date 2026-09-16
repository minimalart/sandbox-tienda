import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { readState } from './engine';

describe('readState', () => {
  it('arranca de cero cuando la sesión no tiene grafo', () => {
    const state = readState({}, 'v1');
    assert.deepEqual(state, { version_id: 'v1', node_id: null, answers: {}, vars: {}, visited: [], awaiting_until: null });
  });

  it('retoma donde quedó si la versión es la misma', () => {
    const saved = {
      graph: { version_id: 'v1', node_id: 'menu', answers: { menu: 'buy' }, vars: { x: 1 }, visited: ['inicio', 'menu'] },
    };
    const state = readState(saved, 'v1');
    assert.equal(state.node_id, 'menu');
    assert.deepEqual(state.answers, { menu: 'buy' });
    assert.deepEqual(state.visited, ['inicio', 'menu']);
  });

  it('REINICIA si se publicó un grafo nuevo a mitad de la conversación', () => {
    // El `node_id` guardado apunta a un nodo del grafo viejo. Seguir con él sería
    // recorrer un mapa que ya no existe, y el cliente terminaría en un nodo que
    // nadie dibujó o directamente sin respuesta.
    const saved = { graph: { version_id: 'v1', node_id: 'menu', answers: { menu: 'buy' }, vars: {}, visited: ['menu'] } };
    const state = readState(saved, 'v2');
    assert.equal(state.version_id, 'v2');
    assert.equal(state.node_id, null);
    assert.deepEqual(state.answers, {});
  });

  it('tolera basura guardada sin lanzar', () => {
    for (const saved of [null, undefined, { graph: null }, { graph: 'nope' }, { graph: { version_id: 'v1', answers: 'x', visited: 7 } }]) {
      const state = readState(saved as never, 'v1');
      assert.equal(typeof state.answers, 'object');
      assert.ok(Array.isArray(state.visited));
    }
  });
});
