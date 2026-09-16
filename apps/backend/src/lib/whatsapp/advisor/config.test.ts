import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { mergeAdvisorConfig } from './config';

/**
 * El asesor guiado pregunta por superficies y bases de PINTURA, y esas preguntas
 * están en código. Una tienda de otro rubro necesita poder apagarlo: un mayorista
 * de almacén tocaba "Necesito ayuda" y recibía "¿sobre qué superficie lo vas a
 * aplicar?".
 */
describe('mergeAdvisorConfig · enabled', () => {
  it('sin config guardada el asesor queda prendido', () => {
    assert.equal(mergeAdvisorConfig(null).enabled, true);
  });

  it('sólo un false explícito lo apaga', () => {
    assert.equal(mergeAdvisorConfig({ enabled: false }).enabled, false);
    assert.equal(mergeAdvisorConfig({ enabled: true }).enabled, true);
  });

  it('un valor basura no lo apaga por accidente', () => {
    assert.equal(mergeAdvisorConfig({ enabled: 'no' }).enabled, true);
    assert.equal(mergeAdvisorConfig({ enabled: 0 }).enabled, true);
  });

  it('una config vieja, sin el campo, sigue andando igual', () => {
    assert.equal(mergeAdvisorConfig({ max_results: 3 }).enabled, true);
  });
});
