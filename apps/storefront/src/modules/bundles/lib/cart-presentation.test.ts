import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCartPresentationFromItems } from "./cart-presentation";

const line = (
  id: string,
  meta?: Record<string, unknown> | null,
  extra?: Partial<{
    quantity: number;
    total: number;
    unit_price: number;
    product_title: string;
    variant_title: string;
    created_at: string;
  }>,
) =>
  ({
    id,
    quantity: extra?.quantity ?? 1,
    total: extra?.total,
    unit_price: extra?.unit_price ?? 0,
    product_title: extra?.product_title,
    variant_title: extra?.variant_title,
    metadata: meta ?? null,
    created_at: extra?.created_at ?? "2026-01-01T00:00:00Z",
  }) as any;

const bundleMeta = (instance: string, extra?: Record<string, unknown>) => ({
  bundle_id: "bndl_A",
  bundle_instance_id: instance,
  bundle_title: "Kit 4.º grado",
  bundle_handle: "kit-4",
  ...extra,
});

test("buildCartPresentation: un kit de 3 líneas mas un standalone da 2 filas", () => {
  const rows = buildCartPresentationFromItems([
    line("li_1", bundleMeta("inst_1"), { total: 1000 }),
    line("li_2", bundleMeta("inst_1"), { total: 2000 }),
    line("li_3", bundleMeta("inst_1"), { total: 3000 }),
    line("li_4", null, { total: 500 }),
  ]);

  assert.equal(rows.length, 2);
  const bundle = rows[0];
  assert.equal(bundle?.kind, "bundle");
  if (bundle?.kind !== "bundle") return;
  assert.equal(bundle.itemCount, 3);
  assert.equal(bundle.subtotal, 6000);
  assert.equal(bundle.title, "Kit 4.º grado");
  assert.equal(bundle.bundleHandle, "kit-4");
  assert.equal(rows[1]?.kind, "single");
});

test("buildCartPresentation: dos instancias del mismo bundle no se mezclan", () => {
  const rows = buildCartPresentationFromItems([
    line("li_1", bundleMeta("inst_1"), { total: 1000 }),
    line("li_2", bundleMeta("inst_2"), { total: 2000 }),
  ]);

  assert.equal(rows.length, 2);
  assert.equal(rows.every((r) => r.kind === "bundle"), true);
  const ids = rows.map((r) => (r.kind === "bundle" ? r.bundleInstanceId : null));
  assert.deepEqual(ids, ["inst_1", "inst_2"]);
});

test("buildCartPresentation: unitCount suma cantidades, itemCount cuenta productos", () => {
  const rows = buildCartPresentationFromItems([
    line("li_1", bundleMeta("inst_1"), { quantity: 2, total: 1000 }),
    line("li_2", bundleMeta("inst_1"), { quantity: 3, total: 1000 }),
  ]);

  const bundle = rows[0];
  assert.equal(bundle?.kind, "bundle");
  if (bundle?.kind !== "bundle") return;
  assert.equal(bundle.itemCount, 2);
  assert.equal(bundle.unitCount, 5);
});

test("buildCartPresentation: el resumen deja afuera los items auto-resueltos", () => {
  const rows = buildCartPresentationFromItems([
    line("li_1", bundleMeta("inst_1", { bundle_auto_resolved: true }), {
      product_title: "Libro",
      variant_title: "Único",
    }),
    line("li_2", bundleMeta("inst_1", { bundle_auto_resolved: false }), {
      product_title: "Lapicera",
      variant_title: "Azul",
    }),
  ]);

  const bundle = rows[0];
  assert.equal(bundle?.kind, "bundle");
  if (bundle?.kind !== "bundle") return;
  assert.deepEqual(
    bundle.selections.map((s) => `${s.product} · ${s.option}`),
    ["Lapicera · Azul"],
  );
});

test("buildCartPresentation: sin el flag de auto-resuelto muestra todas las variantes", () => {
  const rows = buildCartPresentationFromItems([
    line("li_1", bundleMeta("inst_1"), { product_title: "Libro", variant_title: "Único" }),
    line("li_2", bundleMeta("inst_1"), { product_title: "Lapicera", variant_title: "Azul" }),
  ]);

  const bundle = rows[0];
  assert.equal(bundle?.kind, "bundle");
  if (bundle?.kind !== "bundle") return;
  assert.equal(bundle.selections.length, 2);
});

test("buildCartPresentation: una variante que repite el titulo del producto no es una seleccion", () => {
  const rows = buildCartPresentationFromItems([
    line("li_1", bundleMeta("inst_1", { bundle_auto_resolved: false }), {
      product_title: "Cartuchera",
      variant_title: "Cartuchera",
    }),
  ]);

  const bundle = rows[0];
  assert.equal(bundle?.kind, "bundle");
  if (bundle?.kind !== "bundle") return;
  assert.deepEqual(bundle.selections, []);
});

test("buildCartPresentation: instancia vieja sin handle sigue siendo valida", () => {
  const rows = buildCartPresentationFromItems([
    line("li_1", {
      bundle_id: "bndl_A",
      bundle_instance_id: "inst_1",
      bundle_title: "Kit viejo",
    }),
  ]);

  const bundle = rows[0];
  assert.equal(bundle?.kind, "bundle");
  if (bundle?.kind !== "bundle") return;
  assert.equal(bundle.bundleHandle, null);
  assert.equal(bundle.title, "Kit viejo");
});

test("buildCartPresentation: el subtotal cae a unit_price por cantidad cuando no hay total", () => {
  const rows = buildCartPresentationFromItems([
    line("li_1", bundleMeta("inst_1"), { quantity: 2, unit_price: 1500 }),
  ]);

  const bundle = rows[0];
  assert.equal(bundle?.kind, "bundle");
  if (bundle?.kind !== "bundle") return;
  assert.equal(bundle.subtotal, 3000);
});

test("buildCartPresentation: carrito vacio devuelve lista vacia", () => {
  assert.deepEqual(buildCartPresentationFromItems([]), []);
  assert.deepEqual(buildCartPresentationFromItems(null), []);
});
