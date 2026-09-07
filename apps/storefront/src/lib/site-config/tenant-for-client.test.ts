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
