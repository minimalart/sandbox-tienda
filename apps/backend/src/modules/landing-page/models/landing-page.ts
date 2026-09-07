import { model } from '@medusajs/framework/utils';

/**
 * LandingPage — a visually-built marketing page authored with the Puck editor.
 *
 * - `puck_data`: the editor's native JSON ({ content, root }). Source of truth
 *   for rendering — never raw HTML, so the storefront renderer stays controlled
 *   by our own component mapping.
 * - `seo`: { title, description, image, noindex }.
 * - `status`: 'draft' | 'published' | 'archived'.
 *
 * Mirrors the Banner module's JSON-field approach (content/media/cta/rules).
 */
export const LandingPage = model
  .define('landing_page', {
    id: model.id({ prefix: 'lpg' }).primaryKey(),
    title: model.text(),
    slug: model.text(),
    status: model.text().default('draft'),
    description: model.text().nullable(),
    seo: model.json().nullable(),
    puck_data: model.json().nullable(),
    template: model.text().nullable(),
    locale: model.text().nullable(),
    sales_channel_id: model.text().nullable(),
    metadata: model.json().nullable(),
    published_at: model.dateTime().nullable(),
    created_by: model.text().nullable(),
    updated_by: model.text().nullable(),
  })
  .indexes([
    { on: ['slug'], unique: true, where: 'deleted_at IS NULL' },
    { on: ['status'] },
    { on: ['locale'] },
    { on: ['published_at'] },
    { on: ['status', 'slug'] },
  ]);

export default LandingPage;
