import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syncContactToBrevo } from './brevo.ts';
import type { NewsletterSettings } from './settings.ts';

const CONFIGURED: NewsletterSettings = {
  enabled: true,
  apiKey: 'xkeysib-test',
  listId: 2,
  apiUrl: 'https://api.brevo.com/v3',
};

type Call = { url: string; init: RequestInit };

/** `fetch` de mentira que registra la llamada y devuelve la respuesta pedida. */
function fetchStub(response: Response | (() => never)) {
  const calls: Call[] = [];
  const fn = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    if (typeof response === 'function') response();
    return response;
  }) as unknown as typeof globalThis.fetch;
  return { fn, calls };
}

const jsonResponse = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/* ── Los tres estados ────────────────────────────────────────────────────── */

test('201 de Brevo (contacto nuevo) es synced', async () => {
  const { fn } = fetchStub(jsonResponse(201, { id: 99 }));
  const result = await syncContactToBrevo(CONFIGURED, { email: 'a@b.com' }, { fetch: fn });
  assert.deepEqual(result, { status: 'synced', listId: 2 });
});

/**
 * 204 es el caso MÁS común en producción y el que se rompe si alguien saca
 * `updateEnabled`: el visitante que ya estaba en Brevo por otra vía.
 */
test('204 de Brevo (contacto que ya existía) también es synced', async () => {
  const { fn } = fetchStub(new Response(null, { status: 204 }));
  const result = await syncContactToBrevo(CONFIGURED, { email: 'a@b.com' }, { fetch: fn });
  assert.deepEqual(result, { status: 'synced', listId: 2 });
});

test('un error de Brevo es failed, con el code y el message adentro', async () => {
  const { fn } = fetchStub(
    jsonResponse(401, { code: 'unauthorized', message: 'Key not found' }),
  );
  const result = await syncContactToBrevo(CONFIGURED, { email: 'a@b.com' }, { fetch: fn });
  assert.equal(result.status, 'failed');
  assert.match((result as { error: string }).error, /unauthorized/);
  assert.match((result as { error: string }).error, /Key not found/);
});

test('un error sin JSON no rompe: cae al status HTTP', async () => {
  const { fn } = fetchStub(new Response('<html>502</html>', { status: 502 }));
  const result = await syncContactToBrevo(CONFIGURED, { email: 'a@b.com' }, { fetch: fn });
  assert.deepEqual(result, { status: 'failed', error: 'Brevo respondió HTTP 502.' });
});

test('un fallo de red es failed y no propaga la excepción', async () => {
  const { fn } = fetchStub(() => {
    throw new Error('ECONNREFUSED');
  });
  const result = await syncContactToBrevo(CONFIGURED, { email: 'a@b.com' }, { fetch: fn });
  assert.equal(result.status, 'failed');
  assert.match((result as { error: string }).error, /ECONNREFUSED/);
});

/* ── `skipped` no es `failed` ─────────────────────────────────────────────── */

/**
 * Los tres casos de `skipped` NO pueden llamar a Brevo. Es lo que impide el
 * escenario que este ticket destapó al revés: una tienda sin credenciales
 * mandando el contacto con la key que quedó en el entorno de otra.
 */
test('sin API key no se llama a Brevo y el estado es skipped', async () => {
  const { fn, calls } = fetchStub(jsonResponse(201));
  const result = await syncContactToBrevo(
    { ...CONFIGURED, apiKey: '' },
    { email: 'a@b.com' },
    { fetch: fn },
  );
  assert.equal(result.status, 'skipped');
  assert.equal(calls.length, 0);
});

test('sin ID de lista no se llama a Brevo y el estado es skipped', async () => {
  const { fn, calls } = fetchStub(jsonResponse(201));
  const result = await syncContactToBrevo(
    { ...CONFIGURED, listId: null },
    { email: 'a@b.com' },
    { fetch: fn },
  );
  assert.equal(result.status, 'skipped');
  assert.equal(calls.length, 0);
});

test('apagado en Ajustes no se llama a Brevo y el estado es skipped', async () => {
  const { fn, calls } = fetchStub(jsonResponse(201));
  const result = await syncContactToBrevo(
    { ...CONFIGURED, enabled: false },
    { email: 'a@b.com' },
    { fetch: fn },
  );
  assert.equal(result.status, 'skipped');
  assert.equal(calls.length, 0);
});

/* ── La forma de la llamada ───────────────────────────────────────────────── */

/**
 * Los cuatro puntos que el ticket pedía verificar, escritos como test: la key
 * en su header, la lista COMO NÚMERO, el email, y `updateEnabled`.
 */
test('la llamada lleva la API key, el email y listIds numérico con updateEnabled', async () => {
  const { fn, calls } = fetchStub(jsonResponse(201));
  await syncContactToBrevo(CONFIGURED, { email: 'lector@ejemplo.com' }, { fetch: fn });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.brevo.com/v3/contacts');
  assert.equal(calls[0].init.method, 'POST');

  const headers = calls[0].init.headers as Record<string, string>;
  assert.equal(headers['api-key'], 'xkeysib-test');

  const body = JSON.parse(calls[0].init.body as string);
  assert.equal(body.email, 'lector@ejemplo.com');
  assert.deepEqual(body.listIds, [2]);
  assert.equal(typeof body.listIds[0], 'number', 'listIds tiene que ser numérico: Brevo rechaza "2"');
  assert.equal(body.updateEnabled, true);
  assert.ok(!('attributes' in body), 'sin atributos no se manda la clave vacía');
});

test('una URL con barra final no produce una doble barra', async () => {
  const { fn, calls } = fetchStub(jsonResponse(201));
  await syncContactToBrevo(
    { ...CONFIGURED, apiUrl: 'https://api.brevo.com/v3/' },
    { email: 'a@b.com' },
    { fetch: fn },
  );
  assert.equal(calls[0].url, 'https://api.brevo.com/v3/contacts');
});

test('los atributos viajan cuando hay alguno', async () => {
  const { fn, calls } = fetchStub(jsonResponse(201));
  await syncContactToBrevo(
    CONFIGURED,
    { email: 'a@b.com', attributes: { NOMBRE: 'Ana' } },
    { fetch: fn },
  );
  const body = JSON.parse(calls[0].init.body as string);
  assert.deepEqual(body.attributes, { NOMBRE: 'Ana' });
});
