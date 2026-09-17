import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attachBundleOnlyChannels, buildBundleOnlyChannelMap } from './bundle-only-channels';

const row = (product_id: string, site_id: string, sales_mode = 'bundle_only') => ({
  product_id,
  site_id,
  sales_mode,
});

const sites = [
  { id: 'demo_a', sales_channel_id: 'sc_a' },
  { id: 'demo_b', sales_channel_id: 'sc_b' },
];

test('un producto oculto en una tienda indexa el canal de esa tienda', () => {
  const map = buildBundleOnlyChannelMap([row('prod_1', 'demo_a')], sites);
  assert.deepEqual(map.get('prod_1'), ['sc_a']);
});

test('oculto en dos tiendas indexa los dos canales', () => {
  const map = buildBundleOnlyChannelMap([row('prod_1', 'demo_a'), row('prod_1', 'demo_b')], sites);
  assert.deepEqual(map.get('prod_1')?.sort(), ['sc_a', 'sc_b']);
});

test('una tienda sin canal asignado no aporta nada', () => {
  const map = buildBundleOnlyChannelMap([row('prod_1', 'demo_sin_canal')], [
    ...sites,
    { id: 'demo_sin_canal', sales_channel_id: null },
  ]);
  assert.equal(map.size, 0);
});

test('un modo que no es bundle_only no esconde nada', () => {
  const map = buildBundleOnlyChannelMap(
    [row('prod_1', 'demo_a', 'standalone_and_bundle'), row('prod_2', 'demo_a', 'standalone')],
    sites,
  );
  assert.equal(map.size, 0);
});

test('sin filas, mapa vacío', () => {
  assert.equal(buildBundleOnlyChannelMap([], sites).size, 0);
});

test('attach deja el campo SIEMPRE, vacío incluido', () => {
  const products = [{ id: 'prod_1' }, { id: 'prod_2' }, {}] as Array<Record<string, unknown>>;
  attachBundleOnlyChannels(products, new Map([['prod_1', ['sc_a']]]));

  assert.deepEqual(products[0]!.bundle_only_channels, ['sc_a']);
  assert.deepEqual(products[1]!.bundle_only_channels, []);
  assert.deepEqual(products[2]!.bundle_only_channels, []);
});

test('el canal no se repite aunque la base traiga filas duplicadas', () => {
  const map = buildBundleOnlyChannelMap([row('prod_1', 'demo_a'), row('prod_1', 'demo_a')], sites);
  assert.deepEqual(map.get('prod_1'), ['sc_a']);
});
