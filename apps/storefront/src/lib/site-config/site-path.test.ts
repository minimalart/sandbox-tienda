import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { stripSitePrefix, withSitePrefix } from "./site-path.ts";

/**
 * Estos dos helpers los usan ~34 call sites. El round-trip
 * `strip(withPrefix(href)) === href` es lo que garantiza que el highlighting de links
 * y las pestañas activas sigan funcionando dentro de un sitio.
 */

describe("withSitePrefix", () => {
  it("prefixea un href interno", () => {
    assert.equal(withSitePrefix("/store", "/tienda/moda"), "/tienda/moda/store");
  });

  it("la home del sitio no queda con barra doble", () => {
    assert.equal(withSitePrefix("/", "/tienda/moda"), "/tienda/moda");
  });

  it("NO-OP con prefijo vacío — esto es todo el mecanismo de los subdominios", () => {
    // Bajo resolución por host el prefijo es '', así que los 34 call sites se vuelven
    // no-op sin tocar ninguno.
    assert.equal(withSitePrefix("/store", ""), "/store");
    assert.equal(withSitePrefix("/store", null), "/store");
    assert.equal(withSitePrefix("/store", undefined), "/store");
  });

  it("no toca hrefs externos ni anclas", () => {
    assert.equal(withSitePrefix("https://otro.com", "/tienda/moda"), "https://otro.com");
    assert.equal(withSitePrefix("#seccion", "/tienda/moda"), "#seccion");
    assert.equal(withSitePrefix("mailto:a@b.com", "/tienda/moda"), "mailto:a@b.com");
  });

  it("es idempotente: no duplica un prefijo ya presente", () => {
    assert.equal(
      withSitePrefix("/tienda/moda/store", "/tienda/moda"),
      "/tienda/moda/store",
    );
    assert.equal(withSitePrefix("/tienda/moda", "/tienda/moda"), "/tienda/moda");
  });

  it("NO confunde un sitio con otro que empiece igual", () => {
    // `/tienda/moda-premium` NO tiene el prefijo `/tienda/moda`: sin el chequeo de
    // la barra, el `startsWith` lo daría por prefijado y el link quedaría roto.
    assert.equal(
      withSitePrefix("/tienda/moda-premium/store", "/tienda/moda"),
      "/tienda/moda/tienda/moda-premium/store",
    );
  });
});

describe("stripSitePrefix", () => {
  it("saca el prefijo del sitio", () => {
    assert.equal(stripSitePrefix("/tienda/moda/store", "/tienda/moda"), "/store");
  });

  it("la home del sitio queda en '/'", () => {
    assert.equal(stripSitePrefix("/tienda/moda", "/tienda/moda"), "/");
  });

  it("saca la forma legacy aunque no se pase prefijo", () => {
    // Un link viejo que todavía no pasó por el 308.
    assert.equal(stripSitePrefix("/demo/moda/store"), "/store");
    assert.equal(stripSitePrefix("/tienda/moda/store"), "/store");
  });

  it("saca el prefijo de país exacto", () => {
    assert.equal(stripSitePrefix("/ar/store"), "/store");
    assert.equal(stripSitePrefix("/ar"), "/");
  });

  it("NO se come un primer segmento de 2 letras que no sea el país (el footgun viejo)", () => {
    // El regex viejo `/^\/[a-z]{2}(?=\/|$)/i` se comía CUALQUIER segmento de 2 letras.
    // Con un slug `bo`, `/bo/store` quedaba en `/store` y el highlighting se rompía.
    assert.equal(stripSitePrefix("/bo/store"), "/bo/store");
    assert.equal(stripSitePrefix("/l/abc123"), "/l/abc123");
    assert.equal(stripSitePrefix("/c/token"), "/c/token");
  });

  it("saca país Y prefijo juntos", () => {
    assert.equal(stripSitePrefix("/ar/tienda/moda/store", "/tienda/moda"), "/store");
  });

  it("sin prefijo alguno, devuelve el path tal cual", () => {
    assert.equal(stripSitePrefix("/store"), "/store");
    assert.equal(stripSitePrefix("/"), "/");
  });
});

describe("round-trip", () => {
  const cases = ["/", "/store", "/cart", "/account/orders", "/products/zapato-negro"];

  it("strip(withPrefix(href)) devuelve el href original", () => {
    for (const href of cases) {
      const prefixed = withSitePrefix(href, "/tienda/moda");
      assert.equal(
        stripSitePrefix(prefixed, "/tienda/moda"),
        href,
        `round-trip roto para ${href} (pasó por ${prefixed})`,
      );
    }
  });

  it("round-trip con prefijo vacío es la identidad", () => {
    for (const href of cases) {
      assert.equal(stripSitePrefix(withSitePrefix(href, ""), ""), href);
    }
  });

  it("round-trip con un slug de 2 letras (el caso que rompía)", () => {
    // El backend ahora rechaza slugs de 2 caracteres, pero el helper tiene que ser
    // correcto igual: es defensa en profundidad, no confianza en el otro lado.
    const original = process.env.NEXT_PUBLIC_COUNTRY_CODE;
    process.env.NEXT_PUBLIC_COUNTRY_CODE = "ar";
    try {
      for (const href of cases) {
        const prefixed = withSitePrefix(href, "/tienda/bo");
        assert.equal(stripSitePrefix(prefixed, "/tienda/bo"), href);
      }
    } finally {
      if (original === undefined) delete process.env.NEXT_PUBLIC_COUNTRY_CODE;
      else process.env.NEXT_PUBLIC_COUNTRY_CODE = original;
    }
  });
});

after(() => {
  /* nada que limpiar */
});
