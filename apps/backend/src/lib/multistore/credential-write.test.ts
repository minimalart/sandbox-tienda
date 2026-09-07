import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  decryptCredentials,
  deleteSiteCredentialsViaSql,
  encryptCredentials,
  listSiteCredentialsViaSql,
  mergeCredentialValues,
  sanitizeCredentialBag,
  writeSiteCredentialsViaSql,
} from './credentials';

/**
 * La escritura de credenciales por tienda.
 *
 * La tabla `site_credential` vivió con cinco lectores y cero escritores: la única
 * forma de cargar una credencial era un INSERT a mano. Estos tests fijan las dos
 * reglas que hacen que la contraparte de escritura no sea peor que el INSERT:
 *
 *   MERGE, no reemplazo — guardar `{ apiKey }` no puede borrar `{ baseUrl }`.
 *   Borrar es explícito y por NOMBRE — "mandar vacío" jamás borra.
 *
 * Sin DB: `fakePg` graba las queries y devuelve filas de mentira. Lo que se prueba
 * es la LÓGICA (qué se mergea, qué se ignora, cuándo se escribe), no el driver.
 */

// ── el merge, que es la parte pura ───────────────────────────────────────────

test('merge: una clave nueva no pisa las que ya estaban', () => {
  // La lección de erp/service.ts:255-259. Guardar sólo el apiKey borraba el resto
  // del blob, así que rotar una credencial dejaba al provider a medio configurar.
  const r = mergeCredentialValues(
    { apiKey: 'viejo', baseUrl: 'https://api.kapso.ai' },
    { set: { apiKey: 'nuevo' } },
  );
  assert.deepEqual(r.next, { apiKey: 'nuevo', baseUrl: 'https://api.kapso.ai' });
  assert.deepEqual(r.written, ['apiKey']);
  assert.equal(r.changed, true);
});

test('merge: un string vacío se IGNORA, no borra', () => {
  // Es el campo enmascarado que la UI muestra sin tocar. Si vaciar borrara, abrir
  // la pantalla y apretar Guardar dejaría a la tienda sin credenciales.
  const r = mergeCredentialValues(
    { apiKey: 'secreto', baseUrl: 'https://x' },
    { set: { apiKey: '', baseUrl: '   ' } },
  );
  assert.deepEqual(r.next, { apiKey: 'secreto', baseUrl: 'https://x' });
  assert.deepEqual(r.ignored.sort(), ['apiKey', 'baseUrl']);
  assert.equal(r.changed, false);
});

test('merge: un no-string tampoco borra ni se guarda', () => {
  const r = mergeCredentialValues({ apiKey: 'secreto' }, { set: { apiKey: null as never } });
  assert.deepEqual(r.next, { apiKey: 'secreto' });
  assert.deepEqual(r.ignored, ['apiKey']);
});

test('merge: borrar es por NOMBRE de clave y sólo por ahí', () => {
  const r = mergeCredentialValues(
    { username: 'u', password: 'p', contract: 'c' },
    { unset: ['password'] },
  );
  assert.deepEqual(r.next, { username: 'u', contract: 'c' });
  assert.deepEqual(r.removed, ['password']);
  assert.equal(r.changed, true);
});

test('merge: borrar una clave inexistente no es un cambio', () => {
  const r = mergeCredentialValues({ username: 'u' }, { unset: ['password'] });
  assert.deepEqual(r.removed, []);
  assert.equal(r.changed, false);
});

test('merge: guardar el MISMO valor no cuenta como cambio', () => {
  // Si contara, cada Guardar re-cifraría con un IV nuevo y `updated_at` mentiría
  // sobre cuándo se rotó de verdad la credencial.
  const r = mergeCredentialValues({ apiKey: 'igual' }, { set: { apiKey: 'igual' } });
  assert.equal(r.changed, false);
  assert.deepEqual(r.written, []);
});

test('merge: los valores se recortan', () => {
  // Un espacio invisible en un token da un 401 que nadie puede diagnosticar desde
  // la UI, porque el valor no se muestra nunca.
  const r = mergeCredentialValues({}, { set: { apiKey: '  abc  ' } });
  assert.deepEqual(r.next, { apiKey: 'abc' });
});

test('merge: si una clave viene en set y en unset, gana unset', () => {
  // La ruta rechaza esa combinación con 400, pero la función tiene que ser
  // determinista igual: la intención destructiva es la explícita.
  const r = mergeCredentialValues({}, { set: { apiKey: 'x' }, unset: ['apiKey'] });
  assert.deepEqual(r.next, {});
  assert.deepEqual(r.written, []);
});

test('merge: descarta valores no-string del blob guardado en vez de explotar', () => {
  // Un blob cargado a mano puede tener un número. Perder ESA clave es mejor que
  // dejar la pantalla de credenciales rota para la tienda entera.
  assert.deepEqual(sanitizeCredentialBag({ a: 'x', b: 3, c: { d: 1 } }), { a: 'x' });
  assert.deepEqual(sanitizeCredentialBag(null), {});
  assert.deepEqual(sanitizeCredentialBag(['a']), {});
});

// ── el round-trip de cifrado sobre el bag mergeado ───────────────────────────

test('lo que se guarda es exactamente lo que el provider lee', () => {
  const merged = mergeCredentialValues(
    { username: 'u', password: 'viejo' },
    { set: { password: 'nuevo', contract: '400000000' }, unset: ['username'] },
  );
  const blob = encryptCredentials(merged.next);
  assert.doesNotMatch(blob, /nuevo|400000000/, 'el ciphertext filtra el contenido');
  assert.deepEqual(decryptCredentials(blob), { password: 'nuevo', contract: '400000000' });
});

// ── la escritura contra la tabla ─────────────────────────────────────────────

type Call = { sql: string; bindings: unknown[] };

function fakePg(rows: any[] = []) {
  const calls: Call[] = [];
  return {
    calls,
    raw: async (sql: string, bindings: unknown[] = []) => {
      calls.push({ sql, bindings });
      // Sólo el SELECT inicial devuelve la fila existente; el resto son escrituras.
      if (/^\s*SELECT/i.test(sql)) return { rows };
      if (/RETURNING/i.test(sql)) return { rows: rows.length ? [{ id: 'sitecred_1' }] : [] };
      return { rows: [] };
    },
  };
}

const row = (bag: Record<string, string>, id = 'sitecred_1') => ({
  id,
  credentials_enc: encryptCredentials(bag),
});

test('sin fila previa hace INSERT respetando el índice único PARCIAL', async () => {
  const pg = fakePg([]);
  const r = await writeSiteCredentialsViaSql(pg, 'kapso', 'demo_norte', {
    set: { apiKey: 'k-123' },
  });

  assert.equal(r.status, 'saved');
  const insert = pg.calls.find((c) => /INSERT INTO/i.test(c.sql))!;
  assert.ok(insert, 'no hizo INSERT');
  assert.match(
    insert.sql,
    /ON CONFLICT \("site_id", "integration"\) WHERE "deleted_at" IS NULL/,
    'sin repetir el predicado del índice parcial, Postgres no lo infiere y el INSERT ' +
      'concurrente rompe con 23505 en vez de resolver',
  );
});

test('con fila previa MERGEA y hace UPDATE, no INSERT', async () => {
  const pg = fakePg([row({ apiKey: 'viejo', baseUrl: 'https://api' })]);
  const r = await writeSiteCredentialsViaSql(pg, 'kapso', 'demo_norte', {
    set: { apiKey: 'nuevo' },
  });

  assert.equal(r.status, 'saved');
  assert.deepEqual(r.status === 'saved' && r.keys, ['apiKey', 'baseUrl']);
  assert.ok(!pg.calls.some((c) => /INSERT INTO/i.test(c.sql)), 'duplicó la fila en vez de mergear');

  const update = pg.calls.find((c) => /UPDATE/i.test(c.sql))!;
  const blob = update.bindings[0] as string;
  assert.deepEqual(decryptCredentials(blob), { apiKey: 'nuevo', baseUrl: 'https://api' });
});

test('un patch que no cambia nada NO re-escribe', async () => {
  const pg = fakePg([row({ apiKey: 'igual' })]);
  const r = await writeSiteCredentialsViaSql(pg, 'kapso', 'demo_norte', {
    set: { apiKey: 'igual', baseUrl: '' },
  });

  assert.equal(r.status, 'unchanged');
  assert.equal(pg.calls.length, 1, 'escribió aunque no había nada que cambiar');
});

test('borrar la ÚLTIMA clave borra la fila: la tienda vuelve a heredar del entorno', async () => {
  // Una fila con `{}` sería lo mismo que no tenerla, pero opaco: el operador vería
  // "tiene credenciales propias" mientras el provider usa las de entorno.
  const pg = fakePg([row({ apiKey: 'x' })]);
  const r = await writeSiteCredentialsViaSql(pg, 'kapso', 'demo_norte', { unset: ['apiKey'] });

  assert.equal(r.status, 'cleared');
  const del = pg.calls.find((c) => /deleted_at" = now\(\)/i.test(c.sql))!;
  assert.ok(del, 'no hizo el soft-delete');
});

test('un blob ILEGIBLE corta el guardado en vez de mergear sobre vacío', async () => {
  // Mergear sobre `{}` guardaría prolijamente sólo la clave nueva y perdería en
  // silencio las otras. Son irrecuperables igual, pero el operador tiene que
  // enterarse: si no, se va creyendo que la integración quedó completa.
  const pg = fakePg([{ id: 'sitecred_1', credentials_enc: 'v1:roto:roto:roto' }]);
  const r = await writeSiteCredentialsViaSql(pg, 'andreani', 'demo_norte', {
    set: { password: 'nueva' },
  });

  assert.deepEqual(r, { status: 'undecryptable' });
  assert.equal(pg.calls.length, 1, 'escribió encima de un blob que no pudo leer');
});

test('con replace_undecryptable explícito sí reemplaza el blob ilegible', async () => {
  const pg = fakePg([{ id: 'sitecred_1', credentials_enc: 'v1:roto:roto:roto' }]);
  const r = await writeSiteCredentialsViaSql(
    pg,
    'andreani',
    'demo_norte',
    { set: { password: 'nueva' } },
    { onUndecryptable: 'replace' },
  );

  assert.equal(r.status, 'saved');
  const update = pg.calls.find((c) => /UPDATE/i.test(c.sql))!;
  assert.deepEqual(decryptCredentials(update.bindings[0] as string), { password: 'nueva' });
});

test('el borrado explícito es soft y filtra por (site_id, integration) vivo', async () => {
  const pg = fakePg([row({ apiKey: 'x' })]);
  const ok = await deleteSiteCredentialsViaSql(pg, 'kapso', 'demo_norte');

  assert.equal(ok, true);
  const [call] = pg.calls;
  assert.match(call!.sql, /"deleted_at" = now\(\)/);
  assert.match(call!.sql, /"deleted_at" IS NULL/, 'podría re-borrar una fila ya borrada');
  assert.deepEqual(call!.bindings, ['demo_norte', 'kapso']);
});

test('el listado devuelve NOMBRES de claves, nunca valores', async () => {
  const pg = {
    raw: async () => ({
      rows: [
        {
          integration: 'andreani',
          credentials_enc: encryptCredentials({ username: 'u', password: 'secreto' }),
          updated_at: '2026-08-07T00:00:00.000Z',
        },
      ],
    }),
  };
  const [entry] = await listSiteCredentialsViaSql(pg, 'demo_norte');

  assert.deepEqual(entry!.keys, ['password', 'username']);
  assert.equal(entry!.decryptable, true);
  assert.doesNotMatch(JSON.stringify(entry), /secreto/, 'el listado filtró un valor');
});

test('el listado marca decryptable=false en vez de tirar', async () => {
  // Con un blob ilegible el admin tiene que poder ABRIR la pantalla justamente para
  // re-cargar las credenciales. Tirar dejaría al operador sin la única salida.
  const pg = {
    raw: async () => ({
      rows: [{ integration: 'andreani', credentials_enc: 'v1:roto:roto:roto', updated_at: null }],
    }),
  };
  const [entry] = await listSiteCredentialsViaSql(pg, 'demo_norte');

  assert.equal(entry!.decryptable, false);
  assert.deepEqual(entry!.keys, []);
});

test('sin tabla todavía (42P01) el listado devuelve vacío, no explota', async () => {
  const err = Object.assign(new Error('relation does not exist'), { code: '42P01' });
  const pg = {
    raw: async () => {
      throw err;
    },
  };
  assert.deepEqual(await listSiteCredentialsViaSql(pg, 'demo_norte'), []);
});
