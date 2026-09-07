import { model } from '@medusajs/framework/utils';

/**
 * BlogSettings — a single-row configuration record for the Blog section.
 * Holds presentation toggles + default SEO. Kept as its own table (rather than
 * overloading store-config) so the blog module stays self-contained.
 */
export const BlogSettings = model.define('blog_settings', {
  id: model.id({ prefix: 'bset' }).primaryKey(),
  section_name: model.text().default('Blog'),
  show_search: model.boolean().default(true),
  show_categories: model.boolean().default(true),
  posts_per_page: model.number().default(12),
  default_seo_title: model.text().nullable(),
  default_seo_description: model.text().nullable(),
  metadata: model.json().nullable(),
    /**
     * La tienda dueña de esta configuración. `NULL` = GLOBAL de la instancia, el
     * fallback de toda tienda que no defina la suya.
     *
     * Deja de ser un singleton: la unicidad pasa a ser por tienda y necesita DOS
     * índices parciales, porque en Postgres `NULL != NULL`.
     */
    site_id: model.text().nullable(),
});

export default BlogSettings;
