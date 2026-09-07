import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  keywordsFromMetadata,
  META_DESCRIPTION_MIN_LENGTH,
  pickMetaDescription,
  productSeoFromMetadata,
} from "./product-metadata.ts";

const LONG = "x".repeat(META_DESCRIPTION_MIN_LENGTH);
const SHORT = "x".repeat(META_DESCRIPTION_MIN_LENGTH - 1);

describe("keywordsFromMetadata", () => {
  it("acepta array y string separada por comas", () => {
    // El backend guarda las dos formas: la IA puede devolver un array o un
    // string, y `enrichment.ts` sólo hace split cuando no es array.
    assert.deepEqual(keywordsFromMetadata({ keywords: ["a", "b"] }), ["a", "b"]);
    assert.deepEqual(keywordsFromMetadata({ keywords: "a, b ,c" }), [
      "a",
      "b",
      "c",
    ]);
  });

  it("acepta el array serializado en JSON", () => {
    assert.deepEqual(keywordsFromMetadata({ keywords: '["a","b"]' }), [
      "a",
      "b",
    ]);
  });

  it("descarta vacíos y duplicados sin importar la capitalización", () => {
    assert.deepEqual(keywordsFromMetadata({ keywords: "a, ,A ,b" }), ["a", "b"]);
  });

  it("devuelve vacío cuando no hay keywords o vienen con forma inesperada", () => {
    assert.deepEqual(keywordsFromMetadata(null), []);
    assert.deepEqual(keywordsFromMetadata({}), []);
    assert.deepEqual(keywordsFromMetadata({ keywords: { a: 1 } }), []);
  });
});

describe("productSeoFromMetadata", () => {
  it("lee los cuatro campos del catalogador", () => {
    const seo = productSeoFromMetadata({
      meta_title: " Título ",
      meta_description: "Desc",
      keywords: "a,b",
      alt_text: "Botella de 1 L sobre fondo blanco",
    });
    assert.equal(seo.metaTitle, "Título");
    assert.equal(seo.metaDescription, "Desc");
    assert.deepEqual(seo.keywords, ["a", "b"]);
    assert.equal(seo.altText, "Botella de 1 L sobre fondo blanco");
  });

  it("trata la string vacía / en blanco como ausente", () => {
    const seo = productSeoFromMetadata({ meta_title: "   ", alt_text: "" });
    assert.equal(seo.metaTitle, null);
    assert.equal(seo.altText, null);
  });

  it("ignora valores que no son string", () => {
    const seo = productSeoFromMetadata({ meta_title: 42, alt_text: ["a"] });
    assert.equal(seo.metaTitle, null);
    assert.equal(seo.altText, null);
  });
});

describe("pickMetaDescription", () => {
  it("prefiere el primer candidato que llega al mínimo", () => {
    assert.equal(pickMetaDescription([LONG, "otra"], "compuesta"), LONG);
    assert.equal(pickMetaDescription([SHORT, LONG], "compuesta"), LONG);
  });

  it("cae al fallback compuesto cuando ningún candidato llega al mínimo", () => {
    // El punto del piso de 70: un `meta_description` corto NO puede tirar abajo
    // la descripción compuesta, que siempre supera el mínimo.
    assert.equal(pickMetaDescription([SHORT, SHORT], "compuesta"), "compuesta");
    assert.equal(pickMetaDescription([null, undefined], "compuesta"), "compuesta");
  });
});
