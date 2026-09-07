import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveNavIcon } from "./nav-icon.ts";

/**
 * Los dos bugs que estos tests retiran:
 *
 *  1. El botón de home mostraba el LOGOTIPO completo cuando estaba inactivo y
 *     el isotipo cuando estaba activo, así que cambiaba de dibujo al navegar.
 *  2. Con el isotipo NEGATIVO elegido desde el backoffice, el botón quedaba
 *     vacío en producción: el negativo es blanco y el círculo es `bg-white`.
 *     Por eso ya no hay variante que elegir.
 */

const LOGOS = {
  main: "/logotipo.svg",
  mobile: "/iso-positivo.svg",
  iconNegative: "/iso-negativo.svg",
};

describe("resolveNavIcon", () => {
  it("usa el isotipo positivo de la tienda", () => {
    assert.equal(resolveNavIcon(LOGOS), "/iso-positivo.svg");
  });

  it("NUNCA devuelve el isotipo negativo: sobre el círculo blanco no se ve", () => {
    assert.notEqual(resolveNavIcon(LOGOS), "/iso-negativo.svg");
  });

  it("con el negativo cargado y SIN positivo tampoco cae en el negativo", () => {
    // El caso real de desdeelsur invertido: aunque la única variante de marca
    // disponible sea la negativa, el botón cae al isotipo del boilerplate
    // antes que a un archivo que va a quedar invisible.
    const soloNegativa = { main: "/logotipo.svg", iconNegative: "/iso-negativo.svg" };
    assert.equal(resolveNavIcon(soloNegativa), "/logos-mercatto/logo-verde.svg");
  });

  it("NUNCA cae en logos.main, que es el logotipo con la palabra", () => {
    assert.notEqual(resolveNavIcon({ main: "/logotipo.svg" }), "/logotipo.svg");
  });

  it("sin marca cargada cae al isotipo del boilerplate, no al logotipo", () => {
    assert.equal(resolveNavIcon(undefined), "/logos-mercatto/logo-verde.svg");
  });
});
