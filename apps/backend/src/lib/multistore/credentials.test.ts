import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  encryptCredentials,
  decryptCredentials,
  readSiteCredentialsViaSql,
  SITE_CREDENTIAL_TABLE,
} from './credentials';
import type { SiteResolution, SiteRef } from './types';

const NORTE: SiteRef = {
  id: 'demo_norte', slug: 'norte', name: 'Norte', is_main: false,
  channel_ids: ['sc_norte'], region_id: null, stock_location_id: null,
};
const SITE: SiteResolution = { status: 'site', site: NORTE };
const ALL: SiteResolution = { status: 'allSites' };

const CREDS = { username: 'u', password: 'p', contract: 'c-123' };

function fakePg(rows: any[] = [], opts: { error?: unknown } = {}) {
  return {
    raw: async () => {
      if (opts.error) throw opts.error;
      return { rows };
    },
  };
}

test('ida y vuelta del cifrado', () => {
  const blob = encryptCredentials(CREDS);
  assert.deepEqual(decryptCredentials(blob), CREDS);
});

test('el blob NO contiene el secreto en claro', () => {
  const blob = encryptCredentials(CREDS);
  assert.doesNotMatch(blob, /password|c-123/, 'el ciphertext filtra el contenido');
  assert.match(blob, /^v1:/, 'falta el prefijo de versión: sin él no hay rotación de esquema');
});

test('dos cifrados del mismo valor dan blobs distintos (IV aleatorio)', () => {
  // Si el IV fuera fijo, dos tiendas con la misma contraseña producirían el mismo
  // ciphertext y eso ya filtra información.
  assert.notEqual(encryptCredentials(CREDS), encryptCredentials(CREDS));
});

test('un blob manipulado NO se descifra (autenticación GCM)', () => {
  const blob = encryptCredentials(CREDS);
  const parts = blob.split(':');
  const tampered = [parts[0], parts[1], parts[2], Buffer.from('otra cosa').toString('base64')].join(':');
  assert.throws(() => decryptCredentials(tampered));
});

test('un blob con formato inválido tira con mensaje claro', () => {
  assert.throws(() => decryptCredentials('no-es-un-blob'), /formato inválido/);
  assert.throws(() => decryptCredentials('v2:a:b:c'), /formato inválido/);
});

test('sin tienda activa cae al env', async () => {
  const r = await readSiteCredentialsViaSql(fakePg(), 'andreani', ALL, () => CREDS);
  assert.deepEqual(r, { status: 'found', source: 'env', value: CREDS });
});

test('con tienda y fila propia, gana la de la tienda', async () => {
  const rows = [{ credentials_enc: encryptCredentials({ username: 'norte' }) }];
  const r = await readSiteCredentialsViaSql(fakePg(rows), 'andreani', SITE, () => CREDS);
  assert.equal(r.status === 'found' && r.source, 'site');
  assert.deepEqual(r.status === 'found' && r.value, { username: 'norte' });
});

test('con tienda pero sin fila propia, cae al env', async () => {
  // Es lo que permite migrar sin romper: mientras una tienda no declare credenciales,
  // sigue usando las de entorno, que es el comportamiento de hoy.
  const r = await readSiteCredentialsViaSql(fakePg([]), 'andreani', SITE, () => CREDS);
  assert.equal(r.status === 'found' && r.source, 'env');
});

test('un blob ILEGIBLE no cae al env: falla', async () => {
  // El caso que más importa. Si la tienda declaró credenciales propias y no se
  // pueden descifrar (típicamente porque rotó JWT_SECRET), usar las de otra cuenta
  // sería facturar o despachar con la cuenta ajena. Vale más romper.
  const rows = [{ credentials_enc: 'v1:corrupto:corrupto:corrupto' }];
  const r = await readSiteCredentialsViaSql(fakePg(rows), 'andreani', SITE, () => CREDS);
  assert.deepEqual(r, { status: 'missing', reason: 'undecryptable' });
});

test('sin tabla todavía (42P01) cae al env, no explota', async () => {
  // La migración puede no haber corrido; el backend tiene que seguir despachando.
  const err = Object.assign(new Error('relation does not exist'), { code: '42P01' });
  const r = await readSiteCredentialsViaSql(fakePg([], { error: err }), 'andreani', SITE, () => CREDS);
  assert.equal(r.status === 'found' && r.source, 'env');
});

test('sin env fallback y sin fila, informa que falta', async () => {
  const r = await readSiteCredentialsViaSql(fakePg([]), 'andreani', SITE);
  assert.deepEqual(r, { status: 'missing', reason: 'no_row' });
});

test('las credenciales viven en su propia tabla, no en demo_store', () => {
  // Un SELECT de tiendas —que hacen el listado del admin y el manifest— nunca debe
  // arrastrar secretos aunque estén cifrados.
  assert.equal(SITE_CREDENTIAL_TABLE, 'site_credential');
});
