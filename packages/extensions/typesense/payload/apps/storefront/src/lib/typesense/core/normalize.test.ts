import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeSearchQuery, removeDiacritics } from "./normalize.ts";

describe("removeDiacritics", () => {
  it("aplana acentos del español", () => {
    assert.equal(removeDiacritics("Rocío"), "Rocio");
    assert.equal(removeDiacritics("jabón líquido"), "jabon liquido");
    assert.equal(removeDiacritics("Ñandú"), "Nandu");
  });

  it("es idempotente y no toca texto sin acentos", () => {
    assert.equal(removeDiacritics("remera"), "remera");
    assert.equal(removeDiacritics(removeDiacritics("Rocío")), "Rocio");
  });
});

describe("normalizeSearchQuery", () => {
  it("preserva el comodín y las queries vacías", () => {
    assert.equal(normalizeSearchQuery("*"), "*");
    assert.equal(normalizeSearchQuery(""), "");
  });

  /**
   * Estos casos existen para que la singularización heurística NO VUELVA.
   * Estaba rota de dos formas:
   *
   *   1. Su regla de "consonante + es → cortar 2" era inalcanzable: toda palabra
   *      terminada en "es" tiene una "e" (vocal) antes de la "s", así que la regla
   *      de "vocal + s → cortar 1" la interceptaba siempre. Los ejemplos que el
   *      propio comentario del código prometía nunca funcionaron.
   *   2. Su regla de "vocal + s" mordía palabras que no son plurales.
   *
   * Si alguien la reintroduce, estos asserts fallan.
   */
  it("no mutila plurales en -ones/-eles/-ales (la regla inalcanzable)", () => {
    for (const word of ["jabones", "papeles", "aerosoles", "pinceles", "delantales"]) {
      assert.equal(normalizeSearchQuery(word), word);
    }
  });

  it("no mutila palabras que terminan en s sin ser plurales", () => {
    for (const word of ["adidas", "crisis", "gratis", "ingles", "analisis", "paraguas"]) {
      assert.equal(normalizeSearchQuery(word), word);
    }
  });

  it("deja los plurales intactos — los resuelven los sinónimos del servidor", () => {
    assert.equal(normalizeSearchQuery("remeras"), "remeras");
    assert.equal(normalizeSearchQuery("aceites"), "aceites");
  });

  it("normaliza acentos en queries multi-palabra", () => {
    assert.equal(normalizeSearchQuery("jabón para pisós"), "jabon para pisos");
  });
});
