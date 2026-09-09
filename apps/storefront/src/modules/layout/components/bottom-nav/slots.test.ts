import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { MobileNavSlotId } from "@lib/site-config/types";
import {
  DEFAULT_MOBILE_NAV_ORDER,
  pickMobileNavSlot,
  resolveMobileNavOrder,
} from "./slots.ts";

/**
 * El invariante que estas dos funciones defienden es UNO: que la barra inferior
 * mobile siga teniendo 5 íconos cuando la tienda no tiene promociones activas.
 * Antes caía a 4 y el carrito, que es el botón redondo del centro, quedaba
 * descentrado.
 */

/** Todo disponible: el orden manda y gana el primero. */
const todo = () => true;

describe("resolveMobileNavOrder", () => {
  it("sin config devuelve el default", () => {
    assert.deepEqual(resolveMobileNavOrder(undefined), DEFAULT_MOBILE_NAV_ORDER);
  });

  it("respeta el orden configurado", () => {
    const out = resolveMobileNavOrder(["blog", "promos"]);
    assert.deepEqual(out.slice(0, 2), ["blog", "promos"]);
  });

  /**
   * Una lista parcial es "prefiero esto", no "si esto no está dejá la barra en 4":
   * sin el completado, guardar `["blog"]` en una tienda con el blog apagado
   * reintroduce el desbalanceo.
   */
  it("COMPLETA con el default lo que la tienda no listó", () => {
    const out = resolveMobileNavOrder(["contacto"]);
    assert.equal(out.length, DEFAULT_MOBILE_NAV_ORDER.length);
    assert.equal(out[0], "contacto");
    for (const id of DEFAULT_MOBILE_NAV_ORDER) assert.ok(out.includes(id));
  });

  it("descarta ids desconocidos y repetidos", () => {
    const out = resolveMobileNavOrder(["inventado", "blog", "blog"]);
    assert.equal(out.length, DEFAULT_MOBILE_NAV_ORDER.length);
    assert.equal(out[0], "blog");
    assert.equal(out.filter((id) => id === "blog").length, 1);
  });

  it("una lista vacía no deja la barra sin candidatos", () => {
    assert.deepEqual(resolveMobileNavOrder([]), DEFAULT_MOBILE_NAV_ORDER);
  });
});

describe("pickMobileNavSlot", () => {
  it("toma el primero del orden cuando todo está disponible", () => {
    assert.equal(pickMobileNavSlot(resolveMobileNavOrder(undefined), todo), "promos");
  });

  /** El caso del reporte: la tienda no tiene promociones activas. */
  it("sin promos cae al siguiente candidato en vez de dejar el lugar vacío", () => {
    const slot = pickMobileNavSlot(
      resolveMobileNavOrder(undefined),
      (id) => id !== "promos",
    );
    assert.equal(slot, "colores");
  });

  it("sin promos NI tintometría sigue habiendo candidato", () => {
    const off = new Set<MobileNavSlotId>(["promos", "colores"]);
    const slot = pickMobileNavSlot(resolveMobileNavOrder(undefined), (id) => !off.has(id));
    assert.equal(slot, "sucursales");
  });

  it("el orden de la tienda gana sobre el default", () => {
    const slot = pickMobileNavSlot(resolveMobileNavOrder(["contacto"]), todo);
    assert.equal(slot, "contacto");
  });

  /**
   * Sin ningún candidato la barra vuelve a 4 columnas. Es el único caso en que el
   * desbalanceo sigue existiendo, y es correcto: inventar un ítem sería peor.
   */
  it("devuelve null si NINGÚN candidato aplica", () => {
    assert.equal(pickMobileNavSlot(resolveMobileNavOrder(undefined), () => false), null);
  });
});
