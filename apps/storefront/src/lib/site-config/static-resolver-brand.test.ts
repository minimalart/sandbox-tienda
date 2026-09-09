import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

/**
 * ESTE es el test que cierra el seam, y la razón por la que existe es que ya volvió
 * dos veces.
 *
 * `getTenant()` (`site-config/resolver.ts`) es el resolver ESTÁTICO y client-safe:
 * devuelve SIEMPRE `defaultConfig`, con `name: "Mercatto"`, sin mirar la request. El
 * que resuelve la tienda real es `getActiveTenant()` (`site-config/active-tenant.ts`).
 *
 * Una ruta que resuelve la marca con `getTenant()` emite la marca del boilerplate en
 * toda tienda que no sea la principal. Historial:
 *
 *  - PR #940 (DESDEELSUR-49) lo encontró y lo arregló en `/checkout`, `/c/[token]` y
 *    `/store`. Dejó afuera cuatro rutas hermanas.
 *  - Semanas después seguían vivas en producción: `Catálogo | Mercatto | Desde el sur`,
 *    `Pago Exitoso | Mercatto | Desde el sur` (más `pending` y `failure` — las tres
 *    pantallas que ve el cliente JUSTO DESPUÉS DE PAGAR), la `description` de
 *    `/collections/[handle]`, y `/about`, que además escribía "Mercatto" en el cuerpo
 *    VISIBLE.
 *
 * Arreglar de a una ruta es exactamente lo que falló. Lo que ata el invariante al
 * árbol REAL del App Router es este walker: si alguien agrega mañana una página
 * copiando a un vecino, el test falla antes del deploy.
 *
 * El invariante NO es "prohibido importar `getTenant` en `app/`": hay usos legítimos
 * que no tocan la marca (`/colores`, `/cart`, `/sucursales`, `api/store/auth`,
 * `account/subscriptions`). Es más angosto y más útil: **si una ruta importa el
 * resolver estático, no puede leer de él la identidad del sitio.**
 */

const APP_DIR = join(import.meta.dirname, "..", "..", "app");

const SOURCE_FILE = /\.(ts|tsx)$/;
const TEST_FILE = /\.(test|spec)\.(ts|tsx)$/;

/**
 * Import REAL de `getTenant` desde el resolver estático.
 *
 * Tiene que matchear el `import`, no cualquier mención: los archivos ya arreglados
 * NOMBRAN `site-config/resolver.ts` en el comentario que explica por qué dejaron de
 * usarlo. Un `rg -l 'site-config/resolver'` los marca a todos como culpables — es el
 * primer falso positivo que encontré escribiendo esto.
 */
const STATIC_IMPORT =
  /import\s*\{[^}]*\bgetTenant\b[^}]*\}\s*from\s*["'][^"']*site-config\/resolver(?:\.ts)?["']/;

/** Lecturas de identidad del sitio: lo que NO puede salir del resolver estático. */
const BRAND_READS: { pattern: RegExp; what: string }[] = [
  { pattern: /\btenant\.name\b/, what: "tenant.name" },
  { pattern: /\btenant\.metadata\b/, what: "tenant.metadata" },
  { pattern: /getTenant\(\)\s*\)\s*\.\s*(?:name|metadata)\b/, what: "(await getTenant()).name" },
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (SOURCE_FILE.test(entry) && !TEST_FILE.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** Devuelve los nombres de marca que `file` lee del resolver estático. Vacío = limpio. */
function brandReadsFromStaticResolver(source: string): string[] {
  if (!STATIC_IMPORT.test(source)) return [];
  return BRAND_READS.filter(({ pattern }) => pattern.test(source)).map(({ what }) => what);
}

describe("el resolver estático no puede dar la identidad del sitio", () => {
  it("ninguna ruta de app/ lee la marca de getTenant()", () => {
    const offenders: string[] = [];

    for (const file of walk(APP_DIR)) {
      const reads = brandReadsFromStaticResolver(readFileSync(file, "utf8"));
      if (reads.length > 0) {
        offenders.push(`${relative(APP_DIR, file)} → ${reads.join(", ")}`);
      }
    }

    assert.deepEqual(
      offenders,
      [],
      "Estas rutas resuelven la identidad del sitio con el resolver ESTÁTICO " +
        "`getTenant()`, así que van a emitir la marca del boilerplate ('Mercatto') en " +
        "toda tienda que no sea la principal.\n\n" +
        offenders.map((o) => `  · ${o}`).join("\n") +
        "\n\nUsá `getActiveTenant()` (`@lib/site-config/active-tenant`). Y si lo único " +
        "que hacía falta era el sufijo de marca del `<title>`, no resuelvas nada: lo " +
        "agrega el `title.template` del root layout — repetirlo emite `Página | Marca " +
        "| Marca`.",
    );
  });

  /**
   * El detector se prueba a sí mismo.
   *
   * Un chequeo que sale verde POR VACÍO es peor que no chequear: deja la sensación de
   * que está cubierto. Si mañana alguien renombra el resolver, o cambia el estilo de
   * import, `STATIC_IMPORT` deja de matchear, el walker no encuentra a nadie y el test
   * de arriba pasa para siempre sin mirar nada. Estos dos casos son la prueba de que
   * el escáner ve.
   */
  it("el detector reconoce el patrón que tiene que prohibir", () => {
    const culpable = [
      'import { getTenant } from "@lib/site-config/resolver";',
      "export async function generateMetadata() {",
      "  const tenant = await getTenant();",
      "  return { title: `Catálogo | ${tenant.name}` };",
      "}",
    ].join("\n");

    assert.deepEqual(
      brandReadsFromStaticResolver(culpable),
      ["tenant.name"],
      "el detector dejó pasar el patrón exacto que estuvo vivo en producción",
    );
  });

  it("no marca los archivos ya arreglados, que nombran el resolver en un comentario", () => {
    const inocente = [
      "import { getActiveTenant } from '@lib/site-config/active-tenant'",
      "/**",
      " * `getActiveTenant()`, no `getTenant()`: el resolver ESTÁTICO de",
      " * `site-config/resolver.ts` devuelve siempre defaultConfig (name: 'Mercatto').",
      " */",
      "export async function generateMetadata() {",
      "  const tenant = await getActiveTenant()",
      "  return { description: `Explorá el catálogo de ${tenant.name}.` }",
      "}",
    ].join("\n");

    assert.deepEqual(
      brandReadsFromStaticResolver(inocente),
      [],
      "un comentario que MENCIONA el resolver estático no es un uso del resolver estático",
    );
  });

  /** Uso legítimo: importar `getTenant` para algo que no es la identidad del sitio. */
  it("no marca un uso del resolver estático que no lee la marca", () => {
    const legitimo = [
      'import { getTenant } from "@lib/site-config/resolver";',
      "export default async function Page() {",
      "  const tenant = await getTenant();",
      "  return <Widget apiKey={tenant.medusa.publishableKey} />;",
      "}",
    ].join("\n");

    assert.deepEqual(brandReadsFromStaticResolver(legitimo), []);
  });
});
