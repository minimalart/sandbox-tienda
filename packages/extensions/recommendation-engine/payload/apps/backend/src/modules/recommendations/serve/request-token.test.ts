import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mintRequestId, verifyRequestId } from './request-token';

const SECRET = 'secreto-de-prueba';

describe('mintRequestId', () => {
  it('genera un id con el prefijo y las dos partes', () => {
    const id = mintRequestId(SECRET);
    assert.match(id, /^recq_[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{14}$/);
  });

  it('no repite ids', () => {
    const ids = new Set(Array.from({ length: 200 }, () => mintRequestId(SECRET)));
    assert.equal(ids.size, 200);
  });

  it('no filtra el secreto en el id', () => {
    assert.ok(!mintRequestId(SECRET).includes(SECRET));
  });
});

describe('verifyRequestId', () => {
  it('acepta un id recién generado', () => {
    assert.equal(verifyRequestId(mintRequestId(SECRET), SECRET), true);
  });

  it('rechaza si se altera la parte aleatoria', () => {
    const id = mintRequestId(SECRET);
    const [body, signature] = id.slice('recq_'.length).split('.');
    const tampered = `recq_${body.slice(0, -1)}${body.at(-1) === 'a' ? 'b' : 'a'}.${signature}`;
    assert.equal(verifyRequestId(tampered, SECRET), false);
  });

  it('rechaza si se altera la firma', () => {
    const id = mintRequestId(SECRET);
    const [body, signature] = id.slice('recq_'.length).split('.');
    const tampered = `recq_${body}.${signature.slice(0, -1)}${signature.at(-1) === 'a' ? 'b' : 'a'}`;
    assert.equal(verifyRequestId(tampered, SECRET), false);
  });

  it('rechaza un id firmado con otro secreto', () => {
    assert.equal(verifyRequestId(mintRequestId('otro-secreto'), SECRET), false);
  });

  it('rechaza formas inválidas sin lanzar', () => {
    // Corre sobre input no confiable en la ingesta de eventos: nunca puede tirar.
    const garbage: unknown[] = [
      undefined,
      null,
      '',
      0,
      42,
      {},
      [],
      true,
      'recq_',
      'recq_sinpunto',
      'recq_.',
      'recq_abc.def', // longitudes incorrectas
      'otro_AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBB', // prefijo incorrecto
      'AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBB', // sin prefijo
      `recq_${'A'.repeat(16)}.${'B'.repeat(14)}`, // firma que no corresponde
      `recq_${'A'.repeat(16)}.${'B'.repeat(13)}`, // firma corta
      `recq_${'A'.repeat(17)}.${'B'.repeat(14)}`, // aleatorio largo
      `recq_${'*'.repeat(16)}.${'B'.repeat(14)}`, // caracteres fuera de base64url
    ];
    for (const value of garbage) {
      assert.equal(verifyRequestId(value, SECRET), false, `debería rechazar: ${String(value)}`);
    }
  });

  it('rechaza cuando no hay secreto', () => {
    // Sin secreto no se puede afirmar nada sobre la firma: no se acepta a ciegas.
    assert.equal(verifyRequestId(mintRequestId(SECRET), ''), false);
  });

  it('tolera un id con varios puntos', () => {
    const id = mintRequestId(SECRET);
    assert.equal(verifyRequestId(`${id}.extra`, SECRET), false);
  });
});
