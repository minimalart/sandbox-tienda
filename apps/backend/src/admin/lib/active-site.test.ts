import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  getActiveSiteId,
  siteHeader,
  setActiveSite,
  getActiveSiteSnapshot,
  ACTIVE_SITE_STORAGE_KEY,
  SITE_ID_HEADER,
  __resetPinnedForTests,
} from './active-site';

/** localStorage de mentira: el runner del repo corre en Node, sin jsdom. */
function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: (i: number) => [...data.keys()][i] ?? null,
    get length() { return data.size; },
  } as unknown as Storage;
}

const g = globalThis as Record<string, any>;
let reloads = 0;

beforeEach(() => {
  reloads = 0;
  __resetPinnedForTests();
  g.localStorage = fakeStorage();
  g.location = { search: '', reload: () => { reloads += 1; } };
});

test('sin tienda elegida no hay id ni header', () => {
  assert.equal(getActiveSiteId(), null);
  // `{}` y NO `{'x-site-id': 'null'}`: el string "null" haría que el backend lo
  // tratara como una tienda inexistente y devolviera 400 en toda ruta migrada.
  assert.deepEqual(siteHeader(), {});
});

test('la tienda persistida se lee de localStorage', () => {
  g.localStorage.setItem(ACTIVE_SITE_STORAGE_KEY, 'demo_norte');
  assert.equal(getActiveSiteId(), 'demo_norte');
  assert.deepEqual(siteHeader(), { [SITE_ID_HEADER]: 'demo_norte' });
});

test('?site= gana sobre localStorage y pinnea la pestaña', () => {
  g.localStorage.setItem(ACTIVE_SITE_STORAGE_KEY, 'demo_sur');
  g.location.search = '?site=demo_norte';
  __resetPinnedForTests();
  assert.equal(getActiveSiteId(), 'demo_norte');
});

test('?site= vacío o en blanco se ignora', () => {
  g.localStorage.setItem(ACTIVE_SITE_STORAGE_KEY, 'demo_sur');
  g.location.search = '?site=%20';
  __resetPinnedForTests();
  assert.equal(getActiveSiteId(), 'demo_sur');
});

test('elegir una tienda persiste y RECARGA', () => {
  // La recarga es el mecanismo que impide guardar en la tienda equivocada desde un
  // formulario precargado. Si alguien la saca, este test se lo recuerda.
  setActiveSite({ id: 'demo_norte', slug: 'norte', name: 'Norte' });
  assert.equal(g.localStorage.getItem(ACTIVE_SITE_STORAGE_KEY), 'demo_norte');
  assert.equal(reloads, 1, 'cambiar de tienda tiene que recargar la página');
});

test('elegir "ninguna" limpia el storage y también recarga', () => {
  g.localStorage.setItem(ACTIVE_SITE_STORAGE_KEY, 'demo_norte');
  setActiveSite(null);
  assert.equal(g.localStorage.getItem(ACTIVE_SITE_STORAGE_KEY), null);
  assert.equal(reloads, 1);
});

test('el snapshot sólo se usa si coincide con la tienda activa', () => {
  setActiveSite({ id: 'demo_norte', slug: 'norte', name: 'Norte' });
  assert.deepEqual(getActiveSiteSnapshot(), { id: 'demo_norte', slug: 'norte', name: 'Norte' });

  // Tienda cambiada por fuera (otra pestaña): el snapshot viejo no debe pintarse.
  g.localStorage.setItem(ACTIVE_SITE_STORAGE_KEY, 'demo_sur');
  __resetPinnedForTests();
  assert.equal(getActiveSiteSnapshot(), null);
});

test('sin localStorage (modo privado) no tira', () => {
  g.localStorage = undefined;
  __resetPinnedForTests();
  assert.doesNotThrow(() => getActiveSiteId());
  assert.doesNotThrow(() => siteHeader());
  assert.doesNotThrow(() => setActiveSite('demo_norte'));
  assert.deepEqual(siteHeader(), {});
});

test('un snapshot corrupto no rompe el admin', () => {
  g.localStorage.setItem(ACTIVE_SITE_STORAGE_KEY, 'demo_norte');
  g.localStorage.setItem(`${ACTIVE_SITE_STORAGE_KEY}:snapshot`, '{no es json');
  assert.equal(getActiveSiteSnapshot(), null);
});
