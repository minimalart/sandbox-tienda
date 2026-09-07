import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { STORE_ROUTE_SCOPE } from '../lib/multistore/store-routes';

/**
 * El ratchet de `/store/*`. Hermano de `admin-site-scope.test.ts`, con dos
 * diferencias que no son de estilo.
 *
 * 1. LA POBLACIÓN ES *TODA* `route.ts`, sin filtro de verbo.
 *
 *    El del admin excluye las rutas que tienen `[param]` y mutan, porque de esas se
 *    ocupan `admin-id-mutation-scope` y `admin-child-ownership-scope`. Acá NO existen
 *    esos dos hermanos, así que el mismo recorte dejaría un hueco — exactamente el
 *    error que el admin ya cometió una vez y que su propio encabezado documenta: un
 *    criterio angosto no falla ruidosamente, DA UN VERDE.
 *
 *    Que cueste unas decenas de entradas más es el precio correcto. En el store las
 *    rutas por `[token]` y por cliente son mayoría, y declararlas `not-applicable` con
 *    su razón es justamente lo que hace verificable la afirmación "el eje acá es el
 *    cliente, no la tienda".
 *
 * 2. LO QUE PRUEBA `scoped` ES OTRO SÍMBOLO.
 *
 *    El admin exige `siteFromRequest`, que lee el header `x-site-id`. Ese header NO
 *    llega al store —`attachSiteHint` está registrado sólo para `/admin/*`— así que
 *    exigirlo acá probaría lo contrario de lo que se quiere. Lo que vale en el store
 *    es la publishable key: `siteFromPublishableKey` / `siteIdFromPublishableKey`.
 *
 *    Y `req.query.sales_channel_id` NO cuenta, aunque el nombre se parezca: lo escribe
 *    el cliente. Reconocerlo como eje válido sería marcar `scoped` a las nueve rutas
 *    que son el corazón de la deuda de este registro.
 */

const API_DIR = import.meta.dirname;
const STORE_DIR = join(API_DIR, 'store');
const REPO_ROOT = resolve(API_DIR, '..', '..', '..', '..');
const PLUGINS_DIR = join(REPO_ROOT, 'packages', 'plugins');
const STORE_ROOTS = [
  STORE_DIR,
  ...readdirSync(PLUGINS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(PLUGINS_DIR, entry.name, 'src', 'api', 'store'))
    .filter((directory) => existsSync(directory)),
];
const routeFiles = new Map<string, string>();
const sourceOwnedRoutes = new Set<string>();

/** Toda `route.ts` bajo `store/`. Ver el punto 1 del encabezado. */
function storeRoutes(): string[] {
  const found: string[] = [];
  const walk = (dir: string, root: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, root);
        continue;
      }
      if (entry.name !== 'route.ts') continue;
      const relative = full.slice(root.length + 1, -'/route.ts'.length);
      // `store/route.ts` (el healthcheck) queda en la raíz: su relativa es vacía.
      const route = relative ? join('store', relative).split('\\').join('/') : 'store';
      // El host conserva el estado agregado de rutas ya migradas, pero cada plugin
      // es responsable de registrar y probar las rutas nuevas de su paquete.
      if (root !== STORE_DIR && !STORE_ROUTE_SCOPE[route]) continue;
      found.push(route);
      routeFiles.set(route, full);
      if (root === STORE_DIR) sourceOwnedRoutes.add(route);
    }
  };
  for (const root of STORE_ROOTS) walk(root, root);
  return found.sort((a, b) => a.localeCompare(b));
}

const routes = storeRoutes();

/**
 * El contador de deuda. **Sólo puede bajar.**
 *
 * Arranca en 19 después de sellar elegibilidad de suscripciones con la publishable
 * key, y NO es deuda "por hacer": todo lo que se podía cerrar con el código y los
 * datos disponibles está cerrado. Las 19 esperan algo de AFUERA, y el registro dice
 * qué en cada caso. Se agrupan así:
 *
 *   13  el `?sales_channel_id=` que declara el CLIENTE — banners, blog (×3), marcas,
 *       videos, looks, sucursales, catálogo PDF, beneficios de pago, recomendaciones,
 *       cuotas de MercadoPago y canje de loyalty.
 *    5  sin ningún eje: los dos contadores de banner, el detalle de marca y las dos
 *       de sucursal preferida/resuelta por punto.
 *    2  escrituras que NACEN sin tienda: alta de empresa y de cuenta corporativa.
 *    1  el feed de indexación de Typesense.
 *
 * Las 13 primeras son la MISMA decisión repetida y se cierran juntas o no se cierran:
 * media migración dejaría el blog filtrando por la key y las marcas por el query, que
 * es PEOR que el estado actual porque la incoherencia no se ve desde ninguna pantalla.
 */
const MAX_PENDING = 19;

test('el walk encuentra las rutas store (guard contra falso verde por vacío)', () => {
  // Si el walk se rompe, todo lo de abajo pasa trivialmente. Mismo guard que
  // `route-collisions.test.ts` y que el ratchet del admin.
  assert.ok(
    routes.length > 100,
    `sólo ${routes.length} rutas store encontradas: el walk se rompió`,
  );
});

test('la población es TODA route.ts, no sólo las que leen', () => {
  /**
   * Dientes contra el recorte cómodo. Si alguien "alinea" este walk con el del admin
   * —`if (!GET) continue`— el efecto no sería un error: sería que las rutas que sólo
   * escriben salen de la población, el registro queda con entradas huérfanas y el
   * contador de deuda BAJA en silencio. Se ve como una mejora.
   *
   * En el store el recorte es peor que en el admin, porque acá no existen los otros
   * dos ratchets que allá recogen a las que mutan por id.
   */
  const GET_VERB = /export\s+(async\s+)?function\s+GET|export\s+const\s+GET/;
  const soloEscriben = routes.filter((route) => {
    const src = readFileSync(routeFiles.get(route)!, 'utf8');
    return !GET_VERB.test(src);
  });
  assert.ok(
    soloEscriben.length > 20,
    `Sólo ${soloEscriben.length} rutas store sin GET entraron en la auditoría.\n` +
      `Eran más de 20 cuando se midió — entre ellas los dos contadores de banner, que\n` +
      `sólo escriben. Si bajaron tanto, el walk volvió a mirar únicamente el GET.`,
  );
});

test('toda ruta store está declarada en el registro', () => {
  const missing = routes.filter((route) => !STORE_ROUTE_SCOPE[route]);
  assert.deepEqual(
    missing,
    [],
    `Estas rutas store no declaran si respetan la tienda del visitante:\n  ${missing.join('\n  ')}\n\n` +
      `Agregalas a src/lib/multistore/store-routes.ts eligiendo:\n` +
      `  { state: 'scoped' }                         si resuelve la tienda por publishable key y filtra\n` +
      `  { state: 'not-applicable', reason: '...' }  si su eje es otro (cliente, token, carrier, core)\n` +
      `  { state: 'pending', reason: 'BLOQUEADA...' } si todavía no filtra (y subí MAX_PENDING)\n\n` +
      `Una ruta del store sin declarar le muestra a un CLIENTE el contenido de otra marca,\n` +
      `y a diferencia del admin no hay ningún operador del otro lado que lo note.`,
  );
});

test('el registro no tiene entradas huérfanas', () => {
  const known = new Set(routes);
  const orphans = Object.keys(STORE_ROUTE_SCOPE).filter((route) => !known.has(route));
  assert.deepEqual(
    orphans,
    [],
    `El registro declara rutas store que ya no existen:\n  ${orphans.join('\n  ')}\n` +
      `Borrar una ruta tiene que limpiar su entrada.`,
  );
});

/**
 * ¿Este archivo resuelve la tienda por la PUBLISHABLE KEY?
 *
 * Un salto de import y no más, igual que el del admin: alcanza para los helpers que
 * comparten varias rutas de un grupo y sigue exigiendo que la cadena termine en el
 * símbolo real. Con recursión ilimitada cualquier import terminaría "probando"
 * cualquier cosa.
 */
const PUBLISHABLE_KEY_AXIS = /siteFromPublishableKey|siteIdFromPublishableKey|publishable_key_context/;

function resolvesSite(file: string, depth = 1): boolean {
  let src: string;
  try {
    src = readFileSync(file, 'utf8');
  } catch {
    return false;
  }
  if (PUBLISHABLE_KEY_AXIS.test(src)) return true;
  if (depth <= 0) return false;

  for (const match of src.matchAll(/from '(\.[^']+)'/g)) {
    const target = resolve(dirname(file), match[1]!);
    for (const candidate of [`${target}.ts`, join(target, 'index.ts')]) {
      if (resolvesSite(candidate, depth - 1)) return true;
    }
  }
  return false;
}

test('toda ruta marcada `scoped` resuelve la tienda por la publishable key', () => {
  // Dientes contra el tag optimista: marcarla no la migra. Y el símbolo que se busca
  // es el de la KEY, no `siteFromRequest`: en `/store/*` el header `x-site-id` no
  // llega, así que una ruta que lo usara resolvería `allSites` y no filtraría nada.
  const lying: string[] = [];
  for (const [route, entry] of Object.entries(STORE_ROUTE_SCOPE)) {
    if (entry.state !== 'scoped') continue;
    if (!sourceOwnedRoutes.has(route)) continue;
    const file = routeFiles.get(route);
    if (!file || !resolvesSite(file)) lying.push(route);
  }
  assert.deepEqual(
    lying,
    [],
    `Estas rutas están marcadas 'scoped' pero no resuelven la tienda por publishable key:\n  ${lying.join('\n  ')}\n` +
      `Marcarla no la migra: mientras no resuelva la tienda, le sirve a un cliente el\n` +
      `contenido de todas.`,
  );
});

test('`not-applicable` viene siempre con una razón escrita', () => {
  const silent = Object.entries(STORE_ROUTE_SCOPE)
    .filter(([, e]) => e.state === 'not-applicable' && !(e as { reason?: string }).reason?.trim())
    .map(([route]) => route);
  assert.deepEqual(silent, [], `'not-applicable' sin razón: ${silent.join(', ')}`);
});

test('la deuda no sube: pendientes <= MAX_PENDING', () => {
  const pending = Object.values(STORE_ROUTE_SCOPE).filter((e) => e.state === 'pending').length;
  assert.ok(
    pending <= MAX_PENDING,
    `Hay ${pending} rutas store sin filtrar por tienda y el tope es ${MAX_PENDING}.\n` +
      `Si agregaste una ruta nueva que no filtra, migrala o subí MAX_PENDING a conciencia:\n` +
      `este contador está para que la deuda baje, no para que crezca sola.`,
  );
});

/**
 * El techo dice EXACTAMENTE cuántas hay, no "a lo sumo".
 *
 * Es la convención del repo —`MAX_PENDING` del admin, `MAX_SIN_GUARD`,
 * `MAX_SIN_PERTENENCIA`, `MAX_GHOST_KEYS` y `MAX_UNSCOPED_TRANSPORT` tienen todos su
 * par de igualdad—. Con sólo `<=`, cerrar la última pendiente dejaría un tope viejo
 * que vuelve a autorizar una nueva sin que nadie lo note: el contador pasaría a medir
 * el pasado.
 */
test('el techo dice el número REAL: pendientes === MAX_PENDING', () => {
  const pendientes = Object.entries(STORE_ROUTE_SCOPE)
    .filter(([, entry]) => entry.state === 'pending')
    .map(([route]) => route);

  assert.equal(
    pendientes.length,
    MAX_PENDING,
    `El tope dice ${MAX_PENDING} pero hay ${pendientes.length}:\n  ${pendientes.join('\n  ')}\n\n` +
      `Si cerraste alguna —gracias—, bajá \`MAX_PENDING\` a ${pendientes.length} en el mismo commit.`,
  );
});

test('lo que queda pendiente declara QUÉ lo bloquea', () => {
  /**
   * Mismo prefijo obligatorio que en el admin, y por la misma razón: sin él
   * "pendiente" se lee como "falta trabajo" y alguien lo empieza sin saber que primero
   * hay que decidir algo.
   *
   * Acá pesa más todavía. Catorce de las pendientes comparten UNA sola decisión —qué
   * ve la tienda principal cuando el storefront no manda canal— y cerrarlas de a una,
   * sin tomarla, produce un sistema donde el blog filtra por la key y las marcas por
   * el query. Esa incoherencia no se ve desde ninguna pantalla.
   */
  const vague = Object.entries(STORE_ROUTE_SCOPE)
    .filter(([, entry]) => entry.state === 'pending')
    .filter(([, entry]) => !(entry as { reason?: string }).reason?.startsWith('BLOQUEADA'))
    .map(([route]) => route);

  assert.deepEqual(
    vague,
    [],
    `Estas pendientes no dicen qué las bloquea:\n  ${vague.join('\n  ')}\n` +
      `El motivo tiene que empezar con BLOQUEADA POR <PRODUCTO|MODELO|DATO|INFRA> y nombrarlo.`,
  );
});
