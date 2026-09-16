import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils';
import type { MedusaContainer } from '@medusajs/framework/types';
import { UNKNOWN_SITE_ERROR_CODE } from './types';
import type { SiteResolution } from './types';
import { resolveSite } from './resolve-site';
import { decideSiteIdWrite } from './site-write';

/**
 * El filtrado por tienda, escrito UNA vez.
 *
 * Hay 226 handlers GET en `src/api/admin/`; no puede haber 226 implementaciones del
 * mismo predicado. Este archivo existe para que una ruta lo consuma en dos líneas.
 *
 * Lo que hace falta entender antes de tocarlo: NO hay una sola forma de guardar el
 * canal. Hay CUATRO formas físicas, y encima el `NULL` significa tres cosas
 * distintas según para qué se guarda. Esa combinación es de donde sale el fail-open
 * que documenta `EXTENSIONES-MULTITIENDA.md`.
 */

// ── Formas físicas ───────────────────────────────────────────────────────────────
//
//  channel_array       jsonb top-level  → brand, blog_post, store_location,
//                                          vimeo_video, shop_by_look, payment_benefit
//  channel_array_json  jsonb anidado    → banner (los ids viven en rules.sales_channel_ids)
//  channel_column      text singular    → recurring_setting, landing_page,
//                                          abandoned_cart, checkout_link, seo_audit
//  join_table          tabla puente     → pdf_catalog_channel

/**
 * Qué significa que la columna esté vacía. NO es un booleano — son tres cosas:
 *
 *  'all'         data plural: `NULL`/`[]` = visible en TODAS las tiendas. Es la
 *                semántica de `sales_channel_ids` (ver `api/store/brands/route.ts`).
 *  'global'      config: la fila `NULL` es el FALLBACK, no un ítem más de la lista.
 *                Es la de `recurring_setting`. Al LISTAR se comporta como 'all';
 *                al RESOLVER un valor efectivo hay PRECEDENCIA, no unión.
 *  'unassigned'  data singular: `NULL` = huérfano, no es de nadie. Fail-closed.
 */
export type NullMeans = 'all' | 'global' | 'unassigned';

export type SiteScopeDescriptor =
  | { kind: 'channel_array'; table: string; column: string; empty: NullMeans }
  | { kind: 'channel_array_json'; table: string; column: string; path: string[]; empty: NullMeans }
  | { kind: 'channel_column'; table: string; column: string; empty: NullMeans }
  | { kind: 'join_table'; table: string; joinTable: string; fk: string; column: string; empty: NullMeans }
  /**
   * Columna de TIENDA propia (`site_id`), no de canal. Es la forma a la que deberían
   * converger los modelos: filtra por la tienda de verdad y no por "los canales que
   * esa tienda posee", que es una traducción con pérdida —un canal creado a mano no
   * pertenece a nadie, y una tienda con `source_type: 'sales_channel'` adopta uno que
   * puede estar compartido—.
   */
  | { kind: 'site_column'; table: string; column: string; empty: NullMeans }
  /**
   * La fila NO tiene eje propio: lo hereda de su padre por una FK.
   *
   * Es la alternativa a denormalizar `site_id` en cada tabla hija. Denormalizar
   * parece más simple hasta que una escritura se olvida de setearlo: la fila queda
   * huérfana —invisible para su tienda o visible para todas— y no hay forma de
   * detectarlo salvo mirando datos.
   *
   * `parent` es otro descriptor, así que encadena: un `reward_grant` llega a su
   * tienda por `reward` y de ahí por `loyalty_program`.
   */
  | {
      kind: 'via_parent';
      table: string;
      fk: string;
      parent: SiteScopeDescriptor;
      empty: NullMeans;
      /** `fk` es un jsonb array de ids del padre (ej. `vehicle.store_location_ids`). */
      fkIsArray?: boolean;
    };

/**
 * La variante `site_column`, con nombre propio.
 *
 * Existe porque `siteColumnFilter` sólo puede operar sobre ella, y anotar un
 * descriptor como `SiteScopeDescriptor` a secas hace que el compilador no lo deje
 * pasar aunque su `kind` sea el correcto. Tipar con esto los descriptores que ya
 * llevan columna de tienda es además la declaración que se quiere: la forma no es un
 * detalle interno, es la que decide qué helper aplica.
 */
export type SiteColumnScope = Extract<SiteScopeDescriptor, { kind: 'site_column' }>;

/**
 * Cota de seguridad del subselect de ids. Las tablas de contenido curado a mano
 * (marcas, banners, looks) tienen cientos de filas. El día que alguien aplique esto
 * a `delivery` con 200k, se entera con un error y no con un `IN` de 200k binds.
 */
export const SITE_SCOPE_MAX_IDS = 5000;

type PgLike = { raw: (sql: string, bindings?: unknown[]) => Promise<{ rows?: any[] }> };

const pgOf = (scope: MedusaContainer): PgLike =>
  scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as unknown as PgLike;

/** `unknownSite` rompe. Degradar acá es cómo un id stale muestra todas las tiendas. */
function assertResolved(resolution: SiteResolution): void {
  if (resolution.status === 'unknownSite') {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `${UNKNOWN_SITE_ERROR_CODE}: la tienda solicitada no existe o fue eliminada.`,
    );
  }
}

/**
 * ¿Hay que filtrar? Sólo con una tienda elegida de un registro con varias.
 *
 * `singleSite` y `registryAbsent` NO filtran: con una sola tienda no hay nada que
 * aislar, y filtrar igual escondería filas cuyo canal se creó a mano y no pertenece
 * a ninguna tienda.
 */
const channelsToFilterBy = (resolution: SiteResolution): string[] | null => {
  assertResolved(resolution);
  if (resolution.status !== 'site') return null;
  return resolution.site.channel_ids;
};

/**
 * "La fila sirve a ALGUNO de los canales de la tienda" — para las dos formas jsonb.
 *
 * Acá vivía el bug de las sucursales de Vital. El predicado era un `@>` único con el
 * array entero de canales, y `@>` es CONTENCIÓN: `["sc_b2c"] @> ["sc_b2c","sc_b2b"]`
 * es FALSO. O sea que una tienda con B2C y B2B sólo veía las filas atadas a los DOS
 * canales a la vez, y la que estaba en uno solo desaparecía del listado sin ningún
 * error. Medido: 20 sucursales sin filtro, 0 filtrando por Vital, 20 en la web pública
 * —que consulta el B2C—. Cuantos más canales tiene una tienda, MENOS ve, que es lo
 * contrario de lo que significa tener otro canal.
 *
 * Las otras tres formas físicas de este mismo archivo siempre quisieron decir
 * "alguno": `channel_column` y `join_table` emiten `= ANY(?)`, y la guarda en memoria
 * `assertRowInSite` usa `.some(...)` — igual que el storefront en
 * `api/store/store-locations/helpers.ts`, con `.includes(...)`. Eran tres a uno; esto
 * alinea al que faltaba, y de paso cierra la discrepancia entre listado y detalle:
 * una sucursal que el guard dejaba editar no aparecía en la lista de la que era.
 *
 * Se expande a un OR de `@>` de un elemento en vez de pasar a `?|` o a
 * `jsonb_array_elements_text`: `?` colisiona con el placeholder de binds, y la
 * función de conjunto REVIENTA si la columna no es un array (el `@>` sobre un jsonb
 * que no es array simplemente da falso). Además el OR de `@>` sigue usando el índice
 * GIN, si lo hay.
 *
 * Sin canales NO matchea nada. Es la otra mitad del arreglo: `@> '[]'::jsonb` es
 * verdadero para CUALQUIER array —todo array contiene al vacío—, así que una tienda
 * sin canales veía la tabla entera, incluso con `empty: 'unassigned'`, que es
 * exactamente lo que ese modo existe para impedir. Las ramas de `empty` siguen
 * decidiendo aparte si además se ven las filas sin canal.
 */
function anyChannelMatches(expr: string, channels: string[]): { sql: string; bindings: unknown[] } {
  if (channels.length === 0) return { sql: 'FALSE', bindings: [] };
  return {
    sql: `(${channels.map(() => `${expr} @> ?::jsonb`).join(' OR ')})`,
    bindings: channels.map((id) => JSON.stringify([id])),
  };
}

/** El SQL que decide qué ids pertenecen a la tienda, por forma física. */
function idSubselect(
  d: SiteScopeDescriptor,
  channels: string[],
  siteId: string,
): { sql: string; bindings: unknown[] } {
  const includesEmpty = d.empty === 'all' || d.empty === 'global';

  switch (d.kind) {
    case 'channel_array': {
      // `NULL` y `[]` son lo mismo semánticamente; el `jsonb_array_length` cubre el
      // segundo, que es el caso que `$contains` de MikroORM no sabe expresar.
      const empty = includesEmpty
        ? `"${d.column}" IS NULL OR jsonb_array_length("${d.column}") = 0 OR `
        : '';
      const match = anyChannelMatches(`"${d.column}"`, channels);
      return {
        sql: `SELECT "id" FROM "${d.table}"
                WHERE (${empty}${match.sql})
                  AND "deleted_at" IS NULL`,
        bindings: match.bindings,
      };
    }
    case 'channel_array_json': {
      const path = d.path.map((p) => `'${p}'`).join('->');
      const expr = `"${d.column}"->${path}`;
      const empty = includesEmpty
        ? `${expr} IS NULL OR jsonb_typeof(${expr}) <> 'array' OR jsonb_array_length(${expr}) = 0 OR `
        : '';
      const match = anyChannelMatches(expr, channels);
      return {
        sql: `SELECT "id" FROM "${d.table}"
                WHERE (${empty}${match.sql})
                  AND "deleted_at" IS NULL`,
        bindings: match.bindings,
      };
    }
    case 'channel_column': {
      const empty = includesEmpty ? `"${d.column}" IS NULL OR ` : '';
      return {
        sql: `SELECT "id" FROM "${d.table}"
                WHERE (${empty}"${d.column}" = ANY(?))
                  AND "deleted_at" IS NULL`,
        bindings: [channels],
      };
    }
    case 'site_column': {
      // Filtra por el ID de la tienda, no por sus canales: no hace falta traducir.
      const empty = includesEmpty ? `"${d.column}" IS NULL OR ` : '';
      return {
        sql: `SELECT "id" FROM "${d.table}"
                WHERE (${empty}"${d.column}" = ?)
                  AND "deleted_at" IS NULL`,
        bindings: [siteId],
      };
    }
    case 'via_parent': {
      const inner = idSubselect(d.parent, channels, siteId);
      // `empty` acá significa "la fila no apunta a ningún padre". Con `'all'` esas
      // filas se ven desde cualquier tienda; con `'unassigned'`, desde ninguna.
      const empty = d.fkIsArray
        ? includesEmpty
          ? `"${d.fk}" IS NULL OR jsonb_array_length("${d.fk}") = 0 OR `
          : ''
        : includesEmpty
          ? `"${d.fk}" IS NULL OR `
          : '';
      // Con FK de array basta con que UNO de los padres sea de la tienda: un vehículo
      // asignado a dos sucursales de tiendas distintas se ve desde las dos, que es lo
      // que el operador espera al haberlo compartido a propósito.
      const match = d.fkIsArray
        ? `EXISTS (SELECT 1 FROM jsonb_array_elements_text("${d.fk}") AS e(v)
                    WHERE e.v IN (${inner.sql}))`
        : `"${d.fk}" IN (${inner.sql})`;
      return {
        sql: `SELECT "id" FROM "${d.table}"
                WHERE (${empty}${match})
                  AND "deleted_at" IS NULL`,
        bindings: inner.bindings,
      };
    }
    case 'join_table': {
      const empty = includesEmpty
        ? `NOT EXISTS (SELECT 1 FROM "${d.joinTable}" x WHERE x."${d.fk}" = t."id" AND x."deleted_at" IS NULL) OR `
        : '';
      return {
        sql: `SELECT t."id" FROM "${d.table}" t
                WHERE (${empty}EXISTS (
                        SELECT 1 FROM "${d.joinTable}" j
                         WHERE j."${d.fk}" = t."id"
                           AND j."${d.column}" = ANY(?)
                           AND j."deleted_at" IS NULL))
                  AND t."deleted_at" IS NULL`,
        bindings: [channels],
      };
    }
  }
}

/**
 * Predicado para LISTAR. `{}` cuando no hay que filtrar, así el call site lo puede
 * spreadear sin condicionales.
 *
 * Se resuelve como subselect de ids y no con un operador de MikroORM a propósito:
 * `$contains` emite `@>` crudo sin cast a jsonb, y no sabe expresar el caso `[]`.
 * Además esto mantiene `count` y paginación correctos — el patrón actual del lado
 * store lista todo y filtra en memoria, que en un admin paginado miente.
 */
export async function siteFilter(
  scope: MedusaContainer,
  resolution: SiteResolution,
  descriptor: SiteScopeDescriptor,
): Promise<Record<string, unknown>> {
  const channels = channelsToFilterBy(resolution);
  if (!channels) return {};

  // Una tienda sin ningún canal no puede poseer nada. Con `all`/`global` igual ve
  // lo global; con `unassigned` no ve nada, que es lo correcto.
  const { sql, bindings } = idSubselect(
    descriptor,
    channels,
    resolution.status === 'site' ? resolution.site.id : '',
  );
  const result = await pgOf(scope).raw(sql, bindings);
  const ids = (result?.rows ?? []).map((r: { id: string }) => r.id);

  if (ids.length > SITE_SCOPE_MAX_IDS) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `siteFilter: "${descriptor.table}" devolvió ${ids.length} ids (tope ${SITE_SCOPE_MAX_IDS}). ` +
        `Esta tabla es demasiado grande para el subselect: agregale una columna de tienda ` +
        `y filtrala en SQL en vez de por lista de ids.`,
    );
  }

  return { id: ids };
}

/**
 * El MISMO predicado de `siteFilter`, pero como SQL para EMBEBER — sin materializar.
 *
 * Es la salida del techo de `SITE_SCOPE_MAX_IDS`. `siteFilter` tiene ese tope porque
 * devuelve un objeto para MikroORM, y un objeto sólo puede llevar la lista de ids ya
 * traída: no hay forma de expresar "un subselect" en un where de ORM. Cuando el call
 * site escribe SQL —un `COUNT`, un `GROUP BY`— esa restricción no existe: el
 * subselect entra tal cual en el `IN` y Postgres lo resuelve como semi-join, sin
 * traer una sola fila a Node. Sin tope, entonces, y sin `take` que mienta.
 *
 * Es exactamente lo que `assertIdInSite` ya hacía puertas adentro
 * (`SELECT 1 FROM (${inner.sql}) AS allowed …`). Esto sólo le pone nombre para que un
 * agregado no tenga que elegir entre el tope y reimplementar el predicado a mano —que
 * es la alternativa que hay que evitar: una copia del `IS NULL`/`deleted_at`/`@>` en
 * la ruta drifteA del original y nadie se entera hasta que un listado y su KPI dan
 * distinto.
 *
 * CONTRATO CUANDO NO HAY QUE FILTRAR: devuelve `null`, y significa **no pongas la
 * cláusula**. Es la diferencia con `siteFilter`/`siteColumnFilter`, que devuelven `{}`
 * para que el call site lo spreadee sin condicionales: en SQL no existe el "predicado
 * vacío que se concatena" —hay que ELEGIR no escribirlo—, y las alternativas son
 * peores. Un `SELECT "id" FROM t` tautológico haría el trabajo de un `WHERE` que
 * sobra, y un `''` produciría `IN ()`, que ni siquiera es SQL válido.
 *
 * `null` cubre `allSites`, `singleSite` y `registryAbsent`, con el mismo criterio que
 * todo el seam. `unknownSite` TIRA, igual que los demás.
 */
export function siteIdSubselect(
  resolution: SiteResolution,
  descriptor: SiteScopeDescriptor,
): { sql: string; bindings: unknown[] } | null {
  const channels = channelsToFilterBy(resolution);
  if (!channels) return null;

  return idSubselect(
    descriptor,
    channels,
    resolution.status === 'site' ? resolution.site.id : '',
  );
}

/**
 * Filtro por canal para rutas que YA aceptaban `sales_channel_id` como query param.
 *
 * Precedencia: el param explícito gana —quien lo manda sabe lo que pide— y sólo si
 * no viene se usan los canales de la tienda activa.
 *
 * Acá está el arreglo del bug B2B: estas rutas filtraban por un canal ESCALAR, así
 * que en una tienda con `b2b_enabled` todo lo que entró por el canal mayorista
 * quedaba afuera del listado sin ningún error. `channel_ids` son los dos.
 *
 * Consecuencia esperada al desplegar: los números de estos dashboards CAMBIAN para
 * las tiendas B2B, porque empiezan a incluir su tráfico mayorista. Es el arreglo,
 * no una regresión.
 */
export function siteChannelFilter(
  resolution: SiteResolution,
  explicitChannelId: string | undefined,
  column = 'sales_channel_id',
): Record<string, unknown> {
  if (explicitChannelId) return { [column]: explicitChannelId };
  const channels = channelsToFilterBy(resolution);
  if (!channels || channels.length === 0) return {};
  return { [column]: channels };
}

/**
 * Filtro por la COLUMNA de tienda, sin subselect. Sólo para `site_column`.
 *
 * `siteFilter` resuelve la pertenencia como una lista de ids y por eso tiene el tope
 * de `SITE_SCOPE_MAX_IDS`: con las formas de canal —jsonb, join table, herencia por
 * FK— no hay otra manera. Pero cuando la tabla YA tiene `site_id` propio, el predicado
 * es una columna y no hace falta ninguna vuelta.
 *
 * SALE COMO `$or`, NO COMO `{ site_id: [id, null] }`. La forma de array parece la
 * traducción obvia de "la mía o la global" y es la que estaba acá, pero se emite como
 * `site_id IN ('demo_x', NULL)` y en SQL eso NO matchea un `site_id IS NULL`: `x = NULL`
 * no es verdadero, es NULL. O sea que la fila global se volvía invisible EXACTAMENTE
 * cuando la key resolvía una tienda, que es el único caso en que este filtro corre.
 *
 * Medido en producción el 20/08: en un proyecto con la serie de `minimum_purchase`
 * cargada como global, `/store/minimum-purchase` devolvía `null` y el carrito dejaba de
 * exigir el mínimo — plata en la dirección equivocada. El A/B que lo aisló: en la misma
 * request, `store_setting` (que resuelve con dos queries, tienda → global) SÍ leía su
 * fila global; `minimum_purchase` (que usaba el array) no leía la suya.
 *
 * El gemelo en SQL de `idSubselect` nunca tuvo el bug —escribe `"site_id" IS NULL OR
 * "site_id" = ?`— y es el que fija la semántica que este helper tiene que igualar.
 *
 * La diferencia importa donde el subselect no entra. `comment` es la tabla de reseñas
 * de un catálogo entero: pasa las 5000 filas mucho antes que `banner` o `brand`, y ahí
 * `siteFilter` no filtra mal — TIRA. Una ruta pública del storefront que empieza a dar
 * 500 cuando el catálogo crece es peor que la fuga que vino a cerrar.
 *
 * `empty: 'all'`/`'global'` incluye la fila sin tienda; `'unassigned'` la deja afuera.
 * `{}` cuando no hay que filtrar, para spreadear sin condicionales.
 */
export function siteColumnFilter(
  resolution: SiteResolution,
  descriptor: SiteColumnScope,
): Record<string, unknown> {
  const channels = channelsToFilterBy(resolution);
  if (!channels || resolution.status !== 'site') return {};

  const includesEmpty = descriptor.empty === 'all' || descriptor.empty === 'global';
  if (!includesEmpty) return { [descriptor.column]: resolution.site.id };

  // `$or` de dos ramas explícitas: la de la tienda y la global. El call site lo
  // spreadea junto a sus otros filtros, que siguen siendo AND — ninguno de los cuatro
  // usa `$or` por su cuenta hoy, y el día que uno lo haga tiene que anidarlo adentro
  // de una rama en vez de pisar esta clave.
  return {
    $or: [{ [descriptor.column]: resolution.site.id }, { [descriptor.column]: null }],
  };
}

/**
 * Con qué valores nace una fila creada con una tienda activa.
 *
 * Filtrar el GET y dejar el POST sin esto crea filas que el creador no vuelve a ver:
 * nacen globales y aparecen en todas las tiendas.
 */
export function siteDefaults(
  resolution: SiteResolution,
  descriptor: SiteScopeDescriptor,
): Record<string, unknown> {
  const channels = channelsToFilterBy(resolution);
  if (!channels || channels.length === 0) return {};

  switch (descriptor.kind) {
    case 'channel_array':
      return { [descriptor.column]: channels };
    case 'channel_column':
      // Una fila singular pertenece a UN canal: el primario de la tienda.
      return { [descriptor.column]: channels[0] };
    case 'site_column':
      return { [descriptor.column]: resolution.status === 'site' ? resolution.site.id : null };
    case 'via_parent':
      // La pertenencia la fija el padre al que apunte la fila. Inventar un default
      // acá escribiría un eje que contradiría a su propio padre.
      return {};
    // El anidado y la join table se escriben con la forma del propio recurso; el
    // call site sabe cómo, y adivinarlo acá produciría un payload inválido.
    case 'channel_array_json':
    case 'join_table':
      return {};
  }
}

/**
 * Guard de ESCRITURA del eje: qué `site_id` puede mandar el body de un POST.
 *
 * Es la mitad que faltaba. `siteDefaults` decide con qué tienda NACE una fila cuando
 * el body no dice nada, y `assertIdInSite` decide QUÉ fila se puede tocar. Ninguno de
 * los dos mira el `site_id` que viene en el body — porque hasta ahora ningún validator
 * lo aceptaba, así que zod lo BORRABA y el problema no existía. El costo de eso era
 * que desde el admin no había forma de crear ni de convertir una plantilla en GLOBAL,
 * y la global es justamente la única que los emisores sin eje pueden leer.
 *
 * La decisión vive en `site-write.ts` (pura, testeable). Acá sólo se tira y se agrega
 * lo único que no se puede decidir sin I/O: que la tienda pedida EXISTA. Sin ese
 * chequeo, un `site_id` con un typo crea una fila que ninguna tienda ve nunca y que el
 * fallback global tampoco alcanza — el mismo fracaso silencioso que este cambio viene
 * a cerrar, sólo que del lado de la escritura.
 *
 * Devuelve el patch a spreadear: `{}` cuando no hay que tocar el eje.
 */
export async function assertWritableSiteId(
  container: MedusaContainer,
  resolution: SiteResolution,
  descriptor: SiteColumnScope,
  requested: string | null | undefined,
  current?: string | null,
): Promise<Record<string, string | null>> {
  const verdict = decideSiteIdWrite(resolution, {
    column: descriptor.column,
    requested,
    current,
  });

  if (!verdict.ok) {
    // `unknown-site` mantiene el code estable que el admin ya sabe interpretar para
    // limpiar su tienda persistida; el resto es una política, no un id podrido.
    throw new MedusaError(
      verdict.code === 'unknown-site'
        ? MedusaError.Types.INVALID_DATA
        : MedusaError.Types.NOT_ALLOWED,
      verdict.code === 'unknown-site'
        ? `${UNKNOWN_SITE_ERROR_CODE}: ${verdict.message}`
        : verdict.message,
    );
  }

  const target = verdict.patch[descriptor.column];
  // Sólo hace falta preguntar por una tienda distinta de la activa: si es la activa,
  // `siteFromRequest` ya la resolvió y existe. `null` es global, no hay qué validar.
  const alreadyProven = resolution.status === 'site' && target === resolution.site.id;
  if (typeof target === 'string' && target && !alreadyProven) {
    const exists = await resolveSite(container, { siteId: target, allowMainFallback: false });
    if (exists.status === 'unknownSite') {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `${UNKNOWN_SITE_ERROR_CODE}: la tienda "${target}" no existe. Una fila con una tienda ` +
          `inexistente no la ve NADIE y tampoco cae al fallback global.`,
      );
    }
  }

  return verdict.patch;
}

/**
 * Guard de detalle / edición / borrado.
 *
 * Tira 404 y no 403: un 403 confirma que la fila existe, y eso ya filtra existencia
 * entre tiendas.
 */
/**
 * Igual que `assertRowInSite`, pero preguntándole a la BASE en vez de a la fila.
 *
 * Existe porque `via_parent` y `join_table` NO pueden validarse leyendo la fila: la
 * pertenencia vive en otra tabla. Sin esto, el patrón de esas dos formas sería
 * "filtro el listado y dejo el detalle abierto", que esconde la fila de la tienda B
 * pero deja editarla con sólo saber el id — que es justamente lo que un listado
 * filtrado NO impide averiguar.
 *
 * Reusa el mismo subselect que el listado, así detalle y listado no pueden
 * discrepar: si una fila se ve, se puede editar; si no, 404.
 */
export async function assertIdInSite(
  scope: MedusaContainer,
  resolution: SiteResolution,
  descriptor: SiteScopeDescriptor,
  id: string,
): Promise<void> {
  const channels = channelsToFilterBy(resolution);
  if (!channels) return;

  const siteId = resolution.status === 'site' ? resolution.site.id : '';
  const inner = idSubselect(descriptor, channels, siteId);
  const result = await pgOf(scope).raw(
    `SELECT 1 FROM (${inner.sql}) AS allowed WHERE allowed."id" = ? LIMIT 1`,
    [...inner.bindings, id],
  );
  if (!result?.rows?.length) {
    // 404 y no 403 a propósito: un 403 confirmaría que el id existe en otra tienda.
    throw new MedusaError(MedusaError.Types.NOT_FOUND, 'No encontrado.');
  }
}

export function assertRowInSite(
  row: Record<string, unknown> | null | undefined,
  resolution: SiteResolution,
  descriptor: SiteScopeDescriptor,
): void {
  const channels = channelsToFilterBy(resolution);
  if (!channels) return;
  if (!row) throw new MedusaError(MedusaError.Types.NOT_FOUND, 'No encontrado.');

  const includesEmpty = descriptor.empty === 'all' || descriptor.empty === 'global';
  let owned: string[] | null = null;

  if (descriptor.kind === 'channel_array') {
    const value = row[descriptor.column];
    owned = Array.isArray(value) ? (value as string[]) : null;
  } else if (descriptor.kind === 'channel_column') {
    const value = row[descriptor.column];
    owned = typeof value === 'string' ? [value] : null;
  } else if (descriptor.kind === 'via_parent') {
    // No se puede leer de la fila: la tienda vive en el padre. El call site tiene que
    // chequearla con su propia consulta, igual que en `join_table`. No adivinamos,
    // porque adivinar acá deja pasar una escritura cruzada.
    return;
  } else if (descriptor.kind === 'site_column') {
    const value = row[descriptor.column];
    const siteId = resolution.status === 'site' ? resolution.site.id : null;
    const allowed = value == null ? includesEmpty : value === siteId;
    if (!allowed) throw new MedusaError(MedusaError.Types.NOT_FOUND, 'No encontrado.');
    return;
  } else if (descriptor.kind === 'channel_array_json') {
    // Los ids viven anidados (banner: `rules.sales_channel_ids`). Se navega el path
    // sin asumir que exista: un `rules` sin la clave es un banner global.
    let cursor: unknown = row[descriptor.column];
    for (const key of descriptor.path) {
      cursor = cursor && typeof cursor === 'object' ? (cursor as Record<string, unknown>)[key] : undefined;
    }
    owned = Array.isArray(cursor) ? (cursor as string[]) : null;
  } else {
    // `join_table`: la pertenencia vive en otra tabla y no se puede leer de la fila.
    // El call site tiene que chequearla con su propia consulta. No adivinamos, porque
    // adivinar acá significa dejar pasar una escritura cruzada.
    return;
  }

  const allowed =
    owned === null || owned.length === 0
      ? includesEmpty
      : owned.some((id) => channels.includes(id));
  if (!allowed) throw new MedusaError(MedusaError.Types.NOT_FOUND, 'No encontrado.');
}

/**
 * Config EFECTIVA de una tienda, por precedencia canal → global.
 *
 * Es una función aparte de `siteFilter` a propósito, y ese es el punto entero del
 * archivo. Con `empty: 'global'`, listar devuelve la fila de la tienda Y la global
 * —correcto para una lista—, pero REDUCIR con `rows[0]` puede devolver la global
 * cuando existía la de la tienda. Ese es exactamente el fail-open documentado.
 *
 * Al ser dos funciones con dos nombres, un `'global'` que alguien reduzca con
 * `rows[0]` no compila: `siteFilter` no devuelve filas.
 */
/**
 * Qué pasa cuando la tienda NO tiene fila propia. Es la pieza que faltaba de P5.
 *
 *   `'inherit-global'`          — cae a la global. Es el default y el comportamiento
 *                                 histórico: no se cambia solo, hay que pedirlo.
 *   `'inherit-global-for-main'` — sólo la tienda PRINCIPAL cae a la global; una
 *                                 secundaria sin fila propia se queda sin valor.
 *   `'fail-closed'`             — nadie cae a la global.
 *
 * La distinción entre los dos últimos existe porque en casi todas las extensiones
 * la fila global ES la de la tienda principal por razones históricas: el proyecto
 * arrancó mono-tienda y esa configuración se guardó sin canal. Hacer que la
 * principal la herede no es una excepción de cortesía, es reconocer de quién era.
 *
 * Cuándo usar cuál: si heredar de más significa que una tienda OPERA con algo de
 * otra —una cuenta, un acuerdo comercial, un remitente—, va `fail-closed`. Si
 * significa que ve un default razonable, va `inherit-global`. La pregunta no es
 * "¿molesta que herede?" sino "¿qué pasa si hereda y nadie se entera?".
 */
export type SiteInheritance = 'inherit-global' | 'inherit-global-for-main' | 'fail-closed';

export function pickBySitePrecedence<T extends Record<string, unknown>>(
  rows: T[],
  resolution: SiteResolution,
  descriptor: Extract<SiteScopeDescriptor, { kind: 'channel_column' }>,
  inheritance: SiteInheritance = 'inherit-global',
): T | undefined {
  const channels = channelsToFilterBy(resolution);
  const globalRow = rows.find((r) => r[descriptor.column] == null);

  // Sin eje de tienda —`allSites`, `registryAbsent`, `singleSite`— no hay nada que
  // cerrar: la global no es "la de otra tienda", es la única que hay. Los tres modos
  // se comportan igual acá a propósito; si no, un proyecto mono-tienda que activara
  // `fail-closed` se quedaría sin configuración por una decisión que no le aplica.
  if (!channels) return globalRow ?? rows[0];

  const own = rows.find((r) => {
    const value = r[descriptor.column];
    return typeof value === 'string' && channels.includes(value);
  });
  if (own) return own;

  if (inheritance === 'fail-closed') return undefined;
  if (inheritance === 'inherit-global-for-main') {
    const isMain =
      (resolution.status === 'site' || resolution.status === 'singleSite') &&
      resolution.site.is_main;
    return isMain ? globalRow : undefined;
  }
  return globalRow;
}
