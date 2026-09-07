import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * LA SEXTA PATA: la CREACIÓN, en la capa donde de verdad ocurre.
 *
 * Los cinco ratchets de multitienda que existen —`admin-site-scope`,
 * `admin-id-mutation-scope`, `admin-child-ownership-scope`, `store-site-scope` y
 * `job-scope`— miran `src/api/` y `src/jobs`. NINGUNO mira `src/workflows/`, y ahí es
 * donde nacen las filas: la ruta valida y delega, el workflow arma el objeto y llama al
 * `create<Entidad>s` del `MedusaService`.
 *
 * El agujero no es teórico y tiene nombre. `create-banner.ts` pasó CUATRO auditorías
 * escondido detrás de una ruta que sí invocaba `siteFromRequest` —para el GET—. El
 * banner nacía sin `rules.sales_channel_ids`, y con `empty: 'all'` en
 * `BANNER_SITE_SCOPE` eso no lo deja huérfano: lo publica en TODAS las tiendas. No hay
 * error, no hay 4xx, y aparece en el listado de quien lo creó porque una tienda ve los
 * globales. La quinta aparición de esa forma se encontraría igual que las cuatro
 * primeras: leyendo a mano. Este archivo es para que no.
 *
 * ── LOS TRES ERRORES DE CRITERIO QUE YA COMETIERON LOS HERMANOS, Y NO SE REPITEN ──
 *
 *  1. CRITERIO ANGOSTO. `admin-id-mutation-scope` midió primero sólo rutas cuyo ÚLTIMO
 *     segmento fuera un parámetro, y con eso `delivery/executions/[id]/auto-assign` "no
 *     existía" siendo el peor caso. El equivalente acá sería mirar sólo archivos
 *     `create-*.ts`: dejaría afuera `steps/create-pdf-catalog.ts`, los `create*` que
 *     viven dentro de un workflow con otro nombre (`update-route-stops.ts`,
 *     `redeem-reward.ts`, `accept-corporate-invitation.ts`) y —el caso caro— las
 *     COMPENSACIONES de los `delete-*`, que RE-CREAN la fila y son exactamente donde
 *     hoy está la única deuda medida. Por eso el walk es sobre TODO `src/workflows/**`
 *     y el disparador es la LLAMADA, no el nombre del archivo. Hay un test abajo que
 *     mide que la población ancha sea estrictamente mayor que la angosta.
 *
 *  2. EL SALTO AL BARRIL. `lib/multistore/index.ts` re-exporta los helpers, así que
 *     "el archivo menciona X" contaba de más y absolvía por un re-export. Acá NO hay
 *     salto entre archivos de ninguna clase: el criterio se resuelve sobre el ARGUMENTO
 *     de la llamada, que es el único lugar donde el eje puede estar o no estar.
 *
 *  3. MENCIÓN ≠ INVOCACIÓN. Las rutas que explicaban en un COMENTARIO por qué el guard
 *     no aplicaba quedaban absueltas por ese texto. Acá el fuente se limpia de
 *     comentarios ANTES de medir, y la llamada se reconoce por el paréntesis. Nombrar
 *     `site_id` en una cabecera no pone `site_id` en la fila.
 *
 * ── QUÉ *NO* PUEDE VER ESTE RATCHET ──
 *
 * Se escribe acá, y no en un TODO, porque un ratchet que finge cubrir lo que no cubre
 * es peor que no tenerlo: da un verde que alguien va a leer como "esto está auditado".
 *
 *  a) VE LA CLAVE, NO EL VALOR. `rules: input.rules ?? null` cuenta como eje puesto, y
 *     es literalmente la línea de `create-banner.ts`. El eje de ese banner lo estampa
 *     hoy `bannerRulesWithSiteDefaults` en la RUTA, un nivel más arriba; si mañana
 *     alguien saca esa llamada, este test sigue en verde. Lo que cubre ese caso es
 *     `banner-site-scope.test.ts`, que prueba la función de estampado, no la forma del
 *     call site. Los dos hacen falta y ninguno reemplaza al otro.
 *
 *  b) ESTAMPAR NO ES CONSERVAR, Y ESO ES OTRA AUDITORÍA. Un workflow puede RECIBIR el
 *     eje y perderlo de costado al escribir —`update-banner` reemplazaba el blob
 *     `rules` entero y se llevaba puesto `sales_channel_ids`—. Esa forma vive en los
 *     UPDATE, y los UPDATE no están en esta población: acá sólo entra `create<X>s(`.
 *     Un `update-banner` roto deja este ratchet en verde. Se cubre con la prueba de
 *     `mergeRulesPreservingScope`, y hoy no hay ningún ratchet que exija esa prueba
 *     para el próximo blob compuesto que aparezca. Esa es la SÉPTIMA pata, y no está.
 *
 *  c) EL PASS-THROUGH SE ACEPTA A CIEGAS. `createBrands(input as any)` y
 *     `createGa4EventMappings({ ...input, … })` cuentan como cubiertos porque el eje
 *     puede venir en `input` —y de hecho su tipo lo declara—, pero este test no puede
 *     ver si el CALL SITE que arma ese input lo llena. Es una elección deliberada: la
 *     alternativa —marcarlos como deuda— produciría rojo sobre código correcto, y un
 *     ratchet que grita sobre lo que ya está bien enseña a no confiar en él. La
 *     excepción es el pass-through que SACA el eje con un destructuring (`const {
 *     sales_channel_ids, ...resto } = input`): ahí la pérdida es visible y sí cuenta.
 *
 *  d) `via_parent` QUEDA ABSUELTO POR CONSTRUCCIÓN. Ahí la FK ES el eje y `siteDefaults`
 *     devuelve `{}` a propósito, así que exigir una columna sería exigir una que no
 *     existe. Se exige que la FK esté en el objeto —hoy 10 de 10—, pero NO que apunte a
 *     un padre de la tienda correcta: ese es el eje de `admin-child-ownership-scope`.
 *
 *  e) SÓLO VE EL `create<X>s(` LITERAL. Si un workflow crea a través de un método
 *     propio del servicio —`createAuditEntry`, `reconcileChannels`, `replaceHotspots`—
 *     la creación ocurre adentro del módulo y este walk no la ve.
 */

/**
 * El código sin comentarios. Deliberadamente tonto, calcado de los ratchets hermanos:
 * sirve para decidir si algo se INVOCA, no para parsear TypeScript.
 *
 * Único falso positivo posible —un `//` adentro de un string, típicamente una URL— que
 * trunca esa línea. El efecto sería perder una llamada, o sea contar de MENOS en la
 * población; los tests de piso de abajo son los que hacen que eso no pase inadvertido.
 */
const sinComentarios = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');

const WORKFLOWS_DIR = import.meta.dirname;
const MODULES_DIR = join(WORKFLOWS_DIR, '..', 'modules');

type Descriptor = {
  kind: string;
  table: string;
  /** La columna del eje. En `via_parent` no hay: el eje es la `fk`. */
  column?: string;
  fk?: string;
  /** Sólo `channel_array_json`: la ruta DENTRO del jsonb (`rules.sales_channel_ids`). */
  path?: string[];
  modulo: string;
};

/**
 * El techo de deuda. **Sólo puede bajar.**
 *
 * Es el número MEDIDO de llamadas a `create<Entidad>s` en `src/workflows/**` que crean
 * en una tabla CON descriptor y no ponen el eje, descontando las exentas de abajo.
 *
 * **Hoy está en CERO.** El único caso lo encontró este archivo en su primera corrida y
 * vale conservarlo, porque es el que explica para qué sirve:
 *
 *   `steps/delete-ga4-mapping.ts` — la COMPENSACIÓN del borrado re-creaba el mapeo campo
 *   por campo y NO copiaba `site_id`. Un workflow que fallara después de borrar dejaba el
 *   mapeo de la tienda A convertido en GLOBAL, despachando para todas.
 *   `GA4_EVENT_MAPPING_SITE_SCOPE` es `site_column` con `empty: 'all'`, así que la fila no
 *   desaparece: se multiplica, y nadie ve un error.
 *
 * Es el peor lugar donde puede vivir este bug. La compensación **sólo corre cuando algo ya
 * salió mal**, así que el daño llega envuelto en otro error y nadie lo atribuye ahí. Y en
 * el alta no se ve: el step hermano hace `...input` y arrastra todo.
 *
 * Su propio tipo ya lo advertía —"en los workflows que arman el objeto campo por campo hay
 * que enumerarlo además, si no se descarta en silencio: pasó cinco veces en esta
 * migración"—. Ésa fue la sexta, tres archivos más allá de donde estaba la advertencia.
 */
const MAX_SIN_EJE = 0;

/**
 * Creaciones que NO pertenecen a un módulo de este repo.
 *
 * Existe como CANDADO, no como prolijidad. La población se arma resolviendo
 * `create<Plural>` contra los modelos de `src/modules/<módulo>/models/`, y una entidad cuyo
 * plural el helper no acierte se caería de la población EN SILENCIO —el mismo falso
 * verde por vacío que los ratchets hermanos previenen con su piso—. El test de abajo
 * exige que toda llamada no resuelta esté nombrada acá con su razón: si aparece una
 * nueva, se pone rojo y hay que decidir si es ajena o si el mapeo se rompió.
 */
const CREACIONES_AJENAS: Record<string, string> = {
  createFiles: 'módulo FILE del core de Medusa: no tiene modelo en `src/modules/`.',
  createCustomerGroups: 'módulo CUSTOMER del core: el grupo nativo que envuelve un grupo dinámico.',
  createNotifications: 'módulo NOTIFICATION del core: el envío, no una fila de dominio.',
};

/**
 * Llamadas que crean en una tabla con descriptor SIN poner el eje, a propósito.
 *
 * Mismo mecanismo que `EXENTAS` en `admin-id-mutation-scope.test.ts` y por el mismo
 * motivo: sin la lista, la única forma de sacarlas del contador sería estampar un eje
 * que NO corresponde, y un eje puesto donde no va es peor que ninguno —aparece en el
 * diff, la revisión lo da por cerrado y el problema real queda sin nombre—.
 *
 * NO es un cajón para bajar el número: los tests de abajo exigen razón y exigen que la
 * exención siga correspondiendo (si la llamada desaparece o se cierra, se cae).
 */
const EXENTAS: Record<string, string> = {
  // steps/create-pdf-catalog.ts — moved to @minimalart/mercatto-plugin-pdf-catalog.
  'create-corporate.ts': 'YA ESTÁ DECLARADA `pending` EN `store-routes.ts:213`: sellar la empresa con la tienda ' +
    'activa al crearla cambia QUIÉN ADMINISTRA LAS CUENTAS YA CREADAS. `CORPORATE_SITE_SCOPE` es ' +
    '`site_column` con `empty: \'all\'`, o sea que las empresas sin `site_id` —todas las de hoy— se ' +
    'ven desde cualquier tienda a propósito, y esa decisión está escrita en su cabecera: esconder ' +
    'una cuenta B2B viva el día del deploy le cortaría el acceso al comprador sin que nadie lo haya ' +
    'decidido. Es una decisión de producto sobre datos existentes, no un olvido de código.',
};

// ── El mapa MODELO → TABLA, leído de los modelos de verdad ───────────────────────────
//
// Hace falta porque el nombre del método NO dice la tabla. `createRouteStops` escribe en
// `delivery_route_stop`, `createRewardGrants` en `loyalty_reward_grant`, `createRoutes` en
// `delivery_route`. Derivar la tabla del nombre del método —snake_case + singular— habría
// dado `route_stop`, `reward_grant` y `route`: TRES tablas inexistentes, o sea tres
// llamadas fuera de la población sin que nadie se entere. La convención del `MedusaService`
// es pluralizar el nombre del MODELO; el modelo declara su tabla en `model.define`.
function modelosPorNombre(): Map<string, string> {
  const modelos = new Map<string, string>();
  for (const modulo of readdirSync(MODULES_DIR, { withFileTypes: true })) {
    if (!modulo.isDirectory()) continue;
    let archivos: string[];
    try {
      archivos = readdirSync(join(MODULES_DIR, modulo.name, 'models'));
    } catch {
      continue;
    }
    for (const archivo of archivos) {
      if (!archivo.endsWith('.ts')) continue;
      const source = sinComentarios(
        readFileSync(join(MODULES_DIR, modulo.name, 'models', archivo), 'utf8'),
      );
      // `const X = model.define('tabla', …)` — con o sin `export` delante: `BrandImage`
      // usa `export default`, y exigir `export const` lo dejaba afuera.
      for (const m of source.matchAll(
        /(?:export\s+)?const\s+([A-Za-z0-9_]+)\s*=\s*model\s*\.\s*define\(\s*'([a-z0-9_]+)'/g,
      )) {
        modelos.set(m[1]!, m[2]!);
      }
      // La forma con config: `model.define({ name: 'x', tableName: 'y' }, …)`. Hoy la usa
      // una sola (`ZoneResource`), y `tableName` gana sobre `name` — que es justamente el
      // caso donde adivinar la tabla desde el nombre habría fallado.
      for (const m of source.matchAll(
        /(?:export\s+)?const\s+([A-Za-z0-9_]+)\s*=\s*model\s*\.\s*define\(\s*\{([^}]*)\}/g,
      )) {
        const cfg = m[2]!;
        const tabla =
          /tableName:\s*'([a-z0-9_]+)'/.exec(cfg)?.[1] ?? /name:\s*'([a-z0-9_]+)'/.exec(cfg)?.[1];
        if (tabla) modelos.set(m[1]!, tabla);
      }
    }
  }
  return modelos;
}

// ── Los descriptores, leídos de `src/modules/*/site-scope.ts` ────────────────────────
//
// Se parsean las DOS formas que existen en el repo, y la segunda no es un detalle: seis
// módulos declaran sus descriptores hijos con una factory (`viaCorporate('corporate_member')`,
// `viaLocation('delivery_execution')`, `viaProgram('loyalty_tier')`, `viaExecution(…)`).
// Ignorarlas dejaría fuera de la población a `corporate_member`, `corporate_invitation`,
// `delivery_execution`, `delivery_route` y `loyalty_reward_grant` — cinco tablas que sí
// tienen eje, entre ellas las de cuatro llamadas reales de esta población.
function descriptoresPorTabla(): Map<string, Descriptor[]> {
  const porTabla = new Map<string, Descriptor[]>();
  const agregar = (d: Descriptor) => {
    const previos = porTabla.get(d.table);
    if (previos) previos.push(d);
    else porTabla.set(d.table, [d]);
  };

  const campos = (body: string) => ({
    kind: /kind:\s*'(\w+)'/.exec(body)?.[1],
    // El `[^A-Za-z]` delante evita que `joinTable:` matchee como `table:`, que
    // convertiría `pdf_catalog` en `pdf_catalog_channel` y sacaría al catálogo de la
    // población.
    table: /[^A-Za-z]table:\s*'([a-z0-9_]+)'/.exec(body)?.[1],
    column: /[^A-Za-z]column:\s*'([a-z0-9_]+)'/.exec(body)?.[1],
    fk: /[^A-Za-z]fk:\s*'([a-z0-9_]+)'/.exec(body)?.[1],
    path: /path:\s*\[([^\]]*)\]/
      .exec(body)?.[1]
      ?.split(',')
      .map((p) => p.trim().replace(/'/g, ''))
      .filter(Boolean),
  });

  for (const modulo of readdirSync(MODULES_DIR, { withFileTypes: true })) {
    if (!modulo.isDirectory()) continue;
    let source: string;
    try {
      source = sinComentarios(readFileSync(join(MODULES_DIR, modulo.name, 'site-scope.ts'), 'utf8'));
    } catch {
      continue;
    }

    // Factories: `const viaX = (table: string, fk = 'y'): T => ({ … })`.
    const factories = new Map<string, ReturnType<typeof campos>>();
    for (const m of source.matchAll(
      /const\s+([A-Za-z_$][\w$]*)\s*=\s*\([^)]*\)\s*(?::[^=]+)?=>\s*\(\s*(\{[^{}]*\})\s*\)/g,
    )) {
      const tpl = campos(m[2]!);
      // `viaLocation` toma la fk por parámetro con default; el cuerpo la escribe como
      // shorthand (`fk,`) y por eso hay que leerla de la firma.
      const porDefecto = /fk\s*=\s*'([a-z0-9_]+)'/.exec(m[0]!)?.[1];
      factories.set(m[1]!, { ...tpl, fk: tpl.fk ?? porDefecto });
    }

    // Literales.
    for (const m of source.matchAll(/\{[^{}]*kind:\s*'(\w+)'[^{}]*\}/g)) {
      const d = campos(m[0]!);
      if (d.kind && d.table) agregar({ ...d, kind: d.kind, table: d.table, modulo: modulo.name });
    }

    // Aplicaciones de factory: `export const X_SITE_SCOPE = viaY('tabla');`
    for (const m of source.matchAll(/=\s*([A-Za-z_$][\w$]*)\(\s*'([a-z0-9_]+)'/g)) {
      const tpl = factories.get(m[1]!);
      if (tpl?.kind) agregar({ ...tpl, kind: tpl.kind, table: m[2]!, modulo: modulo.name });
    }
  }
  return porTabla;
}

/**
 * La pluralización del `MedusaService`. Chica a propósito.
 *
 * Cubre las formas que hay: `Company → Companies`, y el `+s` de todo lo demás. Si
 * mañana entra un modelo cuyo plural no acierte, la llamada NO se cae en silencio: cae
 * en "no resuelta" y el test de `CREACIONES_AJENAS` se pone rojo pidiendo una decisión.
 */
const pluralizar = (nombre: string): string =>
  /y$/.test(nombre)
    ? `${nombre.slice(0, -1)}ies`
    : /(s|x|ch|sh)$/.test(nombre)
      ? `${nombre}es`
      : `${nombre}s`;

/** Todo `src/workflows/**`, sin los tests. La recursión es el punto: los `steps/` cuentan. */
function archivosDeWorkflows(): string[] {
  const encontrados: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) encontrados.push(full);
    }
  };
  walk(WORKFLOWS_DIR);
  return encontrados.sort();
}

/** El texto del argumento, con paréntesis balanceados. Es todo lo que el criterio mira. */
function argumentoDesde(source: string, inicio: number): string {
  let i = inicio;
  let depth = 1;
  while (i < source.length && depth > 0) {
    if (source[i] === '(') depth++;
    else if (source[i] === ')') depth--;
    i++;
  }
  return source.slice(inicio, i - 1);
}

/**
 * ¿La columna aparece como CLAVE de un objeto en el argumento?
 *
 * El `[^\w.'"]` delante descarta las tres formas que NO son una clave: el sufijo de otro
 * identificador (`corporate_site_id:`), un acceso a propiedad (`previous.site_id`) y una
 * clave entre comillas de un objeto de datos ajeno.
 *
 * NO se exige que la clave esté en el nivel superior, y es deliberado: el único
 * descriptor anidado del repo —`BANNER_SITE_SCOPE`, `channel_array_json` sobre
 * `rules.sales_channel_ids`— pone su eje ADENTRO de otra clave, así que exigir el nivel
 * superior daría rojo sobre la única forma que ya está bien. El costo es que un
 * `metadata: { site_id: … }` contaría como eje; hoy no existe ninguno, y si aparece, el
 * error es escribir un eje en `metadata`, no el regex.
 */
const claveEnArgumento = (arg: string, columna: string): boolean =>
  new RegExp(`(^|[^\\w.'"])${columna}\\s*:`).test(arg);

type Creacion = {
  archivo: string;
  linea: number;
  llamada: string;
  tabla: string;
  kinds: string[];
  columnas: string[];
  fks: string[];
  /** Columnas del eje presentes como clave en el argumento. */
  puestas: string[];
  /** FKs del eje presentes como clave (sólo relevante en `via_parent`). */
  fksPuestas: string[];
  /** Identificadores que el argumento pasa entero: `create(x)` o `{ ...x }`. */
  passthrough: string[];
  /** Columnas del eje que un destructuring le SACÓ a ese identificador. */
  arrancadas: string[];
};

function relevar(): { creaciones: Creacion[]; noResueltas: Map<string, number> } {
  const modelos = modelosPorNombre();
  const porTabla = descriptoresPorTabla();
  const porPlural = new Map<string, string>();
  for (const nombre of modelos.keys()) porPlural.set(pluralizar(nombre), nombre);

  const creaciones: Creacion[] = [];
  const noResueltas = new Map<string, number>();

  for (const archivo of archivosDeWorkflows()) {
    const source = sinComentarios(readFileSync(archivo, 'utf8'));
    // La convención del `MedusaService`: `create` + el modelo en plural + `(`. El
    // paréntesis es obligatorio —mención no es invocación— y el plural exigido excluye
    // `createStep`, `createWorkflow` y `createAuditEntry` sin listas negras.
    for (const m of source.matchAll(/\bcreate([A-Z][A-Za-z0-9]*s)\s*\(/g)) {
      const llamada = `create${m[1]!}`;
      const modelo = porPlural.get(m[1]!);
      if (!modelo) {
        noResueltas.set(llamada, (noResueltas.get(llamada) ?? 0) + 1);
        continue;
      }
      const tabla = modelos.get(modelo)!;
      const descriptores = porTabla.get(tabla);
      if (!descriptores) continue; // Tabla sin eje declarado: no hay nada que exigir.

      const arg = argumentoDesde(source, m.index + m[0]!.length);
      const columnas = [
        ...new Set(
          descriptores.flatMap((d) => [d.column, ...(d.path ?? [])].filter(Boolean) as string[]),
        ),
      ];
      const fks = [...new Set(descriptores.map((d) => d.fk).filter(Boolean) as string[])];

      // Pass-through: el argumento entero es un identificador (`createBrands(input as any)`)
      // o esparce uno (`{ ...input, … }`). El eje puede venir adentro y no se ve.
      const passthrough: string[] = [];
      const suelto = /^\s*([A-Za-z_$][\w$]*)\s*(?:as\s+[\w<>[\]|., ]+)?\s*$/.exec(arg);
      if (suelto) passthrough.push(suelto[1]!);
      for (const s of arg.matchAll(/\.\.\.\s*([A-Za-z_$][\w$]*)/g)) passthrough.push(s[1]!);

      // …salvo que un destructuring le haya SACADO el eje antes de pasarlo. Es el caso de
      // `create-pdf-catalog`, y es la diferencia entre "el eje puede venir adentro" y "el
      // eje se quitó explícitamente": lo segundo se ve, y por lo tanto se mide.
      const arrancadas: string[] = [];
      for (const id of passthrough) {
        for (const d of source.matchAll(/const\s*\{([^{}]*)\}\s*=\s*[^;]*?;/g)) {
          const claves = d[1]!;
          if (!new RegExp(`\\.\\.\\.\\s*${id}\\b`).test(claves)) continue;
          for (const c of columnas) {
            if (new RegExp(`(^|[^\\w.])${c}\\s*[,}]`).test(`${claves}}`)) arrancadas.push(c);
          }
        }
      }

      creaciones.push({
        archivo: archivo.slice(WORKFLOWS_DIR.length + 1),
        linea: source.slice(0, m.index).split('\n').length,
        llamada,
        tabla,
        kinds: [...new Set(descriptores.map((d) => d.kind))],
        columnas,
        fks,
        puestas: columnas.filter((c) => claveEnArgumento(arg, c)),
        fksPuestas: fks.filter((c) => claveEnArgumento(arg, c)),
        passthrough,
        arrancadas,
      });
    }
  }
  return { creaciones, noResueltas };
}

/** Una creación hereda su eje del padre: la FK ES el eje y `siteDefaults` devuelve `{}`. */
const esViaParent = (c: Creacion): boolean => c.kinds.every((k) => k === 'via_parent');

/**
 * ¿El eje está puesto?
 *
 * Las tres formas de que sí, en orden de fuerza:
 *   1. la columna del descriptor aparece como clave del objeto que se crea;
 *   2. el objeto se pasa entero desde el input y nadie le sacó el eje;
 *   3. el descriptor es `via_parent`, donde la columna no existe.
 */
const tieneEje = (c: Creacion): boolean =>
  esViaParent(c) || c.puestas.length > 0 || (c.passthrough.length > 0 && c.arrancadas.length === 0);

const { creaciones, noResueltas } = relevar();

const sinEje = creaciones.filter((c) => !tieneEje(c) && !(c.archivo in EXENTAS));

const detalle = sinEje
  .map(
    (c) =>
      `  ${c.archivo}:${c.linea}  ${c.llamada} → \`${c.tabla}\` [${c.kinds.join(', ')}]\n` +
      `      el objeto que se crea no lleva ${c.columnas.map((x) => `\`${x}\``).join(' ni ')}` +
      (c.arrancadas.length
        ? `, y un destructuring se lo sacó antes de pasarlo (${c.arrancadas.join(', ')}).`
        : '.'),
  )
  .join('\n');

test('el walk encuentra creaciones (guard contra falso verde por vacío)', () => {
  // Sin esto, romper el walk —un `readdirSync` que tira, un regex que deja de matchear,
  // un `site-scope.ts` que cambia de forma— pondría TODO lo de abajo en verde con cero
  // creaciones auditadas: un ratchet que afirma que no hay deuda porque no miró. Misma
  // lección y mismo guard que `admin-site-scope.test.ts` y sus dos hermanos.
  //
  // Los tres pisos son independientes a propósito: uno mide el walk de workflows, otro
  // el mapa de modelos y el tercero el parseo de descriptores. Si se cae uno solo, el
  // mensaje dice cuál.
  assert.ok(
    modelosPorNombre().size >= 95,
    `sólo ${modelosPorNombre().size} modelos resueltos: el parseo de \`model.define\` se rompió`,
  );
  assert.ok(
    descriptoresPorTabla().size >= 30,
    `sólo ${descriptoresPorTabla().size} tablas con descriptor: el parseo de \`site-scope.ts\` se rompió`,
  );
  assert.ok(
    creaciones.length >= 15,
    `sólo ${creaciones.length} creaciones sobre tablas con eje: el walk de \`src/workflows/**\` se rompió`,
  );
});

test('el criterio es más ancho que "archivos `create-*.ts`"', () => {
  /**
   * El test que mide MI PROPIO criterio, calcado del "la medición INGENUA daría todo
   * verde" de `admin-child-ownership-scope.test.ts`.
   *
   * El reflejo obvio para auditar creaciones es abrir los `create-*.ts`. Ese criterio es
   * el error nº1 de la cabecera con otra cara, y acá está MEDIDO en vez de opinado: la
   * versión angosta deja afuera los `create*` que viven dentro de workflows con otro
   * nombre y las COMPENSACIONES de los `delete-*`, que es donde este ratchet ya encontró
   * deuda real.
   *
   * Si alguien "simplifica" el walk a mirar sólo `create-*.ts`, esto se cae y explica por
   * qué, en vez de bajar el contador en silencio.
   */
  const angosta = creaciones.filter((c) => /(^|\/)create-[^/]*\.ts$/.test(c.archivo));
  assert.ok(
    creaciones.length > angosta.length,
    `La población ancha (${creaciones.length}) tiene que ser estrictamente mayor que la\n` +
      `angosta de "sólo archivos \`create-*.ts\`" (${angosta.length}). Si son iguales, el walk\n` +
      `dejó de mirar \`steps/\`, los \`delete-*\` o los workflows con otro nombre.`,
  );
  // Y las que la angosta NO ve tienen que incluir al menos una creación fuera de un
  // `create-*.ts`: es la clase entera que el criterio existe para no perder.
  const invisibles = creaciones.filter((c) => !/(^|\/)create-[^/]*\.ts$/.test(c.archivo));
  assert.ok(
    invisibles.length >= 4,
    `Sólo ${invisibles.length} creaciones fuera de un \`create-*.ts\`. ` +
      `El criterio ancho dejó de cubrir workflows con otro nombre o compensaciones.`,
  );
});

test('toda creación no resuelta está declarada ajena, con razón', () => {
  /**
   * El candado contra el agujero SILENCIOSO de este diseño.
   *
   * La población se arma resolviendo el plural del método contra los modelos del repo.
   * Un modelo cuyo plural el helper no acierte —o un módulo nuevo que declare sus modelos
   * de otra forma— desaparecería de la población sin dejar rastro, y el contador seguiría
   * en verde midiendo menos. Con esto, cualquier `create<X>s(` que no resuelva obliga a
   * escribir por qué.
   */
  const huerfanas = [...noResueltas.keys()].filter((n) => !(n in CREACIONES_AJENAS)).sort();
  assert.deepEqual(
    huerfanas,
    [],
    `Estas llamadas \`create…s(\` de \`src/workflows/**\` no resuelven a ningún modelo del repo:\n` +
      `  ${huerfanas.join('\n  ')}\n\n` +
      `O son de un módulo del core —declaralas en \`CREACIONES_AJENAS\` con su razón— o el mapa\n` +
      `modelo→tabla se rompió y hay creaciones cayéndose de la auditoría sin que nadie lo vea.`,
  );
});

test('la deuda no sube: creaciones sin eje <= MAX_SIN_EJE', () => {
  assert.ok(
    sinEje.length <= MAX_SIN_EJE,
    `Hay ${sinEje.length} creaciones en \`src/workflows/**\` sobre tablas CON descriptor de tienda\n` +
      `que no ponen el eje, y el tope es ${MAX_SIN_EJE}.\n\n${detalle}\n\n` +
      `La fila va a nacer sin eje. Con \`empty: 'all'\` eso NO la deja huérfana: la publica en\n` +
      `TODAS las tiendas, sin error y sin que el listado del creador lo delate —una tienda ve\n` +
      `los globales—. Es exactamente lo que hizo \`create-banner.ts\` durante cuatro auditorías.\n\n` +
      `El arreglo es enumerar la columna en el objeto que se crea:\n` +
      `  site_id: input.site_id ?? null,          // \`site_column\`\n` +
      `  sales_channel_id: input.sales_channel_id ?? null,   // \`channel_column\`\n` +
      `  sales_channel_ids: input.sales_channel_ids ?? null, // \`channel_array\`\n` +
      `y que el call site la llene con \`siteDefaults(resolution, <DESCRIPTOR>)\`, que es el\n` +
      `ÚNICO lugar donde está escrito que \`allSites\`, \`singleSite\` y \`registryAbsent\` NO\n` +
      `estampan nada. Tiparla en el input NO alcanza si el paso arma el objeto campo por\n` +
      `campo: se descarta en silencio.\n\n` +
      `Y si es una COMPENSACIÓN que re-crea una fila borrada, copiá el eje del snapshot que\n` +
      `ya tenés leído. Restaurar sin eje convierte una fila de una tienda en global.`,
  );
});

/**
 * El techo dice EXACTAMENTE cuántas hay, no "a lo sumo".
 *
 * Es la convención del repo —`MAX_SIN_GUARD`, `MAX_SIN_PERTENENCIA`, `MAX_GHOST_KEYS`,
 * `MAX_UNSCOPED_TRANSPORT` tienen todos su par de igualdad— y el motivo es el mismo: con
 * sólo `<=`, cerrar la deuda deja un techo viejo que vuelve a autorizar una creación
 * nueva sin que nadie lo note, y el contador pasa a medir el pasado. Con la igualdad,
 * cerrar OBLIGA a bajar el número en el mismo commit, y el diff del test es el registro.
 */
test('el techo dice el número REAL: creaciones sin eje === MAX_SIN_EJE', () => {
  assert.equal(
    sinEje.length,
    MAX_SIN_EJE,
    `El tope dice ${MAX_SIN_EJE} pero hay ${sinEje.length}.\n\n${detalle}\n\n` +
      `Si cerraste alguna —gracias—, bajá \`MAX_SIN_EJE\` a ${sinEje.length}.`,
  );
});

test('toda exención explica POR QUÉ el eje no va', () => {
  // Una exención sin razón es un `// TODO` con permiso de producción. Con la razón
  // escrita, la próxima auditoría la discute en vez de volver a investigarla desde cero —
  // que es el trabajo que este archivo existe para no repetir.
  const mudas = Object.entries(EXENTAS)
    .filter(([, razon]) => razon.trim().length < 120)
    .map(([archivo]) => archivo);
  assert.deepEqual(mudas, [], `Exenciones sin razón suficiente:\n  ${mudas.join('\n  ')}`);
  const ajenasMudas = Object.entries(CREACIONES_AJENAS)
    .filter(([, razon]) => razon.trim().length < 30)
    .map(([nombre]) => nombre);
  assert.deepEqual(ajenasMudas, [], `Creaciones ajenas sin razón:\n  ${ajenasMudas.join('\n  ')}`);
});

test('no quedan exenciones huérfanas', () => {
  // Una exención que sobrevive a su llamada —renombrada, borrada, o cerrada con el eje
  // puesto— es una autorización viva sin nada que autorizar. La próxima creación que
  // caiga en ese archivo la hereda gratis, que es exactamente cómo un permiso puntual se
  // convierte en una regla que nadie decidió.
  const huerfanas = Object.keys(EXENTAS).filter((archivo) => {
    const suyas = creaciones.filter((c) => c.archivo === archivo);
    return suyas.length === 0 || suyas.every((c) => tieneEje(c));
  });
  assert.deepEqual(
    huerfanas,
    [],
    `Estas exenciones ya no corresponden —la creación no existe, o ya pone el eje—:\n` +
      `  ${huerfanas.join('\n  ')}`,
  );
});

test('las creaciones `via_parent` llevan su FK: el eje es la FK', () => {
  /**
   * La mitad que le falta a "absolver `via_parent` por construcción".
   *
   * `siteDefaults` devuelve `{}` para `via_parent` a propósito —inventar un eje ahí
   * escribiría uno que contradiría a su propio padre—, así que exigirle una columna
   * sería exigirle una que no existe. Pero eso no lo deja sin nada que cumplir: la FK ES
   * el eje, y una fila creada sin ella queda colgando de nadie. Con `empty: 'unassigned'`
   * desaparece de todos los listados; con `empty: 'all'` aparece en todos.
   *
   * Hoy son 10 de 10 y por eso se puede exigir en vez de contar. El pass-through queda
   * fuera del universo porque ahí la FK puede venir adentro y no se ve.
   */
  const universo = creaciones.filter((c) => esViaParent(c) && c.passthrough.length === 0);
  assert.ok(universo.length >= 8, `sólo ${universo.length} creaciones \`via_parent\`: el walk cambió`);
  const sinFk = universo
    .filter((c) => c.fksPuestas.length === 0)
    .map((c) => `${c.archivo}:${c.linea} ${c.llamada} → falta \`${c.fks.join(' | ')}\``);
  assert.deepEqual(
    sinFk,
    [],
    `Estas creaciones heredan la tienda de su padre y no le ponen la FK:\n  ${sinFk.join('\n  ')}\n` +
      `Sin la FK la fila no cuelga de nadie: invisible o global, según el \`empty\` del descriptor.`,
  );
});

// ── Los negativos: que el criterio se ponga rojo cuando tiene que ─────────────────────
//
// Se prueban sobre fuentes sintéticas y no sobre el repo a propósito: son propiedades del
// CRITERIO, y tienen que valer aunque hoy ninguna creación intente hacer trampa. Sin
// esto, "el ratchet está en verde" no significaría nada: podría estar en verde porque no
// mira. Es la misma lección de `admin-child-ownership-scope.test.ts`.

/** El clasificador aislado, para poder probarlo con fuentes de mentira. */
function clasificarSonda(source: string, columnas: string[]): boolean {
  const limpio = sinComentarios(source);
  const m = /\bcreate([A-Z][A-Za-z0-9]*s)\s*\(/.exec(limpio);
  if (!m) return false;
  const arg = argumentoDesde(limpio, m.index + m[0].length);
  const passthrough: string[] = [];
  const suelto = /^\s*([A-Za-z_$][\w$]*)\s*(?:as\s+[\w<>[\]|., ]+)?\s*$/.exec(arg);
  if (suelto) passthrough.push(suelto[1]!);
  for (const s of arg.matchAll(/\.\.\.\s*([A-Za-z_$][\w$]*)/g)) passthrough.push(s[1]!);
  const arrancadas: string[] = [];
  for (const id of passthrough) {
    for (const d of limpio.matchAll(/const\s*\{([^{}]*)\}\s*=\s*[^;]*?;/g)) {
      const claves = d[1]!;
      if (!new RegExp(`\\.\\.\\.\\s*${id}\\b`).test(claves)) continue;
      for (const c of columnas) {
        if (new RegExp(`(^|[^\\w.])${c}\\s*[,}]`).test(`${claves}}`)) arrancadas.push(c);
      }
    }
  }
  const puestas = columnas.filter((c) => claveEnArgumento(arg, c));
  return puestas.length > 0 || (passthrough.length > 0 && arrancadas.length === 0);
}

test('la sonda sin eje da ROJO y con el eje puesto da VERDE', () => {
  // Copia exacta de la forma real: un step que arma el objeto campo por campo sobre una
  // tabla con `site_column`. Es la forma de `create-corporate.ts` y de la compensación de
  // `steps/delete-ga4-mapping.ts`, o sea el 100% de la deuda medida.
  const sinEjeSonda = `
    const paso = createStep('crear-cosa', async (input, { container }) => {
      const service = container.resolve(COSA_MODULE);
      const cosa = await service.createCosas({
        name: input.name,
        status: 'draft',
        metadata: input.metadata ?? null,
      });
      return new StepResponse(cosa, cosa.id);
    });
  `;
  assert.equal(clasificarSonda(sinEjeSonda, ['site_id']), false);

  const conEje = sinEjeSonda.replace("status: 'draft',", "status: 'draft',\n        site_id: input.site_id ?? null,");
  assert.equal(clasificarSonda(conEje, ['site_id']), true);
});

test('MENCIONAR el eje en un comentario NO cuenta como ponerlo', () => {
  // El error nº3 de la cabecera, probado en vez de prometido. `admin-id-mutation-scope`
  // ya se cayó por esto: las rutas que EXPLICABAN por qué el guard no aplicaba quedaban
  // absueltas por el texto de la explicación.
  const conComentario = `
    const cosa = await service.createCosas({
      name: input.name,
      // site_id: no va acá, lo pone el caller
      /* site_id se hereda del padre */
      status: 'draft',
    });
  `;
  assert.equal(clasificarSonda(conComentario, ['site_id']), false);
});

test('un acceso a propiedad NO es una clave: `previous.site_id` no pone nada', () => {
  // El falso verde barato: leer el eje de otra fila y no escribirlo. Es literalmente la
  // silueta de la compensación rota —tiene `previous` cargado y no lo usa para el eje—,
  // así que si el criterio lo aceptara, la única deuda medida sería invisible.
  const solaLectura = `
    const cosa = await service.createCosas({
      name: previous.site_id ? previous.name : 'x',
      status: previous.status,
    });
  `;
  assert.equal(clasificarSonda(solaLectura, ['site_id']), false);
});

test('el pass-through cuenta, salvo que un destructuring saque el eje', () => {
  // Las dos mitades de la regla que separa `create-shop-by-look` de `create-pdf-catalog`,
  // que en la superficie son idénticas —`createXs(resto as any)` sobre un rest—: la
  // diferencia es si el eje viajó adentro o si se lo sacaron a mano.
  const pasaTodo = `
    const { products, ...lookData } = input;
    const look = await service.createLooks(lookData as any);
  `;
  assert.equal(clasificarSonda(pasaTodo, ['sales_channel_ids']), true);

  const saleElEje = `
    const { hotspots, sales_channel_ids, ...catalogData } = input;
    const catalog = await service.createCatalogs(catalogData as any);
  `;
  assert.equal(clasificarSonda(saleElEje, ['sales_channel_ids']), false);

  const spread = `const cosa = await service.createCosas({ ...input, param: input.param as any });`;
  assert.equal(clasificarSonda(spread, ['site_id']), true);
});

test('el punto ciego declarado: el criterio ve la CLAVE, no el VALOR', () => {
  /**
   * La confesión (a) de la cabecera, EJECUTABLE en vez de prosa.
   *
   * Este test pasa afirmando que el criterio da por bueno un objeto que lleva la clave
   * del eje con un valor que lo pierde. No es un bug a arreglar acá: distinguirlo pide
   * saber qué produce ese valor, o sea evaluar el programa. Está escrito para que el
   * día que alguien lea "el ratchet de workflows está en verde" sepa exactamente qué
   * clase de rojo ese verde no puede dar — y para que si mañana el criterio se endurece,
   * este test se caiga y obligue a actualizar la confesión de arriba en vez de dejarla
   * mintiendo.
   *
   * Lo que sí cubre este caso es `banner-site-scope.test.ts`, que prueba el estampado y
   * la fusión (`mergeRulesPreservingScope`) directamente.
   */
  const pierdeElEje = `
    const banner = await service.createBanners({
      internal_name: input.internal_name,
      rules: { locales: input.locales },
    });
  `;
  assert.equal(
    clasificarSonda(pierdeElEje, ['rules', 'sales_channel_ids']),
    true,
    'Si esto pasó a `false`, el criterio ahora mira el valor: actualizá la confesión (a) de la cabecera.',
  );
});
