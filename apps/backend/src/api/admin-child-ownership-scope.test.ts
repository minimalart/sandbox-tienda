import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * LA CUARTA PATA: la PERTENENCIA HIJO→PADRE.
 *
 * `admin-id-mutation-scope.test.ts` mide que HAYA guard de tienda. Lo dice él mismo en
 * su cabecera de `MAX_SIN_GUARD`, y es una confesión, no una nota al pie: **mide que
 * haya guard, no que el guard ALCANCE**. Este archivo es la mitad que falta.
 *
 * El hueco tiene una forma exacta y sólo aparece con DOS parámetros en el path. La ruta
 * es `.../[padre]/<hijas>/[hija]`, el guard valida el PADRE —que es lo correcto: la hija
 * casi nunca tiene columna de tienda propia, la hereda— y después el handler resuelve la
 * hija por su PK y NUNCA la cruza contra el padre. El `:padre` del path queda decorativo.
 *
 * El ataque es de una línea de curl: mando MI id de padre —que pasa el guard— y el id de
 * una hija ajena. El guard confirma que la corrida/empresa/chofer del path es mía; no
 * confirma que la fila que se está mutando cuelgue de ella. Y los ids de las hijas no son
 * secretos: salen de un export, de un webhook, de una URL vieja, de probar.
 *
 * Un guard decorativo es PEOR que ninguno, y el motivo está escrito en
 * `brands/[brand_id]/images/[image_id]`: aparece en el diff, la revisión lo da por
 * cerrado y el agujero sigue entero. La misma lección que el ratchet hermano aprendió un
 * nivel más arriba, cometida un nivel más abajo.
 *
 * La forma canónica del arreglo es una comparación, no una consulta: si el handler ya lee
 * la fila hija, comparar es gratis.
 *
 *     if (row?.parent_id !== req.params.id) { res.status(404)... ; return; }
 *
 * 404 y no 403 por el mismo motivo que los guards de tienda: un 403 confirmaría que esa
 * fila existe en otro lado.
 */

/** Igual que en el ratchet hermano, y a propósito: los dos tienen que ver lo mismo. */
const MUTATION_VERB =
  /export\s+(async\s+)?function\s+(POST|PUT|PATCH|DELETE)\b|export\s+const\s+(POST|PUT|PATCH|DELETE)\s*[:=]/;

const sinComentarios = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');

const API_DIR = import.meta.dirname;
const ADMIN_DIR = join(API_DIR, 'admin');

/**
 * El techo de deuda. **Sólo puede bajar.**
 *
 * Es el número MEDIDO de rutas de mutación con dos o más parámetros donde el id del padre
 * no participa de ninguna comparación contra un campo de la fila hija.
 *
 * **Hoy está en CERO.** El último caso fue `store-locations/[id]/coverage/[coverageId]`,
 * y vale dejar escrito por qué era deuda y no exención: esa ruta ya se había "cerrado"
 * con dos `assertIdInSite` —uno por id, con un descriptor `via_parent` para
 * `branch_coverage`—, y esa forma cubre el eje de TIENDA pero no el de PERTENENCIA. Con
 * dos sucursales de la MISMA tienda, el `:coverageId` de la A pasa los dos guards bajo
 * el `:id` de la B.
 *
 * La objeción ya estaba escrita en el repo, en `brands/[brand_id]/images/[image_id]`,
 * donde ese mismo descriptor se evaluó y se descartó con estas palabras: "no cubre
 * igual, porque seguiría aceptando una imagen de otra marca propia bajo un `brand_id`
 * que no es el suyo". Era literalmente ese caso, con otra tabla.
 *
 * Ésa es la lección que este archivo conserva: **dos guards de tienda no equivalen a un
 * guard de pertenencia**, por más que el diff se vea lleno.
 */
const MAX_SIN_PERTENENCIA = 0;

/**
 * Todas las `route.ts` de `src/api/admin/` con verbo de mutación y DOS O MÁS `[param]`.
 *
 * Dos es el mínimo estructural del hueco y no un corte arbitrario: con un solo parámetro
 * no hay padre contra el cual comparar —el guard de tienda es todo lo que hay y el ratchet
 * hermano ya lo cubre—. Con dos, hay una relación de pertenencia que alguien tiene que
 * verificar, y el guard de tienda por definición no la ve: mira el eje de tienda, no el
 * eje de padre.
 *
 * NO se filtra por `scoped`, a diferencia del hermano. La coherencia del par (padre, hija)
 * no es una regla de multitienda: es de autorización a secas, y sigue valiendo en una
 * instalación de una sola tienda donde `assertIdInSite` no rechaza nada. Filtrar por
 * `scoped` acá dejaría afuera rutas rotas por el motivo equivocado.
 */
function twoParamMutationRoutes(): Array<{ route: string; file: string; params: string[] }> {
  const found: Array<{ route: string; file: string; params: string[] }> = [];
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
      const params = route
        .split('/')
        .filter((segment) => segment.startsWith('[') && segment.endsWith(']'))
        .map((segment) => segment.slice(1, -1));
      if (params.length < 2) continue;
      if (!MUTATION_VERB.test(readFileSync(full, 'utf8'))) continue;
      found.push({ route, file: full, params });
    }
  };
  walk(ADMIN_DIR);
  return found.sort((a, b) => a.route.localeCompare(b.route));
}

/**
 * Borra las llamadas a los guards de tienda, con balanceo de paréntesis.
 *
 * Es la línea de defensa contra el falso verde OBVIO de este test, y el que ya se cometió
 * dos veces en este repo: `req.params.id` aparece SIEMPRE, en TODAS estas rutas, adentro
 * de `assertIdInSite(..., req.params.id)`. Cualquier criterio del tipo "¿se menciona el id
 * del padre?" da 11 de 11 en verde sin haber mirado nada — es exactamente el error de
 * `admin-site-scope.test.ts` con `siteFromRequest`, que da por filtrado un dashboard que
 * filtra tres de siete consultas.
 *
 * Se borra el TEXTO de la llamada entera y no la línea: la llamada al guard se parte en
 * varias líneas y borrar por línea dejaría los argumentos sueltos.
 *
 * El criterio de abajo ya es inmune por otra vía —exige un operador de comparación pegado
 * al token, y una llamada a un guard no tiene ninguno—, así que esto es redundante. Se
 * deja igual: cuesta nada y la redundancia es lo que hace que el test siga siendo correcto
 * si mañana alguien afloja el criterio. Las dos defensas tienen que caerse juntas para
 * volver al falso verde.
 */
function borrarGuards(source: string): string {
  let out = source;
  for (;;) {
    const match = /\b(assertIdInSite|assertRowInSite)\s*\(/.exec(out);
    if (!match) return out;
    let i = match.index + match[0].length;
    let depth = 1;
    while (i < out.length && depth > 0) {
      if (out[i] === '(') depth++;
      else if (out[i] === ')') depth--;
      i++;
    }
    out = out.slice(0, match.index) + ' '.repeat(i - match.index) + out.slice(i);
  }
}

/**
 * Los nombres con los que el fuente se refiere al parámetro del padre.
 *
 * Hace falta porque casi ningún handler compara contra `req.params.id` crudo: lo copia a
 * un local con nombre de dominio —`const corporateId = req.params.id as string`— y compara
 * contra ése. Un criterio que sólo buscara `req.params.<padre>` marcaría como rotas a las
 * que están bien, que es la forma cara de equivocarse: el ratchet grita, alguien "arregla"
 * lo que ya estaba y aprende a no confiar en el test.
 *
 * Se cubren las dos formas que existen en el repo: el `const x = req.params.y` y el
 * destructuring `const { y } = req.params`. Un solo salto, sin seguir reasignaciones: si
 * alguien pasa el id por tres variables antes de compararlo, el test lo marca y el arreglo
 * es escribir la comparación de forma legible, no enseñarle al test a seguir el rastro.
 */
function nombresDelPadre(source: string, param: string): string[] {
  const names = new Set<string>([`req.params.${param}`]);
  const asignacion = new RegExp(
    `const\\s+([A-Za-z_$][\\w$]*)\\s*(?::[^=;]+)?=\\s*req\\.params\\.${param}\\b`,
    'g',
  );
  for (const match of source.matchAll(asignacion)) names.add(match[1]!);
  for (const match of source.matchAll(/const\s*\{([^}]*)\}\s*=\s*req\.params\b/g)) {
    for (const piece of match[1]!.split(',')) {
      const [key, alias] = piece.split(':').map((x) => x.trim());
      if (key === param) names.add(alias || key);
    }
  }
  return [...names];
}

const OPERADORES = ['===', '!==', '==', '!='];
const escapar = (s: string): string => s.replace(/[.$*+?^{}()|[\]\\]/g, '\\$&');

/**
 * ¿El id del padre participa de una comparación contra un CAMPO de una fila?
 *
 * Las dos mitades del criterio importan, y la segunda es la que le da dientes:
 *
 *   1. Un operador de comparación pegado al token. Esto solo ya distingue la aparición
 *      dentro del guard —`assertIdInSite(..., req.params.id as string)`, sin ningún
 *      operador— de una comparación real.
 *
 *   2. Del otro lado, un ACCESO A PROPIEDAD (`algo.campo`), no cualquier cosa. Sin esto,
 *      un `if (req.params.id !== 'demo')` o un `corporateId === undefined` contarían como
 *      pertenencia verificada. La pertenencia es, por definición, comparar el id del padre
 *      contra el campo que la fila hija guarda del padre; si del otro lado no hay un campo
 *      de una fila, no se está verificando nada.
 *
 * Se acepta el acceso en cualquiera de los dos lados. En el repo hoy son todos
 * `fila.padre_id !== padreId`, pero el orden es cosmético y forzarlo sería un ratchet que
 * mide estilo.
 *
 * El lado del campo se reconoce por el `.campo` FINAL y no por la expresión entera a
 * propósito: en el repo hay al menos tres formas —`producto.execution_id`, el opcional
 * `before?.company_id`, y el cast `(image as { brand_id?: string }).brand_id`— y un regex
 * que intente parsear las tres termina siendo un parser de TypeScript malo. El `.campo`
 * pegado al operador las cubre a las tres.
 */
function comparaContraUnCampo(source: string, names: string[]): boolean {
  for (const name of names) {
    const token = escapar(name);
    for (const op of OPERADORES) {
      const o = escapar(op);
      // fila.campo !== padre   (incluye `?.campo` y `(x as T).campo`)
      if (new RegExp(`\\.\\s*[A-Za-z_$][\\w$]*\\s*${o}\\s*${token}\\b`).test(source)) return true;
      // padre !== fila.campo
      if (new RegExp(`${token}\\b[^;\\n]{0,40}?${o}\\s*[A-Za-z_$][\\w$]*\\s*\\??\\.\\s*[A-Za-z_$][\\w$]*`).test(source)) {
        return true;
      }
    }
  }
  return false;
}

/** El padre es el parámetro inmediatamente anterior al último: el dueño directo de la hija. */
const padreDe = (params: string[]): string => params[params.length - 2]!;

const routes = twoParamMutationRoutes();

const analizadas = routes.map((entry) => {
  const source = borrarGuards(sinComentarios(readFileSync(entry.file, 'utf8')));
  const padre = padreDe(entry.params);
  const names = nombresDelPadre(source, padre);
  return {
    ...entry,
    padre,
    names,
    compara: comparaContraUnCampo(source, names),
    // La medición INGENUA, la que este test existe para no ser. Se calcula igual porque
    // uno de los tests de abajo la usa para demostrar que no sirve.
    mencionaIngenuo: names.some((n) => new RegExp(escapar(n)).test(sinComentarios(readFileSync(entry.file, 'utf8')))),
  };
});

const sinPertenencia = analizadas.filter((entry) => !entry.compara);

const detalle = sinPertenencia
  .map(
    (entry) =>
      `  ${entry.route}\n` +
      `      padre \`:${entry.padre}\` (visto como ${entry.names.join(' | ')}) nunca se compara\n` +
      `      contra ningún campo de la fila de \`:${entry.params[entry.params.length - 1]}\`.`,
  )
  .join('\n');

test('el walk encuentra rutas de mutación con dos parámetros (guard contra falso verde por vacío)', () => {
  // Sin esto, romper el walk pondría todo lo de abajo en verde con cero rutas auditadas:
  // un ratchet que afirma que no hay deuda porque no miró. Misma lección y mismo guard que
  // `admin-id-mutation-scope.test.ts` y `admin-site-scope.test.ts`.
  assert.ok(
    routes.length >= 8,
    `sólo ${routes.length} rutas admin de mutación con dos o más parámetros: el walk se rompió`,
  );
});

test('la medición INGENUA daría todo verde: por eso no se usa', () => {
  /**
   * El test que documenta el error que este archivo NO comete.
   *
   * `req.params.<padre>` aparece en el 100% de estas rutas porque el guard de tienda lo
   * recibe como argumento. Cualquier criterio basado en "¿se menciona el id del padre?"
   * —el reflejo obvio, y el que ya se cometió una vez con `siteFromRequest` en
   * `admin-site-scope.test.ts`— absuelve a todas sin mirar ninguna.
   *
   * Esto lo deja MEDIDO y no opinado: la ingenua absuelve a todas, la real no. Si algún
   * día las dos dan lo mismo, este test se cae y avisa que el criterio real se aflojó
   * hasta volverse la ingenua.
   */
  const ingenuas = analizadas.filter((entry) => entry.mencionaIngenuo);
  assert.equal(
    ingenuas.length,
    routes.length,
    `La medición ingenua debería absolver a las ${routes.length}: si no, el guard de tienda\n` +
      `dejó de recibir \`req.params.<padre>\` y hay que revisar de dónde sale el id.`,
  );
  assert.ok(
    analizadas.filter((entry) => entry.compara).length < routes.length ||
      MAX_SIN_PERTENENCIA === 0,
    `La medición real absolvió a las ${routes.length} igual que la ingenua. O se cerró la\n` +
      `última deuda —en cuyo caso \`MAX_SIN_PERTENENCIA\` tiene que ser 0— o el criterio se\n` +
      `aflojó hasta contar la mención dentro del guard como si fuera una comparación.`,
  );
});

test('la deuda no sube: rutas sin chequeo de pertenencia <= MAX_SIN_PERTENENCIA', () => {
  assert.ok(
    sinPertenencia.length <= MAX_SIN_PERTENENCIA,
    `Hay ${sinPertenencia.length} rutas de mutación con dos parámetros donde el id del PADRE\n` +
      `nunca se cruza contra la fila HIJA, y el tope es ${MAX_SIN_PERTENENCIA}.\n\n${detalle}\n\n` +
      `El guard de tienda NO cubre esto: valida que el padre del path sea de mi tienda, no\n` +
      `que la hija cuelgue de ese padre. Con un padre propio y una hija ajena, entra igual.\n\n` +
      `Si el handler YA lee la fila hija, el arreglo son tres líneas y ninguna consulta nueva:\n` +
      `  if (fila?.<padre>_id !== req.params.<padre>) {\n` +
      `    res.status(404).json({ type: 'not_found', message: 'No encontrado' });\n` +
      `    return;\n` +
      `  }\n` +
      `Si no la lee, agregá la lectura mínima: \`retrieveX(id).catch(() => null)\`.\n` +
      `404 y no 403: un 403 confirmaría que esa fila existe en otra empresa/corrida/tienda.\n\n` +
      `Y no la cierres con un descriptor \`via_parent\` sobre la hija: resuelve el eje de\n` +
      `TIENDA en una llamada y sigue aceptando el cruce entre dos padres de la MISMA tienda,\n` +
      `que es el caso que esta comparación existe para tapar.`,
  );
});

/**
 * El techo dice EXACTAMENTE cuántas hay, no "a lo sumo".
 *
 * Es la convención del repo —`MAX_SIN_GUARD`, `MAX_GHOST_KEYS`, `MAX_UNSCOPED_TRANSPORT`
 * tienen todos su par de igualdad— y el motivo es el mismo: con sólo `<=`, cerrar una ruta
 * deja un techo viejo que vuelve a autorizar una nueva sin que nadie lo note. El contador
 * pasaría a medir el pasado. Con la igualdad, cerrar OBLIGA a bajar el número en el mismo
 * commit, y el diff del test es el registro de que la deuda bajó.
 */
test('el techo dice el número REAL: rutas sin pertenencia === MAX_SIN_PERTENENCIA', () => {
  assert.equal(
    sinPertenencia.length,
    MAX_SIN_PERTENENCIA,
    `El tope dice ${MAX_SIN_PERTENENCIA} pero hay ${sinPertenencia.length}.\n\n${detalle}\n\n` +
      `Si cerraste alguna —gracias—, bajá \`MAX_SIN_PERTENENCIA\` a ${sinPertenencia.length}.`,
  );
});

test('el padre se toma del anteúltimo parámetro, no del primero', () => {
  /**
   * Dientes contra la "simplificación" que rompería el test en silencio.
   *
   * Con tres parámetros —`.../[a]/x/[b]/y/[c]`— el dueño directo de `:c` es `:b`, no `:a`.
   * Alguien que cambie `padreDe` a `params[0]` haría que las rutas de tres niveles se
   * midan contra el abuelo: el test seguiría en verde porque la comparación contra el
   * abuelo también existe a veces, y dejaría de ver el salto que importa.
   *
   * Hoy no hay ninguna de tres niveles, así que esto es una invariante de la FUNCIÓN y no
   * de los datos: se prueba directo, que es la única forma de que siga sirviendo cuando
   * aparezca la primera.
   */
  assert.equal(padreDe(['a', 'b']), 'a');
  assert.equal(padreDe(['a', 'b', 'c']), 'b');
});

test('una comparación contra un literal NO cuenta como pertenencia', () => {
  /**
   * El candado contra el arreglo cosmético.
   *
   * Sin la exigencia del acceso a propiedad del otro lado, bajar el contador sería tan
   * barato como escribir `if (req.params.id !== 'x') {}`: aparece un operador, el regex se
   * conforma y la deuda queda "cerrada" sin que nadie haya chequeado nada. Sería el mismo
   * pecado que el guard decorativo, cometido por el test que existe para detectarlo.
   *
   * Se prueba sobre fuentes sintéticas y no sobre el repo a propósito: es una propiedad
   * del criterio, y tiene que valer aunque hoy ninguna ruta intente hacer trampa.
   */
  const names = ['req.params.id', 'companyId'];
  assert.equal(comparaContraUnCampo(`if (req.params.id !== 'demo') {}`, names), false);
  assert.equal(comparaContraUnCampo(`if (companyId === undefined) {}`, names), false);
  assert.equal(comparaContraUnCampo(`if (companyId !== null) {}`, names), false);
  // Y la de verdad sí cuenta, en sus tres formas reales del repo.
  assert.equal(comparaContraUnCampo(`if (row.company_id !== companyId) {}`, names), true);
  assert.equal(comparaContraUnCampo(`if (before?.company_id !== companyId) {}`, names), true);
  assert.equal(
    comparaContraUnCampo(`if ((i as { c?: string }).company_id !== req.params.id) {}`, names),
    true,
  );
  assert.equal(comparaContraUnCampo(`if (companyId !== row.company_id) {}`, names), true);
});

test('la mención dentro del guard de tienda NO cuenta como pertenencia', () => {
  /**
   * El falso verde específico que este archivo existe para no dar, probado en negativo
   * sobre una ruta sintética que es copia exacta de la forma real: guard de tienda con el
   * id del padre, mutación por la PK de la hija, cero comparaciones.
   *
   * Es la prueba de que el test se pone rojo cuando tiene que ponerse. Sin esto, "el
   * ratchet está en verde" no significaría nada: podría estar en verde porque no mira.
   */
  const sonda = `
    export async function DELETE(req, res) {
      await assertIdInSite(req.scope, await siteFromRequest(req), FOO_SITE_SCOPE, req.params.id as string);
      const service = req.scope.resolve(FOO_MODULE);
      const childId = req.params.childId as string;
      await service.deleteChildren([childId]);
      res.json({ id: childId, deleted: true });
    }
  `;
  const limpio = borrarGuards(sinComentarios(sonda));
  assert.equal(comparaContraUnCampo(limpio, nombresDelPadre(limpio, 'id')), false);

  // Y la misma sonda con el chequeo puesto pasa: el criterio distingue, no rechaza todo.
  const cerrada = sonda.replace(
    'await service.deleteChildren',
    `const child = await service.retrieveChild(childId).catch(() => null);
     if (child?.foo_id !== req.params.id) { res.status(404).json({}); return; }
     await service.deleteChildren`,
  );
  const limpioCerrado = borrarGuards(sinComentarios(cerrada));
  assert.equal(comparaContraUnCampo(limpioCerrado, nombresDelPadre(limpioCerrado, 'id')), true);
});
