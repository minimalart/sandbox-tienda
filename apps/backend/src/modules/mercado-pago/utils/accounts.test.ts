import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseMpAccounts, resolveMpAccount, type MpAccount } from './accounts';

/**
 * MercadoPago son DOS providers —Checkout Pro (`mercado-pago`) y Checkout API
 * (`mercado-pago-api`)— que comparten este resolvedor de cuentas. Migrar uno solo
 * deja la mitad del checkout cobrando en la cuenta equivocada, y del lado del
 * comprador no se nota: el pago se aprueba igual. La plata aparece en otro titular.
 *
 * Por eso la mitad de este archivo verifica la PRECEDENCIA y la otra mitad verifica
 * que los dos providers sigan de acuerdo.
 */

const FALLBACK: MpAccount = { accessToken: 'GLOBAL' };

const ACCOUNTS = parseMpAccounts(
  JSON.stringify({
    ESCOBAR: { accessToken: 'BRANCH' },
    demo_norte: { accessToken: 'SITE_BY_ID' },
    sur: { accessToken: 'SITE_BY_SLUG' },
    sc_legacy: { accessToken: 'BY_CHANNEL' },
  }),
);

test('la precedencia es sucursal → tienda → canal → global', () => {
  const at = (opts: Parameters<typeof resolveMpAccount>[2]) =>
    resolveMpAccount(ACCOUNTS, FALLBACK, opts).accessToken;

  // La sucursal es lo más específico: gana incluso si la tienda tiene cuenta.
  assert.equal(at({ branchCode: 'escobar', siteId: 'demo_norte' }), 'BRANCH');
  assert.equal(at({ siteId: 'demo_norte', salesChannelId: 'sc_legacy' }), 'SITE_BY_ID');
  assert.equal(at({ siteSlug: 'sur', salesChannelId: 'sc_legacy' }), 'SITE_BY_SLUG');
  assert.equal(at({ salesChannelId: 'sc_legacy' }), 'BY_CHANNEL');
  assert.equal(at({ salesChannelId: 'sc_desconocido' }), 'GLOBAL');
  assert.equal(at({}), 'GLOBAL');
});

test('una tienda B2B necesita UNA entrada, no dos', () => {
  // El motivo por el que la tienda va ANTES que el canal. Una tienda con b2b_enabled
  // tiene dos sales channels; keyeando por canal habría que duplicar las mismas
  // credenciales, y el día que alguien actualice una sola, retail y mayorista
  // empiezan a cobrar en cuentas distintas sin ningún error.
  const b2b = { siteId: 'demo_norte' };
  assert.equal(
    resolveMpAccount(ACCOUNTS, FALLBACK, { ...b2b, salesChannelId: 'sc_retail' }).accessToken,
    resolveMpAccount(ACCOUNTS, FALLBACK, { ...b2b, salesChannelId: 'sc_mayorista' }).accessToken,
  );
});

test('un mapa malformado se comporta como single-tenant, no explota', () => {
  // Está sobre el camino del cobro: un JSON mal pegado en una variable de entorno no
  // puede dejar la tienda sin poder cobrar.
  assert.equal(parseMpAccounts('{no es json').size, 0);
  assert.equal(parseMpAccounts(undefined).size, 0);
  // Una entrada sin accessToken se descarta en vez de producir un cliente sin token.
  assert.equal(parseMpAccounts(JSON.stringify({ X: { publicKey: 'p' } })).size, 0);
});

// ── Los dos providers, de acuerdo ────────────────────────────────────────────────

const MODULES = join(import.meta.dirname, '..', '..');
const PROVIDERS = [
  { file: join(MODULES, 'mercado-pago', 'service.ts'), label: 'Checkout Pro' },
  { file: join(MODULES, 'mercado-pago-api', 'service.ts'), label: 'Checkout API' },
];

for (const provider of PROVIDERS) {
  const src = readFileSync(provider.file, 'utf8');

  test(`${provider.label}: resuelve la cuenta con la tienda, no sólo con el canal`, () => {
    assert.match(src, /siteId: \(data\?\.site_id as string \| undefined\) \?\? null/);
    assert.match(src, /siteSlug: \(data\?\.site_slug as string \| undefined\) \?\? null/);
  });

  test(`${provider.label}: estampa la tienda en la data de la sesión`, () => {
    // Sin esto, authorize/capture/refund vuelven a resolver la cuenta SIN la tienda
    // y caen al fallback global: se devolvería plata desde la cuenta equivocada.
    assert.match(src, /site_id/);
    assert.match(src, /site_slug/);
  });
}

test('el resolvedor de cuentas es UNO SOLO para los dos providers', () => {
  // Si alguien copia `resolveMpAccount` al segundo provider para "desacoplarlos",
  // los dos se desincronizan en silencio. Checkout API tiene que importarlo del
  // primero, no tener el suyo.
  const api = readFileSync(PROVIDERS[1]!.file, 'utf8');
  assert.match(api, /from '\.\.\/mercado-pago\/utils\/accounts'/);
  assert.doesNotMatch(api, /export function resolveMpAccount/);
});
