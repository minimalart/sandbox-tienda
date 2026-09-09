import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { ADMIN_ROUTE_SCOPE } from '../lib/multistore/scoped-routes';

/**
 * LA TERCERA PATA DEL RATCHET DE TIENDA: la MUTACIÓN POR ID.
 *
 * `admin-site-scope.test.ts` exige que una ruta `scoped` INVOQUE `siteFromRequest`.
 * `admin/hooks/api/site-transport.test.ts` exige que el navegador mande el header.
 * Las dos son necesarias y las dos juntas siguen sin alcanzar, porque miden lo mismo
 * con distinta lupa: que la tienda se resuelva. Ninguna mira qué se HACE con ella.
 *
 * Invocar no es filtrar, y ya está demostrado en este repo: el dashboard de
 * Fidelización llama a `siteFromRequest` para tres de sus siete consultas y pasa el
 * test igual. La versión cara de ese mismo hueco es la de acá — filtrar el LISTADO y
 * dejar la MUTACIÓN abierta. Esconde la fila de la otra tienda y deja editarla con
 * sólo saber el id, que es justamente lo que un listado filtrado NO impide averiguar:
 * los ids salen de un export, de un webhook, de una URL vieja o de probar.
 *
 * El principio ya estaba escrito en `lib/multistore/scope.ts`, arriba de
 * `assertIdInSite`: **si una fila se ve, se puede editar; si no, 404.** Este archivo
 * es lo que hace que esa frase tenga dientes.
 *
 * Media migración es PEOR que ninguna. Sin filtrar, el operador ve las tres tiendas y
 * lo sabe. Con el listado filtrado y el POST abierto, ve una sola y CREE que está
 * aislado, así que ni siquiera mira.
 */

/**
 * Qué cuenta como "ruta de mutación por id". El criterio es más ancho que
 * `.../[id]/route.ts` A PROPÓSITO, y la razón es que la versión angosta ya falló.
 *
 * La primera medición de esta deuda sólo miró rutas cuyo ÚLTIMO segmento fuera un
 * parámetro. Con ese criterio, `delivery/executions/[id]/auto-assign` no existía —y
 * era el peor caso de todos, porque no lee: ESCRIBE una asignación de flota sobre una
 * ejecución de otra tienda—. La forma `.../[id]/<verbo>` es el mismo agujero con otra
 * cara, y en este repo es la MAYORITARIA: publicar, despachar, cancelar, duplicar,
 * recalcular. Un ratchet con ese punto ciego da un verde que no significa nada.
 *
 * Por eso: cuenta cualquier `route.ts` bajo `src/api/admin/` que exporte un verbo de
 * mutación Y tenga al menos UN segmento paramétrico en cualquier posición del path.
 * El parámetro es la puerta; da igual dónde esté.
 */
const MUTATION_VERB = /export\s+(async\s+)?function\s+(POST|PUT|PATCH|DELETE)\b|export\s+const\s+(POST|PUT|PATCH|DELETE)\s*[:=]/;

/**
 * Los DOS guards del repo, y no un tercero.
 *
 *   `assertIdInSite`   pregunta a la BASE con el mismo subselect que usa el listado.
 *                      Es el único que sirve para `via_parent` y `join_table`, donde
 *                      la tienda no está en la fila sino en otra tabla.
 *   `assertRowInSite`  chequea la fila que el handler ya leyó.
 *
 * Se buscan por nombre y no por "menciona `siteFromRequest`" justamente porque esa es
 * la medición que ya demostró no alcanzar.
 *
 * Y se exige el PARÉNTESIS —la llamada, no el nombre— sobre el archivo YA SIN
 * COMENTARIOS. Las dos cosas juntas, porque la versión ingenua se cayó apenas se
 * escribió: las rutas donde el guard NO aplica explican en un comentario por qué "acá
 * no va `assertIdInSite` ni `assertRowInSite`", y ese texto hacía que el test las diera
 * por guardadas. Sería el mismo error que este archivo denuncia, cometido por el
 * archivo mismo: `admin-site-scope.test.ts` se conforma con la mención de
 * `siteFromRequest`; acá mencionar tampoco puede alcanzar.
 */
const GUARD = /\bassertIdInSite\s*\(|\bassertRowInSite\s*\(/;

/**
 * El código sin comentarios. Deliberadamente tonto: sirve para decidir si algo se
 * INVOCA, no para parsear TypeScript.
 *
 * Único falso positivo posible —un `//` adentro de un string, típicamente una URL— que
 * trunca esa línea. Da igual: una llamada a un guard no comparte línea con una URL, y
 * el efecto sería contar de MÁS, nunca absolver de menos. Un ratchet que se equivoca
 * siempre para el lado de la deuda es el único que se puede dejar solo.
 */
const sinComentarios = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');

const API_DIR = import.meta.dirname;
const ADMIN_DIR = join(API_DIR, 'admin');

/**
 * El techo de deuda. **Sólo puede bajar.**
 *
 * Es el número MEDIDO de rutas de mutación por id sobre recursos declarados `scoped`
 * que hoy no llaman a ninguno de los dos guards. No es una estimación ni un margen:
 * si arreglás una, este número baja a mano, y el test de igualdad de más abajo se
 * encarga de que no puedas olvidarte.
 *
 * **Hoy está en CERO**: las 56 que midió la primera corrida se cerraron. El test dejó
 * de ser un contador de deuda y pasó a ser una invariante — igual que
 * `MAX_UNSCOPED_TRANSPORT` en `site-transport.test.ts`.
 *
 * Que esté en cero es exactamente cuando más sirve, y también cuando más frágil es:
 * el único valor que no se puede subir "un poquito" sin que se note en la revisión.
 * Si una ruta nueva lo pone en 1, el arreglo es la ruta, no el número.
 *
 * Cerrar una era mecánico porque su ruta ANCESTRA ya tenía el guard y nombraba el
 * descriptor exacto; el mensaje de error de abajo lo imprime. Pero mecánico no es
 * automático: copiar la línea del ancestro habría sido un guard DECORATIVO en al
 * menos tres casos —`brands/[brand_id]/images/[image_id]`,
 * `delivery/drivers/[id]/shifts/[shiftId]`, `store-locations/[id]/coverage/[coverageId]`—
 * donde el handler resuelve por el id de la HIJA e ignora el del padre. El guard del
 * padre pasa y la escritura cruzada entra igual. Ese caso pide validar la pertenencia
 * hijo→padre, y este test no lo ve: mide que haya guard, no que el guard alcance.
 */
const MAX_SIN_GUARD = 0;

/**
 * Rutas que NO pueden usar ninguno de los dos guards y aun así están cubiertas.
 *
 * Existe porque la alternativa era peor. Sin esta lista, la única forma de sacarlas
 * del contador sería ponerles un `assertIdInSite` que no aplica —sobre una tabla que
 * no es la suya, o sobre un id que no es una PK—, y un guard que filtra por el campo
 * equivocado es peor que ninguno: aparece en el diff, la revisión lo da por cerrado y
 * el agujero sigue abierto. Con la exención, la razón queda escrita y se puede
 * discutir.
 *
 * NO es un cajón para bajar el número. Lo impiden dos tests de abajo: la razón es
 * obligatoria, y la ruta tiene que resolver la tienda de verdad —si no llama a
 * `siteFromRequest` ni directo ni por un helper, la exención se cae—.
 */
const EXENTAS: Record<string, string> = {
  'admin/sites/[id]/checkout':
    'El parámetro identifica la tienda misma, no un recurso hijo. authorizeCheckoutAdmin resuelve siteFromRequest, compara scope.site.id con el parámetro y aplica checkout_site_ids del usuario antes de leer o escribir; writePolicy actualiza únicamente demo_store.id con revisión CAS.',
  'admin/kapso/bindings/[key]':
    '`:key` no es una PK: es el nombre de un evento, una clave DENTRO del JSON de una ' +
    'fila de `store_setting`. La fila sobre la que se opera la elige `siteOf(req)` ' +
    'antes de leer, así que no hay id ajeno que adivinar; el peor caso es borrar una ' +
    'clave inexistente del JSON de la propia tienda.',
  // admin/ga4-builtins/[key]: moved to @minimalart/mercatto-plugin-ga4
  'admin/typesense/curations/[id]':
    'Las curaciones no son filas de Postgres: viven en una colección de Typesense, y los ' +
    'dos guards resuelven un subselect contra la base, así que ninguno aplica. El eje real ' +
    'es la COLECCIÓN, que `collectionForSite` deriva de la tienda activa, y los TRES verbos ' +
    'la usan. Ponerle un guard de SQL para sacarla del contador sería exactamente el error ' +
    'que este test existe para encontrar.',
  'admin/typesense/synonyms/[id]':
    'Mismo caso que las curaciones: el eje es la colección, no una fila. Los tres verbos ' +
    'resuelven `collectionOf(req, …)`. Estuvo abierto en PUT y DELETE mientras ' +
    '`upsertSynonym` y `deleteSynonym` clavaban `this.collectionName` y no aceptaban ' +
    'colección; se les igualó la firma a la de `getSynonym`, que ya la tomaba.',
};

/** Todas las `route.ts` de `src/api/admin/` con verbo de mutación y algún `[param]`. */
function mutationRoutesWithParam(): Array<{ route: string; file: string }> {
  const found: Array<{ route: string; file: string }> = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (entry.name !== 'route.ts') continue;
      const route = join('admin', full.slice(ADMIN_DIR.length + 1, -'/route.ts'.length))
        .split('\\')
        .join('/');
      // El parámetro puede estar en cualquier posición, no sólo al final.
      if (!route.split('/').some((segment) => segment.startsWith('['))) continue;
      if (!MUTATION_VERB.test(readFileSync(full, 'utf8'))) continue;
      found.push({ route, file: full });
    }
  };
  walk(ADMIN_DIR);
  return found.sort((a, b) => a.route.localeCompare(b.route));
}

/**
 * El estado de una ruta con parámetros, resuelto por su ANCESTRO más cercano.
 *
 * Hace falta porque el registro sólo indexa rutas con GET, y muchas de éstas no
 * tienen: `loyalty/campaigns/[id]` es POST y DELETE nomás. Su estado lo fija
 * `loyalty/campaigns`, que es donde vive el listado que ya filtra. Se toma el ancestro
 * MÁS ESPECÍFICO —el más largo— para que una excepción declarada abajo gane.
 */
function scopeStateOf(route: string): { key: string; state: string } | null {
  const parts = route.split('/');
  for (let i = parts.length; i > 0; i--) {
    const key = parts.slice(0, i).join('/');
    const entry = ADMIN_ROUTE_SCOPE[key];
    if (entry) return { key, state: entry.state };
  }
  return null;
}

/**
 * ¿Este archivo guarda, sea directo o por un helper que importa?
 *
 * Un salto y no más, calcado de `resolvesSite` en `admin-site-scope.test.ts`. Alcanza
 * para los `_helpers.ts` compartidos por un grupo de rutas —`fiscal-documents` es el
 * caso real: sus tres rutas guardan con `assertFiscalDocumentInSite`, que envuelve a
 * `assertIdInSite`— y sigue exigiendo que la cadena termine en un guard de verdad. Con
 * recursión ilimitada, cualquier import terminaría "probando" cualquier cosa.
 *
 * El salto SÓLO entra a archivos de `src/api/`, y esa restricción no es prolijidad: sin
 * ella este test daba un falso verde silencioso. `lib/multistore/index.ts` RE-EXPORTA
 * `assertRowInSite`, así que cualquier ruta que importara del barril —aunque fuera sólo
 * `siteFromRequest`— quedaba a un salto del nombre del guard y se contaba como guardada.
 * O sea: el test habría absuelto a la ruta por MENCIONAR el helper a través de un
 * re-export, que es la misma clase de error que este archivo existe para no repetir —
 * `admin-site-scope.test.ts` ya se conforma con la mención de `siteFromRequest`, y por
 * eso el dashboard de Fidelización pasa con tres de siete consultas filtradas.
 *
 * Los helpers de verdad viven al lado de sus rutas; la librería compartida no "guarda"
 * a nadie por el hecho de exportar el guard.
 */
function reaches(file: string, needle: RegExp, depth = 1): boolean {
  let source: string;
  try {
    source = sinComentarios(readFileSync(file, 'utf8'));
  } catch {
    return false;
  }
  if (needle.test(source)) return true;
  if (depth <= 0) return false;

  for (const match of source.matchAll(/from '(\.[^']+)'/g)) {
    const target = resolve(dirname(file), match[1]!);
    if (!target.startsWith(`${API_DIR}/`)) continue;
    for (const candidate of [`${target}.ts`, join(target, 'index.ts')]) {
      if (reaches(candidate, needle, depth - 1)) return true;
    }
  }
  return false;
}

/**
 * El descriptor y el helper que le corresponden, leídos de su ancestro ya guardado.
 *
 * No es decoración del mensaje de error: es la diferencia entre "hay 52 rutas rotas" y
 * "esta ruta se arregla con estas dos líneas". La deuda que no dice cómo pagarse no se
 * paga.
 */
function hintFor(route: string): string {
  const parts = route.split('/');
  for (let i = parts.length - 1; i > 0; i--) {
    const ancestor = join(API_DIR, parts.slice(0, i).join('/'), 'route.ts');
    if (!existsSync(ancestor) || !reaches(ancestor, GUARD)) continue;
    const source = sinComentarios(readFileSync(ancestor, 'utf8'));
    const helper = (GUARD.exec(source)?.[0] ?? 'assertIdInSite(').replace(/\s*\($/, '');
    const descriptors = [...new Set([...source.matchAll(/\b([A-Z][A-Z0-9_]*_SITE_SCOPE)\b/g)].map((m) => m[1]))];
    return ` → ${helper}(${descriptors.join(' | ') || '?'}) como en ${parts.slice(0, i).join('/')}`;
  }
  return ' → sin ancestro guardado: hay que elegir descriptor a mano';
}

const routes = mutationRoutesWithParam();

const scopedRoutes = routes.filter(({ route }) => scopeStateOf(route)?.state === 'scoped');

const sinGuard = scopedRoutes
  .filter(({ route }) => !(route in EXENTAS))
  .filter(({ file }) => !reaches(file, GUARD))
  .map(({ route }) => route);

const detalle = sinGuard.map((route) => `  ${route}${hintFor(route)}`).join('\n');

test('el walk encuentra rutas de mutación con parámetro (guard contra falso verde por vacío)', () => {
  // Sin esto, romper el walk —un `readdirSync` que tira, un regex que deja de
  // matchear— pondría TODO lo de abajo en verde con cero rutas auditadas, que es el
  // peor resultado posible: un ratchet que afirma que no hay deuda porque no miró.
  // Misma lección y mismo guard que `admin-site-scope.test.ts`.
  assert.ok(
    routes.length >= 90,
    `sólo ${routes.length} rutas admin de mutación con parámetro: el walk se rompió`,
  );
  assert.ok(
    scopedRoutes.length >= 60,
    `sólo ${scopedRoutes.length} de esas son \`scoped\`: la resolución por ancestro se rompió`,
  );
});

test('el criterio cubre las rutas de ACCIÓN, no sólo las `[id]` a secas', () => {
  // Dientes contra la regresión que ya pasó una vez. Si alguien "simplifica" el walk a
  // mirar el último segmento, este test se cae y explica por qué — en vez de bajar el
  // contador en silencio y dar por cerrada una deuda que sigue entera.
  const acciones = scopedRoutes.filter(({ route }) => {
    const segments = route.split('/');
    return segments.some((s) => s.startsWith('[')) && !segments[segments.length - 1]!.startsWith('[');
  });
  assert.ok(
    acciones.length >= 36,
    `Sólo ${acciones.length} rutas de acción (\`.../[id]/<verbo>\`) entraron en la auditoría.\n` +
      `El criterio volvió a mirar sólo el último segmento, que es el punto ciego con el que\n` +
      `se escapó \`delivery/executions/[id]/auto-assign\`: no leía, ESCRIBÍA una asignación.`,
  );
});

test('la deuda no sube: rutas de mutación sin guard <= MAX_SIN_GUARD', () => {
  assert.ok(
    sinGuard.length <= MAX_SIN_GUARD,
    `Hay ${sinGuard.length} rutas de mutación por id sobre recursos \`scoped\` sin guard, ` +
      `y el tope es ${MAX_SIN_GUARD}.\n\n${detalle}\n\n` +
      `Si agregaste una ruta nueva, ponele el guard: es una línea antes de mutar.\n` +
      `  await assertIdInSite(req.scope, await siteFromRequest(req), <DESCRIPTOR>, req.params.id as string);\n` +
      `Va en TODOS los verbos, no sólo en el primero. Y si el recurso es \`via_parent\` o\n` +
      `\`join_table\`, tiene que ser \`assertIdInSite\`: \`assertRowInSite\` hace \`return\` sin\n` +
      `chequear para esas dos formas, así que ahí es un guard decorativo.`,
  );
});

/**
 * El techo dice EXACTAMENTE cuántas hay, no "a lo sumo".
 *
 * Es la mitad que hace que el ratchet trinque de verdad. Con sólo `<=`, arreglar diez
 * rutas deja un `MAX_SIN_GUARD = 52` que vuelve a autorizar diez nuevas sin que nadie
 * lo note — el contador quedaría midiendo el pasado. Con la igualdad, cerrar una
 * OBLIGA a bajar el número en el mismo commit, y el diff del test es donde queda el
 * registro de que la deuda bajó.
 *
 * Es la convención del repo: `MAX_GHOST_KEYS` y `MAX_UNSCOPED_TRANSPORT` tienen su par
 * de igualdad por la misma razón.
 */
test('el techo dice el número REAL: rutas sin guard === MAX_SIN_GUARD', () => {
  assert.equal(
    sinGuard.length,
    MAX_SIN_GUARD,
    `El tope dice ${MAX_SIN_GUARD} pero hay ${sinGuard.length}.\n\n${detalle}\n\n` +
      `Si cerraste alguna —gracias—, bajá \`MAX_SIN_GUARD\` a ${sinGuard.length}.`,
  );
});

test('toda exención explica POR QUÉ no le aplica ningún guard', () => {
  // Una exención sin razón es un `// TODO` con permiso de producción. Con la razón
  // escrita, la próxima auditoría puede discutirla en vez de volver a investigarla
  // desde cero — que es el trabajo que este archivo existe para no repetir.
  const mudas = Object.entries(EXENTAS)
    .filter(([, reason]) => reason.trim().length < 40)
    .map(([route]) => route);
  assert.deepEqual(mudas, [], `Exenciones sin razón suficiente:\n  ${mudas.join('\n  ')}`);
});

test('una exención igual tiene que resolver la tienda', () => {
  /**
   * El candado de la puerta de atrás. `EXENTAS` dice "los guards de SQL no aplican
   * acá", NO "esta ruta puede ignorar la tienda": las cuatro aplican el eje por otro
   * camino —la fila que eligen, la colección a la que escriben—, y ese camino empieza
   * sí o sí en `siteFromRequest`.
   *
   * Sin esto, `EXENTAS` sería el atajo obvio para bajar el contador sin arreglar nada:
   * se agrega la ruta, se escribe un párrafo convincente y listo. Acá el párrafo no
   * alcanza — la ruta tiene que resolver la tienda en el código.
   */
  const mienten = Object.keys(EXENTAS).filter(
    (route) => !reaches(join(API_DIR, route, 'route.ts'), /siteFromRequest/),
  );
  assert.deepEqual(
    mienten,
    [],
    `Estas están exentas de los guards pero ni siquiera resuelven la tienda:\n  ${mienten.join('\n  ')}\n` +
      `Exenta de \`assertIdInSite\` no es exenta del eje de tienda.`,
  );
});

test('no quedan exenciones huérfanas', () => {
  // Una exención que sobrevive a su ruta —renombrada, borrada, o migrada a un guard de
  // verdad— es una autorización viva sin nada que autorizar. La próxima ruta que caiga
  // en ese path la hereda gratis.
  const conocidas = new Set(scopedRoutes.map(({ route }) => route));
  const huerfanas = Object.keys(EXENTAS).filter((route) => {
    if (!conocidas.has(route)) return true;
    const entry = scopedRoutes.find((r) => r.route === route)!;
    return reaches(entry.file, GUARD);
  });
  assert.deepEqual(
    huerfanas,
    [],
    `Estas exenciones ya no corresponden —la ruta no existe, dejó de ser \`scoped\`, o\n` +
      `ya usa un guard de verdad—:\n  ${huerfanas.join('\n  ')}`,
  );
});
