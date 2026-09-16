import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPublicUrlFrom, formatPublicUrlFrom, SITE_PATH_PREFIX } from './lib';

/**
 * La URL pública de una tienda tiene que respetar su `canonical_form`.
 *
 * El incidente que motiva este test: al crear una tienda eligiendo SUBDOMINIO, el
 * listado igual mostraba y linkeaba `/{prefijo}/{slug}`. `buildPublicUrl` ignoraba
 * `canonical_form` por completo, y encima usaba el prefijo viejo `demo`, así que el
 * click se comía el 308 de `proxy.ts` hacia `/tienda/…`. Desde el navegador se veía
 * como "elegí subdominio y me redirige a ruta".
 *
 * Nada lo atrapaba: `apps/backend/src/admin` está excluido de `tsc` y no tenía ni un
 * test. Este es el primero bajo `src/admin` — el glob del runner
 * (`src/**\/*.test.ts`) ya lo alcanzaba, sólo que nadie lo había usado.
 *
 * Se testea el NÚCLEO PURO (`*From`), que recibe base y sufijo como argumentos: los
 * wrappers leen `import.meta.env`, que no existe fuera de Vite.
 */

const SUFFIX = '.mercatto.ar';
const BASE = 'https://mercatto.minimalart.studio';

describe('URL pública de una tienda', () => {
  it('la principal se sirve en la base, sin prefijo ni slug', () => {
    const main = { slug: 'principal', is_main: true, canonical_form: 'host' as const };
    assert.equal(buildPublicUrlFrom(main, { baseUrl: BASE, hostSuffix: SUFFIX }), BASE);
    assert.equal(formatPublicUrlFrom(main, { baseUrl: BASE, hostSuffix: SUFFIX }), '/');
  });

  it("canonical_form 'host' con sufijo configurado → subdominio", () => {
    const site = { slug: 'moda', canonical_form: 'host' as const };
    assert.equal(
      buildPublicUrlFrom(site, { baseUrl: BASE, hostSuffix: SUFFIX }),
      'https://moda.mercatto.ar',
    );
    assert.equal(
      formatPublicUrlFrom(site, { baseUrl: BASE, hostSuffix: SUFFIX }),
      'moda.mercatto.ar',
    );
  });

  it("canonical_form 'path' → ruta sobre el hub del sufijo", () => {
    const site = { slug: 'moda', canonical_form: 'path' as const };
    assert.equal(
      buildPublicUrlFrom(site, { baseUrl: BASE, hostSuffix: SUFFIX }),
      `https://mercatto.ar/${SITE_PATH_PREFIX}/moda`,
    );
    assert.equal(
      formatPublicUrlFrom(site, { baseUrl: BASE, hostSuffix: SUFFIX }),
      `/${SITE_PATH_PREFIX}/moda`,
    );
  });

  it("sin sufijo configurado cae a ruta aunque pida 'host'", () => {
    // Sin wildcard el subdominio NO resuelve: linkearlo sería un link muerto.
    const site = { slug: 'moda', canonical_form: 'host' as const };
    assert.equal(
      buildPublicUrlFrom(site, { baseUrl: BASE, hostSuffix: '' }),
      `${BASE}/${SITE_PATH_PREFIX}/moda`,
    );
    assert.equal(
      formatPublicUrlFrom(site, { baseUrl: BASE, hostSuffix: '   ' }),
      `/${SITE_PATH_PREFIX}/moda`,
    );
  });

  it("una fila sin canonical_form se lee como 'host' (el default de la columna)", () => {
    const site = { slug: 'moda' };
    assert.equal(
      buildPublicUrlFrom(site, { baseUrl: BASE, hostSuffix: SUFFIX }),
      'https://moda.mercatto.ar',
    );
    assert.equal(
      buildPublicUrlFrom({ slug: 'moda', canonical_form: null }, { baseUrl: BASE, hostSuffix: SUFFIX }),
      'https://moda.mercatto.ar',
    );
  });

  it('el sufijo se acepta con y sin punto inicial', () => {
    const site = { slug: 'moda', canonical_form: 'host' as const };
    for (const suffix of ['.mercatto.ar', 'mercatto.ar']) {
      assert.equal(
        buildPublicUrlFrom(site, { baseUrl: BASE, hostSuffix: suffix }),
        'https://moda.mercatto.ar',
        `falló con sufijo ${JSON.stringify(suffix)}`,
      );
    }
  });

  it('preserva protocolo y puerto de la base (es lo que hace testeable el local)', () => {
    // `*.localhost` resuelve a 127.0.0.1 en Chrome y Firefox sin tocar /etc/hosts,
    // así que este caso es la única forma de ejercitar subdominios en desarrollo.
    const site = { slug: 'moda', canonical_form: 'host' as const };
    assert.equal(
      buildPublicUrlFrom(site, { baseUrl: 'http://localhost:3000', hostSuffix: '.localhost' }),
      'http://moda.localhost:3000',
    );
  });

  it('tolera una base con slash final', () => {
    const site = { slug: 'moda', canonical_form: 'path' as const };
    assert.equal(
      buildPublicUrlFrom(site, { baseUrl: `${BASE}/`, hostSuffix: '' }),
      `${BASE}/${SITE_PATH_PREFIX}/moda`,
    );
  });

  it('el prefijo de ruta es el que sirve el proxy, no el legacy', () => {
    // `proxy.ts` sirve /tienda/<slug> y hace 308 desde /demo/<slug>: con el literal
    // viejo cada link del admin arrancaba con un redirect.
    assert.equal(SITE_PATH_PREFIX, 'tienda');
  });
});
