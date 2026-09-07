import { test } from 'node:test';
import assert from 'node:assert/strict';
import { __resetSnapshot, replaceSnapshot } from './snapshot.ts';
import { isMercadoPagoCheckoutEnabled, readMercadoPagoSetting } from './mercadopago-runtime.ts';
import { parseMpAccounts, resolveMpAccount } from '../mercado-pago/utils/accounts.ts';

const row = (key: string, value: unknown) => ({
  namespace: 'extension:mercadopago',
  key,
  value,
  is_secret: false,
  ciphertext: null,
  updated_at: null,
  updated_by: null,
});

test('runtime checkout switches can disable new payments independently of bootstrap flags', () => {
  const old = process.env.MERCADOPAGO_ENABLED;
  process.env.MERCADOPAGO_ENABLED = 'true';
  try {
    replaceSnapshot([row('MERCADOPAGO_ENABLED', false), row('MERCADOPAGO_API_ENABLED', true)]);
    assert.equal(isMercadoPagoCheckoutEnabled(), false);
    assert.equal(isMercadoPagoCheckoutEnabled(true), true);
    replaceSnapshot([row('MERCADOPAGO_ENABLED', true), row('MERCADOPAGO_API_ENABLED', false)]);
    assert.equal(isMercadoPagoCheckoutEnabled(), true);
    assert.equal(isMercadoPagoCheckoutEnabled(true), false);
  } finally {
    __resetSnapshot();
    if (old === undefined) delete process.env.MERCADOPAGO_ENABLED;
    else process.env.MERCADOPAGO_ENABLED = old;
  }
});

test('saved account map preserves site routing after a credential change', () => {
  try {
    for (const token of ['fixture-token-before', 'fixture-token-after']) {
      replaceSnapshot([
        row(
          'MERCADOPAGO_ACCOUNTS',
          JSON.stringify({ site_norte: { accessToken: token, publicKey: 'fixture-public' } })
        ),
      ]);
      const map = parseMpAccounts(readMercadoPagoSetting('MERCADOPAGO_ACCOUNTS'));
      assert.equal(
        resolveMpAccount(map, { accessToken: 'fixture-global' }, { siteId: 'site_norte' })
          .accessToken,
        token
      );
      assert.equal(
        resolveMpAccount(map, { accessToken: 'fixture-global' }, { siteId: 'site_sur' })
          .accessToken,
        'fixture-global'
      );
    }
  } finally {
    __resetSnapshot();
  }
});
