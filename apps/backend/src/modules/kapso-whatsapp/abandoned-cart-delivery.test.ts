import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
const ts = createRequire(import.meta.url)('typescript');
const source = ts.transpileModule(
  readFileSync(new URL('./abandoned-cart-delivery.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
).outputText;

function fixture(
  values: Record<string, unknown>,
  credentials: any = { status: 'missing', reason: 'no_row' }
) {
  const scopes: string[] = [];
  const resolution = { status: 'site', site: { id: 'store-b', is_main: false } };
  const adapters: Record<string, unknown> = {
    '../app-settings/read-via-pg': {
      async readSettingsViaPg(namespace: string, _pg: unknown, site: any) {
        assert.equal(namespace, 'extension:whatsapp');
        scopes.push(site.site.id);
        return values;
      },
    },
    '../../lib/multistore/resolve-site-sql': {
      async resolveSiteViaSql(_pg: unknown, hint: any) {
        assert.equal(hint.salesChannelId, 'b-wholesale');
        return resolution;
      },
    },
    '../../lib/multistore/credentials': {
      async readSiteCredentialsViaSql(_pg: unknown, integration: string, site: any) {
        assert.equal(integration, 'kapso');
        scopes.push(site.site.id);
        return credentials;
      },
    },
  };
  const exports: any = {};
  runInNewContext(source, {
    exports,
    require(name: string) {
      if (!(name in adapters)) throw new Error(name);
      return adapters[name];
    },
  });
  return {
    scopes,
    run: () =>
      exports.abandonedCartDelivery(
        {},
        {
          sales_channel_id: 'b-wholesale',
          cart_abandoned_template_name: 'approved_b',
          customer_name: 'Test',
          total: '10',
          recovery_url: 'https://b.test/cart',
        }
      ),
  };
}

test('recovery uses the selected template, sender, language and credentials of the cart store', async () => {
  const f = fixture(
    {
      KAPSO_PHONE_NUMBER_ID: 'phone-instance',
      KAPSO_TEMPLATE_LANG: 'es_AR',
      KAPSO_API_KEY: 'ignored',
    },
    { status: 'found', source: 'site', value: { apiKey: 'key-b', phoneNumberId: 'phone-b' } }
  );
  const delivery = await f.run();
  assert.deepEqual(f.scopes, ['store-b', 'store-b']);
  assert.equal(delivery.apiKey, 'key-b');
  assert.equal(delivery.phoneNumberId, 'phone-b');
  assert.equal(delivery.template.name, 'approved_b');
  assert.equal(delivery.template.language.code, 'es_AR');
  assert.deepEqual(
    Array.from(delivery.template.components[0].parameters, (p: any) => p.text),
    ['Test', '10', 'https://b.test/cart']
  );
});

/**
 * El 401 de desdeelsur (22/09): la tienda tenía API key propia y el número salía
 * de los ajustes de la instancia. Kapso contesta `Invalid credentials for
 * WhatsApp configuration` porque la key no tiene acceso a ESE número, y la orden
 * se confirma igual — sin confirmación por WhatsApp y sin nada visible en el
 * admin. La key y el número son una sola credencial: se toman los dos, o ninguno.
 */
test('a store key without its own sender uses the instance pair whole, never mixed', async () => {
  const f = fixture(
    {
      KAPSO_API_KEY: 'key-instance',
      KAPSO_PHONE_NUMBER_ID: 'phone-instance',
      KAPSO_TEMPLATE_LANG: 'es',
    },
    { status: 'found', source: 'site', value: { apiKey: 'key-b' } }
  );
  const delivery = await f.run();
  assert.equal(delivery.apiKey, 'key-instance');
  assert.equal(delivery.phoneNumberId, 'phone-instance');
});

test('missing secondary credentials cannot use global sender options', async () => {
  await assert.rejects(
    () => fixture({ KAPSO_PHONE_NUMBER_ID: 'phone-b', KAPSO_TEMPLATE_LANG: 'es' }).run(),
    /Configure WhatsApp/
  );
});

test('undecryptable credentials cannot fall back to a different account', async () => {
  await assert.rejects(
    () =>
      fixture(
        { KAPSO_API_KEY: 'fallback', KAPSO_PHONE_NUMBER_ID: 'phone-b', KAPSO_TEMPLATE_LANG: 'es' },
        { status: 'missing', reason: 'undecryptable' }
      ).run(),
    /decrypt/
  );
});
