import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allocatePresentations, variantPresentation } from './variant-presentation';

test('new and queued legacy variants never expose the source identifier', () => {
  assert.equal(
    variantPresentation('168006', '168006', undefined, undefined, new Set()).presentation,
    'Único'
  );
  assert.equal(
    variantPresentation('500 g · 168006', '168006', undefined, undefined, new Set()).title,
    '500 g'
  );
});
test('legacy generated values are repaired without changing manual corrections', () => {
  const prior = { title: 'Old name · 168006', metadata: {} };
  assert.equal(
    variantPresentation('500 g', '168006', prior, '168006', new Set()).presentation,
    '500 g'
  );
  const manual = variantPresentation(
    '500 g',
    '168006',
    { ...prior, title: 'Edición local' },
    'Paquete familiar',
    new Set()
  );
  assert.equal(manual.title, 'Edición local');
  assert.equal(manual.presentation, 'Paquete familiar');
  assert.equal(manual.overrides.presentation, true);
});
test('source changes update owned fields and preserve edits made after import', () => {
  const prior = {
    title: '500 g',
    metadata: { catalog_imported_variant: { title: '500 g', presentation: '500 g' } },
  };
  assert.equal(
    variantPresentation('750 g', 'sku', prior, '500 g', new Set()).presentation,
    '750 g'
  );
  assert.equal(
    variantPresentation('750 g', 'sku', prior, 'Corrección', new Set()).presentation,
    'Corrección'
  );
  assert.equal(
    variantPresentation('750 g', 'sku', prior, '500 g', new Set(['presentation'])).presentation,
    '500 g'
  );
});
test('neutral ordinals keep duplicate SKUs distinct and stable across reordered updates', () => {
  const fresh = () => ({ presentation: 'Único', preservePresentation: false });
  assert.deepEqual(allocatePresentations([fresh(), fresh(), fresh()]), [
    'Único',
    'Único (2)',
    'Único (3)',
  ]);
  assert.deepEqual(
    allocatePresentations([
      { ...fresh(), previous: 'Único (2)', previousImported: 'Único (2)' },
      { ...fresh(), previous: 'Único', previousImported: 'Único' },
      fresh(),
    ]),
    ['Único (2)', 'Único', 'Único (3)']
  );
  assert.deepEqual(allocatePresentations([fresh()], ['Único']), ['Único (2)']);
});
test('manual values win over incoming duplicate labels', () => {
  assert.deepEqual(
    allocatePresentations([
      { presentation: 'Grande', preservePresentation: false },
      { presentation: 'Grande', preservePresentation: true },
    ]),
    ['Grande (2)', 'Grande']
  );
});

test('protected commercial presentation does not retain a legacy technical option or title suffix', () => {
  const display = variantPresentation(
    'Etiqueta origen',
    '168006',
    {
      title: 'Etiqueta anterior · 168006',
      metadata: { catalog_commercial: { presentation: { label: 'Etiqueta manual' } } },
    },
    '168006',
    new Set(['presentation', 'title'])
  );
  assert.equal(display.presentation, 'Etiqueta manual');
  assert.equal(display.title, 'Etiqueta anterior');
});
