import type { MedusaContainer } from '@medusajs/framework/types';
import type { SiteResolution } from './types';
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
export type SiteScopeDescriptor = {
    kind: 'channel_array';
    table: string;
    column: string;
    empty: NullMeans;
} | {
    kind: 'channel_array_json';
    table: string;
    column: string;
    path: string[];
    empty: NullMeans;
} | {
    kind: 'channel_column';
    table: string;
    column: string;
    empty: NullMeans;
} | {
    kind: 'join_table';
    table: string;
    joinTable: string;
    fk: string;
    column: string;
    empty: NullMeans;
}
/**
 * Columna de TIENDA propia (`site_id`), no de canal. Es la forma a la que deberían
 * converger los modelos: filtra por la tienda de verdad y no por "los canales que
 * esa tienda posee", que es una traducción con pérdida —un canal creado a mano no
 * pertenece a nadie, y una tienda con `source_type: 'sales_channel'` adopta uno que
 * puede estar compartido—.
 */
 | {
    kind: 'site_column';
    table: string;
    column: string;
    empty: NullMeans;
}
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
export type SiteColumnScope = Extract<SiteScopeDescriptor, {
    kind: 'site_column';
}>;
/**
 * Cota de seguridad del subselect de ids. Las tablas de contenido curado a mano
 * (marcas, banners, looks) tienen cientos de filas. El día que alguien aplique esto
 * a `delivery` con 200k, se entera con un error y no con un `IN` de 200k binds.
 */
export declare const SITE_SCOPE_MAX_IDS = 5000;
/**
 * Predicado para LISTAR. `{}` cuando no hay que filtrar, así el call site lo puede
 * spreadear sin condicionales.
 *
 * Se resuelve como subselect de ids y no con un operador de MikroORM a propósito:
 * `$contains` emite `@>` crudo sin cast a jsonb, y no sabe expresar el caso `[]`.
 * Además esto mantiene `count` y paginación correctos — el patrón actual del lado
 * store lista todo y filtra en memoria, que en un admin paginado miente.
 */
export declare function siteFilter(scope: MedusaContainer, resolution: SiteResolution, descriptor: SiteScopeDescriptor): Promise<Record<string, unknown>>;
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
export declare function siteIdSubselect(resolution: SiteResolution, descriptor: SiteScopeDescriptor): {
    sql: string;
    bindings: unknown[];
} | null;
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
export declare function siteChannelFilter(resolution: SiteResolution, explicitChannelId: string | undefined, column?: string): Record<string, unknown>;
/**
 * Filtro por la COLUMNA de tienda, sin subselect. Sólo para `site_column`.
 *
 * `siteFilter` resuelve la pertenencia como una lista de ids y por eso tiene el tope
 * de `SITE_SCOPE_MAX_IDS`: con las formas de canal —jsonb, join table, herencia por
 * FK— no hay otra manera. Pero cuando la tabla YA tiene `site_id` propio, el predicado
 * es una columna y no hace falta ninguna vuelta: `site_id IN (mi_tienda, NULL)`.
 *
 * La diferencia importa donde el subselect no entra. `comment` es la tabla de reseñas
 * de un catálogo entero: pasa las 5000 filas mucho antes que `banner` o `brand`, y ahí
 * `siteFilter` no filtra mal — TIRA. Una ruta pública del storefront que empieza a dar
 * 500 cuando el catálogo crece es peor que la fuga que vino a cerrar.
 *
 * `empty: 'all'`/`'global'` incluye la fila sin tienda; `'unassigned'` la deja afuera.
 * `{}` cuando no hay que filtrar, para spreadear sin condicionales.
 */
export declare function siteColumnFilter(resolution: SiteResolution, descriptor: SiteColumnScope): Record<string, unknown>;
/**
 * Con qué valores nace una fila creada con una tienda activa.
 *
 * Filtrar el GET y dejar el POST sin esto crea filas que el creador no vuelve a ver:
 * nacen globales y aparecen en todas las tiendas.
 */
export declare function siteDefaults(resolution: SiteResolution, descriptor: SiteScopeDescriptor): Record<string, unknown>;
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
export declare function assertIdInSite(scope: MedusaContainer, resolution: SiteResolution, descriptor: SiteScopeDescriptor, id: string): Promise<void>;
export declare function assertRowInSite(row: Record<string, unknown> | null | undefined, resolution: SiteResolution, descriptor: SiteScopeDescriptor): void;
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
export declare function pickBySitePrecedence<T extends Record<string, unknown>>(rows: T[], resolution: SiteResolution, descriptor: Extract<SiteScopeDescriptor, {
    kind: 'channel_column';
}>, inheritance?: SiteInheritance): T | undefined;
