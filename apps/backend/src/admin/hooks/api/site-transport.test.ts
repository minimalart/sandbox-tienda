import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ADMIN_ROUTE_SCOPE } from '../../../lib/multistore/scoped-routes';

/**
 * LA OTRA MITAD DEL RATCHET DE TIENDA.
 *
 * `src/api/admin-site-scope.test.ts` verifica que toda ruta declarada `scoped`
 * invoque `siteFromRequest`. Es necesario y NO alcanza: sólo mira el servidor.
 * Filtrar por un header que el navegador nunca manda es no filtrar, y el registro
 * queda entero en verde igual.
 *
 * Así se coló el bug de `fiscal-docs-card` —un `fetchJson` local sin `x-site-id`
 * sobre una ruta que el backend ya filtraba bien— y así se descubrió, al cablear
 * el selector de tienda, que no era uno: `blog-settings`, `loyalty/programs` y
 * `comments/settings` tenían exactamente la misma forma. Las cuatro se migraron.
 *
 * Este test cierra la puerta por la que entraron. Empezó como techo de deuda en 14
 * —los catorce hooks de `hooks/api` que quedaban—, llegó a 0 con ese criterio, y al
 * abrir la población a todo `src/admin` volvió a 6: seis pantallas de `routes/` y
 * `widgets/` que el criterio angosto nunca había mirado. Las seis se migraron: cinco
 * cambiando el transporte, y la última —la que este techo llevaba documentada como
 * imposible de migrar— cambiando el contrato de su ruta, que era el problema real.
 *
 * Mismo mecanismo de techo de deuda que `MAX_PENDING` en `admin-site-scope.test.ts`,
 * con una diferencia que importa: acá el techo NO baja por decisión administrativa —
 * baja cuando el `fetch` cambia. Cualquier hook nuevo que pegue a una ruta `scoped`
 * con su propio `fetch` se pone rojo el día que nace, que es el único momento barato
 * para arreglarlo.
 */

/**
 * Hooks que pegan a rutas `scoped` SIN mandar el header de tienda. Medido, no
 * estimado.
 *
 * Sólo baja. Subirlo NO es una opción administrativa: cada unidad de más es una
 * pantalla afirmando "esta tienda" mientras muestra las tres, que es exactamente el
 * bug que este archivo existe para impedir. Si algo no puede migrarse, la salida es
 * documentar por qué acá —no correr el número y seguir.
 *
 * Para migrar uno: borrar su `fetchJson` local y usar el de `src/admin/lib/http.ts`,
 * que ya inyecta `siteHeader()`. La firma es idéntica a propósito — no hay que
 * tocar un solo call site. Si la respuesta NO es JSON (CSV, PDF, blob), `fetchJson`
 * no sirve porque parsea: va `siteHeaders()` agregado a mano al `fetch`, como en
 * `routes/brands/components/brand-export.tsx`.
 *
 * ─── EL ÚLTIMO QUE QUEDABA, Y CÓMO CERRÓ ────────────────────────────────────────
 *
 * `routes/sites/[id]/home/page.tsx` → `admin/store-config/storefront-url`.
 *
 * Era el único de los seis donde mandar el header EMPEORABA la pantalla, y por eso
 * el techo se quedó en 1 con el motivo escrito acá: ese handler devolvía la URL de
 * la tienda ACTIVA (`<base>/tienda/<slug>`), que es lo que necesita el Preview de
 * una landing; pero el editor de home usa la respuesta como BASE y
 * `buildPublicUrlFrom` le agrega él mismo el prefijo de la tienda que se está
 * editando —la del `[id]`, no la activa—, así que con el header el link quedaba con
 * el prefijo dos veces y daba 404.
 *
 * Lo que decía este comentario: "baja a 0 el día que el contrato de la ruta distinga
 * 'la URL de la tienda activa' de 'la base de la instancia' — no antes, y no migrando
 * el call site". Es lo que pasó: la ruta devuelve ahora `url` (tienda activa) Y `base`
 * (instancia), el editor de home lee `base` y va por `useStorefrontBase()` sobre el
 * SDK, que ya manda el header. No fue deuda de transporte nunca: era una ruta
 * haciendo dos trabajos con una sola respuesta.
 *
 * El mismo cambio arregló el bug que lo hizo visible: el listado de tiendas resolvía
 * la base en BUILD y linkeaba al dominio de otra marca.
 *
 * Con esto el techo llega a 0 CON la población ancha —todo `src/admin`, no sólo
 * `hooks/api/`—, que es la primera vez que el 0 de este archivo afirma lo que parece
 * afirmar.
 */
const MAX_UNSCOPED_TRANSPORT = 0;

/**
 * TODO `src/admin`, recursivo — y no sólo `hooks/api/`, que es como nació.
 *
 * La versión original hacía `readdirSync(HOOKS_DIR)`: plano, un solo directorio. Con
 * ese criterio el techo llegó a 0 y el test de igualdad afirmaba que NINGUNA pantalla
 * del admin pegaba sin el header. Era falso: seis archivos hacen su propio `fetch`
 * desde componentes de `routes/`, desde `widgets/` y desde una page, y dos son copias
 * literales del mismo `fetchJson` que este archivo nombra en su encabezado como el bug
 * original —la card se migró, las copias de un directorio más abajo no—.
 *
 * O sea: el criterio angosto no dio un falso negativo ruidoso, dio un VERDE, que es el
 * error que los ratchets de rutas ya cometieron tres veces y llevan documentado. Este
 * lo cometió también, y en la afirmación más fuerte que hacía.
 *
 * Que el número suba de 0 a 6 no es una regresión: es la medición volviéndose cierta.
 */
const ADMIN_DIR = join(import.meta.dirname, '..', '..');

const walkAdmin = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkAdmin(full, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
};

/**
 * Un hook manda el header si va por el `fetchJson` compartido, por el SDK (que lo
 * pone en `globalHeaders`, ver `lib/client.ts`) o si lo agrega a mano.
 */
const SITE_AWARE = [/from\s+'[^']*lib\/http'/, /sdk\.client/, /siteHeaders?\s*\(/];

const isSiteAware = (source: string) => SITE_AWARE.some((re) => re.test(source));

/**
 * Que el archivo PEGUE, no que nombre una ruta.
 *
 * Al abrir la población a todo `src/admin` apareció el problema espejo del criterio
 * angosto: `lib/site-scope.ts` es el REGISTRO de pantallas y `routes/companies/page.tsx`
 * monta `<SiteScopeBar screen="companies">`, así que los dos contienen el path de una
 * ruta `scoped` sin pegarle a nada. Contarlos habría cambiado un falso VERDE por un
 * falso ROJO — y un ratchet que grita en falso se desactiva a la semana, que es peor:
 * el verde al menos deja el número a la vista.
 *
 * Por eso hace falta un `fetch(` de verdad. Los que van por `lib/http` o por el `sdk`
 * ya salieron antes en `isSiteAware`, así que lo único que queda acá es el `fetch`
 * crudo — que es exactamente lo que este archivo persigue.
 */
const doesRawFetch = (source: string) => /\bfetch\s*\(/.test(source);

/** `/admin/foo/bar` → la clave más específica del registro que lo cubre. */
const registryKeyFor = (path: string): string | undefined => {
  const normalized = path.replace(/^\//, '');
  return Object.keys(ADMIN_ROUTE_SCOPE)
    .filter((key) => normalized === key || normalized.startsWith(`${key}/`))
    .sort((a, b) => b.length - a.length)[0];
};

const scopedPathsIn = (source: string): string[] => {
  const hits = source.match(/\/admin\/[a-z0-9/-]+/g) ?? [];
  const scoped = new Set<string>();

  for (const hit of hits) {
    const key = registryKeyFor(hit);
    if (key && ADMIN_ROUTE_SCOPE[key]?.state === 'scoped') scoped.add(key);
  }

  return [...scoped].sort();
};

const offenders = walkAdmin(ADMIN_DIR)
  .map((path) => ({ file: path.slice(ADMIN_DIR.length + 1), source: readFileSync(path, 'utf8') }))
  .filter(({ source }) => !isSiteAware(source) && doesRawFetch(source))
  .map(({ file, source }) => ({ file, routes: scopedPathsIn(source) }))
  .filter(({ routes }) => routes.length > 0);

test('la deuda de transporte sin header de tienda no sube', () => {
  const detail = offenders
    .map(({ file, routes }) => `  ${file} → ${routes.join(', ')}`)
    .join('\n');

  assert.ok(
    offenders.length <= MAX_UNSCOPED_TRANSPORT,
    `Hay ${offenders.length} hooks que pegan a rutas \`scoped\` sin mandar \`x-site-id\`, ` +
      `y el tope es ${MAX_UNSCOPED_TRANSPORT}.\n\n${detail}\n\n` +
      `El backend de esas rutas SÍ filtra, así que el filtro queda en no-op: la pantalla ` +
      `dice "esta tienda" y muestra las tres.\n` +
      `Arreglo: borrar el \`fetchJson\` local y usar el de \`src/admin/lib/http.ts\`, que ya ` +
      `inyecta \`siteHeader()\` y tiene la MISMA firma — no hay que tocar ningún call site.`,
  );
});

/**
 * El techo tiene que seguir a la realidad hacia abajo. Sin esto, migrar los catorce
 * dejaría un `MAX_UNSCOPED_TRANSPORT = 14` que vuelve a permitir catorce nuevos, y
 * el ratchet se convierte en un número decorativo.
 */
test('el techo de deuda está ajustado a la realidad', () => {
  assert.equal(
    offenders.length,
    MAX_UNSCOPED_TRANSPORT,
    `El tope dice ${MAX_UNSCOPED_TRANSPORT} pero hay ${offenders.length}. ` +
      `Si migraste un hook —gracias—, bajá \`MAX_UNSCOPED_TRANSPORT\` a ${offenders.length}.`,
  );
});

/**
 * Blog y loyalty ya viven en sus plugins publicados. La copia host tiene que seguir
 * ausente: si reaparece, se vuelve a registrar una segunda UI que puede divergir del
 * transporte que mantiene cada plugin.
 */
test('las pantallas migradas a plugins no reaparecen como copias host', () => {
  for (const file of ['blog.tsx', 'loyalty.tsx']) {
    assert.equal(
      existsSync(join(ADMIN_DIR, 'hooks', 'api', file)),
      false,
      `${file} reapareció en el host aunque su UI pertenece al plugin publicado.`,
    );
  }
});
