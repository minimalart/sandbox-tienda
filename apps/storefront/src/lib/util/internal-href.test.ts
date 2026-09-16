import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isExternalHref,
  ownHostsFromEnv,
  pointsToOwnHost,
  toInternalHref,
} from "./internal-href";

/**
 * Regresión de un bug vivo en producción (DESDEELSUR-61 / BUG-04, crítico).
 *
 * En el home de `desdelsur.com.ar` los CTAs de los banners y los bloques de
 * categorías ("Todo para tu hogar", "Todo para completar tu proyecto") estaban
 * guardados con URL absoluta al entorno de preview:
 * `https://desdeelsur.minimalart.studio/store?...`.
 *
 * `hero-banners` clasificaba como externo cualquier href que empezara con
 * "http", así que producción abría el preview en una pestaña nueva, y las tiles
 * hacían navegación de documento completo al otro dominio. El visitante salía del
 * sitio donde estaba comprando.
 *
 * Los datos guardados no se pueden dar por buenos: quien los escribe copia de la
 * barra del navegador. La contención tiene que estar en el render.
 */

const PROD = ["desdelsur.com.ar"];

test("BUG-04: el href absoluto al preview de la plataforma se vuelve interno", () => {
  const stored = "https://desdeelsur.minimalart.studio/store?familia=CINTAS";

  assert.equal(pointsToOwnHost(stored, PROD), true);
  assert.equal(isExternalHref(stored, PROD), false);
  assert.equal(toInternalHref(stored, PROD), "/store?familia=CINTAS");
});

test("BUG-04: sirve para cualquier tienda de la plataforma, no sólo desdeelsur", () => {
  // El preview es un hecho de la plataforma: no hace falta configurar nada por
  // tienda para que el mismo dato mal pegado se contenga en otra.
  assert.equal(
    toInternalHref("https://mercatto.minimalart.studio/store", []),
    "/store",
  );
  // También el apex, no sólo los subdominios.
  assert.equal(toInternalHref("https://minimalart.studio/store", []), "/store");
});

test("el propio dominio público también se reduce a path (así navega client-side)", () => {
  assert.equal(
    toInternalHref("https://desdelsur.com.ar/store?q=lijas#top", PROD),
    "/store?q=lijas#top",
  );
  // El puerto forma parte del host: mismo hostname y otro puerto NO es nuestro.
  assert.equal(pointsToOwnHost("https://desdelsur.com.ar:8443/store", PROD), false);
});

test("un externo de verdad se deja intacto y sigue siendo externo", () => {
  for (const href of [
    "https://www.instagram.com/desdeelsur",
    "https://wa.me/5492944000000",
    // Contiene el dominio de preview como substring pero NO es el host: mirar el
    // string pelado en vez del hostname daría un falso positivo y nos comeríamos
    // un link ajeno.
    "https://minimalart.studio.phishing.example/store",
  ]) {
    assert.equal(pointsToOwnHost(href, PROD), false, href);
    assert.equal(isExternalHref(href, PROD), true, href);
    assert.equal(toInternalHref(href, PROD), href, href);
  }
});

test("los relativos pasan sin tocarse y no son externos", () => {
  for (const href of ["/store", "/store?q=x", "#seccion", "", "///raro"]) {
    assert.equal(toInternalHref(href, PROD), href, href);
    assert.equal(isExternalHref(href, PROD), false, href);
  }
});

test("mailto/tel no son navegación web: se dejan y se marcan externos", () => {
  for (const href of ["mailto:hola@desdelsur.com.ar", "tel:+5492944000000"]) {
    assert.equal(toInternalHref(href, PROD), href, href);
    assert.equal(isExternalHref(href, PROD), true, href);
  }
});

test("una URL absoluta sin path devuelve '/' y nunca un href vacío", () => {
  // Un href "" recarga la página actual: sería un link que parece funcionar y no
  // lleva a ninguna parte.
  assert.equal(toInternalHref("https://desdeelsur.minimalart.studio", PROD), "/");
});

test("ownHostsFromEnv: la base pública entra, la loopback no", () => {
  assert.deepEqual(
    ownHostsFromEnv("https://desdelsur.com.ar"),
    ["desdelsur.com.ar"],
  );
  // El fallo que documenta `canonical-base`: NEXT_PUBLIC_BASE_URL quedó con la
  // URL del backend. Si lo tomáramos como host propio, cualquier link a
  // localhost pasaría a interno.
  assert.deepEqual(ownHostsFromEnv("http://localhost:9000"), []);
  assert.deepEqual(ownHostsFromEnv(undefined), []);
  assert.deepEqual(ownHostsFromEnv("no-es-una-url"), []);
});
