import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildQueryByFields, QUERY_BY_FIELDS } from "./query-by.ts";

/**
 * El schema REAL del backend, no un snapshot. Si alguien renombra o borra un campo
 * indexado, este test falla acá en vez de que el buscador entero devuelva 404 en
 * producción — que es exactamente lo que pasó con `fragrance.name`, un campo de
 * otro vertical que quedó en query_by escondido detrás de un gate que nunca se
 * cumplía.
 */
const SCHEMA_PATH = join(
  import.meta.dirname,
  "..","..","..","..","..","backend","src","modules","typesense","schema.ts",
);

function indexedSchemaFields(): Set<string> {
  const src = readFileSync(SCHEMA_PATH, "utf8");
  const fields = new Set<string>();
  // { name: 'x', type: 'string', facet: false, index: true, ... }
  for (const line of src.split("\n")) {
    const name = /name:\s*'([^']+)'/.exec(line)?.[1];
    if (!name) continue;
    if (!/index:\s*true/.test(line)) continue;
    fields.add(name);
  }
  return fields;
}

describe("buildQueryByFields", () => {
  it("deriva los cuatro params con el mismo largo", () => {
    // Typesense responde 400 ante desalineación. Derivarlos de una sola fuente
    // hace el bug imposible; este test lo deja probado.
    const { queryBy, weights, numTypos, prefix } = buildQueryByFields();
    const n = QUERY_BY_FIELDS.length;
    assert.equal(queryBy.split(",").length, n);
    assert.equal(weights.split(",").length, n);
    assert.equal(numTypos.split(",").length, n);
    assert.equal(prefix.split(",").length, n);
  });

  it("pone `title` primero y con el mayor peso", () => {
    assert.equal(QUERY_BY_FIELDS[0].field, "title");
    const maxWeight = Math.max(...QUERY_BY_FIELDS.map((f) => f.weight));
    assert.equal(QUERY_BY_FIELDS[0].weight, maxWeight);
  });

  it("no repite pesos — es LA razón por la que existe esta config", () => {
    // Con `text_match_type: max_score` los pesos son SÓLO desempate. Si dos campos
    // comparten peso, el desempate entre ellos es una constante y no ordena nada:
    // así es como "remera" empataba el producto titulado "Remera Oversize" con los
    // 200 productos de la categoría "Remeras". Pesos repetidos = regresión.
    const weights = QUERY_BY_FIELDS.map((f) => f.weight);
    assert.equal(new Set(weights).size, weights.length);
  });

  it("ordena los campos por peso descendente", () => {
    const weights = QUERY_BY_FIELDS.map((f) => f.weight);
    assert.deepEqual(weights, [...weights].sort((a, b) => b - a));
  });

  it("sólo consulta campos que el schema del backend indexa", () => {
    const indexed = indexedSchemaFields();
    assert.ok(indexed.size > 0, "no se pudo parsear el schema del backend");
    const missing = QUERY_BY_FIELDS.map((f) => f.field).filter((f) => !indexed.has(f));
    assert.deepEqual(missing, [], `campos ausentes del schema: ${missing.join(", ")}`);
  });

  it("no tolera typos en identificadores ni en la descripción", () => {
    const byField = new Map(QUERY_BY_FIELDS.map((f) => [f.field, f]));
    // SKU: un match fuzzy sobre cualquiera de los N SKUs de un producto le ganaría
    // a un match de título legítimo.
    assert.equal(byField.get("variants.sku")?.numTypos, 0);
    // description: bajo max_score una descripción larga acumula score por
    // solapamiento y le gana a un título; el peso bajo desempata pero no frena eso.
    assert.equal(byField.get("description")?.numTypos, 0);
    assert.equal(byField.get("description")?.prefix, false);
  });
});
