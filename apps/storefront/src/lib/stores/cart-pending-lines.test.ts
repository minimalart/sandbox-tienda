import assert from "node:assert/strict";
import { test } from "node:test";
import { keepPendingOptimisticLines } from "./cart-pending-lines";

/**
 * Regresión DESDEELSUR: con varios "add" en cola, un snapshot del server
 * aplicado en el medio borraba las líneas optimistas y cada add, al resolver,
 * mandaba un delete de la línea que acababa de crear.
 */

const server = { id: "cart_1", items: [{ id: "cali_1", variant_id: "v1" }] };

test("conserva las líneas optimistas cuyo add sigue en cola", () => {
  const local = {
    items: [
      { id: "cali_1", variant_id: "v1" },
      { id: "optimistic-line-v2", variant_id: "v2" },
      { id: "optimistic-line-v3", variant_id: "v3" },
    ],
  };
  const result = keepPendingOptimisticLines(server, local, new Set(["v2", "v3"]));
  assert.deepEqual(
    result.items.map((item) => item.id),
    ["cali_1", "optimistic-line-v2", "optimistic-line-v3"],
  );
  assert.equal(result.id, "cart_1");
});

test("no pega una línea optimista huérfana (su add ya terminó)", () => {
  const local = { items: [{ id: "optimistic-line-v2", variant_id: "v2" }] };
  const result = keepPendingOptimisticLines(server, local, new Set(["v9"]));
  assert.deepEqual(result.items.map((item) => item.id), ["cali_1"]);
});

test("no duplica si el server ya trae la variante", () => {
  const local = { items: [{ id: "optimistic-line-v1", variant_id: "v1" }] };
  const result = keepPendingOptimisticLines(server, local, new Set(["v1"]));
  assert.deepEqual(result.items.map((item) => item.id), ["cali_1"]);
});

test("sin adds pendientes devuelve el snapshot tal cual", () => {
  const local = { items: [{ id: "optimistic-line-v2", variant_id: "v2" }] };
  assert.equal(keepPendingOptimisticLines(server, local, new Set()), server);
});
