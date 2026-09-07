import { model } from '@medusajs/framework/utils';

/**
 * BlogCategory — a taxonomy bucket for articles. Public URL: /blog/categoria/{slug}.
 * `image` is a { url, file_id, alt } JSON; `sort_order` drives menu ordering.
 */
export const BlogCategory = model
  .define('blog_category', {
    id: model.id({ prefix: 'bcat' }).primaryKey(),
    name: model.text(),
    slug: model.text(),
    description: model.text().nullable(),
    image: model.json().nullable(),
    sort_order: model.number().default(0),
    /**
     * La tienda dueña de la categoría. `NULL` = taxonomía compartida.
     *
     * `empty: 'all'` en el descriptor: las existentes son de todas, y esconderlas
     * dejaría posts publicados apuntando a una categoría que el operador no ve.
     */
    site_id: model.text().nullable(),
  })
  .indexes([
    { on: ['slug'], unique: true, where: 'deleted_at IS NULL' },
    { on: ['sort_order'] },
  ]);

export default BlogCategory;
