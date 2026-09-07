import assert from "node:assert/strict";
import { test } from "node:test";
import { withMirroredAddressName } from "./address-name";

test("espeja el nombre en metadata al crear", () => {
  const out = withMirroredAddressName({
    address_1: "Mitre 100",
    address_name: "Casa de mamá",
  }) as { metadata?: Record<string, unknown> };

  assert.equal(out.metadata?.address_name, "Casa de mamá");
});

test("no pisa el resto de metadata (lat/lng de add-address.tsx)", () => {
  const out = withMirroredAddressName({
    address_name: "Trabajo",
    metadata: { latitude: "-41.13", longitude: "-71.31" },
  }) as { metadata?: Record<string, unknown> };

  assert.equal(out.metadata?.latitude, "-41.13");
  assert.equal(out.metadata?.longitude, "-71.31");
  assert.equal(out.metadata?.address_name, "Trabajo");
});

test("sin nombre no inventa metadata", () => {
  const sinNombre = { address_1: "Mitre 100" };
  assert.deepEqual(withMirroredAddressName(sinNombre), sinNombre);

  const vacio = { address_1: "Mitre 100", address_name: "" };
  assert.deepEqual(withMirroredAddressName(vacio), vacio);
});

test("tolera valores que no son objeto", () => {
  assert.equal(withMirroredAddressName(null), null);
  assert.equal(withMirroredAddressName(undefined), undefined);
});
