import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  isReservedSlug,
  RESERVED_SLUGS,
  SLUG_MAX_LENGTH,
  SLUG_MIN_LENGTH,
  SLUG_PATTERN,
} from './reserved-slugs.ts';
import { MAIN_STORE_SLUG } from './main-store.ts';

/**
 * El slug es la identidad pública de una tienda, en las dos formas:
 * `/tienda/<slug>` y `<slug>.<sufijo>`. Un slug mal aceptado no se puede corregir
 * después: renombrarlo rompe URLs indexadas y links compartidos, y bajo subdominios
 * es PEOR que un 404 — el host viejo pasa a "desconocido" y sirve 200 con el
 * contenido del sitio principal.
 */

describe('patrón de slug', () => {
  it('acepta minúsculas, números y guiones simples', () => {
    for (const ok of ['moda', 'tienda-linda', 'a1b2', 'x-y-z', 'tec2024']) {
      assert.ok(SLUG_PATTERN.test(ok), `${ok} debería ser válido`);
    }
  });

  it('rechaza mayúsculas, espacios, guiones dobles y guiones al borde', () => {
    for (const bad of ['Moda', 'tienda linda', 'a--b', '-moda', 'moda-', 'moda_linda']) {
      assert.equal(SLUG_PATTERN.test(bad), false, `${bad} debería ser inválido`);
    }
  });

  it('rechaza puntos: crearían un label extra que el wildcard NO cubre', () => {
    // `*.ejemplo.com` cubre `moda.ejemplo.com` pero NO `a.b.ejemplo.com`: falla en
    // TLS antes de llegar a nuestro código.
    assert.equal(SLUG_PATTERN.test('a.b'), false);
    assert.equal(SLUG_PATTERN.test('moda.tienda'), false);
  });
});

describe('largo mínimo 3', () => {
  it('el mínimo es 3, no 1', () => {
    assert.equal(SLUG_MIN_LENGTH, 3);
  });

  it('un slug de 2 letras choca con el prefijo legacy de país y con el strip', () => {
    // `/ar/...` sigue redirigiendo en el proxy, y `stripSitePrefix` come el primer
    // segmento de 2 letras. Un slug `bo` rompería el highlighting de links en
    // silencio. El patrón lo acepta; lo que lo rechaza es el largo.
    assert.ok(SLUG_PATTERN.test('bo'));
    assert.ok('bo'.length < SLUG_MIN_LENGTH, 'un slug de 2 tiene que quedar fuera por largo');
  });

  it('el máximo es 40 (cabe en un label de DNS, que admite 63)', () => {
    assert.equal(SLUG_MAX_LENGTH, 40);
    assert.ok(SLUG_MAX_LENGTH < 63);
  });
});

describe('lista reservada', () => {
  it('el slug de la fila principal está reservado', () => {
    assert.ok(isReservedSlug(MAIN_STORE_SLUG));
    assert.ok(isReservedSlug('main'));
  });

  it('reserva los segmentos ruteables que taparían una página del storefront', () => {
    for (const seg of ['store', 'cart', 'checkout', 'account', 'products', 'blog', 'sucursales']) {
      assert.ok(isReservedSlug(seg), `${seg} es una página del storefront`);
    }
  });

  it('reserva las DOS formas del prefijo: la nueva y la legacy', () => {
    // `/demo/<slug>` sobrevive con un 308 permanente, así que `demo` tampoco puede
    // ser un slug.
    assert.ok(isReservedSlug('tienda'));
    // El plural no es ruteable, pero se reserva igual para no tener que ampliar la
    // lista después (ampliarla con tiendas vivas es breaking).
    assert.ok(isReservedSlug('tiendas'));
    assert.ok(isReservedSlug('demo'));
  });

  it('reserva los subdominios de infraestructura', () => {
    for (const sub of ['www', 'api', 'admin', 'staging', 'mail', 'cdn']) {
      assert.ok(isReservedSlug(sub), `${sub} es un subdominio de infra`);
    }
  });

  it('es case-insensitive', () => {
    assert.ok(isReservedSlug('STORE'));
    assert.ok(isReservedSlug('Www'));
  });

  it('no reserva nombres razonables de tienda', () => {
    for (const ok of ['moda', 'tecnologia', 'la-tiendita', 'deportes']) {
      assert.equal(isReservedSlug(ok), false, `${ok} debería estar disponible`);
    }
  });

  it('todas las entradas son minúsculas: isReservedSlug normaliza a lower', () => {
    for (const s of RESERVED_SLUGS) {
      assert.equal(s, s.toLowerCase(), `"${s}" tiene mayúsculas y nunca matchearía`);
    }
  });
});

/**
 * Esta lista está DUPLICADA en el storefront
 * (`apps/storefront/src/lib/site-config/reserved-segments.ts`) a propósito:
 * `apps/backend` no puede depender en runtime de nada fuera de `apps/backend/` (no
 * declara deps `@repo/*` y su tsconfig no tiene `paths`; DigitalOcean corre `npm ci`
 * adentro de esta carpeta).
 *
 * El precio de la duplicación es el drift, y el drift acá es asimétrico y peligroso:
 * si el backend ACEPTA un slug que el storefront tiene reservado, se crea una tienda
 * cuya URL nunca va a resolver a su contenido. Este test es el que paga ese precio.
 */
describe('espejo con el storefront', () => {
  const MIRROR = join(
    import.meta.dirname,
    '..', '..', '..', '..',
    'storefront', 'src', 'lib', 'site-config', 'reserved-segments.ts',
  );

  /** Extrae los literales de un `export const NAME … = [ … ]`. */
  function block(src: string, name: string): string[] {
    const match = new RegExp(`${name}\\b.*?=\\s*\\[(.*?)\\n\\]`, 's').exec(src);
    assert.ok(match, `no encontré el bloque ${name} en el espejo`);
    return [...match[1]!.matchAll(/'([^']+)'/g)].map((m) => m[1]!);
  }

  it('los tres bloques son idénticos en las dos apps', () => {
    if (!existsSync(MIRROR)) return; // backend desplegado solo: nada que cruzar
    const src = readFileSync(MIRROR, 'utf8');

    for (const name of ['ROUTABLE_SEGMENTS', 'RESERVED_SUBDOMAINS', 'RESERVED_MAIN']) {
      const mirror = block(src, name).sort();
      // Del lado del backend están concatenados en RESERVED_SLUGS, así que se compara
      // por inclusión bloque a bloque: todo lo del storefront tiene que estar acá.
      const faltan = mirror.filter((s) => !RESERVED_SLUGS.has(s));
      assert.deepEqual(
        faltan,
        [],
        `El storefront reserva ${faltan.join(', ')} en ${name} y el backend NO. ` +
          `Se podría CREAR una tienda con ese slug cuya URL nunca resolvería a su ` +
          `contenido. Sincronizá reserved-slugs.ts.`,
      );
    }
  });

  it('el backend no reserva MENOS de lo que el storefront espera', () => {
    if (!existsSync(MIRROR)) return;
    const src = readFileSync(MIRROR, 'utf8');
    const todos = new Set([
      ...block(src, 'ROUTABLE_SEGMENTS'),
      ...block(src, 'RESERVED_SUBDOMAINS'),
      ...block(src, 'RESERVED_MAIN'),
    ]);
    assert.equal(
      todos.size,
      RESERVED_SLUGS.size,
      `El espejo tiene ${todos.size} entradas y el backend ${RESERVED_SLUGS.size}. ` +
        `Reservar de MÁS en el backend es inocuo, pero de menos deja crear tiendas ` +
        `inalcanzables. Revisá la diferencia.`,
    );
  });
});
