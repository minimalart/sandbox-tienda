"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlogCategory = void 0;
const utils_1 = require("@medusajs/framework/utils");
/**
 * BlogCategory — a taxonomy bucket for articles. Public URL: /blog/categoria/{slug}.
 * `image` is a { url, file_id, alt } JSON; `sort_order` drives menu ordering.
 */
exports.BlogCategory = utils_1.model
    .define('blog_category', {
    id: utils_1.model.id({ prefix: 'bcat' }).primaryKey(),
    name: utils_1.model.text(),
    slug: utils_1.model.text(),
    description: utils_1.model.text().nullable(),
    image: utils_1.model.json().nullable(),
    sort_order: utils_1.model.number().default(0),
    /**
     * La tienda dueña de la categoría. `NULL` = taxonomía compartida.
     *
     * `empty: 'all'` en el descriptor: las existentes son de todas, y esconderlas
     * dejaría posts publicados apuntando a una categoría que el operador no ve.
     */
    site_id: utils_1.model.text().nullable(),
})
    .indexes([
    { on: ['slug'], unique: true, where: 'deleted_at IS NULL' },
    { on: ['sort_order'] },
]);
exports.default = exports.BlogCategory;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmxvZy1jYXRlZ29yeS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2Jsb2cvbW9kZWxzL2Jsb2ctY2F0ZWdvcnkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscURBQWtEO0FBRWxEOzs7R0FHRztBQUNVLFFBQUEsWUFBWSxHQUFHLGFBQUs7S0FDOUIsTUFBTSxDQUFDLGVBQWUsRUFBRTtJQUN2QixFQUFFLEVBQUUsYUFBSyxDQUFDLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDLFVBQVUsRUFBRTtJQUM3QyxJQUFJLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRTtJQUNsQixJQUFJLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRTtJQUNsQixXQUFXLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNwQyxLQUFLLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUM5QixVQUFVLEVBQUUsYUFBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFDckM7Ozs7O09BS0c7SUFDSCxPQUFPLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtDQUNqQyxDQUFDO0tBQ0QsT0FBTyxDQUFDO0lBQ1AsRUFBRSxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxvQkFBb0IsRUFBRTtJQUMzRCxFQUFFLEVBQUUsRUFBRSxDQUFDLFlBQVksQ0FBQyxFQUFFO0NBQ3ZCLENBQUMsQ0FBQztBQUVMLGtCQUFlLG9CQUFZLENBQUMifQ==