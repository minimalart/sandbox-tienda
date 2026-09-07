import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * El aislamiento entre tiendas depende de que NADA que dependa del tenant se sirva
 * desde una caché compartida keyeada sólo por URL.
 *
 * Y hoy ese aislamiento es un EFECTO SECUNDARIO, no una directiva: sólo 16 de 66
 * `page.tsx` declaran `force-dynamic`. Lo que en realidad vuelve dinámica toda la
 * superficie es el acceso implícito a `headers()` desde `app/layout.tsx` (vía
 * `getTenantThemeStyles()` → `getActiveTenant()`) y desde
 * `app/[countryCode]/layout.tsx` (vía `getSiteGateState()`).
 *
 * O sea: alcanza con que alguien cachee `getActiveTenant`, o agregue un `revalidate`
 * a una página, para que la superficie se vuelva estática y una tienda sirva el
 * contenido de otra. Este test es lo que convierte ese efecto secundario en un
 * invariante explícito.
 *
 * Precedente concreto de que el riesgo es real: `api/store/active-promotions` tenía
 * `revalidate = 300` + fallback a `NEXT_PUBLIC_SALES_CHANNEL_ID`, así que servía las
 * promociones del sitio principal a los clientes de cualquier tienda.
 */

const APP_DIR = join(import.meta.dirname, "..", "..", "app");

const ROUTE_FILES = /^(page|route|layout|template|default)\.(ts|tsx)$/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (ROUTE_FILES.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const rel = (p: string): string => relative(APP_DIR, p).split(sep).join("/");

/**
 * Saca comentarios antes de buscar directivas.
 *
 * Sin esto el test es engañable por la PROSA: un archivo que DOCUMENTA el bug
 * ("antes tenía `export const revalidate = 300`…") daría un falso positivo para
 * siempre, y la reacción natural sería borrar el comentario en vez de arreglar el
 * código. Una directiva real nunca puede estar dentro de un comentario, así que
 * strippearlos sólo elimina falsos positivos.
 *
 * El `//` se salta cuando viene después de `:` o `/` para no cortar URLs
 * (`https://…`) al medio.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:/])\/\/.*$/gm, "$1");
}

/** `export const revalidate = <n>` en CÓDIGO → n, o null si no lo declara. */
function revalidateOf(file: string): number | null {
  const code = stripComments(readFileSync(file, "utf8"));
  const m = /export const revalidate(?::\s*number)?\s*=\s*(\d+)/.exec(code);
  return m ? Number(m[1]) : null;
}

/** Código del archivo sin comentarios, para buscar identificadores reales. */
const codeOf = (file: string): string => stripComments(readFileSync(file, "utf8"));

const ALL = walk(APP_DIR);

describe("nada bajo [countryCode] se puede volver estático", () => {
  const tree = ALL.filter((f) => rel(f).startsWith("[countryCode]/"));

  it("hay archivos que revisar (el walker no está mirando al vacío)", () => {
    assert.ok(tree.length > 20, `esperaba >20 archivos ruteables, encontré ${tree.length}`);
  });

  it("si declara revalidate, es 0 — nunca un TTL", () => {
    // `revalidate = 0` NO es el riesgo: es "no cachear nunca", o sea un refuerzo.
    // El riesgo es cualquier valor > 0, que mete la página en el Full Route Cache
    // keyeado sólo por URL — y los paths de sub-ruta son idénticos entre hosts.
    for (const file of tree) {
      const value = revalidateOf(file);
      if (value === null) continue;
      assert.equal(
        value,
        0,
        `${rel(file)} declara revalidate = ${value}. Los paths bajo [countryCode] son ` +
          `los MISMOS para todas las tiendas, así que un TTL > 0 sirve el contenido de ` +
          `una tienda en el host de otra. Si necesitás cachear, meté el slug en la key.`,
      );
    }
  });

  it("nadie declara force-static ni fetchCache", () => {
    for (const file of tree) {
      const src = codeOf(file);
      assert.equal(
        src.includes("force-static"),
        false,
        `${rel(file)} declara force-static: congelaría una tienda para todos los hosts.`,
      );
      assert.equal(
        /export const fetchCache/.test(src),
        false,
        `${rel(file)} declara fetchCache: puede forzar el cacheo de fetches por tenant.`,
      );
    }
  });
});

describe("las rutas /api con TTL compartido son sólo las que no dependen del tenant", () => {
  /**
   * Allowlist EXPLÍCITA. Cada entrada tiene que ser data de la INSTANCIA, no de un
   * sitio: si no tiene dimensión de tenant, no hay nada que pueda filtrar.
   */
  const TENANT_INDEPENDENT: Record<string, string> = {
    "api/store/store-config/route.ts":
      "Resuelve de STORE_CONFIG_MODULE y no acepta slug ni sales_channel_id: " +
      "multi_branch_enabled, cookie_banner_enabled, email_branding… son de la instancia.",
    "api/store/minimum-purchase/route.ts":
      "Ídem: el monto mínimo de compra es de la instancia, no de un sitio.",
  };

  it("ninguna ruta /api tiene revalidate > 0 fuera de la allowlist", () => {
    for (const file of ALL.filter((f) => rel(f).startsWith("api/"))) {
      const value = revalidateOf(file);
      if (value === null || value === 0) continue;
      assert.ok(
        rel(file) in TENANT_INDEPENDENT,
        `${rel(file)} tiene revalidate = ${value} y NO está en la allowlist. El Full ` +
          `Route Cache keyea sólo por URL: si la respuesta depende de la tienda (canal, ` +
          `catálogo, branding), estás sirviendo la de otra. Agregala a la allowlist SÓLO ` +
          `si es data de la instancia, con el motivo escrito.`,
      );
    }
  });

  it("la allowlist no tiene entradas muertas", () => {
    // Una entrada que ya no existe (o que le sacaron el revalidate) es permiso
    // acumulado sin motivo: se borra.
    for (const path of Object.keys(TENANT_INDEPENDENT)) {
      const file = ALL.find((f) => rel(f) === path);
      assert.ok(file, `la allowlist menciona ${path}, que ya no existe`);
      assert.ok(
        (revalidateOf(file) ?? 0) > 0,
        `${path} ya no declara revalidate: sacalo de la allowlist`,
      );
    }
  });

  it("active-promotions ya no tiene revalidate (era el leak)", () => {
    const file = ALL.find((f) => rel(f) === "api/store/active-promotions/route.ts");
    assert.ok(file, "no encontré active-promotions/route.ts");
    assert.equal(
      revalidateOf(file),
      null,
      "active-promotions volvió a declarar revalidate: su respuesta depende del canal " +
        "de la tienda, así que un TTL compartido filtra las promos del principal.",
    );
  });

  it("active-promotions no cae al canal del sitio principal", () => {
    const src = codeOf(ALL.find((f) => rel(f) === "api/store/active-promotions/route.ts")!);
    assert.equal(
      src.includes("NEXT_PUBLIC_SALES_CHANNEL_ID"),
      false,
      "volvió el fallback a NEXT_PUBLIC_SALES_CHANNEL_ID: sin query param, el browser " +
        "de una tienda recibiría las promociones del sitio principal.",
    );
  });
});
