import { test } from "node:test";
import assert from "node:assert/strict";
import { BUNDLE_ONLY_FILTER_FIELD, buildBaseFilterBy } from "./filters";

const params = (extra: Record<string, unknown> = {}) =>
  ({ salesChannelId: "sc_marianista", ...extra }) as never;

test("con canal, el filtro esconde los productos bundle_only de ESE canal", () => {
  const filter = buildBaseFilterBy(params());
  assert.match(filter, /sales_channels\.id:=`sc_marianista`/);
  assert.match(filter, /bundle_only_channels:!=\[`sc_marianista`\]/);
});

test("sin canal no se filtra por bundle_only: no hay tienda contra la cual medirlo", () => {
  const previous = process.env.NEXT_PUBLIC_SALES_CHANNEL_ID;
  process.env.NEXT_PUBLIC_SALES_CHANNEL_ID = "";
  try {
    const filter = buildBaseFilterBy({} as never);
    assert.equal(filter.includes(BUNDLE_ONLY_FILTER_FIELD), false);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SALES_CHANNEL_ID;
    else process.env.NEXT_PUBLIC_SALES_CHANNEL_ID = previous;
  }
});

test("omitBundleOnly saca el filtro y deja el resto intacto", () => {
  const filter = buildBaseFilterBy(params(), { omitBundleOnly: true });
  assert.equal(filter.includes(BUNDLE_ONLY_FILTER_FIELD), false);
  assert.match(filter, /sales_channels\.id:=`sc_marianista`/);
  assert.match(filter, /price:>0/);
});

test("pedir ids explícitos no desactiva el filtro por canal", () => {
  // El auto-add por id se salta `hidden_from_store`, pero un producto que la
  // tienda vende sólo dentro de un kit no debería colarse por ese camino.
  const filter = buildBaseFilterBy(params({ productIds: ["prod_1"] }));
  assert.match(filter, /bundle_only_channels:!=\[`sc_marianista`\]/);
  assert.match(filter, /id:=\[`prod_1`\]/);
});

test("el canal se escapa como el resto de los valores", () => {
  const filter = buildBaseFilterBy(params({ salesChannelId: "sc_`raro`" }));
  assert.match(filter, /bundle_only_channels:!=\[`sc_\\`raro\\``\]/);
});
