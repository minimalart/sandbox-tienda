import assert from 'node:assert/strict';
import test from 'node:test';
import { lowConfidenceOf, planAcceptAll, rawValue } from './lib.ts';

/** Propuesta como la guarda el generador. */
const prop = (value: unknown, confidence = 0.55) => ({
  value,
  attempt: 2,
  confidence,
  source_trace: { catalog: true, image: true, barcode: false, scraping: false, ai_inferred: true },
});

/** Los 7 campos de texto de una corrida real, todos bajo el umbral. */
const SIETE = {
  alt_text: prop('un alt'),
  keywords: prop(['lijar', 'abrasivo']),
  subtitle: prop('un subtítulo'),
  categories: prop(['pcat_1']),
  meta_title: prop('un meta title'),
  description: prop('una descripción'),
  meta_description: prop('una meta description'),
};

const GATE_ON = { requireReview: true, threshold: 0.7 };

test('rawValue extrae el valor crudo y deja pasar lo que ya es crudo', () => {
  assert.equal(rawValue(prop('hola')), 'hola');
  assert.deepEqual(rawValue(prop(['a', 'b'])), ['a', 'b']);
  assert.equal(rawValue('ya crudo'), 'ya crudo');
  assert.equal(rawValue(null), null);
});

test('lowConfidenceOf devuelve el número, no un booleano', () => {
  assert.equal(lowConfidenceOf(prop('x', 0.55), GATE_ON), 0.55);
  assert.equal(lowConfidenceOf(prop('x', 0.7), GATE_ON), null, '0.7 pasa: la comparación es < estricta');
  assert.equal(lowConfidenceOf(prop('x', 0.9), GATE_ON), null);
});

test('con el gate apagado no se difiere nada', () => {
  assert.equal(lowConfidenceOf(prop('x', 0.1), { requireReview: false, threshold: 0.7 }), null);
  const plan = planAcceptAll({ ...GATE_ON, requireReview: false, proposed: SIETE, accepted: {}, rejected: {} });
  assert.equal(plan.deferred.length, 0);
  assert.equal(Object.keys(plan.accept).length, 7);
});

test('sin decisiones previas, los campos bajo el umbral se difieren', () => {
  const plan = planAcceptAll({ ...GATE_ON, proposed: SIETE, accepted: {}, rejected: {} });
  assert.equal(plan.deferred.length, 7);
  assert.deepEqual(Object.keys(plan.accept), []);
});

/**
 * La regresión. Alguien acepta los siete campos uno por uno, aprieta "aceptar
 * todo", y el toast le dice "7 campos quedaron pendientes por baja confianza —
 * faltan decidirlos campo por campo" con los siete ya en `accepted_changes`.
 * Verificado en producción sobre `catexecp_01M11R4X63SQ7WT41QGES6RQ0A`: 7
 * propuestos, 7 aceptados, 0 sin decisión, y el aviso decía 7 pendientes.
 */
test('un campo YA aceptado a mano no vuelve a contar como pendiente', () => {
  const accepted = Object.fromEntries(Object.entries(SIETE).map(([f, p]) => [f, p.value]));
  const plan = planAcceptAll({ ...GATE_ON, proposed: SIETE, accepted, rejected: {} });
  assert.deepEqual(plan.deferred, [], 'los siete estaban decididos: nada que informar');
  assert.deepEqual(Object.keys(plan.accept), [], 'y nada que re-escribir');
});

test('un campo YA rechazado a mano tampoco cuenta como pendiente', () => {
  const plan = planAcceptAll({
    ...GATE_ON,
    proposed: SIETE,
    accepted: {},
    rejected: { subtitle: SIETE.subtitle },
  });
  assert.equal(plan.deferred.length, 6);
  assert.ok(!plan.deferred.some((d) => d.field === 'subtitle'));
});

test('informa sólo los campos que de verdad quedan sin decidir', () => {
  const plan = planAcceptAll({
    ...GATE_ON,
    proposed: SIETE,
    accepted: { alt_text: 'un alt', keywords: ['lijar'] },
    rejected: { subtitle: SIETE.subtitle },
  });
  assert.deepEqual(
    plan.deferred.map((d) => d.field).sort(),
    ['categories', 'description', 'meta_description', 'meta_title']
  );
});

test('los campos que pasan el umbral se aceptan y se sacan de rechazados', () => {
  const proposed = { subtitle: prop('sube', 0.9), description: prop('baja', 0.55) };
  const plan = planAcceptAll({ ...GATE_ON, proposed, accepted: {}, rejected: {} });
  assert.deepEqual(plan.accept, { subtitle: 'sube' });
  assert.deepEqual(plan.unreject, ['subtitle']);
  assert.deepEqual(
    plan.deferred.map((d) => d.field),
    ['description']
  );
});

test('una propuesta sin confidence no se difiere: se acepta', () => {
  const plan = planAcceptAll({
    ...GATE_ON,
    proposed: { tags: { value: ['a'] } },
    accepted: {},
    rejected: {},
  });
  assert.deepEqual(plan.accept, { tags: ['a'] });
  assert.equal(plan.deferred.length, 0);
});
