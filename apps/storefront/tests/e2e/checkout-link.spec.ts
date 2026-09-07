import { type APIRequestContext, expect, request, test } from "@playwright/test";

/**
 * E2E coverage for the preloaded checkout links feature.
 *
 * - The "invalid link" test is self-contained: the token is resolved
 *   server-side (RSC), so even with the backend down the page catches the
 *   failure and renders the "no longer available" UI.
 * - The "happy path" test needs a live backend with seeded products and an
 *   admin API key to mint a real token (the resolve cannot be mocked because it
 *   runs server-side). It skips gracefully when those prerequisites are missing.
 */

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000";
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY;
const ADMIN_API_KEY = process.env.MEDUSA_ADMIN_API_KEY;

test.describe("Checkout Link Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Start from a clean session so the cart is always built from the link.
    await page.context().clearCookies();
  });

  test("shows an error when the link is invalid or expired", async ({
    page,
  }) => {
    await page.goto(`/c/no-existe-${Date.now()}`);

    await expect(
      page.getByText("Este link ya no está disponible"),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Ir a la tienda" }),
    ).toBeVisible();
  });

  test.describe("with a real preloaded link", () => {
    let token: string | null = null;
    let countryCode = "";
    let skipReason = "";
    let api: APIRequestContext;

    test.beforeAll(async () => {
      if (!PUBLISHABLE_KEY || !ADMIN_API_KEY) {
        skipReason =
          "Missing NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY or MEDUSA_ADMIN_API_KEY";
        return;
      }

      api = await request.newContext({ baseURL: BACKEND_URL });

      try {
        // 1) Pick a region + country from the store API.
        const regionsRes = await api.get("/store/regions", {
          headers: { "x-publishable-api-key": PUBLISHABLE_KEY },
        });
        if (!regionsRes.ok()) {
          skipReason = `Backend not reachable (/store/regions -> ${regionsRes.status()})`;
          return;
        }
        const { regions } = await regionsRes.json();
        const region = regions?.[0];
        const iso2 = region?.countries?.[0]?.iso_2;
        if (!region || !iso2) {
          skipReason = "No region/country configured in the backend";
          return;
        }
        countryCode = iso2;

        // 2) Grab a real variant to add to the cart.
        const productsRes = await api.get("/store/products", {
          headers: { "x-publishable-api-key": PUBLISHABLE_KEY },
          params: {
            limit: "1",
            fields: "id,*variants",
            region_id: region.id,
          },
        });
        if (!productsRes.ok()) {
          skipReason = `Could not list products (-> ${productsRes.status()})`;
          return;
        }
        const { products } = await productsRes.json();
        const variantId = products?.[0]?.variants?.[0]?.id;
        if (!variantId) {
          skipReason = "No seeded products/variants available";
          return;
        }

        // 3) Create a checkout link via the admin API (Basic auth with the key).
        const auth =
          "Basic " + Buffer.from(`${ADMIN_API_KEY}:`).toString("base64");
        const createRes = await api.post("/admin/checkout-links", {
          headers: { Authorization: auth },
          data: {
            internal_name: "E2E preloaded link",
            country_code: countryCode,
            region_id: region.id,
            items: [{ variant_id: variantId, quantity: 1 }],
          },
        });
        if (!createRes.ok()) {
          skipReason = `Could not create checkout link (-> ${createRes.status()})`;
          return;
        }
        const { checkout_link } = await createRes.json();
        token = checkout_link?.token ?? null;
        if (!token) {
          skipReason = "Admin API did not return a token";
        }
      } catch (error) {
        skipReason = `Setup failed: ${(error as Error).message}`;
      }
    });

    test.afterAll(async () => {
      await api?.dispose();
    });

    test("builds the cart and lands on checkout", async ({ page }) => {
      test.skip(!!skipReason, skipReason);

      await page.goto(`/${countryCode}/c/${token}`);

      // The server-side builder route handler builds the cart and redirects
      // into the standard checkout.
      await page.waitForURL(/\/checkout(\?|$)/, { timeout: 20_000 });

      // The cart was actually preloaded: the cart page shows the line item.
      await page.goto(`/${countryCode}/cart`);
      await page.waitForLoadState("networkidle");
      await expect(
        page.locator('[data-testid="product-row"]').first(),
      ).toBeVisible({ timeout: 15_000 });
    });
  });
});
