import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildShippingAddressKey } from "./shipping-address-key.ts";

describe("buildShippingAddressKey", () => {
  it("devuelve el centinela vacío cuando no hay dirección", () => {
    // No `undefined`: un efecto que dependa de esto no puede recibir una
    // dependencia inestable antes de que exista shipping_address.
    assert.equal(buildShippingAddressKey(null), "");
    assert.equal(buildShippingAddressKey(undefined), "");
  });

  it("cambia cuando cambia un campo postal, aunque el resto se repita", () => {
    const base = {
      address_1: "Av. Siempre Viva 742",
      city: "Springfield",
      province: "Buenos Aires",
      postal_code: "1000",
      country_code: "ar",
    };
    const keyA = buildShippingAddressKey(base);
    const keyB = buildShippingAddressKey({ ...base, postal_code: "1001" });
    assert.notEqual(keyA, keyB);
  });

  it("es estable frente a un objeto nuevo con el mismo contenido", () => {
    // Simula el cart que llega como referencia nueva en cada render.
    const address = {
      address_1: "Calle Falsa 123",
      city: "CABA",
      postal_code: "1400",
      country_code: "ar",
    };
    const keyA = buildShippingAddressKey({ ...address });
    const keyB = buildShippingAddressKey({ ...address });
    assert.equal(keyA, keyB);
  });

  it("prioriza metadata.lat/lng por sobre latitude/longitude, igual que el backend", () => {
    const withBoth = buildShippingAddressKey({
      address_1: "x",
      metadata: { lat: "-34.6", lng: "-58.4", latitude: "0", longitude: "0" },
    });
    const withLatOnly = buildShippingAddressKey({
      address_1: "x",
      metadata: { lat: "-34.6", lng: "-58.4" },
    });
    assert.equal(withBoth, withLatOnly);
  });

  it("cae a latitude/longitude cuando no hay lat/lng", () => {
    const key = buildShippingAddressKey({
      address_1: "x",
      metadata: { latitude: -34.6, longitude: -58.4 },
    });
    assert.match(key, /-34\.6\|-58\.4$/);
  });

  it("normaliza número y string al mismo valor de clave", () => {
    const asNumber = buildShippingAddressKey({
      address_1: "x",
      metadata: { lat: -34.6, lng: -58.4 },
    });
    const asString = buildShippingAddressKey({
      address_1: "x",
      metadata: { lat: "-34.6", lng: "-58.4" },
    });
    assert.equal(asNumber, asString);
  });

  it("trata lat 0 (ecuador) como coordenada válida, no como ausente", () => {
    // `??` en vez de `||`: 0 es un valor válido de latitud, no debe caer al
    // fallback ni terminar como cadena vacía.
    const key = buildShippingAddressKey({
      address_1: "x",
      metadata: { lat: 0, lng: -58.4 },
    });
    assert.match(key, /\|0\|-58\.4$/);
  });

  it("no confunde una dirección incompleta (todo vacío) con ausencia de dirección", () => {
    const key = buildShippingAddressKey({});
    assert.notEqual(key, "");
  });
});
