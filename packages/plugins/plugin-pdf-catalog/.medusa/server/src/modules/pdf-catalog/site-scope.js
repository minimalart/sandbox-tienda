"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PDF_CATALOG_ROW_SCOPE = exports.PDF_CATALOG_SITE_SCOPE = void 0;
/**
 * En qué tiendas está activo un catálogo PDF.
 *
 * Es la ÚNICA forma `join_table` del repo: la pertenencia no vive en el catálogo
 * sino en `pdf_catalog_channel`, una fila por activación, con un UNIQUE parcial que
 * garantiza "un solo catálogo activo por canal".
 *
 * `empty: 'all'`: un catálogo SIN activaciones es un borrador, y tiene que verse en
 * el listado — si no, nunca podrías activarlo desde una tienda. Ponerle
 * `'unassigned'` escondería todo catálogo recién creado.
 */
exports.PDF_CATALOG_SITE_SCOPE = {
    kind: 'join_table',
    table: 'pdf_catalog',
    joinTable: 'pdf_catalog_channel',
    fk: 'catalog_id',
    column: 'sales_channel_id',
    empty: 'all',
};
/**
 * El mismo scope, pero sobre la fila YA HIDRATADA por `retrieveWithChannels`, que
 * aplana los canales de la join table en un `sales_channel_ids`.
 *
 * Existe porque `assertRowInSite` no puede resolver una `join_table` desde una fila
 * plana —la pertenencia vive en otra tabla y adivinarla dejaría pasar escrituras
 * cruzadas—, pero sí puede leer el array que esa función ya trajo. Usar
 * `PDF_CATALOG_SITE_SCOPE` para LISTAR y este para GUARDAR el detalle.
 */
exports.PDF_CATALOG_ROW_SCOPE = {
    kind: 'channel_array',
    table: 'pdf_catalog',
    column: 'sales_channel_ids',
    empty: 'all',
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2l0ZS1zY29wZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL3BkZi1jYXRhbG9nL3NpdGUtc2NvcGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBRUE7Ozs7Ozs7Ozs7R0FVRztBQUNVLFFBQUEsc0JBQXNCLEdBQXdCO0lBQ3pELElBQUksRUFBRSxZQUFZO0lBQ2xCLEtBQUssRUFBRSxhQUFhO0lBQ3BCLFNBQVMsRUFBRSxxQkFBcUI7SUFDaEMsRUFBRSxFQUFFLFlBQVk7SUFDaEIsTUFBTSxFQUFFLGtCQUFrQjtJQUMxQixLQUFLLEVBQUUsS0FBSztDQUNiLENBQUM7QUFFRjs7Ozs7Ozs7R0FRRztBQUNVLFFBQUEscUJBQXFCLEdBQXdCO0lBQ3hELElBQUksRUFBRSxlQUFlO0lBQ3JCLEtBQUssRUFBRSxhQUFhO0lBQ3BCLE1BQU0sRUFBRSxtQkFBbUI7SUFDM0IsS0FBSyxFQUFFLEtBQUs7Q0FDYixDQUFDIn0=