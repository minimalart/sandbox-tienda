import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { decideSaleConflict } from './conflict-decision.ts';

/**
 * El caso real que motivó esto (DESDEELSUR-61): la orden #78 y otras 19 quedaron
 * archivadas como "duplicadas" con `attempts: 0` y sin `idtransac`. Es decir:
 * marcadas como resueltas, inexistentes en el ERP, y sin nadie mirando.
 */
describe('decideSaleConflict', () => {
  it('conflicto en el PRIMER envío: no puede ser duplicado, es rechazo', () => {
    const decision = decideSaleConflict(0, 'cond_venta inválida');

    assert.equal(decision.kind, 'rejected');
    assert.match(decision.message, /PRIMER envío/);
    assert.match(decision.message, /cond_venta inválida/);
  });

  it('el motivo del ERP viaja en el mensaje, que es lo único que ve el operador', () => {
    const decision = decideSaleConflict(0, '  {"error":"codigo_iva requerido"}  ');

    assert.equal(decision.kind, 'rejected');
    assert.match(decision.message, /codigo_iva requerido/);
  });

  it('sin cuerpo, el mensaje lo dice en vez de inventar una causa', () => {
    const decision = decideSaleConflict(0, null);

    assert.equal(decision.kind, 'rejected');
    assert.match(decision.message, /no devolvió ningún motivo/);
  });

  it('un cuerpo enorme se recorta: va a un mensaje de error, no a un log', () => {
    const decision = decideSaleConflict(0, 'x'.repeat(5000));

    assert.equal(decision.kind, 'rejected');
    assert.ok(decision.message.length < 600, `mensaje de ${decision.message.length} caracteres`);
  });

  it('con un intento fallido previo, "ya lo tengo" es creíble: se respeta la idempotencia', () => {
    // El caso que NO hay que romper: el POST entró, la respuesta se perdió
    // (timeout, corte), el evento se reintenta y el ERP contesta conflicto.
    // Ahí sí es un duplicado de verdad y reenviar duplicaría la factura.
    assert.deepEqual(decideSaleConflict(1, 'ya existe'), { kind: 'duplicate' });
    assert.deepEqual(decideSaleConflict(5, null), { kind: 'duplicate' });
  });

  it('attempts ausente o null se lee como primer envío', () => {
    // Un evento sin contador no es un evento con historial: ante la duda, la
    // venta se marca para que alguien la mire, no se da por resuelta.
    assert.equal(decideSaleConflict(undefined, 'motivo').kind, 'rejected');
    assert.equal(decideSaleConflict(null, 'motivo').kind, 'rejected');
  });
});
