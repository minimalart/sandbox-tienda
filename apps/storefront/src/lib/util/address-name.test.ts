import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_ADDRESS_NAME,
  getAddressNamePreset,
  withMirroredAddressName,
} from "./address-name";

test("usa Casa como nombre predeterminado", () => {
  assert.equal(DEFAULT_ADDRESS_NAME, "Casa");
});

test("selecciona Otro cuando el nombre es personalizado", () => {
  assert.equal(getAddressNamePreset("Casa"), "Casa");
  assert.equal(getAddressNamePreset("Trabajo"), "Trabajo");
  assert.equal(getAddressNamePreset("Casa de mamá"), "Otro");
  assert.equal(getAddressNamePreset("Otro"), "Otro");
  assert.equal(getAddressNamePreset(""), "Otro");
});

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
