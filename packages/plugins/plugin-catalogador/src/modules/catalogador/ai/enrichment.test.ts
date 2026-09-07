import assert from 'node:assert/strict';
import test from 'node:test';
import { getCatalogadorDefaults } from '../config.ts';
import { evidenceConfidence } from './enrichment.ts';

/**
 * La tabla de confianza y su relación con el gate de revisión.
 *
 * El umbral se LEE del default real (`config.ts` → `rules.low_confidence_threshold`)
 * en vez de repetirlo acá. Antes era una constante `0.7` copiada, y una copia de
 * un default es justo lo que dejó pasar la regresión que estos tests cuidan: el
 * número vivía en cuatro lugares (config, el `??` del endpoint de decisiones y
 * dos pantallas del admin) y nada obligaba a que se movieran juntos.
 *
 * La comparación del endpoint es `confidence < umbral` ESTRICTA: un valor igual
 * al umbral pasa.
 */
const DEFAULT_THRESHOLD = getCatalogadorDefaults().rules.low_confidence_threshold;

const passesGate = (confidence: number) => !(confidence < DEFAULT_THRESHOLD);

/** El piso y el techo que la fórmula puede devolver, para razonar sobre el gate. */
const FLOOR = 0.55;
const CEILING_WITHOUT_EXTERNAL_SOURCES = 0.7;

test('barcode con página coincidente es la evidencia más fuerte', () => {
  assert.equal(evidenceConfidence({ usedBarcode: true, pageHits: 1, hasImage: false }), 0.9);
  assert.equal(evidenceConfidence({ usedBarcode: true, pageHits: 3, hasImage: true }), 0.9);
});

test('barcode sin páginas puntúa 0.8', () => {
  assert.equal(evidenceConfidence({ usedBarcode: true, pageHits: 0, hasImage: false }), 0.8);
});

test('dos páginas coincidentes puntúan 0.7', () => {
  assert.equal(evidenceConfidence({ usedBarcode: false, pageHits: 2, hasImage: false }), 0.7);
});

test('la foto del producto puntúa 0.7: el modelo la mira, no la deduce', () => {
  assert.equal(evidenceConfidence({ usedBarcode: false, pageHits: 0, hasImage: true }), 0.7);
});

test('una sola página pesa menos que la foto propia', () => {
  const unaPagina = evidenceConfidence({ usedBarcode: false, pageHits: 1, hasImage: false });
  const soloFoto = evidenceConfidence({ usedBarcode: false, pageHits: 0, hasImage: true });
  assert.equal(unaPagina, 0.6);
  assert.ok(soloFoto > unaPagina);
});

test('sin foto ni fuentes externas la fórmula toca su piso', () => {
  assert.equal(evidenceConfidence({ usedBarcode: false, pageHits: 0, hasImage: false }), FLOOR);
});

/**
 * El techo alcanzable NUNCA puede quedar por debajo del umbral.
 *
 * Es la regresión de DESDEELSUR-16 en una línea. Con `barcode_enabled: false` y
 * `scraping_enabled: false` —el default, y la config real de desdeelsur— la
 * fórmula no pasa de 0.7. Con el umbral en 0.7 la comparación estricta salvaba
 * el empate; con cualquier umbral MÁS ALTO el techo cae por debajo y el gate
 * difiere el 100% de los campos siempre: 140 propuestas de una corrida
 * idénticamente diferidas y "aceptar todo" incapaz de aceptar nada.
 *
 * Un gate cuyo techo está debajo de su propio umbral no discrimina: apaga el
 * botón. Este test es el que impide volver ahí.
 */
test('el techo alcanzable sin fuentes externas pasa el gate', () => {
  assert.ok(
    DEFAULT_THRESHOLD <= CEILING_WITHOUT_EXTERNAL_SOURCES,
    `el umbral por default (${DEFAULT_THRESHOLD}) no puede superar el techo alcanzable ` +
      `sin barcode ni scraping (${CEILING_WITHOUT_EXTERNAL_SOURCES}): el gate diferiría todo, siempre`,
  );
  assert.equal(passesGate(CEILING_WITHOUT_EXTERNAL_SOURCES), true);
});

/**
 * Y el otro extremo, EXPLÍCITO porque es una decisión y no un accidente.
 *
 * DESDEELSUR-46 bajó el default a 0.5. Como el piso de la fórmula es 0.55, con
 * ese umbral el gate no difiere NADA: todo campo propuesto se auto-acepta en
 * "aceptar todo". Es lo que se pidió —el equipo venía aceptando campo por campo—
 * pero conviene tenerlo escrito: hoy `require_review_low_confidence` está en
 * `true` y no cambia el resultado. Quien quiera el gate de vuelta tiene que subir
 * el umbral por encima de 0.55 (y no más de 0.7), no tocar el booleano.
 *
 * Si alguien cambia el piso de la fórmula, este test se cae y hay que decidir de
 * nuevo — que es exactamente cuándo se quiere una decisión humana.
 */
test('con el default de 0.5 el piso también pasa: el gate no difiere nada', () => {
  assert.equal(DEFAULT_THRESHOLD, 0.5);
  assert.ok(FLOOR > DEFAULT_THRESHOLD);
  assert.equal(passesGate(FLOOR), true);
});
