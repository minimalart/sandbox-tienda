import assert from "node:assert/strict";
import { test } from "node:test";
import { isLoopbackOrigin, preferPublicOrigin } from "./canonical-base";

/**
 * Regresión de un bug vivo en producción (DESDEELSUR-49).
 *
 * `NEXT_PUBLIC_BASE_URL` del storefront de desdeelsur quedó con la URL del BACKEND,
 * `http://localhost:9000`. El sitio siguió respondiendo 200 y nadie vio nada roto en
 * la UI, pero durante semanas publicó `<link rel="canonical" href="http://localhost:9000">`
 * en toda página, `robots.txt` y `sitemap.xml` apuntando a localhost, y las OG images
 * en un host que ningún crawler puede resolver.
 *
 * El caso 3 es el que importa: una base loopback NUNCA le puede ganar al host real por
 * el que llegó la request.
 */

test("isLoopbackOrigin: reconoce loopback en cualquier puerto y esquema", () => {
  for (const url of [
    "http://localhost:9000",
    "http://localhost:8000",
    "https://localhost:8000",
    "http://127.0.0.1:3000",
    "http://0.0.0.0:8000",
    "http://tienda.localhost:8000",
  ]) {
    assert.equal(isLoopbackOrigin(url), true, url);
  }
});

test("isLoopbackOrigin: un host público no es loopback", () => {
  for (const url of [
    "https://desdelsur.com.ar",
    "https://desdeelsur.minimalart.studio",
    // Contiene "localhost" como substring pero NO es el hostname: mirar el string
    // pelado en vez del hostname daría un falso positivo acá.
    "https://localhost.desdelsur.com.ar",
  ]) {
    assert.equal(isLoopbackOrigin(url), false, url);
  }
});

test("isLoopbackOrigin: un valor que no parsea no se declara local", () => {
  // No se puede afirmar que sea local, y "reparar" lo que no entendemos es peor que
  // dejarlo pasar: igual revienta más arriba, en el `new URL()` de `metadataBase`.
  assert.equal(isLoopbackOrigin("no-es-una-url"), false);
  assert.equal(isLoopbackOrigin(""), false);
});

test("caso 1 — base pública: se devuelve TAL CUAL, la request no la mueve", () => {
  // Es lo que mantiene el canonical estable cuando el sitio es alcanzable por varios
  // hosts, que es exactamente para lo que existe un canonical.
  assert.equal(
    preferPublicOrigin("https://desdelsur.com.ar", "https://preview-abc.vercel.app"),
    "https://desdelsur.com.ar"
  );
});

test("caso 2 — dev: base loopback y request loopback, gana la configurada", () => {
  // Quien desarrolla espera ver SU valor, y un request a otro puerto no tiene por qué
  // cambiarle las URLs.
  assert.equal(
    preferPublicOrigin("https://localhost:8000", "http://localhost:3000"),
    "https://localhost:8000"
  );
});

test("caso 3 — producción mal configurada: gana el host real de la request", () => {
  assert.equal(
    preferPublicOrigin("http://localhost:9000", "https://desdelsur.com.ar"),
    "https://desdelsur.com.ar"
  );
});

test("caso 3 — sin request resoluble se conserva la configurada", () => {
  // Build time / fuera de request scope: no hay host del que aprender, así que no hay
  // nada mejor que ofrecer. Devolver `''` acá rompería `new URL()` río arriba.
  assert.equal(
    preferPublicOrigin("http://localhost:9000", ""),
    "http://localhost:9000"
  );
});
