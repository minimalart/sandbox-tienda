import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  allowedTypos,
  boundedDamerauLevenshtein,
  matchesWithTypos,
  tokenMatchesWithTypos,
} from "./fuzzy-match.ts";

describe("boundedDamerauLevenshtein", () => {
  it("cuenta una transposición como UN error", () => {
    // Dos teclas invertidas es el typo de tipeo más común. Levenshtein a secas lo
    // contaría como 2 y quedaría fuera del presupuesto de un token corto.
    assert.equal(boundedDamerauLevenshtein("verdea", "verdae", 2), 1);
    assert.equal(boundedDamerauLevenshtein("mañnaa", "mañana", 2), 1);
    // Sin transposición sería 2 (dos sustituciones), y con un token de 6 letras
    // —presupuesto de 1— quedaría afuera.
    assert.equal(boundedDamerauLevenshtein("azlu", "azul", 1), 1);
  });

  it("cuenta inserciones, borrados y sustituciones", () => {
    assert.equal(boundedDamerauLevenshtein("manzna", "manzana", 2), 1); // inserción
    assert.equal(boundedDamerauLevenshtein("manzanaa", "manzana", 2), 1); // borrado
    assert.equal(boundedDamerauLevenshtein("manzena", "manzana", 2), 1); // sustitución
  });

  it("es 0 para strings iguales", () => {
    assert.equal(boundedDamerauLevenshtein("manzana", "manzana", 2), 0);
  });

  it("corta apenas supera el máximo en vez de calcular la distancia real", () => {
    // El contrato es "≤ max o algo mayor que max", no la distancia exacta.
    assert.ok(boundedDamerauLevenshtein("manzana", "bordo", 1) > 1);
    assert.ok(boundedDamerauLevenshtein("a", "zzzzzzzzzz", 2) > 2);
  });
});

describe("allowedTypos", () => {
  it("escala el presupuesto de typos con el largo del token", () => {
    // Los umbrales (4 y 7) están tomados de los defaults min_len_1typo y
    // min_len_2typo de Typesense: es una escala ya calibrada para búsqueda de
    // catálogo, no un número inventado.
    assert.equal(allowedTypos(3), 0);
    assert.equal(allowedTypos(4), 1);
    assert.equal(allowedTypos(6), 1);
    assert.equal(allowedTypos(7), 2);
    assert.equal(allowedTypos(12), 2);
  });

  it("no tolera typos en tokens de 1 a 3 caracteres", () => {
    // Con 3 letras una edición cambia el término entero, y en una carta de colores
    // eso significa devolver un color que no es el que se pidió.
    for (const n of [1, 2, 3]) assert.equal(allowedTypos(n), 0);
  });
});

describe("tokenMatchesWithTypos", () => {
  it("matchea un typo contra cualquier palabra del candidato", () => {
    assert.ok(tokenMatchesWithTypos("manzna", "verde manzana 30gy 55/402"));
    assert.ok(tokenMatchesWithTypos("mañna", "rocio de la mañana 51yy"));
  });

  it("matchea contra el prefijo de una palabra más larga", () => {
    assert.ok(tokenMatchesWithTypos("manzna", "manzanas verdes"));
  });

  it("no matchea candidatos distintos", () => {
    assert.ok(!tokenMatchesWithTypos("verde", "bordo profundo"));
    assert.ok(!tokenMatchesWithTypos("azul", "amarillo limon"));
  });

  it("no matchea nada con tokens demasiado cortos", () => {
    assert.ok(!tokenMatchesWithTypos("azl", "azul profundo"));
  });

  it("acepta un token corto que coincide LITERAL, sin presupuesto de typos", () => {
    // Regresión: `allowedTypos` da 0 para tokens de 1 a 3 caracteres, y la función
    // los descartaba de entrada sin mirar si coincidían. Eso hundía cualquier
    // consulta con artículos: "rocio de la mañana" fallaba por "de" y "la".
    assert.ok(tokenMatchesWithTypos("de", "rocio de la mañana"));
    assert.ok(tokenMatchesWithTypos("la", "rocio de la mañana"));
    assert.ok(tokenMatchesWithTypos("51", "51yy 61/792"));
  });
});

describe("matchesWithTypos", () => {
  it("tolera un typo en un nombre de color", () => {
    assert.ok(matchesWithTypos("rocio de la mañna", "rocio de la mañana 51yy 61/792"));
    assert.ok(matchesWithTypos("verde manzna", "verde manzana 30gy 55/402"));
  });

  it("tolera un typo en un código transcripto del abanico", () => {
    // El caso que motiva todo esto: el cliente copia el código a mano.
    assert.ok(matchesWithTypos("61/793", "rocio de la mañana 51yy 61/792"));
    assert.ok(matchesWithTypos("51yy 61/792", "rocio de la mañana 51yy 61/792"));
  });

  it("exige que TODOS los tokens se expliquen", () => {
    // Si alguien escribe dos palabras y sólo una matchea, el resultado no es lo
    // que buscaba.
    assert.ok(!matchesWithTypos("verde profundo", "verde manzana 30gy 55/402"));
  });

  it("no matchea colores distintos", () => {
    assert.ok(!matchesWithTypos("azul", "verde manzana 30gy 55/402"));
    assert.ok(!matchesWithTypos("bordo", "rocio de la mañana 51yy 61/792"));
  });

  it("no matchea nada con una query vacía", () => {
    assert.ok(!matchesWithTypos("", "verde manzana"));
    assert.ok(!matchesWithTypos("   ", "verde manzana"));
  });

  it("acepta el match exacto — el fallback nunca contradice al literal", () => {
    assert.ok(matchesWithTypos("verde", "verde manzana 30gy 55/402"));
  });
});
