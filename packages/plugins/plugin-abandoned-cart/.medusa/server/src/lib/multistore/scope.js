"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SITE_SCOPE_MAX_IDS = void 0;
exports.siteFilter = siteFilter;
exports.siteIdSubselect = siteIdSubselect;
exports.siteChannelFilter = siteChannelFilter;
exports.siteColumnFilter = siteColumnFilter;
exports.siteDefaults = siteDefaults;
exports.assertIdInSite = assertIdInSite;
exports.assertRowInSite = assertRowInSite;
exports.pickBySitePrecedence = pickBySitePrecedence;
const utils_1 = require("@medusajs/framework/utils");
const types_1 = require("./types");
/**
 * Cota de seguridad del subselect de ids. Las tablas de contenido curado a mano
 * (marcas, banners, looks) tienen cientos de filas. El día que alguien aplique esto
 * a `delivery` con 200k, se entera con un error y no con un `IN` de 200k binds.
 */
exports.SITE_SCOPE_MAX_IDS = 5000;
const pgOf = (scope) => scope.resolve(utils_1.ContainerRegistrationKeys.PG_CONNECTION);
/** `unknownSite` rompe. Degradar acá es cómo un id stale muestra todas las tiendas. */
function assertResolved(resolution) {
    if (resolution.status === 'unknownSite') {
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, `${types_1.UNKNOWN_SITE_ERROR_CODE}: la tienda solicitada no existe o fue eliminada.`);
    }
}
/**
 * ¿Hay que filtrar? Sólo con una tienda elegida de un registro con varias.
 *
 * `singleSite` y `registryAbsent` NO filtran: con una sola tienda no hay nada que
 * aislar, y filtrar igual escondería filas cuyo canal se creó a mano y no pertenece
 * a ninguna tienda.
 */
const channelsToFilterBy = (resolution) => {
    assertResolved(resolution);
    if (resolution.status !== 'site')
        return null;
    return resolution.site.channel_ids;
};
/** El SQL que decide qué ids pertenecen a la tienda, por forma física. */
function idSubselect(d, channels, siteId) {
    const includesEmpty = d.empty === 'all' || d.empty === 'global';
    switch (d.kind) {
        case 'channel_array': {
            // `NULL` y `[]` son lo mismo semánticamente; el `jsonb_array_length` cubre el
            // segundo, que es el caso que `$contains` de MikroORM no sabe expresar.
            const empty = includesEmpty
                ? `"${d.column}" IS NULL OR jsonb_array_length("${d.column}") = 0 OR `
                : '';
            return {
                sql: `SELECT "id" FROM "${d.table}"
                WHERE (${empty}"${d.column}" @> ?::jsonb)
                  AND "deleted_at" IS NULL`,
                bindings: [JSON.stringify(channels)],
            };
        }
        case 'channel_array_json': {
            const path = d.path.map((p) => `'${p}'`).join('->');
            const expr = `"${d.column}"->${path}`;
            const empty = includesEmpty
                ? `${expr} IS NULL OR jsonb_typeof(${expr}) <> 'array' OR jsonb_array_length(${expr}) = 0 OR `
                : '';
            return {
                sql: `SELECT "id" FROM "${d.table}"
                WHERE (${empty}${expr} @> ?::jsonb)
                  AND "deleted_at" IS NULL`,
                bindings: [JSON.stringify(channels)],
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
async function siteFilter(scope, resolution, descriptor) {
    const channels = channelsToFilterBy(resolution);
    if (!channels)
        return {};
    // Una tienda sin ningún canal no puede poseer nada. Con `all`/`global` igual ve
    // lo global; con `unassigned` no ve nada, que es lo correcto.
    const { sql, bindings } = idSubselect(descriptor, channels, resolution.status === 'site' ? resolution.site.id : '');
    const result = await pgOf(scope).raw(sql, bindings);
    const ids = (result?.rows ?? []).map((r) => r.id);
    if (ids.length > exports.SITE_SCOPE_MAX_IDS) {
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_ALLOWED, `siteFilter: "${descriptor.table}" devolvió ${ids.length} ids (tope ${exports.SITE_SCOPE_MAX_IDS}). ` +
            `Esta tabla es demasiado grande para el subselect: agregale una columna de tienda ` +
            `y filtrala en SQL en vez de por lista de ids.`);
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
function siteIdSubselect(resolution, descriptor) {
    const channels = channelsToFilterBy(resolution);
    if (!channels)
        return null;
    return idSubselect(descriptor, channels, resolution.status === 'site' ? resolution.site.id : '');
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
function siteChannelFilter(resolution, explicitChannelId, column = 'sales_channel_id') {
    if (explicitChannelId)
        return { [column]: explicitChannelId };
    const channels = channelsToFilterBy(resolution);
    if (!channels || channels.length === 0)
        return {};
    return { [column]: channels };
}
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
function siteColumnFilter(resolution, descriptor) {
    const channels = channelsToFilterBy(resolution);
    if (!channels || resolution.status !== 'site')
        return {};
    const includesEmpty = descriptor.empty === 'all' || descriptor.empty === 'global';
    return {
        [descriptor.column]: includesEmpty ? [resolution.site.id, null] : resolution.site.id,
    };
}
/**
 * Con qué valores nace una fila creada con una tienda activa.
 *
 * Filtrar el GET y dejar el POST sin esto crea filas que el creador no vuelve a ver:
 * nacen globales y aparecen en todas las tiendas.
 */
function siteDefaults(resolution, descriptor) {
    const channels = channelsToFilterBy(resolution);
    if (!channels || channels.length === 0)
        return {};
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
async function assertIdInSite(scope, resolution, descriptor, id) {
    const channels = channelsToFilterBy(resolution);
    if (!channels)
        return;
    const siteId = resolution.status === 'site' ? resolution.site.id : '';
    const inner = idSubselect(descriptor, channels, siteId);
    const result = await pgOf(scope).raw(`SELECT 1 FROM (${inner.sql}) AS allowed WHERE allowed."id" = ? LIMIT 1`, [...inner.bindings, id]);
    if (!result?.rows?.length) {
        // 404 y no 403 a propósito: un 403 confirmaría que el id existe en otra tienda.
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_FOUND, 'No encontrado.');
    }
}
function assertRowInSite(row, resolution, descriptor) {
    const channels = channelsToFilterBy(resolution);
    if (!channels)
        return;
    if (!row)
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_FOUND, 'No encontrado.');
    const includesEmpty = descriptor.empty === 'all' || descriptor.empty === 'global';
    let owned = null;
    if (descriptor.kind === 'channel_array') {
        const value = row[descriptor.column];
        owned = Array.isArray(value) ? value : null;
    }
    else if (descriptor.kind === 'channel_column') {
        const value = row[descriptor.column];
        owned = typeof value === 'string' ? [value] : null;
    }
    else if (descriptor.kind === 'via_parent') {
        // No se puede leer de la fila: la tienda vive en el padre. El call site tiene que
        // chequearla con su propia consulta, igual que en `join_table`. No adivinamos,
        // porque adivinar acá deja pasar una escritura cruzada.
        return;
    }
    else if (descriptor.kind === 'site_column') {
        const value = row[descriptor.column];
        const siteId = resolution.status === 'site' ? resolution.site.id : null;
        const allowed = value == null ? includesEmpty : value === siteId;
        if (!allowed)
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_FOUND, 'No encontrado.');
        return;
    }
    else if (descriptor.kind === 'channel_array_json') {
        // Los ids viven anidados (banner: `rules.sales_channel_ids`). Se navega el path
        // sin asumir que exista: un `rules` sin la clave es un banner global.
        let cursor = row[descriptor.column];
        for (const key of descriptor.path) {
            cursor = cursor && typeof cursor === 'object' ? cursor[key] : undefined;
        }
        owned = Array.isArray(cursor) ? cursor : null;
    }
    else {
        // `join_table`: la pertenencia vive en otra tabla y no se puede leer de la fila.
        // El call site tiene que chequearla con su propia consulta. No adivinamos, porque
        // adivinar acá significa dejar pasar una escritura cruzada.
        return;
    }
    const allowed = owned === null || owned.length === 0
        ? includesEmpty
        : owned.some((id) => channels.includes(id));
    if (!allowed)
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_FOUND, 'No encontrado.');
}
function pickBySitePrecedence(rows, resolution, descriptor, inheritance = 'inherit-global') {
    const channels = channelsToFilterBy(resolution);
    const globalRow = rows.find((r) => r[descriptor.column] == null);
    // Sin eje de tienda —`allSites`, `registryAbsent`, `singleSite`— no hay nada que
    // cerrar: la global no es "la de otra tienda", es la única que hay. Los tres modos
    // se comportan igual acá a propósito; si no, un proyecto mono-tienda que activara
    // `fail-closed` se quedaría sin configuración por una decisión que no le aplica.
    if (!channels)
        return globalRow ?? rows[0];
    const own = rows.find((r) => {
        const value = r[descriptor.column];
        return typeof value === 'string' && channels.includes(value);
    });
    if (own)
        return own;
    if (inheritance === 'fail-closed')
        return undefined;
    if (inheritance === 'inherit-global-for-main') {
        const isMain = (resolution.status === 'site' || resolution.status === 'singleSite') &&
            resolution.site.is_main;
        return isMain ? globalRow : undefined;
    }
    return globalRow;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NvcGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbGliL211bHRpc3RvcmUvc2NvcGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBZ09BLGdDQTRCQztBQTZCRCwwQ0FZQztBQWdCRCw4Q0FTQztBQWtCRCw0Q0FXQztBQVFELG9DQXlCQztBQW9CRCx3Q0FtQkM7QUFFRCwwQ0FpREM7QUFrQ0Qsb0RBNkJDO0FBcmhCRCxxREFBbUY7QUFFbkYsbUNBQWtEO0FBaUZsRDs7OztHQUlHO0FBQ1UsUUFBQSxrQkFBa0IsR0FBRyxJQUFJLENBQUM7QUFJdkMsTUFBTSxJQUFJLEdBQUcsQ0FBQyxLQUFzQixFQUFVLEVBQUUsQ0FDOUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxpQ0FBeUIsQ0FBQyxhQUFhLENBQXNCLENBQUM7QUFFOUUsdUZBQXVGO0FBQ3ZGLFNBQVMsY0FBYyxDQUFDLFVBQTBCO0lBQ2hELElBQUksVUFBVSxDQUFDLE1BQU0sS0FBSyxhQUFhLEVBQUUsQ0FBQztRQUN4QyxNQUFNLElBQUksbUJBQVcsQ0FDbkIsbUJBQVcsQ0FBQyxLQUFLLENBQUMsWUFBWSxFQUM5QixHQUFHLCtCQUF1QixtREFBbUQsQ0FDOUUsQ0FBQztJQUNKLENBQUM7QUFDSCxDQUFDO0FBRUQ7Ozs7OztHQU1HO0FBQ0gsTUFBTSxrQkFBa0IsR0FBRyxDQUFDLFVBQTBCLEVBQW1CLEVBQUU7SUFDekUsY0FBYyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQzNCLElBQUksVUFBVSxDQUFDLE1BQU0sS0FBSyxNQUFNO1FBQUUsT0FBTyxJQUFJLENBQUM7SUFDOUMsT0FBTyxVQUFVLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQztBQUNyQyxDQUFDLENBQUM7QUFFRiwwRUFBMEU7QUFDMUUsU0FBUyxXQUFXLENBQ2xCLENBQXNCLEVBQ3RCLFFBQWtCLEVBQ2xCLE1BQWM7SUFFZCxNQUFNLGFBQWEsR0FBRyxDQUFDLENBQUMsS0FBSyxLQUFL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