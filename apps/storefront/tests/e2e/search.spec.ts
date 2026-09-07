import { expect, type Page, test } from "@playwright/test";

/**
 * SELECTOR: se usa el `aria-label`, NO el placeholder.
 *
 * La versión anterior de esta suite buscaba
 * `input[type="text"][placeholder*="Buscar"]`, y eso estaba roto de dos formas:
 *
 *   1. Las barras que efectivamente shippean (`header-search-bar`,
 *      `mobile-search-bar`) usan `type="search"`, no `type="text"`. El único
 *      input que matcheaba era el de `modules/store/components/search-sort-bar`,
 *      que sólo consume `modules/store/templates/index.tsx` — un template legacy
 *      que NO está referenciado desde `app/`. La suite probaba código que no se
 *      renderiza.
 *   2. Su placeholder es un hint ROTATIVO (`useRotatingHint`, cambia cada
 *      2500 ms entre 6 valores, y sólo uno contiene "Buscar"), así que el
 *      selector habría sido no determinístico incluso con el type correcto.
 *
 * `aria-label="Buscar productos"` es estable y está en las dos barras reales.
 */
const searchInput = (page: Page) =>
  page.getByLabel("Buscar productos").first();

/** El storefront consulta el nodo Typesense directo desde el browser. */
const TYPESENSE_SEARCH = /\/collections\/[^/]+\/documents\/search/;

const productCards = (page: Page) => page.locator("article");

/** Espera a que el PLP termine de pintar el resultado de una búsqueda. */
async function search(page: Page, query: string) {
  const response = page.waitForResponse(TYPESENSE_SEARCH, { timeout: 15_000 });
  await searchInput(page).fill(query);
  await response;
  await page.waitForURL(new RegExp(`q=${encodeURIComponent(query)}`), {
    timeout: 10_000,
  });
  // El grid re-renderiza tras el fetch; sin esto se leen las cards viejas.
  await page.waitForLoadState("networkidle");
}

const firstCardTitle = async (page: Page): Promise<string> =>
  ((await productCards(page).first().textContent()) ?? "").toLowerCase();

const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Introduce una transposición: el typo de tipeo más común. */
const transpose = (word: string): string =>
  word.length < 4
    ? word
    : word.slice(0, 2) + word[3] + word[2] + word.slice(4);

test.describe("Buscador de productos", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/store");
    await page.waitForLoadState("networkidle");
  });

  test("manda la configuración de relevancia que espera el motor", async ({
    page,
  }) => {
    // Este test es independiente del catálogo y ataja las regresiones de config
    // que Typesense castiga con un 400 o, peor, degradando el ranking en silencio.
    const request = page.waitForRequest(TYPESENSE_SEARCH, { timeout: 15_000 });
    await searchInput(page).fill("remera");
    const url = new URL((await request).url());

    const queryBy = (url.searchParams.get("query_by") ?? "").split(",");
    const weights = (url.searchParams.get("query_by_weights") ?? "").split(",");
    const numTypos = (url.searchParams.get("num_typos") ?? "").split(",");
    const prefix = (url.searchParams.get("prefix") ?? "").split(",");

    // Los cuatro arrays van posicionalmente alineados: si no, es un 400.
    expect(queryBy.length).toBeGreaterThan(1);
    expect(weights).toHaveLength(queryBy.length);
    expect(numTypos).toHaveLength(queryBy.length);
    expect(prefix).toHaveLength(queryBy.length);

    // `title` primero y con el mayor peso: bajo `text_match_type: max_score` los
    // pesos sólo desempatan, así que si se repiten no ordenan nada.
    expect(queryBy[0]).toBe("title");
    expect(Number(weights[0])).toBe(Math.max(...weights.map(Number)));
    expect(new Set(weights).size).toBe(weights.length);

    // Identificadores y medidas no deben tolerar typos: "AB1234" no es "AB1235",
    // y "aerosol 500" no debe traer 600 ml.
    expect(url.searchParams.get("enable_typos_for_alpha_numerical_tokens")).toBe("false");
    expect(url.searchParams.get("enable_typos_for_numerical_tokens")).toBe("false");

    // El sort de relevancia NO debe cuantizar el text match: medido contra un
    // catálogo real, `buckets` deja que el merchandising se coma la relevancia.
    expect(url.searchParams.get("sort_by") ?? "").not.toContain("buckets");
  });

  test("encuentra un producto real aunque se tipee con un typo", async ({
    page,
  }) => {
    // Se deriva el término del catálogo en vez de hardcodear "remera": así el test
    // vale igual en cualquier tienda y no se rompe cuando cambia el seed.
    const baseline = await firstCardTitle(page);
    const word = fold(baseline)
      .split(/\s+/)
      .find((w) => w.length >= 6 && /^[a-z]+$/.test(w));
    test.skip(!word, "el catálogo de prueba no tiene un título usable");

    const typo = transpose(word as string);
    expect(typo).not.toBe(word);

    await search(page, typo);
    // Con tolerancia a typos, una transposición sobre una palabra de 6+ letras
    // tiene que seguir devolviendo resultados.
    expect(await productCards(page).count()).toBeGreaterThan(0);
  });

  test("rankea primero el producto cuyo TÍTULO matchea, no su categoría", async ({
    page,
  }) => {
    const baseline = await firstCardTitle(page);
    const word = fold(baseline)
      .split(/\s+/)
      .find((w) => w.length >= 5 && /^[a-z]+$/.test(w));
    test.skip(!word, "el catálogo de prueba no tiene un título usable");

    await search(page, word as string);
    expect(await productCards(page).count()).toBeGreaterThan(0);
    // Ésta es la regresión que motivó el cambio de pesos: con todos los campos
    // empatados en 10, los productos que sólo matchean por categoría empataban
    // con los que matchean por título y el orden lo decidía `metadata.ranking`.
    expect(fold(await firstCardTitle(page))).toContain(word as string);
  });

  test("trata igual la query con y sin acentos", async ({ page }) => {
    await search(page, "rocio");
    const sinAcento = await productCards(page).count();

    await searchInput(page).clear();
    await search(page, "rocío");
    const conAcento = await productCards(page).count();

    expect(conAcento).toBe(sinAcento);
  });

  test("no confunde medidas numéricas parecidas", async ({ page }) => {
    // 500 y 600 están a una edición de distancia. Sin
    // `enable_typos_for_numerical_tokens: false`, buscar 500 ml trae 600 ml.
    await search(page, "500");
    const titles = await productCards(page).allTextContents();
    for (const t of titles) {
      if (/\d/.test(t)) {
        expect(t).not.toMatch(/\b600\b/);
      }
    }
  });

  test("ofrece salida cuando los filtros tapan resultados", async ({ page }) => {
    // El cero-resultados más común en un PLP faceteado no es un typo: es la query
    // combinada con filtros. El conteo sin filtros ya viene en la respuesta.
    await page.goto("/store?q=remera&priceMin=99999999");
    await page.waitForLoadState("networkidle");

    if ((await productCards(page).count()) === 0) {
      const emptyState = page.getByText(/sin resultados|no encontramos/i);
      await expect(emptyState).toBeVisible();
      // Tiene que haber una salida, no un callejón sin salida.
      await expect(
        page.getByRole("button", { name: /sin filtros|limpiar filtros/i }),
      ).toBeVisible();
    }
  });

  test("informa el cero-resultados sin sugerir palabras", async ({ page }) => {
    await search(page, "xyzabc123nonexistent");
    expect(await productCards(page).count()).toBe(0);
    await expect(page.getByText(/no encontramos|no se encontraron/i)).toBeVisible();
  });

  test("no sugiere corregir la palabra cuando la búsqueda ya funcionó", async ({
    page,
  }) => {
    // El buscador de productos NO ofrece correcciones de tipeo: la tolerancia a
    // typos la resuelve el motor del lado del servidor. Sugerirlas en la interfaz
    // resultaba en ruido — "lijas" devolvía 103 lijas y aun así ofrecía
    // "¿Quisiste decir Lija autof triangulo delta PS33CK N.º 80?".
    await search(page, "lijas");
    await expect(page.getByText(/quisiste decir/i)).toHaveCount(0);
  });

  test("el infinite scroll appendea sin duplicar ni reordenar", async ({
    page,
  }) => {
    await page.goto("/store");
    await page.waitForLoadState("networkidle");

    const firstPage = await productCards(page).allTextContents();
    test.skip(firstPage.length < 12, "no hay suficientes productos para paginar");

    await page.mouse.wheel(0, 20_000);
    await page.waitForLoadState("networkidle");

    const afterScroll = await productCards(page).allTextContents();
    if (afterScroll.length > firstPage.length) {
      // El prefijo tiene que quedar intacto: si la segunda página reordena lo ya
      // renderizado, al usuario se le mueven las cards abajo del cursor.
      expect(afterScroll.slice(0, firstPage.length)).toEqual(firstPage);
      // Y sin repetidos.
      expect(new Set(afterScroll).size).toBe(afterScroll.length);
    }
  });

  test("conserva la query al volver por URL", async ({ page }) => {
    await search(page, "mandarina");
    const searchUrl = page.url();

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.goto(searchUrl);
    await page.waitForLoadState("networkidle");

    expect(await searchInput(page).inputValue()).toBe("mandarina");
    expect(page.url()).toContain("q=mandarina");
  });

  test("limpiar la búsqueda vuelve al catálogo completo", async ({ page }) => {
    await search(page, "test");
    await searchInput(page).clear();
    await searchInput(page).press("Enter");
    await page.waitForLoadState("networkidle");

    expect(page.url()).not.toContain("q=");
    expect(await productCards(page).count()).toBeGreaterThan(0);
  });
});

/**
 * La búsqueda por voz vive SÓLO en `modules/store/components/search-sort-bar`,
 * que consume `modules/store/templates/index.tsx` — un template legacy que no está
 * referenciado desde `app/`. O sea: hoy no shippea.
 *
 * El test anterior la "probaba" envuelto en `if (voiceButtonCount > 0)`, así que
 * pasaba vacuamente y daba una señal de cobertura falsa. Queda como `fixme`
 * explícito: si alguien vuelve a exponer voice search en una barra real, esto es
 * lo que hay que reactivar.
 */
test.fixme(
  "búsqueda por voz — no expuesta en ninguna barra que shippee",
  () => {},
);
