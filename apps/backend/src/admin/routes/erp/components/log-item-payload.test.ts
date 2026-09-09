import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { describeItemPayload, summarizeItemPayload } from './log-item-payload.ts';

/**
 * Los payloads de `catalog_sync` de estos tests están copiados TAL CUAL de
 * producción (desdeelsur, log `erpsl_01M1Y8Q9GJM8KMNTNJCXQ13BGS`, barrido
 * completo del 2026-09-07). Es la única forma de que el test pruebe algo: el bug
 * que arregla este archivo era exactamente "la función no conoce esta forma".
 */
const PRICE_UNCHANGED = {
  base: { amount: 2728.2, previous: 2728.2, list_index: 1 },
  brand: { handle: 'eq-arte', status: 'unchanged' },
  product: { status: 'updated', changed: ['metadata'], erp_code: '040/50' },
  category: { code: '020B', status: 'unchanged', category_id: 'pcat_01KZXV3P5QNGM9DP82K3QWWDBC' },
  erp_code: '040/50',
  tax_rate: 21,
  variant_id: 'variant_01KZXX984E3T9V5HHYTHSDNRAR',
  price_lists: [{ title: 'LISTA WEB', unchanged: 1909.74, list_index: 4 }],
};

const VARIANT_NOT_FOUND = {
  brand: { handle: 'eq-arte', status: 'no_product' },
  product: { active: false, status: 'not_published', published: false },
  category: { code: '020B', status: 'no_product' },
  erp_code: '040/150',
};

describe('summarizeItemPayload', () => {
  it('sin payload devuelve el guión', () => {
    assert.equal(summarizeItemPayload(null), '—');
    assert.equal(summarizeItemPayload({}), '—');
  });

  it('un item real de catalog_sync ya NO devuelve el guión', () => {
    // La regresión que motivó el archivo: 2463 de 2463 filas en `—`.
    const summary = summarizeItemPayload(PRICE_UNCHANGED);
    assert.notEqual(summary, '—');
    assert.match(summary, /actualizado/);
    assert.match(summary, /campos: metadatos/);
    assert.match(summary, /precio: 2\.728,20 \(sin cambio\)/);
    assert.match(summary, /LISTA WEB: 1\.909,74 \(sin cambio\)/);
  });

  it('categoría y marca sin cambios no ensucian la línea', () => {
    // `unchanged` en las 2696 filas de un barrido no le dice nada a nadie.
    const summary = summarizeItemPayload(PRICE_UNCHANGED);
    assert.doesNotMatch(summary, /categoría/);
    assert.doesNotMatch(summary, /marca/);
  });

  it('explica el variant_not_found en lugar de dejarlo mudo', () => {
    // 723 items de esa corrida. El status suena a bug y no lo es.
    const summary = summarizeItemPayload(VARIANT_NOT_FOUND);
    assert.match(summary, /el ERP no lo publica \(inactivo y no publicado en el ERP\)/);
    // Acá sí se muestran: explican POR QUÉ no se vinculó nada.
    assert.match(summary, /categoría 020B: el artículo no tiene producto en Medusa/);
    assert.match(summary, /marca eq-arte: el artículo no tiene producto en Medusa/);
  });

  it('muestra la normalización de título que vive bajo `product`', () => {
    // El bug fino: se buscaba `payload.title_rules` (forma de stock_sync) y en
    // catalog_sync está anidada, así que el "recibido → normalizado" nunca se
    // veía — justo el dato que se mira al tocar el diccionario.
    const summary = summarizeItemPayload({
      product: {
        status: 'updated',
        changed: ['title'],
        title_rules: {
          received: 'EQ ARTE - ACRILICO G2 040 DORADO IRIDISCENTE X 50 CC',
          normalized: 'Acrílico G2 040 dorado iridiscente x50 cc',
          reason: 'rules_changed',
          written: true,
          applied: ['R10', 'R25'],
        },
      },
    });
    assert.match(summary, /título: EQ ARTE - ACRILICO.* → Acrílico G2 040 dorado iridiscente x50 cc/);
  });

  it('cuando el título NO se escribió lo dice, con el motivo', () => {
    const summary = summarizeItemPayload({
      product: {
        status: 'skipped',
        reason: 'unchanged',
        title_rules: {
          received: 'ALBA - LATEX INTERIOR X 4 LT',
          normalized: 'Látex interior x4 lt',
          reason: 'rules_changed',
          written: false,
          warnings: ['unidad desconocida: "lt."'],
        },
      },
    });
    assert.match(summary, /título \(sin escribir\)/);
    assert.match(summary, /unidad desconocida/);
  });

  it('sigue leyendo los payloads de stock_sync', () => {
    // El archivo cubre las dos formas porque la misma tabla muestra las dos y el
    // tipo del log no viaja en el item.
    const summary = summarizeItemPayload({
      erp_quantity: 12,
      normalized_quantity: 10,
      previous_stocked: 8,
      reserved_quantity: 2,
    });
    assert.match(summary, /ERP: 12/);
    assert.match(summary, /→ 10/);
    assert.match(summary, /antes: 8/);
    assert.match(summary, /reservado: 2/);
  });

  it('traduce los enums crudos del backend', () => {
    assert.match(
      summarizeItemPayload({ erp_code: '10', reason: 'create_products_disabled' }),
      /el alta de productos está apagada/
    );
  });

  it('una despublicación bloqueada por el guard se ve', () => {
    const summary = summarizeItemPayload({
      publication: { action: 'unpublish_blocked_by_guard', reason: 'missing_in_erp' },
    });
    assert.match(summary, /BLOQUEADA por el guard/);
  });

  it('las price lists salteadas dicen qué se conservó', () => {
    const summary = summarizeItemPayload({
      price_lists: [
        { list_index: 4, title: 'LISTA WEB', skipped: 'no_price_in_erp', kept: 1500 },
        { list_index: 5, title: 'MAYORISTA', amount: 900, previous: 800 },
        { list_index: 6, title: 'NUEVA', created: 700 },
      ],
    });
    assert.match(summary, /LISTA WEB: salteada — el ERP no manda precio para esa lista \(queda 1\.500,00\)/);
    assert.match(summary, /MAYORISTA: 800,00 → 900,00/);
    assert.match(summary, /NUEVA: alta 700,00/);
  });
});

describe('describeItemPayload', () => {
  it('sin payload no hay secciones', () => {
    assert.deepEqual(describeItemPayload(null), []);
  });

  it('agrupa el item real en bloques y no inventa vacíos', () => {
    const sections = describeItemPayload(PRICE_UNCHANGED);
    const titles = sections.map((section) => section.title);
    assert.deepEqual(titles, ['Qué pasó', 'Precios', 'Categoría, marca y publicación']);
    // Ninguna sección puede venir sin campos: eso pintaría un título huérfano.
    for (const section of sections) assert.ok(section.fields.length > 0);
  });

  it('el bloque de normalización expone las reglas que mordieron', () => {
    const sections = describeItemPayload({
      product: {
        status: 'updated',
        title_rules: {
          received: 'ALBA - LATEX X 4 LT',
          normalized: 'Látex x4 lt',
          written: true,
          applied: ['R10', 'R19'],
          warnings: ['unidad desconocida'],
        },
      },
    });
    const block = sections.find((section) => section.title === 'Normalización de texto');
    assert.ok(block, 'falta el bloque de normalización');
    const byLabel = new Map(block.fields.map((field) => [field.label, field]));
    assert.equal(byLabel.get('Título normalizado')?.value, 'Látex x4 lt');
    assert.equal(byLabel.get('Reglas aplicadas')?.value, 'R10, R19');
    assert.equal(byLabel.get('¿Se escribió?')?.value, 'sí');
    assert.equal(byLabel.get('Avisos')?.tone, 'error');
  });

  it('el motivo del variant_not_found queda arriba, no escondido', () => {
    const sections = describeItemPayload(VARIANT_NOT_FOUND);
    assert.equal(sections[0]?.title, 'Qué pasó');
    assert.equal(sections[0]?.fields[0]?.label, 'Resultado');
    assert.match(sections[0]!.fields[0]!.value, /el ERP no lo publica/);
  });

  it('un SKU repetido se marca en rojo', () => {
    const sections = describeItemPayload({ variant_ids: ['variant_a', 'variant_b'] });
    const block = sections.find((section) => section.title === 'Avisos');
    assert.equal(block?.fields[0]?.tone, 'error');
    assert.equal(block?.fields[0]?.value, 'variant_a, variant_b');
  });
});
