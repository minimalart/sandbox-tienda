import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ErpCatalogRow } from '../adapters/types.ts';
import { DEFAULT_PRODUCT_FIELDS, type ErpProductField } from '../types.ts';
import {
  erpVariantMetadata,
  planProductMetadata,
  planProductUpdate,
  type ExistingProduct,
} from './plan-product-updates.ts';
import { resolveTitleRules, titleRulesFingerprint } from './product-title.ts';

const row = (over: Partial<ErpCatalogRow> = {}): ErpCatalogRow => ({
  code: '010/50',
  title: 'EQ ARTE - ACRILICO G2 010 PLATEADO X 50 CC',
  description: 'Acrílico de 50cc',
  prices: { 1: 2526.12, 4: 1768.28 },
  tax_rate: 21,
  published: true,
  active: true,
  category_code: '020B',
  brand: 'EQ ARTE',
  family: 'ARTISTICA ACRILICOS',
  // Un EAN de verdad: el fixture prueba que SOLO un barcode real llega a la variante.
  barcode: '7791234567890',
  factory_code: '1.1.1.50.010',
  weight: 0.08,
  length: 3,
  height: 5,
  width: 4,
  modified_at: '2026-07-24 10:00:00.000',
  ...over,
});

const existing = (over: Partial<ExistingProduct> = {}): ExistingProduct => ({
  product_id: 'prod_1',
  variant_id: 'variant_1',
  title: 'Acrílico plateado 50cc (título curado para SEO)',
  description: 'Descripción escrita por marketing.',
  status: 'published',
  weight: 0.08,
  length: 3,
  height: 5,
  width: 4,
  barcode: '7791234567890',
  metadata: { source: 'zeus', source_product_id: '010/50', zeus_por_iva: 21, brand: 'EQ ARTE', zeus_familia: 'ARTISTICA ACRILICOS', zeus_categoria: '020B', zeus_codigo_fabrica: '1.1.1.50.010' },
  category_ids: [],
  ...over,
});

const plan = (over: Partial<Parameters<typeof planProductUpdate>[0]> = {}) =>
  planProductUpdate({
    row: row(),
    existing: existing(),
    fields: DEFAULT_PRODUCT_FIELDS,
    createProducts: false,
    onlyPublished: true,
    ...over,
  });

describe('planProductUpdate — allowlist de campos', () => {
  it('sin cambios reales → skipped(unchanged)', () => {
    const result = plan();
    assert.equal(result.status, 'skipped');
    assert.equal(result.response_payload.reason, 'unchanged');
  });

  it('NO pisa title ni description con el default (protege el SEO curado)', () => {
    const result = plan();
    assert.equal(result.product_update, undefined);
    // El título del ERP es distinto al curado, y aun así no se toca.
    assert.notEqual(row().title, existing().title);
  });

  it('pisa title/description solo si están en la allowlist', () => {
    const fields: ErpProductField[] = [...DEFAULT_PRODUCT_FIELDS, 'title', 'description'];
    // Sin `titleRules` rige el comportamiento histórico: título literal del ERP.
    const result = plan({ fields });
    assert.equal(result.status, 'updated');
    assert.equal(result.product_update?.title, row().title);
    assert.equal(result.product_update?.description, 'Acrílico de 50cc');
  });

  it('actualiza dimensiones cuando cambian en el ERP', () => {
    const result = plan({ row: row({ weight: 0.5 }) });
    assert.equal(result.status, 'updated');
    assert.equal(result.product_update?.weight, 0.5);
    assert.deepEqual(result.response_payload.changed, ['weight']);
  });

  it('ignora dimensiones nulas del ERP (no las borra en Medusa)', () => {
    const result = plan({ row: row({ weight: null, length: null }) });
    assert.equal(result.status, 'skipped');
  });

  it('barcode va al patch de variante, no al de producto', () => {
    const result = plan({ row: row({ barcode: 'NUEVO-EAN' }) });
    assert.equal(result.variant_update?.barcode, 'NUEVO-EAN');
    assert.equal(result.product_update, undefined);
  });

  it('el codigo de fabrica NUNCA va al barcode (rompe el checkout por escaner)', () => {
    // Regresión: el adapter mapeaba `codigo_fabrica` al `barcode` de la variante,
    // metiendo referencias tipo "1.1.1.50.010" en el campo que lee el escáner.
    const result = plan({
      row: row({ barcode: null, factory_code: 'REF-INTERNA-9' }),
      existing: existing({ barcode: null, metadata: { source: 'zeus' } }),
    });
    assert.equal(result.variant_update?.barcode, undefined);
    const metadata = result.variant_update?.metadata as Record<string, unknown>;
    assert.equal(metadata.zeus_codigo_fabrica, 'REF-INTERNA-9');
  });

  it('respeta la exclusión de un campo de la allowlist', () => {
    const sinPeso = DEFAULT_PRODUCT_FIELDS.filter((f) => f !== 'weight');
    const result = plan({ row: row({ weight: 99 }), fields: sinPeso });
    assert.equal(result.status, 'skipped');
  });
});

describe('planProductUpdate — barcode compartido entre artículos', () => {
  const withBarcode: ErpProductField[] = [...DEFAULT_PRODUCT_FIELDS, 'barcode'];
  /** `7790400021806` estaba cargado en 5 artículos de marcas distintas. */
  const shared = new Map([['7798123210323', ['ZC24', 'C28', 'C67']]]);

  it('escribe el barcode cuando es exclusivo del artículo', () => {
    const result = plan({
      fields: withBarcode,
      row: row({ barcode: '7798123210323' }),
      existing: existing({ barcode: null }),
    });
    assert.equal(result.variant_update?.barcode, '7798123210323');
  });

  it('NO lo escribe cuando varios artículos lo reclaman', () => {
    // Medusa tiene constraint único en variant.barcode: darselo al primero haría
    // fallar a los demás Y le pondría a ese producto un código que puede no ser
    // el suyo.
    const result = plan({
      fields: withBarcode,
      row: row({ barcode: '7798123210323' }),
      existing: existing({ barcode: null }),
      duplicateBarcodes: shared,
    });
    assert.equal(result.variant_update?.barcode, undefined);
    const warning = result.response_payload.barcode_warning as string;
    assert.match(warning, /3 artículos/);
    assert.match(warning, /ZC24, C28, C67/);
  });

  it('tampoco lo mete en un alta: el constraint haría fallar la creación entera', () => {
    const result = plan({
      fields: withBarcode,
      row: row({ barcode: '7798123210323' }),
      existing: undefined,
      createProducts: true,
      duplicateBarcodes: shared,
    });
    assert.equal(result.status, 'created');
    assert.equal(result.create?.barcode, null);
  });
});

describe('planProductUpdate — metadatos y alícuota', () => {
  it('mergea los metadatos del ERP siempre, sin borrar los ajenos', () => {
    const result = plan({
      row: row({ tax_rate: 10.5 }),
      existing: existing({ metadata: { source: 'zeus', source_product_id: '010/50', zeus_por_iva: 21, custom: 'no tocar' } }),
    });
    assert.equal(result.status, 'updated');
    const metadata = result.variant_update?.metadata as Record<string, unknown>;
    assert.equal(metadata.zeus_por_iva, 10.5); // la alícuota nueva
    assert.equal(metadata.custom, 'no tocar'); // lo que no es del ERP sobrevive
  });

  it('erpVariantMetadata deja la alícuota que notifySale necesita por línea', () => {
    const metadata = erpVariantMetadata(row({ tax_rate: 10.5 }));
    assert.equal(metadata.zeus_por_iva, 10.5);
    assert.equal(metadata.source, 'zeus');
    assert.equal(metadata.source_product_id, '010/50');
  });

  it('omite las claves vacías en lugar de guardar nulls', () => {
    const metadata = erpVariantMetadata(row({ brand: null, family: null, category_code: null }));
    assert.equal('brand' in metadata, false);
    assert.equal('zeus_familia' in metadata, false);
    assert.equal('zeus_categoria' in metadata, false);
  });
});

describe('planProductUpdate — creación', () => {
  it('sin create_products → variant_not_found, no crea nada', () => {
    const result = plan({ existing: undefined });
    assert.equal(result.status, 'variant_not_found');
    assert.equal(result.create, undefined);
    assert.equal(result.response_payload.reason, 'create_products_disabled');
  });

  it('con create_products → created con SKU = código del ERP', () => {
    const result = plan({ existing: undefined, createProducts: true });
    assert.equal(result.status, 'created');
    assert.equal(result.create?.sku, '010/50');
    assert.equal(result.create?.title, row().title);
    assert.equal(result.create?.metadata.source_product_id, '010/50');
    assert.equal(result.create?.metadata.zeus_por_iva, 21);
  });

  it('artículo sin descripción → failed (no se puede crear sin título)', () => {
    const result = plan({ row: row({ title: null }), existing: undefined, createProducts: true });
    assert.equal(result.status, 'failed');
    assert.match(result.error ?? '', /título/i);
  });

  it('category solo viaja si está en la allowlist', () => {
    const sinCat = plan({ existing: undefined, createProducts: true });
    assert.equal(sinCat.create?.category_code, null);

    const conCat = plan({
      existing: undefined,
      createProducts: true,
      fields: [...DEFAULT_PRODUCT_FIELDS, 'category'],
    });
    assert.equal(conCat.create?.category_code, '020B');
  });

  it('no publicable → not_published antes de intentar crear', () => {
    const result = plan({
      row: row({ published: false }),
      existing: undefined,
      createProducts: true,
    });
    assert.equal(result.status, 'not_published');
    assert.equal(result.create, undefined);
  });
});

describe('planProductUpdate — normalización de título', () => {
  const rules = resolveTitleRules();
  const fingerprint = titleRulesFingerprint(rules);
  /** `EQ ARTE - ACRILICO G2 010 PLATEADO X 50 CC` con marca `EQ ARTE`. */
  const NORMALIZED = 'Acrílico G2 010 plateado x50 cc';
  const withTitle: ErpProductField[] = [...DEFAULT_PRODUCT_FIELDS, 'title'];

  /** Metadata de una variante que ya pasó por la normalización. */
  const stamped = (over: Record<string, unknown> = {}) => ({
    ...existing().metadata,
    zeus_source_title: row().title,
    zeus_title_rules_v: fingerprint,
    zeus_presentacion: '50 cc',
    // "PLATEADO" está en el vocabulario de colores, así que el sync lo deja acá.
    zeus_color: 'Plateado',
    ...over,
  });

  it('nunca escribe el título literal del ERP', () => {
    const result = plan({ fields: withTitle, titleRules: rules });
    assert.equal(result.product_update?.title, NORMALIZED);
    assert.notEqual(result.product_update?.title, row().title);
  });

  it('un título que nunca se normalizó se reescribe (arregla el catálogo existente)', () => {
    const result = plan({ fields: withTitle, titleRules: rules });
    assert.equal(result.status, 'updated');
    const detail = result.response_payload.title_rules as Record<string, unknown>;
    assert.equal(detail.reason, 'never_normalized');
    assert.equal(detail.written, true);
    assert.equal(detail.received, row().title);
  });

  it('deja el título fuente y la huella de las reglas en la metadata', () => {
    const result = plan({ fields: withTitle, titleRules: rules });
    const metadata = result.variant_update?.metadata as Record<string, unknown>;
    assert.equal(metadata.zeus_source_title, row().title);
    assert.equal(metadata.zeus_title_rules_v, fingerprint);
    assert.equal(metadata.zeus_presentacion, '50 cc');
  });

  it('una edición manual sobrevive: sin motivo no se reescribe', () => {
    const result = plan({
      fields: withTitle,
      titleRules: rules,
      existing: existing({ title: 'Acrílico plateado — nombre elegido a mano', metadata: stamped() }),
    });
    assert.equal(result.status, 'skipped');
    assert.equal(result.product_update, undefined);
  });

  it('reescribe cuando el ERP renombró el artículo', () => {
    // La variante quedó normalizada con el nombre VIEJO; Zeus ahora manda "PLATEADO".
    const result = plan({
      fields: withTitle,
      titleRules: rules,
      existing: existing({
        title: 'Acrílico G2 010 dorado x50 cc',
        metadata: stamped({ zeus_source_title: 'EQ ARTE - ACRILICO G2 010 DORADO X 50 CC' }),
      }),
    });
    assert.equal(result.status, 'updated');
    assert.equal(result.product_update?.title, NORMALIZED);
    assert.equal(
      (result.response_payload.title_rules as Record<string, unknown>).reason,
      'source_changed'
    );
  });

  it('reescribe cuando cambió la huella de las reglas (diccionario editado)', () => {
    const result = plan({
      fields: withTitle,
      titleRules: rules,
      existing: existing({ title: 'Acrilico g2 010 plateado x50 cc', metadata: stamped({ zeus_title_rules_v: '1:deadbeef' }) }),
    });
    assert.equal(result.status, 'updated');
    assert.equal(result.product_update?.title, NORMALIZED);
    assert.equal(
      (result.response_payload.title_rules as Record<string, unknown>).reason,
      'rules_changed'
    );
  });

  it('no escribe cuando el título guardado ya es el normalizado', () => {
    const result = plan({
      fields: withTitle,
      titleRules: rules,
      existing: existing({ title: NORMALIZED, metadata: stamped() }),
    });
    assert.equal(result.status, 'skipped');
    assert.equal(result.product_update, undefined);
  });

  it('sin `title` en la allowlist no toca el título ni estampa la metadata', () => {
    const result = plan({ titleRules: rules });
    assert.equal(result.status, 'skipped');
    assert.equal(result.product_update, undefined);
    assert.equal(result.variant_update, undefined);
  });

  it('el alta normaliza SIEMPRE, aunque `title` no esté en la allowlist', () => {
    const result = plan({ existing: undefined, createProducts: true, titleRules: rules });
    assert.equal(result.status, 'created');
    assert.equal(result.create?.title, NORMALIZED);
    assert.equal(result.create?.metadata.zeus_source_title, row().title);
    assert.equal(result.create?.metadata.zeus_title_rules_v, fingerprint);
  });

  it('el alta lleva la presentación para el valor de la opción de variante', () => {
    const result = plan({ existing: undefined, createProducts: true, titleRules: rules });
    assert.equal(result.create?.presentation, '50 cc');
  });

  it('un artículo sin presentación en el título deja la opción en null', () => {
    const result = plan({
      row: row({ title: 'EQ ARTE - PINCEL PLANO N 10' }),
      existing: undefined,
      createProducts: true,
      titleRules: rules,
    });
    assert.equal(result.create?.title, 'Pincel plano N.º 10');
    assert.equal(result.create?.presentation, null);
  });

  it('deja los warnings asentados incluso cuando no reescribe (R15)', () => {
    // `esc` (escalones) no es una unidad: el título se normaliza igual y el
    // warning queda asentado para que alguien lo mire.
    const raw = 'EQ ARTE - ESCALERA MADERA PINTOR X 5 ESC';
    const result = plan({
      fields: withTitle,
      titleRules: rules,
      row: row({ title: raw }),
      existing: existing({
        title: 'Escalera madera pintor x5 esc',
        metadata: stamped({ zeus_source_title: raw }),
      }),
    });
    const detail = result.response_payload.title_rules as { warnings?: string[]; written?: boolean };
    assert.equal(detail.written, false);
    assert.match(detail.warnings?.[0] ?? '', /Unidad desconocida/);
  });
});

describe('planProductMetadata — marca y familia a nivel PRODUCTO', () => {
  const metadataPlan = (over: Partial<Parameters<typeof planProductMetadata>[0]> = {}) =>
    planProductMetadata({ row: row(), current: null, fields: DEFAULT_PRODUCT_FIELDS, ...over });

  it('escribe marca, familia y el código crudo de categoría', () => {
    const patch = metadataPlan()!;
    // La marca va CRUDA: es un nombre propio con casing de marca.
    assert.equal(patch.brand, 'EQ ARTE');
    // La familia va NORMALIZADA (DESDEELSUR-48): es el filtro del PLP.
    assert.equal(patch.family, 'Artística acrílicos');
    assert.equal(patch.erp_category_code, '020B');
  });

  it('devuelve null cuando no hay nada que cambiar', () => {
    const patch = metadataPlan({
      current: { brand: 'EQ ARTE', family: 'Artística acrílicos', erp_category_code: '020B' },
    });
    assert.equal(patch, null);
  });

  it('reescribe una familia que quedó guardada en crudo', () => {
    // El caso de desdeelsur al momento del fix: 2716 productos con la familia
    // gritada. El diff existe justamente para que el barrido las corrija.
    const patch = metadataPlan({
      current: { brand: 'EQ ARTE', family: 'ARTISTICA ACRILICOS', erp_category_code: '020B' },
    })!;
    assert.equal(patch.family, 'Artística acrílicos');
  });

  it('preserva las claves que no son del ERP', () => {
    const patch = metadataPlan({ current: { hidden_from_store: true, ranking: 5 } })!;
    assert.equal(patch.hidden_from_store, true);
    assert.equal(patch.ranking, 5);
    assert.equal(patch.family, 'Artística acrílicos');
  });

  it('respeta la allowlist: sin `family` no escribe la familia', () => {
    const fields = DEFAULT_PRODUCT_FIELDS.filter((f) => f !== 'family');
    const patch = metadataPlan({ fields })!;
    assert.equal('family' in patch, false);
    assert.equal(patch.brand, 'EQ ARTE');
  });

  it('un valor vacío en el ERP no borra el que ya está guardado', () => {
    const patch = metadataPlan({
      row: row({ brand: null, family: null }),
      current: { brand: 'EQ ARTE', family: 'Artística acrílicos', erp_category_code: '020B' },
    });
    assert.equal(patch, null);
  });

  it('normaliza el código de categoría a mayúsculas', () => {
    const patch = metadataPlan({ row: row({ category_code: '020b' }) })!;
    assert.equal(patch.erp_category_code, '020B');
  });
});

describe('planProductUpdate — descripción (DESDEELSUR-34)', () => {
  const titleRules = resolveTitleRules(null);
  const cruda = 'LATEX 3X MAS LAVABLE QUE LOS NORMALES. ES ADEMAS ANTIMARCA Y ANTIMANCHA.';
  const normalizada = 'Látex 3X más lavable que los normales. Es además antimarca y antimancha.';

  it('normaliza el volcado crudo que dejó el propio sync', () => {
    const result = plan({
      row: row({ description: cruda }),
      existing: existing({ description: cruda }),
      titleRules,
    });
    assert.equal(result.product_update?.description, normalizada);
    assert.equal(
      (result.response_payload.description_rules as Record<string, unknown>).reason,
      'never_normalized'
    );
  });

  it('NO toca un texto redactado por el catalogador', () => {
    // El caso peligroso: 37 productos de desdeelsur tienen texto bueno y ninguno
    // tiene `zeus_source_description`, igual que los 363 con el volcado crudo.
    const redactada = 'El acrílico G2 de EQ Arte es una pintura decorativa de alta calidad.';
    const result = plan({
      row: row({ description: cruda }),
      existing: existing({ description: redactada }),
      titleRules,
    });
    assert.equal(result.product_update?.description, undefined);
    assert.equal(result.response_payload.description_rules, undefined);
  });

  it('NO rellena una descripción que alguien vació a propósito', () => {
    const result = plan({
      row: row({ description: cruda }),
      existing: existing({ description: null }),
      titleRules,
    });
    assert.equal(result.product_update?.description, undefined);
  });

  it('deja el rastro que hace idempotente la corrida siguiente', () => {
    const first = plan({
      row: row({ description: cruda }),
      existing: existing({ description: cruda }),
      titleRules,
    });
    const metadata = first.variant_update?.metadata as Record<string, unknown>;
    assert.equal(metadata.zeus_source_description, cruda);

    const second = plan({
      row: row({ description: cruda }),
      existing: existing({ description: normalizada, metadata: { ...metadata } }),
      titleRules,
    });
    assert.equal(second.product_update?.description, undefined);
  });

  it('recalcula cuando la gestión cambia el texto de origen', () => {
    const result = plan({
      row: row({ description: 'ANTIHONGOS PARA BAÑOS Y COCINAS' }),
      existing: existing({
        description: normalizada,
        metadata: { zeus_source_description: cruda, zeus_description_rules_v: 'd1:viejo' },
      }),
      titleRules,
    });
    assert.equal(result.product_update?.description, 'Antihongos para baños y cocinas');
    assert.equal(
      (result.response_payload.description_rules as Record<string, unknown>).reason,
      'source_changed'
    );
  });

  it('vacía el campo cuando el ERP sólo mandaba un código y una categoría', () => {
    const result = plan({
      row: row({ description: '871  ESMALTE BRILLANTE' }),
      existing: existing({ description: '871  ESMALTE BRILLANTE' }),
      titleRules,
    });
    assert.equal(result.product_update?.description, null);
    assert.equal(
      (result.response_payload.description_rules as Record<string, unknown>).discarded,
      'fragmento'
    );
  });

  it('con la normalización apagada vuelve al comportamiento histórico', () => {
    const conAllowlist = [...DEFAULT_PRODUCT_FIELDS, 'description'] as ErpProductField[];
    const result = plan({
      row: row({ description: cruda }),
      existing: existing({ description: 'otra cosa' }),
      fields: conAllowlist,
      titleRules: null,
    });
    assert.equal(result.product_update?.description, cruda);
  });

  it('un alta entra con la descripción ya normalizada', () => {
    const result = plan({
      row: row({ description: cruda }),
      existing: undefined,
      createProducts: true,
      titleRules,
    });
    assert.equal(result.status, 'created');
    assert.equal(result.create?.description, normalizada);
    assert.equal(result.create?.metadata.zeus_source_description, cruda);
    assert.equal(
      result.create?.metadata.zeus_description_rules_v,
      `d1:${titleRulesFingerprint(titleRules)}`
    );
  });
});
