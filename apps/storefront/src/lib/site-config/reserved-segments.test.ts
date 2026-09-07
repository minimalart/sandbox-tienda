import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { isValidSlugShape, ROUTABLE_SEGMENTS } from "./reserved-segments.ts";

/**
 * ESTE es el test que evita el incidente silencioso: alguien agrega
 * `(main)/ofertas/page.tsx` en seis meses y, sin querer, le tapa el sitio al cliente
 * que tiene el slug `ofertas` — su `/tienda/ofertas` empieza a resolver la página
 * nueva en vez de su tienda.
 *
 * No alcanza con mantener la lista a mano: hay que atarla al árbol REAL del App
 * Router. Este walker es esa atadura.
 */

const APP_DIR = join(import.meta.dirname, "..", "..", "app");

const isRouteGroup = (name: string): boolean => name.startsWith("(") && name.endsWith(")");
const isDynamic = (name: string): boolean => name.startsWith("[");
const isPrivate = (name: string): boolean => name.startsWith("_") || name.startsWith(".");

const ROUTE_FILE = /^(page|route)\.(ts|tsx|js|jsx)$/;

/** ¿Este folder produce una URL alcanzable en algún nivel de profundidad? */
function containsRoute(dir: string): boolean {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (containsRoute(full)) return true;
    } else if (ROUTE_FILE.test(entry)) {
      return true;
    }
  }
  return false;
}

/**
 * Segmentos de URL de primer nivel que salen de `dir`.
 *
 * Los route groups `(x)` NO crean segmento: se desciende. Los dinámicos `[x]` tampoco
 * son un nombre fijo con el que un slug pueda chocar (y `[countryCode]` es el comodín
 * que el proxy usa internamente), así que sólo se desciende en el que se pida.
 */
function firstLevelSegments(dir: string, descendInto: string[] = []): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (!statSync(full).isDirectory()) continue;
    if (isPrivate(entry)) continue;

    if (isRouteGroup(entry)) {
      found.push(...firstLevelSegments(full, descendInto));
      continue;
    }
    if (isDynamic(entry)) {
      if (descendInto.includes(entry)) found.push(...firstLevelSegments(full, descendInto));
      continue;
    }
    if (containsRoute(full)) found.push(entry);
  }
  return found;
}

// Se desciende en `[countryCode]` porque el proxy lo inyecta: la URL pública NUNCA lo
// incluye, así que sus hijos SÍ son segmentos de primer nivel para el usuario.
const actual = [...new Set(firstLevelSegments(APP_DIR, ["[countryCode]"]))].sort();
const declared = [...new Set(ROUTABLE_SEGMENTS)].sort();

describe("la lista reservada refleja el árbol real de rutas", () => {
  it("el walker encontró algo (no está mirando al vacío)", () => {
    assert.ok(existsSync(APP_DIR), `no existe ${APP_DIR}`);
    assert.ok(actual.length > 20, `esperaba >20 segmentos, encontré ${actual.length}`);
  });

  it("NINGÚN segmento ruteable falta en la lista", () => {
    const missing = actual.filter((s) => !declared.includes(s));
    assert.deepEqual(
      missing,
      [],
      `Estos segmentos existen en src/app pero NO están en ROUTABLE_SEGMENTS: ` +
        `${missing.join(", ")}.\n` +
        `Un slug con ese nombre le taparía el sitio a un cliente. Agregalos a ` +
        `reserved-segments.ts Y a su espejo del backend ` +
        `(modules/demo-store/reserved-slugs.ts).`,
    );
  });

  it("la lista no declara segmentos que ya no existen (salvo los intencionales)", () => {
    // Reservar de más es SEGURO y a veces deliberado: `tienda` es el prefijo (no un
    // folder), `tiendas` es el plural que se reserva de prevención, y `demo` sobrevive
    // sólo como origen del 308. Lo que se vigila es que no se acumule basura sin razón.
    const INTENTIONAL = new Set(["tienda", "tiendas", "demo"]);
    const stale = declared.filter((s) => !actual.includes(s) && !INTENTIONAL.has(s));
    assert.deepEqual(
      stale,
      [],
      `ROUTABLE_SEGMENTS declara segmentos que ya no existen en src/app: ${stale.join(", ")}. ` +
        `Si los borraste, sacalos de la lista o movelos a INTENTIONAL con el motivo. ` +
        `OJO: sacar uno LIBERA ese slug, y si alguna tienda ya lo tomó, volver a ` +
        `agregarlo después es breaking.`,
    );
  });
});

describe("todos los segmentos reservados serían slugs plausibles", () => {
  it("un segmento que nunca podría ser un slug no hace falta reservarlo", () => {
    // Documenta por qué la lista tiene lo que tiene: `llms.txt` lleva un punto, así que
    // el patrón de slug ya lo rechaza — está por si acaso, no por necesidad.
    const conPunto = declared.filter((s) => s.includes("."));
    assert.deepEqual(conPunto, ["llms.txt"], "sólo llms.txt debería tener punto");
  });

  it("ningún segmento reservado pasa isValidSlugShape (son todos ilegales como slug)", () => {
    // El invariante circular que confirma que la lista está enchufada: si un segmento
    // ruteable pasara la validación, sería tomable como slug.
    for (const segment of declared) {
      assert.equal(
        isValidSlugShape(segment),
        false,
        `"${segment}" está en la lista pero isValidSlugShape lo acepta: no está enchufado`,
      );
    }
  });
});
