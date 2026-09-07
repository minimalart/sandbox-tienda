import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildSortBy, STOCK_PRIORITY } from "./sort.ts";
import type { SortOption } from "../types.ts";

// Debe cubrir todo el union de SortOption; el tipado explícito hace que agregar
// una variante sin sumarla acá rompa la compilación del test.
const ALL_SORT_OPTIONS: SortOption[] = [
  "relevance", "price_asc", "price_desc", "created_at", "ranking",
];

describe("buildSortBy", () => {
  it("nunca supera los 3 sort fields que permite Typesense", () => {
    // Tope duro del motor: un cuarto campo es un 400. La rama `relevance` ya está
    // en el límite, así que el próximo desempate que alguien agregue rompe prod.
    // Este test es ese guardarraíl.
    for (const option of [...ALL_SORT_OPTIONS, undefined]) {
      const sortBy = buildSortBy(option);
      // Se cuentan las comas de tope, no las de `_text_match(buckets: 8)` ni las de
      // `(missing_values: last)`, que van dentro de paréntesis.
      const fields = sortBy.replace(/\([^)]*\)/g, "").split(",");
      assert.ok(
        fields.length <= 3,
        `${String(option)} produjo ${fields.length} sort fields: ${sortBy}`,
      );
    }
  });

  it("prioriza stock en toda variante", () => {
    for (const option of [...ALL_SORT_OPTIONS, undefined]) {
      assert.ok(buildSortBy(option).startsWith(STOCK_PRIORITY));
    }
  });

  it("no cuantiza el text match — buckets anularía la escalera de pesos", () => {
    // El efecto de los pesos de query_by vive DENTRO del text match score.
    // Cuantizarlo en escalones empata productos que la escalera separó a propósito
    // y el desempate pasa a `metadata.ranking`, así que un match por CATEGORÍA
    // (peso 25) puede ganarle a uno por TÍTULO (peso 100).
    //
    // Medido sobre 5041 productos reales, top-6: sin buckets 30/30 resultados
    // matchean por título; con buckets 28/30, y un match sólo-por-categoría se
    // cuela delante de uno por título en 2 de 2 casos comprobables.
    assert.doesNotMatch(buildSortBy("relevance"), /buckets/);
  });

  it("ranquea por text match sólo en `relevance`", () => {
    assert.match(buildSortBy("relevance"), /_text_match/);
    for (const option of ALL_SORT_OPTIONS.filter((o) => o !== "relevance")) {
      assert.doesNotMatch(buildSortBy(option), /_text_match/);
    }
  });
});
