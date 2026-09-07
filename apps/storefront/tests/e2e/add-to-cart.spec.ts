import { expect, test } from "@playwright/test";

const REGEX_BORDER_INDIGO = /border-\[--primary-color\]/;
const REGEX_OPACITY_FULL = /opacity-100/;

test.describe("Add to Cart Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to home page
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("should add product to cart from featured products quick view", async ({
    page,
  }) => {
    // Click on first featured product card to open quick view
    const firstProduct = page.locator("article.interactive-elevate").first();
    await firstProduct.click();

    // Wait for quick view modal to appear
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Wait for product title to be visible
    await expect(page.locator("h3.text-xl").first()).toBeVisible();

    // Check if radio group options are preselected
    const selectedOption = page.locator('input[type="radio"]:checked').first();
    await expect(selectedOption).toBeChecked();

    // Get initial cart count
    const cartButton = page.locator('[data-testid="nav-cart-link"]');
    const initialCartText = await cartButton.textContent();

    // Click "Agregar al carrito" button
    const addToCartButton = page
      .locator('button:has-text("Agregar al carrito")')
      .first();
    await addToCartButton.click();

    // Wait for the button loading state to finish
    await expect(addToCartButton).not.toBeDisabled({ timeout: 10_000 });

    // Wait for cart count to update (should increase)
    await page.waitForTimeout(1000); // Give time for router.refresh()

    // Verify cart count increased
    const updatedCartText = await cartButton.textContent();
    expect(updatedCartText).not.toBe(initialCartText);
  });

  test("should add product to cart from product detail page", async ({
    page,
  }) => {
    // Navigate to store page
    await page.goto("/store");
    await page.waitForLoadState("networkidle");

    // Click on first product card
    const firstProductLink = page.locator("article a").first();
    await firstProductLink.click();

    // Wait for product detail page to load
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1").first()).toBeVisible();

    // Check if radio group options are preselected
    const selectedOption = page.locator('input[type="radio"]:checked').first();
    if ((await selectedOption.count()) > 0) {
      await expect(selectedOption).toBeChecked();
    }

    // Get initial cart count
    const cartButton = page.locator('[data-testid="nav-cart-link"]');
    const initialCartText = await cartButton.textContent();

    // Click "Agregar al carrito" button
    const addToCartButton = page
      .locator('button:has-text("Agregar al carrito")')
      .first();
    await addToCartButton.click();

    // Wait for the button loading state to finish
    await expect(addToCartButton).not.toBeDisabled({ timeout: 10_000 });

    // Wait for cart count to update
    await page.waitForTimeout(1000);

    // Verify cart count increased
    const updatedCartText = await cartButton.textContent();
    expect(updatedCartText).not.toBe(initialCartText);
  });

  test("should open mini cart drawer when clicking cart icon", async ({
    page,
  }) => {
    // Add a product first
    const firstProduct = page.locator("article.interactive-elevate").first();
    await firstProduct.click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    const addToCartButton = page
      .locator('button:has-text("Agregar al carrito")')
      .first();
    await addToCartButton.click();
    await expect(addToCartButton).not.toBeDisabled({ timeout: 10_000 });

    // Close quick view
    const closeButton = page.locator('button:has-text("Cerrar")').first();
    await closeButton.click();
    await page.waitForTimeout(500);

    // Click cart icon to open drawer
    const cartButton = page.locator('[data-testid="nav-cart-link"]');
    await cartButton.click();

    // Wait for drawer to appear with animation
    await page.waitForTimeout(600);

    // Verify drawer is visible
    const drawer = page.locator("text=Carrito de compras");
    await expect(drawer).toBeVisible();

    // Verify cart has items
    const cartItem = page.locator('[data-testid="cart-item"]').first();
    await expect(cartItem).toBeVisible();

    // Verify subtotal is displayed
    const subtotal = page.locator('[data-testid="cart-subtotal"]');
    await expect(subtotal).toBeVisible();
  });

  test("should change variant selection in quick view", async ({ page }) => {
    // Click on first featured product card
    const firstProduct = page.locator("article.interactive-elevate").first();
    await firstProduct.click();

    // Wait for quick view modal
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Check if there are multiple variant options
    const radioOptions = page.locator('input[type="radio"]');
    const optionCount = await radioOptions.count();

    if (optionCount > 1) {
      // Get the first option text
      const firstOptionLabel = page
        .locator('label:has(input[type="radio"])')
        .first();
      const _firstOptionText = await firstOptionLabel.textContent();

      // Click on second option
      const secondOption = page
        .locator('label:has(input[type="radio"])')
        .nth(1);
      await secondOption.click();

      // Verify second option is now checked
      const secondRadio = secondOption.locator('input[type="radio"]');
      await expect(secondRadio).toBeChecked();

      // Verify first option is not checked
      const firstRadio = firstOptionLabel.locator('input[type="radio"]');
      await expect(firstRadio).not.toBeChecked();
    }
  });

  test("should show check icon on selected radio option", async ({ page }) => {
    // Click on first featured product card
    const firstProduct = page.locator("article.interactive-elevate").first();
    await firstProduct.click();

    // Wait for quick view modal
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Find the selected radio option label
    const selectedLabel = page
      .locator('label:has(input[type="radio"]:checked)')
      .first();

    if ((await selectedLabel.count()) > 0) {
      // Verify the label has indigo border (selected state)
      await expect(selectedLabel).toHaveClass(REGEX_BORDER_INDIGO);

      // Verify check icon is visible (opacity-100)
      const checkIcon = selectedLabel.locator("svg").last();
      await expect(checkIcon).toHaveClass(REGEX_OPACITY_FULL);
    }
  });
});
