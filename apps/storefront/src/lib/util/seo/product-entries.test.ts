import assert from "node:assert/strict";
import { test } from "node:test";
import { seoPageOffsets, toSeoProduct } from "./product-entries";

/**
 * Regresión de DESDEELSUR-50.
 *
 * El sitemap de desdeelsur publicaba 12 URLs y CERO de sus 2.696 productos, con 200 OK
 * y sin un solo log. La causa de fondo está documentada en `listProductsForSeo()`; acá
 * se fijan las dos piezas puras de las que depende que el catálogo entero entre.
 */

test("seoPageOffsets: el catálogo real de desdeelsur entra en 6 páginas", () => {
  // 2.696 productos en páginas de 500. Con el esquema anterior —100 por página y
  // pidiendo precios— eran 27 requests de ~1,5 s: ~40 s contra un presupuesto de 30 s,
  // o sea un sitemap PARCIAL incluso con la región resuelta.
  assert.deepEqual(seoPageOffsets(2696, 500, 20_000), [0, 500, 1000, 1500, 2000, 2500]);
});

test("seoPageOffsets: un count múltiplo exacto no pide una página vacía de más", () => {
  assert.deepEqual(seoPageOffsets(1000, 500, 20_000), [0, 500]);
});

test("seoPageOffsets: menos productos que una página es una sola página", () => {
  assert.deepEqual(seoPageOffsets(1, 500, 20_000), [0]);
  assert.deepEqual(seoPageOffsets(500, 500, 20_000), [0]);
});

test("seoPageOffsets: el techo duro acota los offsets", () => {
  // El tope existe para que un `count` mal devuelto por el backend no dispare cientos
  // de requests.
  assert.deepEqual(seoPageOffsets(1_000_000, 500, 1500), [0, 500, 1000]);
});

test("seoPageOffsets: un count degenerado devuelve la primera página y nada más", () => {
  // `[0]` y no `[]`: el llamador YA trajo esa página, y devolver `[]` haría que un
  // catálogo de 0 y uno con `count` roto se vieran igual río arriba.
  for (const count of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(seoPageOffsets(count, 500, 20_000), [0], String(count));
  }
  assert.deepEqual(seoPageOffsets(2696, 0, 20_000), [0]);
});

test("toSeoProduct: mapea los campos que el sitemap y llms.txt consumen", () => {
  assert.deepEqual(
    toSeoProduct({
      handle: "010-50",
      title: "Acrílico Decorativo Plateado",
      subtitle: "50cc",
      updated_at: "2026-09-01T10:00:00.000Z",
    }),
    {
      handle: "010-50",
      title: "Acrílico Decorativo Plateado",
      subtitle: "50cc",
      updatedAt: "2026-09-01T10:00:00.000Z",
    }
  );
});

test("toSeoProduct: sin handle no hay URL, así que no se publica", () => {
  assert.equal(toSeoProduct({ title: "Sin handle" }), null);
  assert.equal(toSeoProduct({ handle: "" }), null);
  assert.equal(toSeoProduct(null), null);
  assert.equal(toSeoProduct(undefined), null);
});

test("toSeoProduct: un producto oculto no se publica (su PDP ya es 404)", () => {
  // Medusa lo guarda como booleano y Typesense como el string "true": las dos formas
  // cuentan, igual que en `isHiddenFromStore`.
  assert.equal(toSeoProduct({ handle: "regalo", metadata: { hidden_from_store: true } }), null);
  assert.equal(toSeoProduct({ handle: "regalo", metadata: { hidden_from_store: "true" } }), null);
});

test("toSeoProduct: metadata sin la marca no oculta nada", () => {
  const product = toSeoProduct({ handle: "visible", metadata: { otra_cosa: true } });
  assert.equal(product?.handle, "visible");
});

test("toSeoProduct: los campos ausentes quedan en null, no en undefined", () => {
  // `lastModified` del sitemap distingue "no sé" de "vacío": un `undefined` suelto
  // termina en `new Date(undefined)` → Invalid Date, y eso invalida la entrada.
  assert.deepEqual(toSeoProduct({ handle: "pelado" }), {
    handle: "pelado",
    title: null,
    subtitle: null,
    updatedAt: null,
  });
});
