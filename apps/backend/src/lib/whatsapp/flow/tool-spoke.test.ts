import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { toolHandledTurn } from './tool-spoke';

describe('cuándo una acción atendió el turno', () => {
  it('habló: atendió', () => {
    assert.equal(
      toolHandledTurn({ returned: 'Ya le mostré las opciones', silent: false, spoke: true }),
      true,
    );
  });

  it('NO habló: cede el turno aunque haya devuelto texto', () => {
    /**
     * EL BUG. La búsqueda sin resultados devuelve "No encontré productos para X,
     * pedile al cliente que lo nombre de otra forma" — una instrucción PARA EL
     * MODELO. En un recorrido no hay modelo: si esto contara como atendido, el
     * cliente escribe el nombre de un producto y no vuelve nada. Visto en producción
     * el 2026-09-16.
     */
    assert.equal(
      toolHandledTurn({
        returned: 'No encontré productos para "albalatex". Pedile al cliente que lo nombre de otra forma.',
        silent: false,
        spoke: false,
      }),
      false,
    );
  });

  it('un envío que falló tampoco atiende', () => {
    // El carrusel que Meta rechaza y la lista que tampoco sale: la tool devuelve el
    // detalle para que lo mande el modelo, y no hay modelo.
    assert.equal(
      toolHandledTurn({ returned: 'No pude enviar los botones. Mandale este detalle…', silent: false, spoke: false }),
      false,
    );
  });

  it('una acción silenciosa atiende sin hablar', () => {
    // Es su razón de ser: agrega al carrito y el recorrido dibuja la pregunta que
    // sigue, todo en un mensaje. Exigirle que hable rompería ese caso.
    assert.equal(toolHandledTurn({ returned: 'OK: agregado.', silent: true, spoke: false }), true);
  });

  it('una acción que ni corrió no atiende', () => {
    assert.equal(toolHandledTurn({ returned: undefined, silent: false, spoke: false }), false);
  });

  it('ni siquiera marcada como silenciosa, si no corrió', () => {
    // `silent` dice "no hace falta que hable", no "hacé de cuenta que pasó algo".
    assert.equal(toolHandledTurn({ returned: undefined, silent: true, spoke: false }), false);
  });

  it('un error de la tool cede el turno en vez de tragárselo', () => {
    assert.equal(
      toolHandledTurn({ returned: 'Error: falta variant_id.', silent: false, spoke: false }),
      false,
    );
  });
});
