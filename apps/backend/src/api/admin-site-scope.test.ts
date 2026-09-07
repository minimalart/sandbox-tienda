import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { ADMIN_ROUTE_SCOPE } from '../lib/multistore/scoped-routes';

/**
 * El registro de `scoped-routes.ts` sólo sirve si no puede driftear del filesystem.
 *
 * Sin este test, una ruta admin nueva nace sin declararse y devuelve datos de todas
 * las tiendas para siempre, en silencio — y el selector del backoffice la muestra
 * como si respetara la tienda activa.
 *
 * Calca `route-collisions.test.ts`, que ya camina `src/api/**` con la misma técnica.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÉ ENTRA AL REGISTRO, Y POR QUÉ DEJÓ DE SER "LAS QUE LEEN"
 *
 * Hasta el repaso del punto ciego, la población de este archivo era "toda `route.ts`
 * bajo `admin/` que exporte GET". Los otros dos ratchets tienen criterios distintos:
 * `admin-id-mutation-scope.test.ts` pide verbo de mutación Y algún `[param]`;
 * `admin-child-ownership-scope.test.ts` pide dos o más `[param]`.
 *
 * En la INTERSECCIÓN de los tres huecos vivían 47 rutas que ninguno podía ver:
 * mutan, no tienen GET —así que este registro no las exigía— y no tienen ningún
 * parámetro —así que los otros dos ni las miraban—. No eran rutas menores: ahí
 * estaban `andreani/tickets/bulk` y `correo-argentino/tickets/bulk`, que crean
 * envíos REALES Y FACTURABLES con `order_ids` del body; `delivery/routes/auto-build`,
 * que es la gemela exacta de `executions/[id]/auto-assign` —la que se escapó del
 * primer ratchet— con el id en el body en vez del path; `seo-geo/corrections/apply`,
 * que PISA el título y la descripción de un producto; y `typesense/analytics/reset`,
 * que borraba la colección de analítica global desde cualquier tienda.
 *
 * Es la MISMA lección, por tercera vez en este repo: la primera medición de la deuda
 * de mutación por id miraba sólo el último segmento y por eso `auto-assign` "no
 * existía". Un criterio angosto no falla ruidosamente. Da un VERDE.
 *
 * Por eso el registro dejó de indexar "las rutas que LEEN" y pasa a indexar **las
 * que TOCAN DATOS**. El GET solo nunca fue la propiedad que importaba — era la que
 * resultaba fácil de detectar.
 *
 * POR QUÉ NO ENTRA *TODA* MUTACIÓN, SINO LAS QUE NO TIENEN NINGÚN `[param]`
 *
 * Porque las que sí tienen ya están cubiertas, y por un mecanismo que este registro
 * no puede replicar. `admin-id-mutation-scope.test.ts` las audita resolviendo su
 * estado por el ANCESTRO más cercano —`loyalty/campaigns/[id]` hereda el de
 * `loyalty/campaigns`, que es donde vive el listado que filtra—, y eso es
 * deliberado: exigirle una entrada propia a cada `.../[id]/<verbo>` serían cientos
 * de líneas que repiten el estado del recurso padre, y una entrada repetida es una
 * entrada que se desincroniza.
 *
 * Una ruta SIN ningún parámetro no tiene ese paraguas: no hay ancestro que le fije
 * el estado ni ratchet que la mire. Ése es exactamente el hueco, y es exactamente lo
 * que este criterio cierra — ni más, para no duplicar al hermano, ni menos, para no
 * dejar el mismo verde de antes.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const API_DIR = import.meta.dirname;
const ADMIN_DIR = join(API_DIR, 'admin');
const REPO_ROOT = resolve(API_DIR, '..', '..', '..', '..');
const PLUGINS_DIR = join(REPO_ROOT, 'packages', 'plugins');
const ADMIN_ROOTS = [
  ADMIN_DIR,
  ...readdirSync(PLUGINS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(PLUGINS_DIR, entry.name, 'src', 'api', 'admin'))
    .filter((directory) => existsSync(directory)),
];

const GET_VERB = /export\s+(async\s+)?function\s+GET|export\s+const\s+GET/;

/**
 * El mismo regex que los otros dos ratchets, palabra por palabra, y a propósito: los
 * tres tienen que estar de acuerdo sobre qué es una mutación. Si mañana aparece un
 * verbo nuevo, tiene que aparecer en los tres o el hueco vuelve a abrirse justo en
 * la diferencia.
 */
const MUTATION_VERB =
  /export\s+(async\s+)?function\s+(POST|PUT|PATCH|DELETE)\b|export\s+const\s+(POST|PUT|PATCH|DELETE)\s*[:=]/;

/**
 * El contador de deuda. **Sólo puede bajar.** Cada PR que migra un grupo lo baja a
 * mano; si alguien agrega una ruta sin filtrar, el build se pone rojo y tiene que
 * decidir explícitamente si es `pending` (y subirlo, con revisión) o `scoped`.
 *
 * Mismo mecanismo que el conteo exacto de paquetes de
 * `packages/project-composer/src/index.test.js`, que ya demostró que funciona acá.
 */
/**
 * **Sube a 2 con el repaso del punto ciego**, y la que entra es
 * `admin/recommendations/relations/bulk`. No es deuda nueva: es deuda que recién
 * ahora se puede ver, porque hasta este commit la ruta no entraba en ninguna
 * población. Su razón está escrita entera en el registro y se resume así: crear la
 * relación SIN canal —global— es una decisión deliberada y documentada que comparte
 * con el POST singular hermano, así que ponerle el eje sólo al bulk haría que la
 * MISMA acción cree global desde el form y de la tienda desde la carga masiva.
 * Se cierra decidiendo para las dos a la vez, y eso es de producto.
 *
 * La otra sigue siendo `admin/whatsapp-conversations`, también bloqueada por
 * producto (`phone` UNIQUE en toda la instalación).
 */
const MAX_PENDING = 2;

/**
 * Toda `route.ts` de `admin/` que TOQUE DATOS y que no tenga otro ratchet que la
 * mire: con GET, o con verbo de mutación y CERO parámetros.
 *
 * El segundo término es el arreglo del punto ciego. Antes de él, una ruta que sólo
 * escribe —sin GET y sin `[param]`— no existía para ninguno de los tres ratchets, y
 * la única señal de que estaba mal filtrada habría sido que un operador notara datos
 * de otra tienda en su pantalla. O que no los notara.
 */
function adminDataRoutes(): Array<{ route: string; get: boolean; blindMutation: boolean; file: string; sourceOwned: boolean }> {
  const found: Array<{ route: string; get: boolean; blindMutation: boolean; file: string; sourceOwned: boolean }> = [];
  const walk = (dir: string, root: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, root);
        continue;
      }
      if (entry.name !== 'route.ts') continue;
      const route = join('admin', full.slice(root.length + 1, -'/route.ts'.length))
        .split('\\')
        .join('/');
      // Los plugins publicados conservan sus entradas históricas en el manifest
      // agregado, pero auditan las rutas nuevas dentro de su propio paquete.
      if (root !== ADMIN_DIR && !ADMIN_ROUTE_SCOPE[route]) continue;
      const src = readFileSync(full, 'utf8');
      const get = GET_VERB.test(src);
      // El parámetro se busca en CUALQUIER posición, no sólo en el último segmento.
      // Mirar sólo el último es literalmente el error que dejó pasar
      // `delivery/executions/[id]/auto-assign` en el ratchet hermano.
      const hasParam = route.split('/').some((segment) => segment.startsWith('['));
      const blindMutation = !get && !hasParam && MUTATION_VERB.test(src);
      if (!get && !blindMutation) continue;
      found.push({ route, get, blindMutation, file: full, sourceOwned: root === ADMIN_DIR });
    }
  };
  for (const root of ADMIN_ROOTS) walk(root, root);
  return found.sort((a, b) => a.route.localeCompare(b.route));
}

const entries = adminDataRoutes();
const routes = entries.map((entry) => entry.route);
const routeFiles = new Map(entries.map((entry) => [entry.route, entry.file]));
const sourceOwnedRoutes = new Set(entries.filter((entry) => entry.sourceOwned).map((entry) => entry.route));

/** La población VIEJA: sólo-GET. Se calcula para poder compararla, no para usarla. */
const getOnlyRoutes = entries.filter((entry) => entry.get).map((entry) => entry.route);

test('el walk encuentra las rutas admin (guard contra falso verde por vacío)', () => {
  // Si el walk se rompe, todo lo de abajo pasaría trivialmente. La lección viene de
  // `route-collisions.test.ts`, que tiene el mismo guard.
  assert.ok(
    routes.length > 200,
    `sólo ${routes.length} rutas admin que tocan datos: el walk se rompió`,
  );
});

test('el criterio cubre las rutas que SÓLO escriben, no sólo las que leen', () => {
  /**
   * Dientes contra la regresión que este archivo acaba de arreglar, y calcado del
   * test equivalente de `admin-id-mutation-scope.test.ts` ("el criterio cubre las
   * rutas de ACCIÓN, no sólo las `[id]` a secas"), que existe por exactamente la
   * misma razón un nivel más arriba.
   *
   * Si alguien "simplifica" el walk de vuelta a `if (!GET) continue`, el efecto NO
   * sería un error: sería que 47 rutas salen de la población, el registro queda con
   * 47 entradas huérfanas y el contador de deuda BAJA en silencio. Se ve como una
   * mejora. Este test lo convierte en rojo con el motivo escrito.
   *
   * La comparación es estricta (`>`), no `>=`: la población nueva tiene que ser
   * ESTRICTAMENTE mayor que la vieja. Con `>=`, un walk que volviera a mirar sólo
   * GET pasaría igual.
   */
  const soloMutan = entries.filter((entry) => entry.blindMutation);
  assert.ok(
    routes.length > getOnlyRoutes.length,
    `La población (${routes.length}) no supera a la vieja de sólo-GET (${getOnlyRoutes.length}).\n` +
      `El walk volvió a mirar únicamente el GET, que es el punto ciego por el que se\n` +
      `colaron 47 rutas: mutan, no tienen GET y no tienen ningún \`[param]\`, así que\n` +
      `tampoco las veían los otros dos ratchets.`,
  );
  assert.ok(
    soloMutan.length >= 40,
    `Sólo ${soloMutan.length} rutas que mutan SIN GET entraron en la auditoría.\n` +
      `Tras migrar rutas a plugins quedan 40 source-owned —entre ellas \`andreani/tickets/bulk\` y\n` +
      `\`correo-argentino/tickets/bulk\`, que crean envíos facturables, y\n` +
      `\`seo-geo/corrections/apply\`, que pisa el título de un producto—.\n` +
      `Si bajaron tanto, el criterio se aflojó: revisá \`MUTATION_VERB\`.`,
  );
});

test('toda ruta admin que toca datos está declarada en el registro', () => {
  const missing = routes.filter((route) => !ADMIN_ROUTE_SCOPE[route]);
  assert.deepEqual(
    missing,
    [],
    `Estas rutas admin no declaran si respetan la tienda activa:\n  ${missing.join('\n  ')}\n\n` +
      `Agregalas a src/lib/multistore/scoped-routes.ts eligiendo:\n` +
      `  { state: 'scoped' }            si sus GET filtran y sus mutaciones guardan con la tienda\n` +
      `  { state: 'not-applicable', reason: '...' }  si no tiene eje de tienda posible\n` +
      `  { state: 'pending' }           si todavía no filtra (y subí MAX_PENDING en este test)`,
  );
});

test('el registro no tiene entradas huérfanas', () => {
  const known = new Set(routes);
  const orphans = Object.keys(ADMIN_ROUTE_SCOPE).filter((route) => !known.has(route));
  assert.deepEqual(
    orphans,
    [],
    `El registro declara rutas que ya no existen:\n  ${orphans.join('\n  ')}\n` +
      `Borrar una ruta tiene que limpiar su entrada.`,
  );
});

/**
 * ¿Este archivo resuelve la tienda, sea directo o por un helper que importa?
 *
 * Un salto y no más: alcanza para los `_helpers.ts` que comparten varias rutas de un
 * mismo grupo, y sigue exigiendo que la cadena termine en `siteFromRequest`. Con
 * recursión ilimitada, cualquier import terminaría "probando" cualquier cosa.
 */
function resolvesSite(file: string, depth = 1): boolean {
  let src: string;
  try {
    src = readFileSync(file, 'utf8');
  } catch {
    return false;
  }
  if (src.includes('siteFromRequest')) return true;
  if (depth <= 0) return false;

  for (const match of src.matchAll(/from '(\.[^']+)'/g)) {
    const target = resolve(dirname(file), match[1]!);
    for (const candidate of [`${target}.ts`, join(target, 'index.ts')]) {
      if (resolvesSite(candidate, depth - 1)) return true;
    }
  }
  return false;
}

test('toda ruta marcada `scoped` invoca siteFromRequest', () => {
  // Dientes contra el tag optimista: marcarla no la migra. Misma técnica que
  // `module-keys.test.ts` con el literal del módulo.
  const lying: string[] = [];
  for (const [route, entry] of Object.entries(ADMIN_ROUTE_SCOPE)) {
    if (entry.state !== 'scoped') continue;
    if (!sourceOwnedRoutes.has(route)) continue;
    const file = routeFiles.get(route);
    if (!file || !resolvesSite(file)) lying.push(route);
  }
  assert.deepEqual(
    lying,
    [],
    `Estas rutas están marcadas 'scoped' pero no invocan siteFromRequest:\n  ${lying.join('\n  ')}\n` +
      `Marcarla no la migra: mientras no resuelva la tienda, devuelve datos de todas.`,
  );
});

test('`not-applicable` viene siempre con una razón escrita', () => {
  const silent = Object.entries(ADMIN_ROUTE_SCOPE)
    .filter(([, e]) => e.state === 'not-applicable' && !(e as { reason?: string }).reason?.trim())
    .map(([route]) => route);
  assert.deepEqual(silent, [], `'not-applicable' sin razón: ${silent.join(', ')}`);
});

test('la deuda no sube: pendientes <= MAX_PENDING', () => {
  const pending = Object.values(ADMIN_ROUTE_SCOPE).filter((e) => e.state === 'pending').length;
  assert.ok(
    pending <= MAX_PENDING,
    `Hay ${pending} rutas admin sin filtrar por tienda y el tope es ${MAX_PENDING}.\n` +
      `Si agregaste una ruta nueva que no filtra, migrala o subí MAX_PENDING a conciencia:\n` +
      `este contador está para que la deuda baje, no para que crezca sola.`,
  );
});

/**
 * El techo dice EXACTAMENTE cuántas hay, no "a lo sumo".
 *
 * Es la convención del repo —`MAX_SIN_GUARD`, `MAX_SIN_PERTENENCIA`, `MAX_GHOST_KEYS`
 * y `MAX_UNSCOPED_TRANSPORT` tienen todos su par de igualdad— y faltaba justo acá,
 * que es el ratchet más viejo de los tres de tienda.
 *
 * El motivo es el mismo: con sólo `<=`, cerrar la última pendiente dejaría un
 * `MAX_PENDING` viejo que vuelve a autorizar una nueva sin que nadie lo note — el
 * contador pasaría a medir el pasado. Con la igualdad, cerrar OBLIGA a bajar el
 * número en el mismo commit, y el diff del test es el registro de que la deuda bajó.
 */
test('el techo dice el número REAL: pendientes === MAX_PENDING', () => {
  const pendientes = Object.entries(ADMIN_ROUTE_SCOPE)
    .filter(([, entry]) => entry.state === 'pending')
    .map(([route]) => route);

  assert.equal(
    pendientes.length,
    MAX_PENDING,
    `El tope dice ${MAX_PENDING} pero hay ${pendientes.length}:\n  ${pendientes.join('\n  ')}\n\n` +
      `Si cerraste alguna —gracias—, bajá \`MAX_PENDING\` a ${pendientes.length} en el mismo commit.`,
  );
});

test('toda ruta pendiente explica QUÉ le falta', () => {
  // Un `pending` sin razón es una nota mental que se pierde. Con razón, el próximo que
  // agarre la ruta sabe si le falta una columna, una decisión de producto o sólo
  // cablear un descriptor que ya existe — que es la diferencia entre media hora y una
  // semana.
  //
  // Además impide el atajo cómodo: marcar `not-applicable` para bajar el contador.
  // Si algo tiene eje posible tiene que quedar en `pending`, y entonces debe decir por
  // qué todavía no filtra.
  const sinRazon = Object.entries(ADMIN_ROUTE_SCOPE)
    .filter(([, entry]) => entry.state === 'pending' && !('reason' in entry && entry.reason))
    .map(([route]) => route);

  assert.deepEqual(
    sinRazon,
    [],
    `Estas rutas quedaron pendientes sin explicar qué les falta:\n  ${sinRazon.join('\n  ')}`,
  );
});

test('lo que queda pendiente declara QUÉ lo bloquea', () => {
  // Llegado este punto no queda deuda "por hacer": todo lo que se podía migrar con el
  // código y los datos disponibles está migrado. Lo que queda espera algo de AFUERA —
  // una decisión de producto, una de infraestructura, o un dato que un tercero no manda.
  //
  // El prefijo obliga a nombrarlo. Sin él, "pendiente" se lee como "falta trabajo" y
  // alguien lo empieza sin saber que primero hay que decidir algo.
  const vague = Object.entries(ADMIN_ROUTE_SCOPE)
    .filter(([, entry]) => entry.state === 'pending')
    .filter(([, entry]) => !(entry as { reason?: string }).reason?.startsWith('BLOQUEADA'))
    .map(([route]) => route);

  assert.deepEqual(
    vague,
    [],
    `Estas siguen pendientes sin decir qué las bloquea:\n  ${vague.join('\n  ')}\n` +
      `Si se puede hacer con el código y los datos que hay, hacelo. Si no, la razón ` +
      `tiene que empezar con BLOQUEADA POR … y nombrar la decisión que falta.`,
  );
});
