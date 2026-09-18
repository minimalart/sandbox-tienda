import { test } from "node:test";
import assert from "node:assert/strict";
import { groupCartItemsByBundle } from "./group-cart-items";

const item = (id: string, meta?: Record<string, unknown>, created_at?: string) =>
  ({ id, quantity: 1, metadata: meta ?? null, created_at: created_at ?? "2026-01-01T00:00:00Z" } as any);

test("groupCartItemsByBundle: items sin metadata caen en single", () => {
  const rows = groupCartItemsByBundle([item("li_1"), item("li_2")]);
  assert.equal(rows.length, 2);
  assert.equal(rows.every((r) => r.kind === "single"), true);
});

test("groupCartItemsByBundle: items con mismo bundle_instance_id se agrupan", () => {
  const rows = groupCartItemsByBundle([
    item("li_1", { bundle_id: "bndl_A", bundle_handle: "kit-a", bundle_instance_id: "inst_1", bundle_title: "Kit" }),
    item("li_2", { bundle_id: "bndl_A", bundle_handle: "kit-a", bundle_instance_id: "inst_1" }),
    item("li_3"),
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.kind, "bundle");
  assert.equal(rows[1]!.kind, "single");
  if (rows[0]!.kind === "bundle") {
    assert.equal(rows[0]!.group.items.length, 2);
    assert.equal(rows[0]!.group.bundle_title, "Kit");
    assert.equal(rows[0]!.group.bundle_handle, "kit-a");
  }
});

test("groupCartItemsByBundle: sin bundle_handle en metadata (line items pre-fix) queda null", () => {
  const rows = groupCartItemsByBundle([
    item("li_1", { bundle_id: "bndl_A", bundle_instance_id: "inst_1", bundle_title: "Kit" }),
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.kind, "bundle");
  if (rows[0]!.kind === "bundle") {
    assert.equal(rows[0]!.group.bundle_handle, null);
  }
});

test("groupCartItemsByBundle: dos instances distintas son grupos distintos", () => {
  const rows = groupCartItemsByBundle([
    item("li_1", { bundle_id: "bndl_A", bundle_instance_id: "inst_A" }),
    item("li_2", { bundle_id: "bndl_A", bundle_instance_id: "inst_B" }),
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows.every((r) => r.kind === "bundle"), true);
});

test("groupCartItemsByBundle: preserva orden de aparición del primer item de cada grupo", () => {
  const rows = groupCartItemsByBundle([
    item("li_solo"),
    item("li_1", { bundle_id: "bndl", bundle_instance_id: "inst_A" }),
    item("li_2", { bundle_id: "bndl", bundle_instance_id: "inst_A" }),
    item("li_solo_2"),
  ]);
  assert.equal(rows.length, 3);
  assert.equal(rows[0]!.kind, "single");
  assert.equal(rows[1]!.kind, "bundle");
  assert.equal(rows[2]!.kind, "single");
});
