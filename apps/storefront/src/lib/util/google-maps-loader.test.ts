import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { GOOGLE_MAPS_LIBRARIES } from "./google-maps-loader";

/**
 * Regresión de un bug vivo en producción (DESDEELSUR-52, DESDEELSUR-54).
 *
 * `useJsApiLoader` mantiene UN loader por documento y lanza
 * `Loader must not be called again with different options` si un segundo
 * consumidor pide `libraries` distintas. El sitio tenía tres configuraciones
 * conviviendo — `["maps"]` implícita en /contact, `["places"]` en /sucursales y
 * `["places","marker"]` en checkout — así que navegar de una a otra reventaba la
 * segunda y caía al error boundary: "No pudimos cargar esta sección".
 *
 * Este test no prueba el mapa: prueba que NADIE vuelva a declarar su propia
 * lista de libraries. Es la única barrera contra un quinto consumidor que
 * reintroduzca el bug sin que nadie lo note hasta producción.
 */

const UTIL_DIR = import.meta.dirname;
const REPO_ROOT = path.resolve(UTIL_DIR, "../../../../..");

/** Árboles donde puede vivir un consumidor: el storefront y los payloads de extensiones. */
const SEARCH_ROOTS = [
  path.resolve(UTIL_DIR, "../.."),
  path.join(REPO_ROOT, "packages/extensions"),
].filter(existsSync);

const SKIP_DIRS = new Set(["node_modules", ".next", "dist", ".git"]);

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      collectSourceFiles(path.join(dir, entry.name), out);
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith(".test.ts")) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

const consumers = SEARCH_ROOTS.flatMap((root) => collectSourceFiles(root))
  .map((file) => ({ file, source: readFileSync(file, "utf8") }))
  .filter(({ source }) => source.includes("useJsApiLoader("));

test("el superset de libraries cubre lo que el sitio usa", () => {
  assert.deepEqual([...GOOGLE_MAPS_LIBRARIES].sort(), ["marker", "places"]);
});

test("hay consumidores para revisar (el barrido no quedó vacío)", () => {
  assert.ok(
    consumers.length >= 5,
    `esperaba al menos 5 consumidores de useJsApiLoader, encontré ${consumers.length}. ` +
      "Si el barrido dejó de encontrarlos, este test dejó de proteger nada.",
  );
});

test("todo consumidor de useJsApiLoader usa las libraries canónicas", () => {
  const offenders = consumers
    .filter(
      ({ source }) =>
        !source.includes("libraries: GOOGLE_MAPS_LIBRARIES") ||
        !source.includes("google-maps-loader"),
    )
    .map(({ file }) => path.relative(REPO_ROOT, file));

  assert.deepEqual(
    offenders,
    [],
    "Estos archivos llaman a useJsApiLoader sin las libraries canónicas. " +
      "Importá GOOGLE_MAPS_LIBRARIES de @lib/util/google-maps-loader: opciones " +
      "distintas rompen la navegación entre páginas con mapa.\n" +
      offenders.join("\n"),
  );
});

/** Un array literal en la llamada, o una constante local llamada `libraries`/`LIBRARIES`. */
const LOCAL_LIST = [
  /libraries\s*:\s*\[/,
  /\b(?:const|let|var)\s+\w*[Ll][Ii][Bb][Rr][Aa][Rr][Ii][Ee][Ss]\w*\s*(?::[^=\n]*)?=\s*\[/,
];

test("nadie declara una lista de libraries propia", () => {
  const offenders = consumers
    .filter(({ source }) => LOCAL_LIST.some((re) => re.test(source)))
    .map(({ file }) => path.relative(REPO_ROOT, file));

  assert.deepEqual(
    offenders,
    [],
    "Estos archivos declaran su propia lista de libraries en lugar de importar " +
      `GOOGLE_MAPS_LIBRARIES:\n${offenders.join("\n")}`,
  );
});
