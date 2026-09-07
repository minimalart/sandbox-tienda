import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { fetchJson } from './http';
import { ACTIVE_SITE_STORAGE_KEY, SITE_ID_HEADER, __resetPinnedForTests } from './active-site';

const g = globalThis as Record<string, any>;
let calls: Array<{ url: string; init: RequestInit }> = [];

function stubFetch(response: { ok: boolean; body?: unknown; statusText?: string }) {
  g.fetch = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return {
      ok: response.ok,
      statusText: response.statusText ?? 'Error',
      json: async () => response.body ?? {},
    };
  };
}

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  } as unknown as Storage;
}

const headersOf = (i: number) => calls[i]!.init.headers as Record<string, string>;

beforeEach(() => {
  calls = [];
  __resetPinnedForTests();
  g.localStorage = fakeStorage();
  g.location = { search: '', reload: () => {} };
});

test('sin tienda activa NO manda el header', () => {
  // Los PRs 1-3 tienen que poder mergearse antes que el selector: mientras no haya
  // tienda elegida, todo esto es un no-op observable.
  stubFetch({ ok: true, body: { ok: 1 } });
  return fetchJson('/admin/brands').then(() => {
    assert.equal(headersOf(0)[SITE_ID_HEADER], undefined);
  });
});

test('con tienda activa el header viaja', async () => {
  g.localStorage.setItem(ACTIVE_SITE_STORAGE_KEY, 'demo_norte');
  stubFetch({ ok: true, body: {} });
  await fetchJson('/admin/brands');
  assert.equal(headersOf(0)[SITE_ID_HEADER], 'demo_norte');
});

test('siempre manda credentials: include', async () => {
  // Dos de las 22 copias lo traían y el resto no. Es correcto en todas, y su
  // ausencia rompe las que sí lo necesitan.
  stubFetch({ ok: true, body: {} });
  await fetchJson('/admin/brands');
  assert.equal(calls[0]!.init.credentials, 'include');
});

test('los headers del caller ganan sobre los default', async () => {
  // Alguna llamada manda su propio Content-Type para subir archivos; pisarlo desde
  // el helper rompería esos uploads.
  stubFetch({ ok: true, body: {} });
  await fetchJson('/admin/media', { headers: { 'Content-Type': 'multipart/form-data' } });
  assert.equal(headersOf(0)['Content-Type'], 'multipart/form-data');
});

test('preserva el init del caller (method, body)', async () => {
  stubFetch({ ok: true, body: {} });
  await fetchJson('/admin/brands', { method: 'POST', body: '{"a":1}' });
  assert.equal(calls[0]!.init.method, 'POST');
  assert.equal(calls[0]!.init.body, '{"a":1}');
});

test('un error con mensaje conserva el mensaje del cuerpo', async () => {
  // Es la semántica que replican las 22 copias: perderla cambiaría los toasts de
  // medio admin por un "Bad Request" genérico.
  stubFetch({ ok: false, body: { message: 'La marca ya existe' }, statusText: 'Bad Request' });
  await assert.rejects(() => fetchJson('/admin/brands'), /La marca ya existe/);
});

test('un error sin cuerpo cae al statusText', async () => {
  g.fetch = async () => ({
    ok: false,
    statusText: 'Not Found',
    json: async () => { throw new Error('no body'); },
  });
  await assert.rejects(() => fetchJson('/admin/brands'), /Not Found/);
});
