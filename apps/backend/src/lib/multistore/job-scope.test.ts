import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { JOB_SCOPE } from './job-scope';

/**
 * El registro de `job-scope.ts` sólo sirve si no puede driftear del filesystem.
 *
 * Calca `admin-site-scope.test.ts`, que hace lo mismo con `src/api/admin/**`, y
 * existe por el hueco que ese archivo no puede cubrir: un job o un subscriber no
 * tiene request, así que `siteFromRequest` no aplica y ninguno de los tres ratchets
 * de rutas los indexa. Antes de este archivo, un subscriber nuevo que mandara un
 * mail con la marca de otra tienda nacía sin que nada se pusiera rojo.
 *
 * La población es TODO archivo `.ts` bajo `src/jobs/` y `src/subscribers/` que no
 * sea un `.test.ts`. No hay criterio más fino a propósito: en `src/api` el criterio
 * angosto ("las que exportan GET") dejó 47 rutas invisibles, y la lección — escrita
 * tres veces en este repo — es que un criterio angosto no falla ruidosamente, da un
 * VERDE. Acá cada archivo de esos dos directorios es un punto de entrada que Medusa
 * ejecuta, y eso es exactamente lo que hay que declarar.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÉ NO PUEDE VER ESTE RATCHET
 *
 * Los tres ratchets de rutas fallaron cada uno por un criterio angosto y hoy lo
 * llevan escrito. Éste nace con los suyos declarados, para que el próximo que lo
 * lea no le crea más de lo que da:
 *
 * 1. **`scoped` NO ESTÁ PROBADO. Es una declaración humana.** El test de abajo sólo
 *    exige que el archivo —o alguno que importe, un salto— MENCIONE algún token de
 *    eje (`listSites`, `resolveSite`, `sales_channel_id`, `site_id`…). Eso descarta
 *    al que se marcó `scoped` sin tocar el tema, y NADA MÁS. Confundir mención con
 *    invocación es literalmente uno de los tres errores que ya cometieron los
 *    ratchets de rutas. Un subscriber que resuelva `sales_channel_id` y después se
 *    lo pase al provider equivocado, o que lo lea y lo tire, pasa este test.
 *    Verificar que el eje está BIEN APLICADO sigue siendo lectura humana.
 *
 * 2. **Sólo mira el archivo de ENTRADA.** El trabajo real de casi todos vive en
 *    `src/modules/**` o `src/workflows/**`, y ahí el eje se pierde sin que esto se
 *    entere: `jobs/process-gift-card-lifecycle` son catorce líneas que delegan en
 *    `modules/gift-card-experience/lifecycle.ts`, y es ADENTRO donde
 *    `getSettings()` lee la fila global. Esas siete deudas se encontraron leyendo a
 *    mano, no con este test, y si mañana alguien mete el mismo error un nivel más
 *    abajo de un archivo ya declarado `scoped`, este ratchet sigue verde.
 *
 * 3. **No sabe qué se ejecuta de verdad.** Indexa archivos, no registraciones: no
 *    lee el `config.event` de los subscribers ni el `config.schedule` de los jobs.
 *    Un subscriber suscrito a un evento que nadie emite, o un job cuyo cron quedó
 *    apagado, cuenta igual — y al revés, si algún día un módulo registra sus
 *    propios jobs desde `src/modules/<x>/jobs/`, esta caminata no los vería. Hoy no
 *    existe ninguno (los dos directorios de arriba son los únicos), y el guard de
 *    población de abajo es lo único que avisaría si el walk se rompe.
 *
 * 4. **`not-applicable` tampoco está probado.** Se exige una razón ESCRITA, no una
 *    razón cierta. Es el atajo cómodo de siempre: marcar `not-applicable` para no
 *    subir el contador. Lo único que lo frena es que la razón tiene que nombrar
 *    qué hace único el trabajo por instalación, y eso se lee en la revisión.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** `src/`, dos niveles arriba de `src/lib/multistore`. */
const SRC_DIR = resolve(import.meta.dirname, '..', '..');
const REPO_ROOT = resolve(SRC_DIR, '..', '..', '..');
const PLUGINS_DIR = join(REPO_ROOT, 'packages', 'plugins');
const SOURCE_ROOTS = [
  SRC_DIR,
  ...readdirSync(PLUGINS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(PLUGINS_DIR, entry.name, 'src')),
];
const entryFiles = new Map<string, string>();

const POPULATIONS = ['jobs', 'subscribers'] as const;

/**
 * El contador de deuda. **Sólo puede bajar.**
 *
 * Arrancó en 21, la primera vez que se midió. Hoy quedan 8, y lo que se cerró dice
 * más que el número: fue TODO lo que mandaba el mismo efecto externo con distinto
 * destinatario. Ese es el criterio de corte, y conviene tenerlo escrito porque la
 * pasada anterior lo confundió con "no tocar nada que salga de la instalación":
 *
 *   MULTIPLICA   → hoy corre una vez, con el eje puesto correría N veces.
 *                  `seo-embed-catalog` pagaría N embeddings por vectores idénticos.
 *                  NO se toca: el fan-out por tienda sería EL bug.
 *   NO MULTIPLICA → hoy sale un mail por orden y después sale UN mail por orden,
 *                  sólo que a la casilla correcta. Se cierra.
 *
 * La pasada que bajó de 16 a 12 agregó un matiz al criterio, y vale escribirlo: los
 * cuatro que cerró no mandan NADA nuevo hacia afuera —eligen contra qué fila leen.
 * Un earn por orden sigue siendo un earn por orden; una gift card por ítem sigue
 * siendo una. Lo que cambió es de quién es la configuración con la que se decide, y
 * en gift cards eso además queda SELLADO en la fila de la entrega: leer la global ahí
 * no es un error que se corrija después, es un dato mal escrito para siempre.
 *
 * Lo que queda, por familia:
 *
 *  - Gift cards (3): los tres BARRIDOS. No les falta un parámetro —`getSettings(null)`
 *    está escrito con la razón al lado— sino la forma del barrido: reclaman o recorren
 *    filas de todas las tiendas antes de saber de quién es cada una.
 *  - Cliente/auth (2): NO es que falte pasar un parámetro — no hay de dónde sacar la
 *    tienda. `customer` no tiene columna de canal, no hay link `customer`→`demo_store`
 *    y el alta no sella nada. Las dos se cierran juntas el día que el registro del
 *    cliente sepa su tienda; la razón de cada una lista las vías que se descartaron.
 *  - Sueltas (3): tracking de los dos carriers (bloqueadas por el modelo:
 *    `delivery_execution` no sabe de qué tienda es) y `seo-embed-catalog` (sólo el
 *    gate, y su fan-out sería el error inverso).
 *
 * Bajarlo es parte del PR que cierra cada una. Subirlo pide revisión: si algo nuevo
 * no aplica el eje, o se migra, o se justifica por escrito acá.
 */
const MAX_PENDING_JOBS = 8;

/**
 * Tokens que delatan que un archivo (o algo que importa) resuelve o propaga el eje.
 *
 * Es la contraparte de `siteFromRequest` en `admin-site-scope.test.ts`, pero acá no
 * hay UN helper canónico: sin request, la tienda llega de tres formas distintas
 * —recorriendo el registro, resolviéndola desde una fila, o propagándola en la
 * `data` de una notificación— y las tres son legítimas. Por eso la lista, y por eso
 * la advertencia 1 de la cabecera.
 */
const SITE_AXIS_TOKENS = [
  'listSites',
  'resolveSite',
  'siteFromRequest',
  'sales_channel_id',
  'salesChannelId',
  'site_id',
  'siteId',
];

/** Todo `.ts` que no sea test bajo `src/<population>/`, como `<population>/<nombre>`. */
function entryPoints(): string[] {
  const found: string[] = [];
  for (const sourceRoot of SOURCE_ROOTS) for (const population of POPULATIONS) {
    const dir = join(sourceRoot, population);
    if (!existsSync(dir)) continue;
    const walk = (current: string, prefix: string) => {
      for (const entry of readdirSync(current, { withFileTypes: true })) {
        const full = join(current, entry.name);
        if (entry.isDirectory()) {
          walk(full, `${prefix}/${entry.name}`);
          continue;
        }
        if (!entry.name.endsWith('.ts')) continue;
        // Los tests que viven al lado del job que prueban (`sync-correo-tracking-status.test.ts`)
        // no son puntos de entrada: no los carga Medusa y no tocan datos en producción.
        if (entry.name.endsWith('.test.ts')) continue;
        const key = `${prefix}/${entry.name.slice(0, -'.ts'.length)}`;
        // Los plugins publicados mantienen sus entradas agregadas existentes,
        // mientras que cada paquete controla sus puntos de entrada nuevos.
        if (sourceRoot !== SRC_DIR && !JOB_SCOPE[key]) continue;
        found.push(key);
        entryFiles.set(key, full);
      }
    };
    walk(dir, population);
  }
  return found.sort((a, b) => a.localeCompare(b));
}

const files = entryPoints();

test('el walk encuentra jobs Y subscribers (guard contra falso verde por vacío)', () => {
  // Si el walk se rompe, TODO lo de abajo pasaría trivialmente: cero archivos = cero
  // faltantes. Mismo guard que `admin-site-scope.test.ts` y `route-collisions.test.ts`.
  //
  // Se cuentan las dos poblaciones por separado a propósito: con un solo total, que
  // `src/jobs` desapareciera del walk se compensaría con los subscribers y el test
  // seguiría verde con la mitad de la deuda sin vigilar.
  const jobs = files.filter((file) => file.startsWith('jobs/'));
  const subscribers = files.filter((file) => file.startsWith('subscribers/'));
  assert.ok(jobs.length > 20, `sólo ${jobs.length} jobs encontrados: el walk se rompió`);
  assert.ok(
    subscribers.length > 40,
    `sólo ${subscribers.length} subscribers encontrados: el walk se rompió`,
  );
});

test('todo job y subscriber está declarado en el registro', () => {
  const missing = files.filter((file) => !JOB_SCOPE[file]);
  assert.deepEqual(
    missing,
    [],
    `Estos jobs/subscribers no declaran si respetan la tienda:\n  ${missing.join('\n  ')}\n\n` +
      `Agregalos a src/lib/multistore/job-scope.ts eligiendo:\n` +
      `  { state: 'scoped' }                          si lee y escribe con el eje puesto\n` +
      `  { state: 'not-applicable', reason: '...' }   si no tiene eje de tienda posible\n` +
      `  { state: 'pending', reason: '...' }          si todavía no lo aplica (y subí MAX_PENDING_JOBS)\n\n` +
      `Abrí el archivo antes de elegir: declarar 'scoped' por el nombre o por analogía\n` +
      `con un hermano es exactamente lo que este registro existe para impedir.`,
  );
});

test('el registro no tiene entradas huérfanas', () => {
  const known = new Set(files);
  const orphans = Object.keys(JOB_SCOPE).filter((key) => !known.has(key));
  assert.deepEqual(
    orphans,
    [],
    `El registro declara jobs/subscribers que ya no existen:\n  ${orphans.join('\n  ')}\n` +
      `Borrar uno tiene que limpiar su entrada — si no, el contador mide el pasado.`,
  );
});

/**
 * ¿Este archivo menciona el eje, sea directo o por un helper que importa?
 *
 * Un salto y no más, calcado de `resolvesSite()` en `admin-site-scope.test.ts`: alcanza
 * para los subscribers de WhatsApp, que delegan enteros en
 * `lib/whatsapp/send-order-notification.ts`, y para `compute-recurring-metrics`, que
 * delega en `modules/recurring-order/analytics.ts`. Con recursión ilimitada, cualquier
 * import terminaría "probando" cualquier cosa.
 */
function mentionsSiteAxis(file: string, depth = 1): boolean {
  let src: string;
  try {
    src = readFileSync(file, 'utf8');
  } catch {
    return false;
  }
  if (SITE_AXIS_TOKENS.some((token) => src.includes(token))) return true;
  if (depth <= 0) return false;

  for (const match of src.matchAll(/from '(\.[^']+)'/g)) {
    const target = resolve(dirname(file), match[1]!);
    for (const candidate of [`${target}.ts`, join(target, 'index.ts')]) {
      if (mentionsSiteAxis(candidate, depth - 1)) return true;
    }
  }
  return false;
}

test('todo lo marcado `scoped` al menos MENCIONA el eje de tienda', () => {
  // Dientes contra el tag optimista, y nada más que eso: ver la advertencia 1 de la
  // cabecera. Lo que este test SÍ atrapa es el `scoped` puesto por analogía sobre un
  // archivo donde la palabra "tienda" no aparece en ninguna forma.
  const lying: string[] = [];
  for (const [key, entry] of Object.entries(JOB_SCOPE)) {
    if (entry.state !== 'scoped') continue;
    const file = entryFiles.get(key);
    if (!file || !mentionsSiteAxis(file)) lying.push(key);
  }
  assert.deepEqual(
    lying,
    [],
    `Estos están marcados 'scoped' pero ni ellos ni lo que importan nombran el eje:\n  ${lying.join('\n  ')}\n` +
      `Tokens buscados: ${SITE_AXIS_TOKENS.join(', ')}.\n` +
      `Marcarlo no lo migra: mientras no resuelva la tienda, trabaja sobre las de todas.`,
  );
});

test('`not-applicable` viene siempre con una razón escrita', () => {
  const silent = Object.entries(JOB_SCOPE)
    .filter(([, entry]) => entry.state === 'not-applicable')
    .filter(([, entry]) => !(entry as { reason?: string }).reason?.trim())
    .map(([key]) => key);
  assert.deepEqual(
    silent,
    [],
    `'not-applicable' sin razón: ${silent.join(', ')}\n` +
      `La razón tiene que NOMBRAR qué lo hace único por instalación (qué tabla, qué\n` +
      `helper, qué invariante). "Es de instancia" es una etiqueta, no una razón.`,
  );
});

test('todo `pending` explica QUÉ le falta', () => {
  // Un `pending` sin razón es una nota mental que se pierde, y entre 22 se pierde
  // seguro. Con razón, el próximo sabe si le falta una columna, una decisión de
  // producto o sólo pasarle un parámetro a un helper que ya lo acepta — que es la
  // diferencia entre media hora y una semana.
  //
  // Además impide el atajo cómodo al revés: marcar `not-applicable` para bajar el
  // contador. Si hay eje posible tiene que quedar en `pending`, y entonces debe decir
  // por qué todavía no lo aplica.
  const sinRazon = Object.entries(JOB_SCOPE)
    .filter(([, entry]) => entry.state === 'pending')
    .filter(([, entry]) => !(entry as { reason?: string }).reason?.trim())
    .map(([key]) => key);
  assert.deepEqual(
    sinRazon,
    [],
    `Estos quedaron pendientes sin explicar qué les falta:\n  ${sinRazon.join('\n  ')}`,
  );
});

test('la deuda no sube: pendientes <= MAX_PENDING_JOBS', () => {
  const pending = Object.values(JOB_SCOPE).filter((entry) => entry.state === 'pending').length;
  assert.ok(
    pending <= MAX_PENDING_JOBS,
    `Hay ${pending} jobs/subscribers que no aplican el eje y el tope es ${MAX_PENDING_JOBS}.\n` +
      `Si agregaste uno que no lo aplica, migralo o subí MAX_PENDING_JOBS a conciencia:\n` +
      `este contador está para que la deuda baje, no para que crezca sola.`,
  );
});

/**
 * El techo dice EXACTAMENTE cuántos hay, no "a lo sumo".
 *
 * Es la convención del repo —`MAX_PENDING`, `MAX_SIN_GUARD`, `MAX_SIN_PERTENENCIA`,
 * `MAX_GHOST_KEYS` y `MAX_UNSCOPED_TRANSPORT` tienen todos su par de igualdad—, y el
 * motivo es el mismo: con sólo `<=`, cerrar una pendiente dejaría un tope viejo que
 * vuelve a autorizar una nueva sin que nadie lo note, y el contador pasaría a medir
 * el pasado. Con la igualdad, cerrar OBLIGA a bajar el número en el mismo commit, y
 * el diff del test es el registro de que la deuda bajó.
 */
test('el techo dice el número REAL: pendientes === MAX_PENDING_JOBS', () => {
  const pendientes = Object.entries(JOB_SCOPE)
    .filter(([, entry]) => entry.state === 'pending')
    .map(([key]) => key);

  assert.equal(
    pendientes.length,
    MAX_PENDING_JOBS,
    `El tope dice ${MAX_PENDING_JOBS} pero hay ${pendientes.length}:\n  ${pendientes.join('\n  ')}\n\n` +
      `Si cerraste alguno —gracias—, bajá \`MAX_PENDING_JOBS\` a ${pendientes.length} en el mismo commit.`,
  );
});
