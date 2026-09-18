import { test } from "node:test";
import assert from "node:assert/strict";
import {
  findVariantByOptions,
  isVariantBuyable,
  listAvailableValuesForOption,
} from "./resolve-variant";
import type { StorefrontBundleProduct, StorefrontVariant } from "@lib/data/bundles";

const variant = (
  id: string,
  options: Record<string, string>,
  overrides: Partial<StorefrontVariant> = {},
): StorefrontVariant => ({
  id,
  title: null,
  sku: null,
  options,
  calculated_price: { amount: 1000, currency_code: "ars" },
  inventory_available: true,
  allow_backorder: false,
  manage_inventory: false,
  ...overrides,
});

const product: StorefrontBundleProduct = {
  id: "prod_moch",
  title: "Mochila",
  handle: "mochila",
  thumbnail: null,
  status: "published",
  options: [
    { id: "opt_tam", title: "Tamaño", values: ["Chica", "Grande"] },
    { id: "opt_col", title: "Color", values: ["Azul", "Roja", "Negra"] },
  ],
  variants: [
    variant("v_chica_azul", { Tamaño: "Chica", Color: "Azul" }),
    variant("v_chica_roja", { Tamaño: "Chica", Color: "Roja" }),
    variant("v_grande_negra", { Tamaño: "Grande", Color: "Negra" }),
  ],
};

test("findVariantByOptions: matchea solo cuando todas las opciones coinciden", () => {
  const found = findVariantByOptions(product, { Tamaño: "Chica", Color: "Azul" });
  assert.equal(found?.id, "v_chica_azul");
});

test("findVariantByOptions: retorna null si falta una opción", () => {
  const found = findVariantByOptions(product, { Tamaño: "Chica", Color: null });
  assert.equal(found, null);
});

test("listAvailableValuesForOption: sólo devuelve valores que llevan a un variant real", () => {
  // Con Tamaño=Grande, sólo Negra es válida
  const values = listAvailableValuesForOption(product, { Tamaño: "Grande", Color: null }, "Color");
  assert.deepEqual([...values].sort(), ["Negra"]);
});

test("listAvailableValuesForOption: sin restricciones, todos los valores válidos aparecen", () => {
  const values = listAvailableValuesForOption(product, { Tamaño: null, Color: null }, "Color");
  assert.deepEqual([...values].sort(), ["Azul", "Negra", "Roja"]);
});

test("isVariantBuyable: variant con calculated_price null y sin backorder no es comprable", () => {
  const notBuyable = variant("v_x", { Tamaño: "Chica", Color: "Azul" }, {
    calculated_price: null,
    manage_inventory: true,
  });
  assert.equal(isVariantBuyable(notBuyable), false);
});

test("isVariantBuyable: backorder permite comprar sin calculated_price cuando manage_inventory=true", () => {
  const buyable = variant("v_y", { Tamaño: "Chica", Color: "Azul" }, {
    calculated_price: null,
    manage_inventory: true,
    allow_backorder: true,
  });
  assert.equal(isVariantBuyable(buyable), true);
});
