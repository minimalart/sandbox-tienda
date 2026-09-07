import { type APIRequestContext, expect, request, test } from "@playwright/test";

/**
 * Regression spec for the carrier-abstraction refactor of
 * `src/modules/checkout/components/shipping/index.tsx`.
 *
 * WHY this file exists: that component went from string-based carrier
 * inference ("pickup" | "shipping" | "cde", isAndreani(name) substring checks)
 * to a { mode, carrier } model driven by a carrier registry. Andreani is the
 * only carrier wired in today and it's the one that bills — this spec locks
 * down that its checkout behavior (domicilio, sucursal, HOP, retiro en tienda
 * propia) and the CDE flow are unchanged, and that the new data contract
 * (`data.carrier`, `data.branch_id`/`branch_code` on the shipping method) is
 * actually on the wire.
 *
 * SETUP STRATEGY: mirrors checkout-link.spec.ts — build a real cart via the
 * Store API (region, product, line item, email, shipping address) instead of
 * driving the personal-info/address UI steps, inject the `_medusa_cart_id`
 * cookie, and open `/checkout?step=delivery` directly. Every test skips with
 * an explicit reason (surfaced in the HTML report) when the backend, a
 * publishable key, or a specific seeded shipping option isn't available.
 *
 * MOCKING BOUNDARY: the Andreani/HOP branch list (`/api/store/carrier-branches`)
 * is mocked at the Next.js route boundary for the branch-selection assertions
 * (tests 2, 3, and the data-contract tests). That route's own logic (upstream
 * dispatch, error sanitization, dedupe) is not what this refactor touched in a
 * behavior-risky way and isn't re-tested here — what IS being regression-tested
 * is how the checkout component consumes that contract (fetch trigger,
 * rendering, badge selection, submit gating). The Andreani pickup shipping
 * OPTION itself still has to be real seed data for `activeCarrierId` to
 * resolve to "andreani" — that part is NOT mocked.
 */

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000";
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY;

// Mirrors the module-level pure predicates in shipping/index.tsx — kept in
// sync manually since this is test code observing the contract, not importing
// the component's internals.
type RawShippingOption = {
  id: string;
  name: string;
  provider_id: string;
  price_type: "flat" | "calculated";
  data?: Record<string, unknown> | null;
  service_zone?: { fulfillment_set?: { type?: string } };
};

function isPickupOption(o: RawShippingOption): boolean {
  return (
    o.service_zone?.fulfillment_set?.type === "pickup" ||
    o.name?.toLowerCase().includes("retiro")
  );
}

function isAndreaniOption(o: RawShippingOption): boolean {
  return (
    o.name?.toLowerCase().includes("andreani") ||
    o.provider_id?.toLowerCase().includes("andreani")
  );
}

function isStorePickupOption(o: RawShippingOption): boolean {
  return o.data?.pickup_kind === "store";
}

// Mirrors CARRIER_REGISTRY.correo_argentino.matcher in constants.tsx: `\b`
// only makes sense against `name` (free-text Spanish, space-separated) — it
// deliberately does NOT protect `provider_id` (`correo_argentino_correo_argentino`),
// since `_` is a word-char in regex and there's no boundary between "correo"
// and "_argentino" in that compound id. A plain `includes` is used for
// provider_id instead (safe there: it's a controlled system identifier, not
// free text).
function isCorreoOption(o: RawShippingOption): boolean {
  return (
    /\bcorreo\b/i.test(o.name ?? "") ||
    !!o.provider_id?.toLowerCase().includes("correo")
  );
}

function isCdeOption(o: RawShippingOption): boolean {
  const name = o.name?.toLowerCase() ?? "";
  return (
    name.includes("centro de distribución") ||
    name.includes("centro de distribucion")
  );
}

// Same regex the component derives from CARRIER_REGISTRY — used here only to
// predict the visible (sanitized) label so we can locate a specific row by
// text without hardcoding a carrier-specific string.
const PROVIDER_TAG_REGEX = /@(?:andreani|hop)\b/gi;
function sanitizeLabel(name: string): string {
  return name.replace(PROVIDER_TAG_REGEX, "").replace(/\s{2,}/g, " ").trim();
}

type CartBootstrap = {
  cartId: string;
  countryCode: string;
  shippingOptions: RawShippingOption[];
};

async function bootstrapCart(
  api: APIRequestContext,
): Promise<{ result?: CartBootstrap; error?: string }> {
  const headers = { "x-publishable-api-key": PUBLISHABLE_KEY as string };

  const regionsRes = await api.get("/store/regions", { headers });
  if (!regionsRes.ok()) {
    return { error: `Backend not reachable (/store/regions -> ${regionsRes.status()})` };
  }
  const { regions } = await regionsRes.json();
  const region = regions?.[0];
  const iso2 = region?.countries?.[0]?.iso_2;
  if (!region || !iso2) {
    return { error: "No region/country configured in the backend" };
  }

  const productsRes = await api.get("/store/products", {
    headers,
    params: { limit: "1", fields: "id,*variants", region_id: region.id },
  });
  if (!productsRes.ok()) {
    return { error: `Could not list products (-> ${productsRes.status()})` };
  }
  const { products } = await productsRes.json();
  const variantId = products?.[0]?.variants?.[0]?.id;
  if (!variantId) {
    return { error: "No seeded products/variants available" };
  }

  const createRes = await api.post("/store/carts", {
    headers,
    data: { region_id: region.id },
  });
  if (!createRes.ok()) {
    return {
      error: `Could not create cart (-> ${createRes.status()}: ${await createRes.text()})`,
    };
  }
  const { cart } = await createRes.json();
  const cartId: string = cart.id;

  const lineRes = await api.post(`/store/carts/${cartId}/line-items`, {
    headers,
    data: { variant_id: variantId, quantity: 1 },
  });
  if (!lineRes.ok()) {
    return { error: `Could not add line item (-> ${lineRes.status()})` };
  }

  // CABA postal code — used only to give Andreani's calculated-price and
  // branch-lookup flows a plausible destination. If the sandbox account
  // rejects it, home-delivery pricing (test 1) will surface that as a
  // timeout instead of a price, which is itself useful signal.
  const updateRes = await api.post(`/store/carts/${cartId}`, {
    headers,
    data: {
      email: "e2e-delivery@example.com",
      shipping_address: {
        first_name: "E2E",
        last_name: "Delivery",
        address_1: "Av. Corrientes 1234",
        city: "Buenos Aires",
        postal_code: "1425",
        country_code: iso2,
        province: "Buenos Aires",
      },
    },
  });
  if (!updateRes.ok()) {
    return { error: `Could not set email/address on cart (-> ${updateRes.status()})` };
  }

  const optionsRes = await api.get("/store/shipping-options", {
    headers,
    params: {
      cart_id: cartId,
      // Mismo `fields` que usa la app (lib/data/fulfillment.ts). `+data` es
      // imprescindible: sin él la Store API no devuelve `data`, este spec no
      // encuentra ninguna opción con `data.pickup_kind === 'store'` y el caso 4
      // se SALTEA en silencio — que es exactamente cómo se coló el bug que este
      // fields arregla. Un skip no rompe el build.
      fields: "+data,+service_zone.fulfillment_set.type",
    },
  });
  if (!optionsRes.ok()) {
    return { error: `Could not list shipping options (-> ${optionsRes.status()})` };
  }
  const { shipping_options } = await optionsRes.json();

  return {
    result: {
      cartId,
      countryCode: iso2,
      shippingOptions: (shipping_options ?? []) as RawShippingOption[],
    },
  };
}

test.describe("Checkout — Delivery step (carrier abstraction regression)", () => {
  let api: APIRequestContext;
  let setupError = "";
  let cartId = "";
  let countryCode = "";
  let shippingOptions: RawShippingOption[] = [];

  test.beforeAll(async () => {
    if (!PUBLISHABLE_KEY) {
      setupError = "Missing NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY";
      return;
    }
    api = await request.newContext({ baseURL: BACKEND_URL });
    try {
      const { result, error } = await bootstrapCart(api);
      if (error || !result) {
        setupError = error || "Unknown cart bootstrap failure";
        return;
      }
      cartId = result.cartId;
      countryCode = result.countryCode;
      shippingOptions = result.shippingOptions;
    } catch (error) {
      setupError = `Setup failed: ${(error as Error).message}`;
    }
  });

  test.afterAll(async () => {
    await api?.dispose();
  });

  test.beforeEach(async ({ page }) => {
    test.skip(!!setupError, setupError);
    await page.context().addCookies([
      {
        name: "_medusa_cart_id",
        value: cartId,
        domain: "localhost",
        path: "/",
      },
    ]);
  });

  const homeAndreaniOption = () =>
    shippingOptions.find(
      (o) => !isPickupOption(o) && !isCdeOption(o) && isAndreaniOption(o),
    );
  const andreaniPickupOption = () =>
    shippingOptions.find((o) => isPickupOption(o) && isAndreaniOption(o));
  const storePickupOption = () =>
    shippingOptions.find((o) => isPickupOption(o) && isStorePickupOption(o));
  const homeCorreoOption = () =>
    shippingOptions.find(
      (o) => !isPickupOption(o) && !isCdeOption(o) && isCorreoOption(o),
    );
  const correoPickupOption = () =>
    shippingOptions.find((o) => isPickupOption(o) && isCorreoOption(o));

  async function openDeliveryStep(page: import("@playwright/test").Page) {
    await page.goto(`/${countryCode}/checkout?step=delivery`);
    await expect(
      page.locator('[data-testid="delivery-options-container"]'),
    ).toBeVisible({ timeout: 20_000 });
  }

  function optionRow(page: import("@playwright/test").Page, option: RawShippingOption) {
    return page
      .locator('[data-testid="delivery-option-radio"]')
      .filter({ hasText: sanitizeLabel(option.name) });
  }

  async function waitForSetShippingMethodRequest(
    page: import("@playwright/test").Page,
    trigger: () => Promise<void>,
  ) {
    const [req] = await Promise.all([
      page.waitForRequest(
        (candidate) =>
          candidate.url().includes("/api/store/cart") &&
          candidate.method() === "POST" &&
          candidate.postDataJSON()?.action === "setShippingMethod",
        { timeout: 15_000 },
      ),
      trigger(),
    ]);
    return req;
  }

  // ──────────────────────────────────────────────────────────────────────
  // 1. Domicilio Andreani — calculated price
  // ──────────────────────────────────────────────────────────────────────
  test("home delivery (Andreani, calculated price) quotes, selects, and advances the step", async ({
    page,
  }) => {
    test.skip(
      !homeAndreaniOption(),
      "No Andreani home-delivery shipping option on this cart — run `pnpm seed:andreani-domicilio` in apps/backend",
    );
    const option = homeAndreaniOption()!;

    await openDeliveryStep(page);
    const row = optionRow(page, option);
    await expect(row).toBeVisible();

    if (option.price_type === "calculated") {
      // "-" is the placeholder for a calculated price that never resolved —
      // this is exactly the failure mode a broken quote would produce.
      await expect(row).not.toHaveText(/(^|\s)-(\s|$)/, { timeout: 20_000 });
      await expect(row).not.toBeDisabled({ timeout: 20_000 });
    }

    const req = await waitForSetShippingMethodRequest(page, async () => {
      await row.click();
    });
    const body = req.postDataJSON();
    expect(body.shippingMethodId).toBe(option.id);
    // The point of the refactor: an explicit carrier travels in `data`
    // instead of the backend having to re-infer it from the option name.
    expect(body.data?.carrier).toBe("andreani");

    await expect(
      page.locator('[data-testid="submit-delivery-option-button"]'),
    ).toBeEnabled({ timeout: 10_000 });
    await page.locator('[data-testid="submit-delivery-option-button"]').click();
    await page.waitForURL(/step=benefits/, { timeout: 10_000 });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 2. Sucursal Andreani — branch search, selection, and pickupComplete gate
  // ──────────────────────────────────────────────────────────────────────
  test("Andreani branch pickup: fetches branches, requires a selection, and gates submit", async ({
    page,
  }) => {
    test.skip(
      !andreaniPickupOption(),
      "No Andreani pickup shipping option on this cart — run `pnpm seed:andreani-pickup` in apps/backend",
    );
    const option = andreaniPickupOption()!;

    const branchRequests: string[] = [];
    await page.route("**/api/store/carrier-branches**", async (route) => {
      branchRequests.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          count: 2,
          branches: [
            {
              id: "suc-1",
              description: "Sucursal Once",
              address: "Av. Rivadavia 3000",
              city: "CABA",
              province: "Buenos Aires",
              postalCode: "1425",
              phone: "",
              type: "Sucursal",
              network: "sucursal",
              businessHours: "Lun a Vie 9 a 18",
            },
            {
              id: "hop-1",
              description: "Kiosco HOP Palermo",
              address: "Av. Santa Fe 4000",
              city: "CABA",
              province: "Buenos Aires",
              postalCode: "1425",
              phone: "",
              type: "PuntoDeTercero",
              network: "hop",
              businessHours: "",
            },
          ],
        }),
      });
    });

    await openDeliveryStep(page);
    await optionRow(page, option).click();

    // The branch search must actually fire — this is the fetch that the old
    // negative isStorePickupOption definition would have skipped in favor of
    // the (wrong) store-locations list if the classification broke.
    await expect
      .poll(() => branchRequests.length, { timeout: 10_000 })
      .toBeGreaterThan(0);

    const rows = page.locator('[data-testid="delivery-branch-row"]');
    await expect(rows).toHaveCount(2, { timeout: 10_000 });

    // Without a branch chosen, submit stays blocked — this is pickupComplete
    // failing correctly for a carrier pickup with no selection yet.
    await expect(
      page.locator('[data-testid="submit-delivery-option-button"]'),
    ).toBeDisabled();
    await expect(page.getByText("Seleccioná una sucursal para continuar")).toBeVisible();

    const req = await waitForSetShippingMethodRequest(page, async () => {
      await rows.filter({ hasText: "Sucursal Once" }).click();
    });
    const body = req.postDataJSON();
    expect(body.data?.branch_id).toBe("suc-1");
    expect(body.data?.carrier).toBe("andreani");

    await expect(
      page.locator('[data-testid="submit-delivery-option-button"]'),
    ).toBeEnabled({ timeout: 10_000 });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 3. Punto HOP — badge distinction
  // ──────────────────────────────────────────────────────────────────────
  test("HOP branches render a distinct badge from plain Andreani branches", async ({
    page,
  }) => {
    test.skip(
      !andreaniPickupOption(),
      "No Andreani pickup shipping option on this cart — run `pnpm seed:andreani-pickup` in apps/backend",
    );
    const option = andreaniPickupOption()!;

    await page.route("**/api/store/carrier-branches**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          count: 2,
          branches: [
            {
              id: "suc-1",
              description: "Sucursal Once",
              address: "Av. Rivadavia 3000",
              city: "CABA",
              province: "Buenos Aires",
              postalCode: "1425",
              phone: "",
              type: "Sucursal",
              network: "sucursal",
            },
            {
              id: "hop-1",
              description: "Kiosco HOP Palermo",
              address: "Av. Santa Fe 4000",
              city: "CABA",
              province: "Buenos Aires",
              postalCode: "1425",
              phone: "",
              type: "PuntoDeTercero",
              network: "hop",
            },
          ],
        }),
      });
    });

    await openDeliveryStep(page);
    await optionRow(page, option).click();

    const rows = page.locator('[data-testid="delivery-branch-row"]');
    await expect(rows).toHaveCount(2, { timeout: 10_000 });

    const sucursalRow = rows.filter({ hasText: "Sucursal Once" });
    const hopRow = rows.filter({ hasText: "Kiosco HOP Palermo" });

    // ShippingProviderBadge renders <Image alt={carrier.label|networkBadge.label}>.
    // These two alt texts are the CARRIER_REGISTRY.andreani.label ("Andreani")
    // and CARRIER_REGISTRY.andreani.networkBadges.hop.label ("Punto HOP") —
    // if networkBadges stopped being consulted, both rows would show "Andreani".
    await expect(sucursalRow.locator('img[alt="Andreani"]')).toBeVisible();
    await expect(sucursalRow.locator('img[alt="Punto HOP"]')).toHaveCount(0);

    await expect(hopRow.locator('img[alt="Punto HOP"]')).toBeVisible();
  });

  // ──────────────────────────────────────────────────────────────────────
  // 4. Retiro en tienda propia — positive isStorePickupOption, no carrier fetch
  // ──────────────────────────────────────────────────────────────────────
  test("own-store pickup: lists store rows and never triggers the carrier branch search", async ({
    page,
  }) => {
    test.skip(
      !storePickupOption(),
      'No store-pickup ("Retiro en sucursal", data.pickup_kind=store) shipping option on this cart — run `pnpm exec medusa exec ./src/scripts/seed-store-pickup-shipping.ts` in apps/backend',
    );
    const option = storePickupOption()!;

    const branchRequests: string[] = [];
    await page.route("**/api/store/carrier-branches**", async (route) => {
      branchRequests.push(route.request().url());
      await route.continue();
    });

    await openDeliveryStep(page);
    await optionRow(page, option).click();

    const storeRows = page.locator('[data-testid="delivery-store-row"]');
    // Either real store locations are seeded and rows render, or the "no
    // stores available" empty state shows — both are valid outcomes for this
    // assertion; what matters is which search fired.
    await page.waitForTimeout(2000);

    // The heart of the bug this refactor fixed: if isStorePickupOption ever
    // regresses to its old negative definition (or a positive check on the
    // wrong field), this option would still render, but it would (wrongly)
    // trigger the Andreani branch search instead of / in addition to the
    // store-locations one.
    expect(branchRequests).toHaveLength(0);

    if ((await storeRows.count()) > 0) {
      const req = await waitForSetShippingMethodRequest(page, async () => {
        await storeRows.first().click();
      });
      const body = req.postDataJSON();
      // Store pickup has no carrier (own fleet) — `data.carrier` must be
      // absent, not "andreani" and not any other carrier id.
      expect(body.data?.carrier).toBeUndefined();
      expect(body.data?.pickup_kind).toBe("store");

      await expect(
        page.locator('[data-testid="submit-delivery-option-button"]'),
      ).toBeEnabled({ timeout: 10_000 });
    } else {
      await expect(page.getByText("No hay sucursales disponibles")).toBeVisible();
    }
  });

  // ──────────────────────────────────────────────────────────────────────
  // 5. CDE
  // ──────────────────────────────────────────────────────────────────────
  test("CDE distribution-center pickup", async () => {
    // Not a missing-seed problem: this codebase's CDE support is a stub.
    // `useCdeLocations` in shipping/index.tsx unconditionally returns
    // `{ cdeLocations: [], isLoading: false, error: null }` and `cartHasKit`
    // unconditionally returns `false` (see the file's own top comment: "CDE
    // and Kit are out of scope for this boilerplate — stubs kept for
    // compilation"). `_cdeMethods` is filtered with `&& hasKit`, so it is
    // always `[]` regardless of what shipping options exist in the backend —
    // there is no seed script that would make this flow reachable. Making
    // this testable requires implementing CDE/kit for real, not seeding data.
    test.skip(
      true,
      "CDE is a stub in this boilerplate (hasKit always false in shipping/index.tsx) — the flow is unreachable from the UI regardless of backend seed data. See comment above.",
    );
  });

  // ──────────────────────────────────────────────────────────────────────
  // Data contract: changing branch on an already-selected pickup option
  // resyncs data.branch_id (this is what makes the branch id travel via
  // `data` instead of only living in cart metadata, per the refactor's task 3).
  // ──────────────────────────────────────────────────────────────────────
  test("changing branch on an already-selected pickup option resyncs data.branch_id", async ({
    page,
  }) => {
    test.skip(
      !andreaniPickupOption(),
      "No Andreani pickup shipping option on this cart — run `pnpm seed:andreani-pickup` in apps/backend",
    );
    const option = andreaniPickupOption()!;

    await page.route("**/api/store/carrier-branches**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          count: 2,
          branches: [
            {
              id: "suc-1",
              description: "Sucursal Once",
              address: "Av. Rivadavia 3000",
              city: "CABA",
              province: "Buenos Aires",
              postalCode: "1425",
              phone: "",
              type: "Sucursal",
              network: "sucursal",
            },
            {
              id: "suc-2",
              description: "Sucursal Belgrano",
              address: "Av. Cabildo 2000",
              city: "CABA",
              province: "Buenos Aires",
              postalCode: "1425",
              phone: "",
              type: "Sucursal",
              network: "sucursal",
            },
          ],
        }),
      });
    });

    await openDeliveryStep(page);
    await optionRow(page, option).click();

    const rows = page.locator('[data-testid="delivery-branch-row"]');
    await expect(rows).toHaveCount(2, { timeout: 10_000 });

    // First branch selection.
    const firstReq = await waitForSetShippingMethodRequest(page, async () => {
      await rows.filter({ hasText: "Sucursal Once" }).click();
    });
    expect(firstReq.postDataJSON().data?.branch_id).toBe("suc-1");

    // Changing to a second branch WITHOUT touching the radio (the pickup
    // option is already selected) must still hit /api/store/cart with the new
    // branch_id — this is resyncShippingMethodData. Before the refactor's
    // task 3, branch_id only lived in cart metadata and this second request
    // either didn't carry it or didn't fire the shipping-method update at all.
    const secondReq = await waitForSetShippingMethodRequest(page, async () => {
      await rows.filter({ hasText: "Sucursal Belgrano" }).click();
    });
    const secondBody = secondReq.postDataJSON();
    expect(secondBody.shippingMethodId).toBe(option.id);
    expect(secondBody.data?.branch_id).toBe("suc-2");
    expect(secondBody.data?.carrier).toBe("andreani");
  });

  // ──────────────────────────────────────────────────────────────────────
  // 6. Domicilio Correo Argentino — carrier registry entry added in this
  // change (CARRIER_REGISTRY.correo_argentino, constants.tsx). Same shape
  // as test 1, just asserting the Correo carrier id instead of Andreani's.
  //
  // NEVER RUN: this spec file has never been executed in this repo — no
  // Chromium binary installed and no backend with seeded data available in
  // this environment. This test is additionally gated on
  // `homeCorreoOption()` being present, same pattern as the Andreani tests
  // above — it will keep skipping until both conditions are met.
  // ──────────────────────────────────────────────────────────────────────
  test("home delivery (Correo Argentino, calculated price) quotes, selects, and advances the step", async ({
    page,
  }) => {
    test.skip(
      !homeCorreoOption(),
      "No Correo Argentino home-delivery shipping option on this cart — run `pnpm seed:correo-domicilio` in apps/backend",
    );
    const option = homeCorreoOption()!;

    await openDeliveryStep(page);
    const row = optionRow(page, option);
    await expect(row).toBeVisible();

    if (option.price_type === "calculated") {
      await expect(row).not.toHaveText(/(^|\s)-(\s|$)/, { timeout: 20_000 });
      await expect(row).not.toBeDisabled({ timeout: 20_000 });
    }

    const req = await waitForSetShippingMethodRequest(page, async () => {
      await row.click();
    });
    const body = req.postDataJSON();
    expect(body.shippingMethodId).toBe(option.id);
    // The point of the carrier registry entry: Correo travels through the
    // same `data.carrier` contract as Andreani, no special-casing.
    expect(body.data?.carrier).toBe("correo_argentino");

    await expect(
      page.locator('[data-testid="submit-delivery-option-button"]'),
    ).toBeEnabled({ timeout: 10_000 });
    await page.locator('[data-testid="submit-delivery-option-button"]').click();
    await page.waitForURL(/step=benefits/, { timeout: 10_000 });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 7. Sucursal Correo Argentino — branch search, selection. Correo has a
  // single pickup network (no HOP-equivalent), so unlike test 2 there's no
  // separate badge-distinction assertion (that's test 3, Andreani-only).
  //
  // NEVER RUN — same caveat as test 6 above.
  // ──────────────────────────────────────────────────────────────────────
  test("Correo Argentino branch pickup: fetches branches, requires a selection, and sends branch_id/branch_code", async ({
    page,
  }) => {
    test.skip(
      !correoPickupOption(),
      "No Correo Argentino pickup shipping option on this cart — run `pnpm seed:correo-sucursal` in apps/backend",
    );
    const option = correoPickupOption()!;

    const branchRequests: string[] = [];
    await page.route("**/api/store/carrier-branches**", async (route) => {
      branchRequests.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          count: 1,
          // Shape mirrors what /api/store/carrier-branches?carrier=correo_argentino
          // actually returns after mapCorreoBranches() in route.ts: `code` is
          // the opaque 3-char agency_id, same value as `id` per the backend
          // transformer (transformers/agencies.ts: `code: agencyId`).
          branches: [
            {
              id: "SCQ",
              code: "SCQ",
              description: "Sucursal Correo Once",
              address: "Av. Rivadavia 3100",
              city: "CABA",
              province: "Buenos Aires",
              postalCode: "1425",
              phone: "",
              type: "agency",
              network: "sucursal",
              businessHours: "Lun a Vie 9 a 18",
            },
          ],
        }),
      });
    });

    await openDeliveryStep(page);
    await optionRow(page, option).click();

    // Confirms the carrier param actually reaches /api/store/carrier-branches
    // as "correo_argentino" — this is what dispatches to searchCorreoBranches
    // in route.ts instead of defaulting to Andreani.
    await expect
      .poll(() => branchRequests.length, { timeout: 10_000 })
      .toBeGreaterThan(0);
    expect(
      branchRequests.some((url) => url.includes("carrier=correo_argentino")),
    ).toBe(true);

    const rows = page.locator('[data-testid="delivery-branch-row"]');
    await expect(rows).toHaveCount(1, { timeout: 10_000 });

    await expect(
      page.locator('[data-testid="submit-delivery-option-button"]'),
    ).toBeDisabled();

    const req = await waitForSetShippingMethodRequest(page, async () => {
      await rows.filter({ hasText: "Sucursal Correo Once" }).click();
    });
    const body = req.postDataJSON();
    expect(body.data?.carrier).toBe("correo_argentino");
    expect(body.data?.branch_id).toBe("SCQ");
    expect(body.data?.branch_code).toBe("SCQ");

    await expect(
      page.locator('[data-testid="submit-delivery-option-button"]'),
    ).toBeEnabled({ timeout: 10_000 });
  });
});
