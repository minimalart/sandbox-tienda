"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlogSettings = void 0;
const utils_1 = require("@medusajs/framework/utils");
/**
 * BlogSettings — a single-row configuration record for the Blog section.
 * Holds presentation toggles + default SEO. Kept as its own table (rather than
 * overloading store-config) so the blog module stays self-contained.
 */
exports.BlogSettings = utils_1.model.define('blog_settings', {
    id: utils_1.model.id({ prefix: 'bset' }).primaryKey(),
    section_name: utils_1.model.text().default('Blog'),
    show_search: utils_1.model.boolean().default(true),
    show_categories: utils_1.model.boolean().default(true),
    posts_per_page: utils_1.model.number().default(12),
    default_seo_title: utils_1.model.text().nullable(),
    default_seo_description: utils_1.model.text().nullable(),
    metadata: utils_1.model.json().nullable(),
    /**
     * La tienda dueña de esta configuración. `NULL` = GLOBAL de la instancia, el
     * fallback de toda tienda que no defina la suya.
     *
     * Deja de ser un singleton: la unicidad pasa a ser por tienda y necesita DOS
     * índices parciales, porque en Postgres `NULL != NULL`.
     */
    site_id: utils_1.model.text().nullable(),
});
exports.default = exports.BlogSettings;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmxvZy1zZXR0aW5ncy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2Jsb2cvbW9kZWxzL2Jsb2ctc2V0dGluZ3MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscURBQWtEO0FBRWxEOzs7O0dBSUc7QUFDVSxRQUFBLFlBQVksR0FBRyxhQUFLLENBQUMsTUFBTSxDQUFDLGVBQWUsRUFBRTtJQUN4RCxFQUFFLEVBQUUsYUFBSyxDQUFDLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDLFVBQVUsRUFBRTtJQUM3QyxZQUFZLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUM7SUFDMUMsV0FBVyxFQUFFLGFBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDO0lBQzFDLGVBQWUsRUFBRSxhQUFLLENBQUMsT0FBTyxFQUFFLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQztJQUM5QyxjQUFjLEVBQUUsYUFBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7SUFDMUMsaUJBQWlCLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUMxQyx1QkFBdUIsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ2hELFFBQVEsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQy9COzs7Ozs7T0FNRztJQUNILE9BQU8sRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0NBQ25DLENBQUMsQ0FBQztBQUVILGtCQUFlLG9CQUFZLENBQUMifQ==