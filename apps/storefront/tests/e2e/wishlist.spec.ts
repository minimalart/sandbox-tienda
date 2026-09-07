import { expect, test } from "@playwright/test";

test.describe("Wishlist Flow", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    await page.goto("/store");
    await page.waitForLoadState("networkidle");
  });

  test("should persist guest favorites after reload", async ({ page }) => {
    const wishlistButton = page
      .locator('button[aria-label="Agregar a favoritos"]')
      .first();

    await expect(wishlistButton).toBeVisible();
    await wishlistButton.click();

    await expect(
      page.locator('button[aria-label="Quitar de favoritos"]').first(),
    ).toBeVisible();

    await page.reload();
    await page.waitForLoadState("networkidle");

    await expect(
      page.locator('button[aria-label="Quitar de favoritos"]').first(),
    ).toBeVisible();
  });

  test("should open favorites drawer from header", async ({ page }) => {
    const wishlistButton = page
      .locator('button[aria-label="Agregar a favoritos"]')
      .first();

    await expect(wishlistButton).toBeVisible();
    await wishlistButton.click();

    await page.locator('[data-testid="nav-wishlist-link"]').click();

    await expect(page.getByText("Favoritos")).toBeVisible();
    await expect(
      page.locator('button[aria-label="Quitar de favoritos"]').first(),
    ).toBeVisible();
  });
});
