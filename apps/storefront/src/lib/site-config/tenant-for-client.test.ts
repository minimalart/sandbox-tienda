import assert from "node:assert/strict";
import { test } from "node:test";
import { tenantForClient } from "./tenant-for-client";
import type { TenantConfig } from "./types";

/**
 * Regresión de DESDEELSUR-49, punto 4: "contenidos residuales de otras plantillas".
 *
 * El HTML de producción de desdeelsur —una pinturería, `template: "grocery"`— traía
 * "Celulares", "Setup gamer", "Smart Home", "Indumentaria" y decenas de fotos de
 * Unsplash en el payload RSC de cada página, porque `TenantProvider` serializa el
 * `TenantConfig` entero y el merge le pega los cuatro configs de template.
 */

const base = (
  template: string,
  assets: Record<string, unknown>
): TenantConfig =>
  ({
    id: "storefront",
    name: "Desde el sur",
    template,
    assets,
  }) as unknown as TenantConfig;

const TEMPLATE_ASSETS = {
  technology: { hero: { eyebrow: "Mercatto Tech" } },
  fashion: { hero: { title: "Moda" } },
  techRetail: { hero: { title: "Tech Retail" } },
  sports: { hero: { title: "Deportes" } },
};

test("grocery: se van los CUATRO bloques de template", () => {
  const out = tenantForClient(
    base("grocery", { logos: { main: "/logo.svg" }, ...TEMPLATE_ASSETS })
  );
  const assets = out.assets as unknown as Record<string, unknown>;

  for (const key of ["technology", "fashion", "techRetail", "sports"]) {
    assert.equal(key in assets, false, `${key} no debería viajar al cliente`);
  }
  // Lo que no es de un template se conserva intacto.
  assert.deepEqual(assets.logos, { main: "/logo.svg" });
});

test("cada template conserva SU bloque y descarta los otros tres", () => {
  const cases: [string, string][] = [
    ["technology", "technology"],
    ["fashion", "fashion"],
    // El template se llama `tech-retail` pero la clave de assets es `techRetail`:
    // el mapeo no es identidad, y por eso existe la tabla.
    ["tech-retail", "techRetail"],
    ["sports", "sports"],
  ];

  for (const [template, kept] of cases) {
    const assets = tenantForClient(
      base(template, { ...TEMPLATE_ASSETS })
    ).assets as unknown as Record<string, unknown>;

    assert.equal(kept in assets, true, `${template} tiene que conservar ${kept}`);
    for (const other of ["technology", "fashion", "techRetail", "sports"]) {
      if (other === kept) continue;
      assert.equal(other in assets, false, `${template} no debería llevar ${other}`);
    }
  }
});

test("no muta el tenant original", () => {
  // El mismo objeto lo siguen usando los Server Components — `(main)/layout.tsx` decide
  // con él qué chrome montar. Recortarlo in-place rompería esa decisión.
  const original = base("grocery", { ...TEMPLATE_ASSETS });
  tenantForClient(original);
  const assets = original.assets as unknown as Record<string, unknown>;
  assert.equal("technology" in assets, true);
  assert.equal("sports" in assets, true);
});

test("un template desconocido descarta los cuatro y no explota", () => {
  const assets = tenantForClient(
    base("un-template-nuevo", { ...TEMPLATE_ASSETS })
  ).assets as unknown as Record<string, unknown>;
  assert.deepEqual(Object.keys(assets), []);
});

test("sin assets no rompe", () => {
  const out = tenantForClient({ id: "x", name: "X", template: "grocery" } as unknown as TenantConfig);
  assert.deepEqual(out.assets, {});
});

/**
 * Regresión de DESDEELSUR-61, BUG-10: "Config JSON con datos de otro cliente
 * ('Mercatto', supermercado) embebida en el HTML de todas las páginas".
 *
 * `defaultConfig` es el baseline de cualquier deploy del boilerplate, pero su
 * contenido es el de un supermercado concreto. `mergeMainTenant` es shallow por
 * clave de `assets`, así que toda sección que la fila del sitio no define se queda
 * con la del demo. QA lo encontró con Ctrl+U sobre producción.
 */

const GROCERY_CONTENT = {
  partners: [{ name: "Mercatto", src: "/logo_full.webp" }],
  moreProducts: {
    title: "Conocé más categorías",
    subtitle: "Recorré todo el supermercado.",
    items: [{ categoryId: "more-frescos", label: "Frutas y Verduras" }],
  },
  collections: {
    collections: [{ collectionId: "col-frescos", label: "Frutas y Verduras" }],
  },
  heroBanners: { slides: [{ cta: { text: "Ver frescos", href: "/store?q=frescos" } }] },
  shoppableVideos: { videos: [{ id: "v1" }] },
  resellerKits: { kits: [] },
};

test("BUG-10: las secciones de home del baseline no viajan al cliente", () => {
  const assets = tenantForClient(
    base("grocery", { logos: { main: "/logo.svg" }, ...GROCERY_CONTENT })
  ).assets as unknown as Record<string, unknown>;

  for (const key of Object.keys(GROCERY_CONTENT)) {
    assert.equal(key in assets, false, `${key} no debería viajar al cliente`);
  }
  // El branding sí: lo leen Client Components.
  assert.deepEqual(assets.logos, { main: "/logo.svg" });
});

test("BUG-10: no queda rastro de 'Mercatto' ni del supermercado en el payload", () => {
  // El chequeo tal como lo hace QA: serializar y buscar el string, que es lo que ve
  // quien abre el código fuente de la página.
  const out = tenantForClient(
    base("grocery", { logos: { main: "/logo.svg" }, ...GROCERY_CONTENT })
  );
  const payload = JSON.stringify(out).toLowerCase();

  for (const needle of ["mercatto", "frescos", "supermercado", "frutas y verduras"]) {
    assert.equal(payload.includes(needle), false, `"${needle}" no debería estar en el payload`);
  }
});

test("BUG-10: searchSuggestions SÍ viaja — lo lee el header, que es client", () => {
  const assets = tenantForClient(
    base("grocery", {
      ...GROCERY_CONTENT,
      searchSuggestions: [{ label: "Pinturas", query: "pinturas" }],
    })
  ).assets as unknown as Record<string, unknown>;

  assert.ok(assets.searchSuggestions, "header-search-bar lo lee desde el contexto");
});

test("BUG-10: tampoco muta el tenant original", () => {
  // Los Server Components siguen necesitando las secciones: HomeRenderer las monta.
  const original = base("grocery", { ...GROCERY_CONTENT });
  tenantForClient(original);
  const assets = original.assets as unknown as Record<string, unknown>;
  assert.equal("partners" in assets, true);
  assert.equal("collections" in assets, true);
});
