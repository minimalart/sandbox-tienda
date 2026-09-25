import assert from "node:assert/strict";
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

/**
 * pnpm hoistea el paquete local del boilerplate como
 * `node_modules/@minimalart/...` apuntando a `packages/plugins/...`. El glob
 * de Tailwind vive del lado de `node_modules` (uniforme boilerplate/hijas),
 * mientras que el alias del tsconfig apunta al path físico del monorepo.
 * Sin resolver el symlink, ambos lados de la comparación quedan en paths
 * distintos y el guard nunca matchea. `realpathSync` con fallback silencioso
 * porque en primera corrida (previo a `pnpm install`) los symlinks no existen
 * y el test no debe explotar.
 */
const resolveReal = (candidate: string): string => {
  try {
    return realpathSync(candidate);
  } catch {
    return candidate;
  }
};

/**
 * Guardián de un fallo INVISIBLE (DESDEELSUR-61 / BUG-06).
 *
 * Tailwind sólo genera las clases que encuentra escaneando los globs de
 * `content`. Un componente que vive fuera de esos globs renderiza igual, compila
 * igual y pasa el typecheck igual — pero sus clases no existen en el CSS. No hay
 * error, no hay warning: el estilo simplemente no está.
 *
 * Fue exactamente lo que pasó con `CheckboxInput`, que vive en
 * `packages/plugins/plugin-storefront-shared` y entra por alias del tsconfig. Su tilde
 * se muestra con el variant `peer-checked` sobre la opacidad, y esa regla no
 * existía en el CSS de producción: medido en vivo, el ícono quedaba en
 * `opacity: 0` incluso con el input en `checked`. El checkbox "Necesito Factura
 * A" del checkout alternaba los campos de facturación pero nunca se veía
 * tildado; lo mismo en login, filtros de tienda, localizador de sucursales,
 * shop-by-look, devoluciones y suscripciones.
 *
 * CUIDADO AL EDITAR ESTE ARCHIVO: vive en `src/lib`, que Tailwind SÍ escanea, así
 * que cualquier clase escrita literalmente acá — aunque sea en un comentario —
 * hace que Tailwind la genere. La primera versión de este test nombraba la clase
 * del tilde en su doc-block y con eso la producía sola: al medir el CSS con y sin
 * el glob la regla aparecía en los dos casos y el bug parecía no existir. Por eso
 * los variants se describen en prosa y no se escriben como clase.
 *
 * La regla que se defiende acá: si un alias del tsconfig apunta FUERA de
 * `apps/storefront` (o sea, a un paquete del monorepo), algún glob de `content`
 * tiene que cubrirlo. El día que alguien agregue el alias número 15, este test
 * falla antes de que el estilo se pierda en silencio.
 *
 * `tailwind.config.js` se lee como TEXTO en vez de importarse porque es CJS y
 * hace `require("@medusajs/ui-preset")`: importarlo obligaría a tener el monorepo
 * instalado para correr un test que sólo necesita mirar una lista de strings.
 */

const STOREFRONT_DIR = path.resolve(import.meta.dirname, "../../..");

/** Targets de alias del tsconfig que se van de `apps/storefront`. */
function aliasTargetsOutsideApp(): string[] {
  const tsconfig = JSON.parse(
    readFileSync(path.join(STOREFRONT_DIR, "tsconfig.json"), "utf8"),
  ) as { compilerOptions?: { paths?: Record<string, string[]> } };

  const paths = tsconfig.compilerOptions?.paths ?? {};
  const targets = new Set<string>();

  for (const entries of Object.values(paths)) {
    for (const entry of entries) {
      // Los targets del tsconfig son relativos a `baseUrl` (./src), así que un
      // paquete del monorepo se ve como "../../../packages/...".
      const absolute = resolveReal(path.resolve(STOREFRONT_DIR, "src", entry));
      if (absolute.startsWith(`${STOREFRONT_DIR}${path.sep}`)) continue;
      targets.add(absolute);
    }
  }

  return [...targets];
}

/**
 * Prefijos absolutos que Tailwind realmente escanea: la parte de cada glob que
 * está antes del primer comodín. Alcanza para decidir cobertura y no obliga a
 * implementar matching de globs.
 */
function scannedPrefixes(): string[] {
  const raw = readFileSync(
    path.join(STOREFRONT_DIR, "tailwind.config.js"),
    "utf8",
  );

  // Los comentarios se sacan ANTES de buscar el array: el propio `content` está
  // documentado con clases de ejemplo entre corchetes (`p-[10%]`), y un match
  // hasta el primer `]` se corta ahí y sólo ve los primeros globs — el test
  // pasaría en verde ignorando justo los globs que tiene que auditar.
  const source = raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/[^\n]*/g, "$1");

  const block = source.match(/content:\s*\[([\s\S]*?)\]/);
  assert.ok(block, "tailwind.config.js: no se encontró el array `content`");

  // `exec` en un while y no spread de `matchAll`: el target del storefront no
  // habilita iterar un `RegExpStringIterator` (TS2802).
  const QUOTED = /"([^"]+)"/g;
  const globs: string[] = [];
  let quoted: RegExpExecArray | null;
  while ((quoted = QUOTED.exec(block[1])) !== null) {
    globs.push(quoted[1]);
  }
  assert.ok(globs.length > 0, "tailwind.config.js: `content` quedó vacío");

  return globs.map((glob) => {
    const wildcard = glob.search(/[*?[]/);
    const literal = wildcard === -1 ? glob : glob.slice(0, wildcard);
    return resolveReal(path.resolve(STOREFRONT_DIR, literal));
  });
}

test("cada alias del tsconfig a un paquete del monorepo está cubierto por `content` de Tailwind", () => {
  const prefixes = scannedPrefixes();
  const uncovered = aliasTargetsOutsideApp().filter(
    (target) =>
      !prefixes.some(
        (prefix) => target === prefix || target.startsWith(prefix),
      ),
  );

  assert.deepEqual(
    uncovered,
    [],
    `Estos targets de alias no los escanea Tailwind, así que sus clases NO van a existir en el CSS:\n` +
      uncovered.map((t) => `  - ${path.relative(STOREFRONT_DIR, t)}`).join("\n") +
      `\nAgregá el glob correspondiente a \`content\` en apps/storefront/tailwind.config.js.`,
  );
});

test("el paquete storefront-shared está entre lo que Tailwind escanea", () => {
  // Aserción explícita del caso concreto que rompió: si alguien saca el glob,
  // el test de arriba lo agarra sólo mientras el alias siga existiendo. Este
  // fija la expectativa aunque el tsconfig cambie de forma.
  //
  // Sentinel = `dist/`. La base y las hijas consumen el mismo artefacto: el
  // `dist/` del plugin publicado. En el boilerplate ese path resuelve por
  // symlink de pnpm al `dist/` compilado del workspace local; en las hijas
  // resuelve al `dist/` del tarball publicado. Chequear contra `dist/` acá
  // fija el contrato uniforme y evita la asimetría previa (src en base, dist
  // en hijas) que ocultaba bugs de compilación hasta producción.
  const sharedDist = resolveReal(
    path.resolve(
      STOREFRONT_DIR,
      "node_modules/@minimalart/mercatto-plugin-storefront-shared/dist",
    ),
  );
  assert.ok(
    scannedPrefixes().some((prefix) => sharedDist.startsWith(prefix)),
    "@minimalart/mercatto-plugin-storefront-shared/dist salió de `content`: las clases de CheckboxInput, ProductImage y ScrollCarousel dejan de generarse",
  );
});
