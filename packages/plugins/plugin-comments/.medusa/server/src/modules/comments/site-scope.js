"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMMENT_SITE_SCOPE = void 0;
/**
 * `empty: 'all'` — los comentarios anteriores a la columna se moderan desde cualquier
 * tienda. Esconder reseñas de clientes reales el día del deploy es peor que mostrarlas
 * de más: una reseña sin moderar que nadie ve queda publicada.
 */
exports.COMMENT_SITE_SCOPE = {
    kind: 'site_column',
    table: 'comment',
    column: 'site_id',
    empty: 'all',
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2l0ZS1zY29wZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2NvbW1lbnRzL3NpdGUtc2NvcGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBRUE7Ozs7R0FJRztBQUNVLFFBQUEsa0JBQWtCLEdBQXdCO0lBQ3JELElBQUksRUFBRSxhQUFhO0lBQ25CLEtBQUssRUFBRSxTQUFTO0lBQ2hCLE1BQU0sRUFBRSxTQUFTO0lBQ2pCLEtBQUssRUFBRSxLQUFLO0NBQ2IsQ0FBQyJ9