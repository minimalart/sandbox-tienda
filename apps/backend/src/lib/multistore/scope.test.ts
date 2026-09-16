import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  siteFilter,
  siteChannelFilter,
  siteColumnFilter,
  siteIdSubselect,
  siteDefaults,
  assertRowInSite,
  assertIdInSite,
  pickBySitePrecedence,
  type SiteScopeDescriptor,
  type SiteInheritance,
} from './scope';
import type { SiteResolution, SiteRef } from './types';

const NORTE: SiteRef = {
  id: 'demo_norte', slug: 'norte', name: 'Norte', is_main: false,
  channel_ids: ['sc_norte', 'sc_norte_b2b'], region_id: null, stock_location_id: null,
};

const SITE: SiteResolution = { status: 'site', site: NORTE };
const ALL: SiteResolution = { status: 'allSites' };
const SINGLE: SiteResolution = { status: 'singleSite', site: NORTE };
const ABSENT: SiteResolution = { status: 'registryAbsent', reason: 'module' };
const UNKNOWN: SiteResolution = { status: 'unknownSite', hint: { siteId: 'demo_x' } };

/** Captura el SQL que produce el helper, sin base de datos. */
function fakeScope(rows: Array<{ id: string }> = []) {
  const calls: Array<{ sql: string; bindings: unknown[] }> = [];
  const scope = {
    resolve: () => ({
      raw: async (sql: string, bindings: unknown[] = []) => {
        calls.push({ sql, bindings });
        return { rows };
      },
    }),
  } as any;
  return { scope, calls };
}

const ARRAY_ALL: SiteScopeDescriptor = { kind: 'channel_array', table: 'brand', column: 'sales_channel_ids', empty: 'all' };
const ARRAY_UNASSIGNED: SiteScopeDescriptor = { kind: 'channel_array', table: 'brand', column: 'sales_channel_ids', empty: 'unassigned' };
const COLUMN_GLOBAL: SiteScopeDescriptor = { kind: 'channel_column', table: 'recurring_setting', column: 'sales_channel_id', empty: 'global' };
const COLUMN_UNASSIGNED: SiteScopeDescriptor = { kind: 'channel_column', table: 'abandoned_cart', column: 'sales_channel_id', empty: 'unassigned' };
const NESTED: SiteScopeDescriptor = { kind: 'channel_array_json', table: 'banner', column: 'rules', path: ['sales_channel_ids'], empty: 'all' };
const JOIN: SiteScopeDescriptor = { kind: 'join_table', table: 'pdf_catalog', joinTable: 'pdf_catalog_channel', fk: 'catalog_id', column: 'sales_channel_id', empty: 'unassigned' };

test('sin tienda elegida no filtra: devuelve {} y no toca la DB', async () => {
  for (const resolution of [ALL, SINGLE, ABSENT]) {
    const { scope, calls } = fakeScope();
    assert.deepEqual(await siteFilter(scope, resolution, ARRAY_ALL), {});
    assert.equal(calls.length, 0, `${resolution.status} no debería consultar`);
  }
});

test('unknownSite ROMPE, no degrada a "todas"', async () => {
  // Degradar acá es cómo un id stale muestra todas las tiendas mientras el operador
  // cree que ve una sola — y una escritura desde esa pantalla pega en otra tienda.
  const { scope } = fakeScope();
  await assert.rejects(() => siteFilter(scope, UNKNOWN, ARRAY_ALL), /MULTISTORE_UNKNOWN_SITE/);
  assert.throws(() => siteDefaults(UNKNOWN, ARRAY_ALL), /MULTISTORE_UNKNOWN_SITE/);
  assert.throws(() => assertRowInSite({}, UNKNOWN, ARRAY_ALL), /MULTISTORE_UNKNOWN_SITE/);
});

test("`empty:'all'` y `empty:'unassigned'` NO producen el mismo predicado", async () => {
  // Este test existe para que nadie los "simplifique" en un booleano dentro de seis
  // meses. Con 'all', NULL/[] es visible en todas las tiendas; con 'unassigned', NULL
  // es huérfano y no lo ve nadie. Colapsarlos es fail-open.
  const a = fakeScope();
  await siteFilter(a.scope, SITE, ARRAY_ALL);
  const u = fakeScope();
  await siteFilter(u.scope, SITE, ARRAY_UNASSIGNED);

  // Sobre la COLUMNA DE CANAL, no sobre cualquier `IS NULL`: el predicado siempre
  // trae `"deleted_at" IS NULL`, así que una aserción laxa acá daría falso rojo.
  const emptyBranch = /"sales_channel_ids" IS NULL/;
  assert.match(a.calls[0]!.sql, emptyBranch, "'all' tiene que incluir las filas sin canal");
  assert.doesNotMatch(u.calls[0]!.sql, emptyBranch, "'unassigned' NO puede incluirlas");
  assert.notEqual(a.calls[0]!.sql, u.calls[0]!.sql);
});

test('channel_array cubre el caso [] además de NULL', async () => {
  // El caso que `$contains` de MikroORM no sabe expresar, y por el que este helper
  // usa subselect: `[]` es semánticamente lo mismo que NULL en este repo.
  const { scope, calls } = fakeScope();
  await siteFilter(scope, SITE, ARRAY_ALL);
  assert.match(calls[0]!.sql, /jsonb_array_length/);
  assert.match(calls[0]!.sql, /@> \?::jsonb/, 'el bind tiene que ir casteado a jsonb');
});

test('una fila atada a UN SOLO canal de la tienda entra igual', async () => {
  // La regresión de las sucursales de Vital. El predicado era un `@>` único con el
  // array entero —`["sc_b2c"] @> ["sc_b2c","sc_b2b"]` es FALSO—, así que una tienda
  // B2B sólo veía lo atado a sus DOS canales a la vez: 20 sucursales sin filtro, 0
  // filtrando por la tienda. Un OR de contenciones de UN elemento es "alguno".
  for (const descriptor of [ARRAY_ALL, NESTED]) {
    const { scope, calls } = fakeScope();
    await siteFilter(scope, SITE, descriptor);
    const { sql, bindings } = calls[0]!;

    // Un `@>` ÚNICO es la forma vieja y exige AMBOS canales; tiene que haber uno por
    // canal, unidos por OR.
    assert.equal(
      (sql.match(/@> \?::jsonb/g) ?? []).length,
      2,
      'una contención por canal de la tienda',
    );
    assert.match(sql, /@> \?::jsonb OR .* @> \?::jsonb/);
    assert.deepEqual(
      bindings,
      [JSON.stringify(['sc_norte']), JSON.stringify(['sc_norte_b2b'])],
      'cada bind es un array de UN elemento, no el array entero',
    );
  }
});

test('una tienda SIN canales no matchea nada (no la tabla entera)', async () => {
  // `@> '[]'::jsonb` es verdadero para CUALQUIER array, así que el predicado viejo
  // abría la tabla completa justo en el modo que existe para cerrarla.
  const sinCanales: SiteResolution = { status: 'site', site: { ...NORTE, channel_ids: [] } };
  for (const descriptor of [ARRAY_ALL, ARRAY_UNASSIGNED, NESTED]) {
    const { scope, calls } = fakeScope();
    await siteFilter(scope, sinCanales, descriptor);
    assert.doesNotMatch(calls[0]!.sql, /@>/, 'sin canales no hay contención que evaluar');
    assert.match(calls[0]!.sql, /FALSE/);
    assert.deepEqual(calls[0]!.bindings, []);
  }
});

test('filtra por LOS DOS canales de una tienda B2B', async () => {
  // Ninguno de los dos canales puede quedar afuera del predicado. Cada forma física
  // los lleva a su manera —el array jsonb, un bind por canal; la columna, un `ANY`
  // con los dos— así que se compara contra el binding aplanado.
  for (const [descriptor, expected] of [
    [ARRAY_ALL, [JSON.stringify(['sc_norte']), JSON.stringify(['sc_norte_b2b'])]],
    [COLUMN_GLOBAL, [['sc_norte', 'sc_norte_b2b']]],
  ] as const) {
    const { scope, calls } = fakeScope();
    await siteFilter(scope, SITE, descriptor as SiteScopeDescriptor);
    assert.deepEqual(calls[0]!.bindings, expected);
  }
});

test('cada forma física produce su propio SQL', async () => {
  const seen = new Set<string>();
  for (const d of [ARRAY_ALL, NESTED, COLUMN_GLOBAL, JOIN]) {
    const { scope, calls } = fakeScope();
    await siteFilter(scope, SITE, d);
    seen.add(calls[0]!.sql);
  }
  assert.equal(seen.size, 4, 'las 4 formas no pueden compartir predicado');
});

test('el predicado siempre excluye filas borradas', async () => {
  for (const d of [ARRAY_ALL, NESTED, COLUMN_GLOBAL, JOIN]) {
    const { scope, calls } = fakeScope();
    await siteFilter(scope, SITE, d);
    assert.match(calls[0]!.sql, /deleted_at" IS NULL/, `${d.kind} no filtra soft-deletes`);
  }
});

test('siteFilter devuelve ids, no filas: reducir con rows[0] no compila', async () => {
  const { scope } = fakeScope([{ id: 'br_1' }, { id: 'br_2' }]);
  assert.deepEqual(await siteFilter(scope, SITE, ARRAY_ALL), { id: ['br_1', 'br_2'] });
});

test('siteFilter tira si el subselect excede el tope', async () => {
  const many = Array.from({ length: 5001 }, (_, i) => ({ id: `br_${i}` }));
  const { scope } = fakeScope(many);
  await assert.rejects(() => siteFilter(scope, SITE, ARRAY_ALL), /demasiado grande/);
});

test('siteDefaults: una fila nace con los canales de la tienda activa', () => {
  // Sin esto, el POST crea filas globales que el creador ve en todas las tiendas.
  assert.deepEqual(siteDefaults(SITE, ARRAY_ALL), { sales_channel_ids: ['sc_norte', 'sc_norte_b2b'] });
  assert.deepEqual(siteDefaults(SITE, COLUMN_GLOBAL), { sales_channel_id: 'sc_norte' });
  assert.deepEqual(siteDefaults(ALL, ARRAY_ALL), {}, 'sin tienda activa no impone canal');
});

test('assertRowInSite bloquea la escritura cruzada', () => {
  const mine = { sales_channel_ids: ['sc_norte'] };
  const theirs = { sales_channel_ids: ['sc_sur'] };
  const global = { sales_channel_ids: null };

  assert.doesNotThrow(() => assertRowInSite(mine, SITE, ARRAY_ALL));
  assert.throws(() => assertRowInSite(theirs, SITE, ARRAY_ALL), /No encontrado/);
  assert.doesNotThrow(() => assertRowInSite(global, SITE, ARRAY_ALL), "con 'all' la fila global es editable");
  assert.throws(() => assertRowInSite(global, SITE, ARRAY_UNASSIGNED), /No encontrado/);
  assert.throws(() => assertRowInSite(null, SITE, ARRAY_ALL), /No encontrado/);
  assert.doesNotThrow(() => assertRowInSite(theirs, ALL, ARRAY_ALL), 'sin tienda activa no hay guard');
});

test('assertRowInSite NO adivina en las formas que no puede leer de la fila', () => {
  // Adivinar acá significaría dejar pasar una escritura cruzada. El call site tiene
  // que chequear la join table con su propia consulta.
  assert.doesNotThrow(() => assertRowInSite({ id: 'x' }, SITE, JOIN));
});

test('pickBySitePrecedence: la fila de la tienda gana sobre la global', () => {
  // El fail-open que documenta el proyecto es reducir con rows[0] una lista que trae
  // la del canal Y la global: podés terminar con la global cuando existía la propia.
  const rows = [
    { sales_channel_id: null, valor: 'global' },
    { sales_channel_id: 'sc_norte', valor: 'norte' },
  ];
  assert.equal(pickBySitePrecedence(rows, SITE, COLUMN_GLOBAL as any)?.valor, 'norte');
  assert.equal(pickBySitePrecedence([rows[0]!], SITE, COLUMN_GLOBAL as any)?.valor, 'global');
  assert.equal(pickBySitePrecedence(rows, ALL, COLUMN_GLOBAL as any)?.valor, 'global');
});

test('pickBySitePrecedence encuentra la fila por el canal MAYORISTA', () => {
  const rows = [
    { sales_channel_id: null, valor: 'global' },
    { sales_channel_id: 'sc_norte_b2b', valor: 'norte-mayorista' },
  ];
  assert.equal(
    pickBySitePrecedence(rows, SITE, COLUMN_GLOBAL as any)?.valor,
    'norte-mayorista',
    'hoy runtime-config.ts cae al global acá, en silencio',
  );
});

test('COLUMN_UNASSIGNED no incluye las filas sin canal', async () => {
  const { scope, calls } = fakeScope();
  await siteFilter(scope, SITE, COLUMN_UNASSIGNED);
  assert.doesNotMatch(calls[0]!.sql, /IS NULL OR/);
});

test('assertRowInSite lee la forma ANIDADA (banner: rules.sales_channel_ids)', () => {
  const mine = { rules: { sales_channel_ids: ['sc_norte'] } };
  const theirs = { rules: { sales_channel_ids: ['sc_sur'] } };
  const noRules = { rules: null };
  const rulesSinCanales = { rules: { locale: 'es' } };

  assert.doesNotThrow(() => assertRowInSite(mine, SITE, NESTED));
  assert.throws(() => assertRowInSite(theirs, SITE, NESTED), /No encontrado/);
  // Sin reglas, o con reglas que no declaran canales, el banner es global.
  assert.doesNotThrow(() => assertRowInSite(noRules, SITE, NESTED));
  assert.doesNotThrow(() => assertRowInSite(rulesSinCanales, SITE, NESTED));
});

test('siteChannelFilter: el param explícito gana sobre la tienda activa', () => {
  assert.deepEqual(siteChannelFilter(SITE, 'sc_pedido'), { sales_channel_id: 'sc_pedido' });
});

test('siteChannelFilter arregla el bug B2B: filtra por LOS DOS canales', () => {
  // Estas rutas filtraban por un canal escalar, así que en una tienda B2B todo lo
  // que entró por el canal mayorista quedaba afuera del listado, sin error.
  assert.deepEqual(siteChannelFilter(SITE, undefined), {
    sales_channel_id: ['sc_norte', 'sc_norte_b2b'],
  });
});

test('siteChannelFilter no filtra sin tienda activa ni param', () => {
  for (const r of [ALL, SINGLE, ABSENT]) {
    assert.deepEqual(siteChannelFilter(r, undefined), {}, r.status);
  }
});

// ── site_column: la forma que filtra por la TIENDA y no por sus canales ──────────

const SITE_COLUMN: SiteScopeDescriptor = {
  kind: 'site_column', table: 'contact_submission', column: 'site_id', empty: 'all',
};

test('site_column bindea el ID DE LA TIENDA, no sus canales', async () => {
  // Es toda la diferencia con las otras cuatro formas. Si alguien "unifica" esto
  // pasándole `channels`, el filtro deja de matchear nada: ningún `site_id` es igual
  // a un `sc_...`, así que el listado se vacía en silencio.
  const { scope, calls } = fakeScope([{ id: 'cts_1' }]);
  await siteFilter(scope, SITE, SITE_COLUMN);
  assert.deepEqual(calls[0]!.bindings, ['demo_norte']);
  assert.match(calls[0]!.sql, /"site_id" = \?/);
  assert.doesNotMatch(calls[0]!.sql, /ANY/, 'no traduce a canales: la tienda ya es el eje');
});

test("site_column con empty:'all' incluye las filas sin asignar", async () => {
  // Los mensajes anteriores a la columna. Esconderlos sería perder consultas reales.
  const { scope, calls } = fakeScope([{ id: 'cts_1' }]);
  await siteFilter(scope, SITE, SITE_COLUMN);
  assert.match(calls[0]!.sql, /"site_id" IS NULL/);

  const strict = fakeScope([{ id: 'cts_1' }]);
  await siteFilter(strict.scope, SITE, { ...SITE_COLUMN, empty: 'unassigned' });
  assert.doesNotMatch(strict.calls[0]!.sql, /"site_id" IS NULL/);
});

test('site_column: una fila nace con la tienda activa', () => {
  assert.deepEqual(siteDefaults(SITE, SITE_COLUMN), { site_id: 'demo_norte' });
  // Sin tienda elegida devuelve `{}`, no `{ site_id: null }`. La diferencia importa:
  // el call site lo spreadea sobre el payload, y un `null` explícito PISARÍA un
  // site_id que la ruta ya haya resuelto por su cuenta (es el caso de la ruta store,
  // que lo saca de la publishable key y no del header).
  assert.deepEqual(siteDefaults(ALL, SITE_COLUMN), {});
});

test('site_column: assertRowInSite bloquea la escritura cruzada', () => {
  assert.throws(() => assertRowInSite({ site_id: 'demo_sur' }, SITE, SITE_COLUMN));
  assert.doesNotThrow(() => assertRowInSite({ site_id: 'demo_norte' }, SITE, SITE_COLUMN));
  // La fila sin asignar sigue el `empty` del descriptor, como las demás formas.
  assert.doesNotThrow(() => assertRowInSite({ site_id: null }, SITE, SITE_COLUMN));
  assert.throws(() => assertRowInSite({ site_id: null }, SITE, { ...SITE_COLUMN, empty: 'unassigned' }));
});

// ── siteColumnFilter: el mismo predicado SIN subselect ──────────────────────────

const SITE_COLUMN_NARROW = { ...SITE_COLUMN } as Extract<
  SiteScopeDescriptor,
  { kind: 'site_column' }
>;

test('siteColumnFilter filtra por la columna, sin tocar la DB', () => {
  // La diferencia con `siteFilter` no es de estilo: éste no hace I/O y por eso no
  // tiene el tope de SITE_SCOPE_MAX_IDS. Es lo que lo hace usable sobre `comment`,
  // que es la tabla de reseñas de un catálogo entero y pasa las 5000 filas.
  assert.deepEqual(siteColumnFilter(SITE, SITE_COLUMN_NARROW), {
    $or: [{ site_id: 'demo_norte' }, { site_id: null }],
  });
});

test('siteColumnFilter NO usa `{ site_id: [id, null] }`: el IN no matchea NULL', () => {
  // Este test es el que existe para que nadie "simplifique" el `$or` de vuelta al
  // array. La forma de array se emite como `site_id IN ('demo_norte', NULL)`, y en SQL
  // `x = NULL` no es verdadero sino NULL: la fila global desaparece justo cuando el
  // filtro corre, o sea cuando la key resolvió una tienda.
  //
  // Costó plata: con la serie de `minimum_purchase` cargada como global,
  // `/store/minimum-purchase` devolvía `null` y el carrito dejaba de exigir el mínimo.
  const filter = siteColumnFilter(SITE, SITE_COLUMN_NARROW);
  assert.ok(!Array.isArray((filter as { site_id?: unknown }).site_id));
  // Las dos ramas, explícitas: sin la del `null` la fila global se cae.
  const branches = (filter as { $or: Array<Record<string, unknown>> }).$or;
  assert.ok(branches.some((b) => b.site_id === null), 'falta la rama de la fila global');
  assert.ok(branches.some((b) => b.site_id === 'demo_norte'), 'falta la rama de la tienda');
});

test("siteColumnFilter respeta el `empty` del descriptor", () => {
  // `all` incluye la fila global; `unassigned` la deja afuera. Si esto se colapsara
  // en un solo predicado, una de las dos semánticas se rompe en silencio: con `all`
  // desaparecerían las reseñas anteriores a la columna, con `unassigned` se verían
  // filas huérfanas desde todas las tiendas.
  assert.deepEqual(siteColumnFilter(SITE, SITE_COLUMN_NARROW), {
    $or: [{ site_id: 'demo_norte' }, { site_id: null }],
  });
  // `unassigned` es la única rama que sale como escalar: sin fila global que incluir,
  // el `$or` de una sola rama sería ruido.
  assert.deepEqual(
    siteColumnFilter(SITE, { ...SITE_COLUMN_NARROW, empty: 'unassigned' }),
    { site_id: 'demo_norte' },
  );
});

test('siteColumnFilter no filtra sin tienda elegida', () => {
  // Mismo criterio que todo el resto del seam: `singleSite` NO filtra. Con una sola
  // tienda, la fila sin `site_id` no es "la de otra" — es la única que hay.
  for (const r of [ALL, SINGLE, ABSENT]) {
    assert.deepEqual(siteColumnFilter(r, SITE_COLUMN_NARROW), {}, r.status);
  }
});

test('siteColumnFilter tira con unknownSite, igual que siteFilter', () => {
  // Degradar a `{}` acá sería exactamente cómo un id stale termina mostrando todas
  // las tiendas. Los dos helpers tienen que romper por el mismo motivo.
  assert.throws(() => siteColumnFilter(UNKNOWN, SITE_COLUMN_NARROW));
});

// ── via_parent: la fila hereda la tienda de su padre ─────────────────────────────

const PROGRAM: SiteScopeDescriptor = {
  kind: 'site_column', table: 'loyalty_program', column: 'site_id', empty: 'all',
};
const REWARD: SiteScopeDescriptor = {
  kind: 'via_parent', table: 'loyalty_reward', fk: 'program_id', parent: PROGRAM, empty: 'unassigned',
};
const GRANT: SiteScopeDescriptor = {
  kind: 'via_parent', table: 'loyalty_reward_grant', fk: 'reward_id', parent: REWARD, empty: 'unassigned',
};

test('via_parent anida el subselect del padre', async () => {
  const { scope, calls } = fakeScope([{ id: 'loyrw_1' }]);
  await siteFilter(scope, SITE, REWARD);
  assert.match(calls[0]!.sql, /FROM "loyalty_reward"/);
  assert.match(calls[0]!.sql, /"program_id" IN \(SELECT "id" FROM "loyalty_program"/);
  // El bind sigue siendo el de la tienda: el hijo no aporta ninguno propio.
  assert.deepEqual(calls[0]!.bindings, ['demo_norte']);
});

test('via_parent encadena DOS saltos: grant → reward → program', async () => {
  // Es la razón por la que `parent` es un descriptor y no un par de strings. Sin
  // recursión habría que denormalizar site_id en cada tabla hija, y ahí cada
  // escritura que se lo olvide deja una fila contradiciendo a su propio padre.
  const { scope, calls } = fakeScope([{ id: 'loygr_1' }]);
  await siteFilter(scope, SITE, GRANT);
  const sql = calls[0]!.sql;
  assert.ok(
    sql.indexOf('loyalty_reward_grant') < sql.indexOf('loyalty_reward"') &&
      sql.indexOf('loyalty_reward"') < sql.indexOf('loyalty_program'),
    'los tres niveles tienen que anidar en orden',
  );
  assert.deepEqual(calls[0]!.bindings, ['demo_norte']);
});

test("via_parent con empty:'unassigned' NO deja pasar la fila huérfana", async () => {
  // Una fila sin padre no es "de todas": es de ninguna. Distinto del programa mismo,
  // donde NULL sí significa global.
  const { scope, calls } = fakeScope([{ id: 'x' }]);
  await siteFilter(scope, SITE, REWARD);
  assert.doesNotMatch(calls[0]!.sql, /"program_id" IS NULL/);

  const loose = fakeScope([{ id: 'x' }]);
  await siteFilter(loose.scope, SITE, { ...REWARD, empty: 'all' } as SiteScopeDescriptor);
  assert.match(loose.calls[0]!.sql, /"program_id" IS NULL/);
});

test('via_parent no inventa defaults ni valida la fila por su cuenta', () => {
  // La pertenencia la fija el padre. Escribir un eje acá crearía una fila que
  // contradice a su propio padre, y `assertRowInSite` no puede leerlo de la fila.
  assert.deepEqual(siteDefaults(SITE, REWARD), {});
  assert.doesNotThrow(() => assertRowInSite({ program_id: 'loypr_otro' }, SITE, REWARD));
});

test('via_parent con FK de ARRAY: alcanza con que UNO de los padres sea de la tienda', async () => {
  // Es el caso de `vehicle.store_location_ids`. Un vehículo compartido entre dos
  // sucursales de tiendas distintas se ve desde las dos — se compartió a propósito.
  const ARRAY_FK: SiteScopeDescriptor = {
    kind: 'via_parent', table: 'vehicle', fk: 'store_location_ids', fkIsArray: true,
    parent: { kind: 'channel_array', table: 'store_location', column: 'sales_channel_ids', empty: 'all' },
    empty: 'all',
  };
  const { scope, calls } = fakeScope([{ id: 'veh_1' }]);
  await siteFilter(scope, SITE, ARRAY_FK);
  assert.match(calls[0]!.sql, /jsonb_array_elements_text\("store_location_ids"\)/);
  // El array VACÍO cuenta como "sin sucursal", igual que NULL: un `IS NULL` solo
  // dejaría afuera a los vehículos con `[]`, que son el caso que más aparece.
  assert.match(calls[0]!.sql, /jsonb_array_length\("store_location_ids"\) = 0/);
});

// ── siteIdSubselect: el mismo predicado, para EMBEBER ───────────────────────────

test('siteIdSubselect emite EXACTAMENTE el predicado que consume siteFilter', async () => {
  // Es el test que hace que exponer el subselect valga la pena en vez de ser un
  // riesgo. Si las dos funciones pudieran driftear, un KPI en SQL y su listado
  // hermano darían números distintos para la misma tienda — y el operador tendría
  // dos pantallas que se contradicen sin ningún error.
  for (const d of [ARRAY_ALL, NESTED, COLUMN_GLOBAL, JOIN, REWARD, GRANT, SITE_COLUMN]) {
    const { scope, calls } = fakeScope([]);
    await siteFilter(scope, SITE, d);
    const embebido = siteIdSubselect(SITE, d);
    assert.equal(embebido?.sql, calls[0]!.sql, `${d.kind}: el SQL drifteó`);
    assert.deepEqual(embebido?.bindings, calls[0]!.bindings, `${d.kind}: los binds driftearon`);
  }
});

test('siteIdSubselect devuelve null cuando NO hay que filtrar, no un predicado vacío', () => {
  // El contrato es distinto al de `siteFilter`, y a propósito. Ahí `{}` se spreadea y
  // desaparece; en SQL no existe el predicado vacío que se concatena. `null` obliga al
  // call site a NO escribir la cláusula. Las alternativas son peores: un `SELECT id
  // FROM t` tautológico haría el trabajo de un WHERE que sobra, y un `''` produciría
  // `IN ()`, que ni siquiera parsea.
  for (const resolution of [ALL, SINGLE, ABSENT]) {
    assert.equal(siteIdSubselect(resolution, GRANT), null, resolution.status);
  }
});

test('siteIdSubselect NO hace I/O: por eso no tiene el tope de SITE_SCOPE_MAX_IDS', async () => {
  // La diferencia entera con `siteFilter`. Aquél tiene tope porque devuelve un objeto
  // para MikroORM y un objeto sólo puede llevar la lista ya traída; éste devuelve el
  // subselect y Postgres lo resuelve como semi-join, sin traer una fila a Node.
  const { scope, calls } = fakeScope(Array.from({ length: 9999 }, (_, i) => ({ id: `x_${i}` })));
  const sub = siteIdSubselect(SITE, GRANT);
  assert.equal(calls.length, 0, 'no puede consultar la base');
  assert.match(sub!.sql, /FROM "loyalty_reward_grant"/);
  // Y el contraste, para que el motivo quede escrito: el mismo descriptor por
  // `siteFilter` con esos mismos datos TIRA.
  await assert.rejects(() => siteFilter(scope, SITE, GRANT), /demasiado grande/);
});

test('siteIdSubselect tira con unknownSite, igual que los demás helpers', () => {
  // Degradar a `null` acá sería peor que en `siteFilter`: el call site no escribiría la
  // cláusula y el agregado contaría TODAS las tiendas creyendo que cuenta una.
  assert.throws(() => siteIdSubselect(UNKNOWN, GRANT), /MULTISTORE_UNKNOWN_SITE/);
});

test('assertIdInSite pregunta a la BASE, porque via_parent no se lee de la fila', async () => {
  // Es la mitad que cierra el agujero: filtrar el listado y dejar el detalle abierto
  // esconde la fila de la otra tienda pero deja editarla con sólo saber el id.
  const { scope, calls } = fakeScope([]); // la base no devuelve nada → no es de la tienda
  await assert.rejects(
    () => assertIdInSite(scope, SITE, REWARD, 'loyrw_de_otra_tienda'),
    /No encontrado/,
  );
  // Reusa el MISMO subselect del listado: detalle y listado no pueden discrepar.
  assert.match(calls[0]!.sql, /FROM "loyalty_reward"/);
  assert.equal(calls[0]!.bindings.at(-1), 'loyrw_de_otra_tienda');

  // Y el otro lado: si la fila SÍ es de la tienda, pasa. Sin esta mitad el test
  // quedaría verde con un guard que rechaza siempre.
  const propia = fakeScope([{ id: 'loyrw_1' }]);
  await assert.doesNotReject(() => assertIdInSite(propia.scope, SITE, REWARD, 'loyrw_1'));
});

test('assertIdInSite no consulta cuando no hay que filtrar', async () => {
  for (const resolution of [ALL, SINGLE, ABSENT]) {
    const { scope, calls } = fakeScope([]);
    await assertIdInSite(scope, resolution, REWARD, 'loyrw_1');
    assert.equal(calls.length, 0, `${resolution.status} no debería consultar`);
  }
});

/**
 * Los tres modos de herencia — P5 del plan multitienda.
 *
 * Hasta acá `pickBySitePrecedence` siempre caía a la fila global, y eso está bien
 * para una preferencia con default razonable. No está bien cuando heredar significa
 * que una tienda OPERA con algo de otra: un acuerdo comercial, un remitente, una
 * cuenta. Ahí el valor correcto es "no hay", no "el de la instancia".
 *
 * El default sigue siendo `inherit-global` a propósito: cambiarlo prendería
 * fail-closed en todas las extensiones de una, y "de golpe la tienda B se quedó sin
 * configuración" es peor que el problema que arregla. Se pide por call site.
 */

const PROPIA = { sales_channel_id: 'sc_norte', marca: 'propia' };
const HERMANO = { sales_channel_id: 'sc_norte_b2b', marca: 'hermano' };
const GLOBAL = { sales_channel_id: null, marca: 'global' };

const COLUMN = COLUMN_GLOBAL as Extract<SiteScopeDescriptor, { kind: 'channel_column' }>;
const pick = (rows: Record<string, unknown>[], r: SiteResolution, m?: SiteInheritance) =>
  pickBySitePrecedence(rows, r, COLUMN, m)?.marca;

test('con fila propia los tres modos dan lo mismo', () => {
  for (const modo of ['inherit-global', 'inherit-global-for-main', 'fail-closed'] as const) {
    assert.equal(pick([PROPIA, GLOBAL], SITE, modo), 'propia', modo);
  }
});

test('cualquier canal de la tienda cuenta como fila propia', () => {
  // El caso B2B: la config se guardó contra el canal mayorista.
  assert.equal(pick([HERMANO, GLOBAL], SITE, 'fail-closed'), 'hermano');
});

test('sin fila propia: inherit-global hereda, fail-closed no', () => {
  assert.equal(pick([GLOBAL], SITE, 'inherit-global'), 'global');
  assert.equal(pick([GLOBAL], SITE, 'fail-closed'), undefined);
});

test('inherit-global-for-main distingue principal de secundaria', () => {
  const PRINCIPAL: SiteResolution = { status: 'site', site: { ...NORTE, is_main: true } };
  assert.equal(pick([GLOBAL], PRINCIPAL, 'inherit-global-for-main'), 'global');
  assert.equal(
    pick([GLOBAL], SITE, 'inherit-global-for-main'),
    undefined,
    'una tienda secundaria heredó la global: opera con la configuración de otra',
  );
});

test('sin eje de tienda los tres modos caen a la global', () => {
  // No es una excepción: acá la global no es "la de otra tienda", es la única que
  // hay. Si `fail-closed` cortara, un proyecto mono-tienda que lo activara se
  // quedaría sin configuración por una decisión que no le aplica.
  for (const r of [ALL, ABSENT] as SiteResolution[]) {
    assert.equal(pick([GLOBAL], r, 'fail-closed'), 'global');
  }
});

test('el default no cambió: sin modo, hereda', () => {
  assert.equal(pick([GLOBAL], SITE), 'global');
});
