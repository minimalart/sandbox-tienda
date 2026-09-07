import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Regresión de una FUGA DE CATÁLOGO ENTRE TIENDAS que estuvo viva en producción.
 *
 * `getCachedPromotionProducts` guarda en un objeto de `globalThis` —cache de PROCESO,
 * compartida por todas las requests de todas las tiendas— y se keyeaba sólo por
 * `backendUrl`. Como esa URL no llevaba el sales channel y la publishable key es una
 * sola para toda la instancia, la primera tienda que pedía promociones dejaba SU
 * catálogo cacheado para las demás durante 5 minutos.
 *
 * El archivo es `"use server"` y arrastra medio data layer al importarlo, así que se
 * verifica sobre el fuente. Es menos elegante que ejecutarlo, pero fija exactamente
 * las dos condiciones que hacían falta para que el bug existiera — y las fija donde
 * alguien las va a leer si intenta "simplificar" la key.
 */

const SOURCE = readFileSync(
  join(import.meta.dirname, "products.repository.ts"),
  "utf8",
);

test("la cache de promociones NO se keyea sólo por la URL", () => {
  assert.doesNotMatch(
    SOURCE,
    /cache\[backendUrl\]/,
    "Volvió la fuga: `cache[backendUrl]` ignora la tienda y comparte el catálogo " +
      "entre todas. La key tiene que incluir al menos la publishable key.",
  );
  assert.match(
    SOURCE,
    /const cacheKeyOf\s*=/,
    "Falta el helper de cache key: sin él, es cuestión de tiempo que alguien vuelva a keyear por URL.",
  );
});

test("la URL de promociones lleva el canal de la tienda activa", () => {
  // Sin esto el backend resuelve el canal desde la publishable key global y
  // devuelve el mismo catálogo para todas las tiendas, aunque la cache esté bien.
  assert.match(
    SOURCE,
    /getActiveSalesChannelId\(\)/,
    "El repositorio ya no resuelve el canal de la tienda activa.",
  );
  assert.match(
    SOURCE,
    /backendParams\.set\(\s*['"]sales_channel_id['"]/,
    "El canal activo ya no viaja en la query de /store/product-promotion.",
  );
});

test("lectura y escritura de la cache usan la MISMA key", () => {
  // Un fix a medias —leer por `cacheKey` y escribir por `backendUrl`— haría que la
  // cache nunca acierte: no habría fuga, pero tampoco cache, y nadie lo notaría
  // salvo por la latencia.
  const reads = SOURCE.match(/cache\[([A-Za-z]+)\]/g) ?? [];
  assert.ok(reads.length >= 2, "Se esperaban al menos una lectura y una escritura de la cache.");
  assert.equal(
    new Set(reads).size,
    1,
    `La cache se lee y se escribe con keys distintas: ${[...new Set(reads)].join(" vs ")}`,
  );
});
