import { model } from '@medusajs/framework/utils';

/**
 * EmailTemplate — a transactional email body editable from the backoffice.
 *
 * Mirrors the LandingPage module's "content lives in the DB" + Puck approach:
 * `design` (Puck JSON) is the source of truth, edited from the block editor.
 *
 * - `key`: stable identifier matching the `template` string passed to
 *   `notificationService.createNotifications`. The email provider looks the
 *   published row up by this key; when absent it falls back to the hardcoded
 *   template function in `src/modules/email/templates`.
 * - `design`: Puck document. On save it is rendered to email-safe HTML via
 *   React Email (src/modules/email-template/render-email.ts) and cached in
 *   `html`. Handlebars tokens ({{var}}, {{#each}}, {{#if}}) are preserved.
 * - `subject` / `html`: Handlebars sources sent to the recipient. `html` is the
 *   derived render of `design`; the provider runs Handlebars over it at send
 *   time. Variables ({{var}}) are auto-escaped; loops/conditionals work for
 *   line items, etc.
 * - `variables`: declared placeholders shown in the editor (name + description).
 * - `sample_data`: example payload used to render the live preview / test send.
 * - `status`: 'draft' | 'published'. Only `published` rows override code.
 */
export const EmailTemplate = model
  .define('email_template', {
    id: model.id({ prefix: 'etpl' }).primaryKey(),
    key: model.text(),
    name: model.text(),
    description: model.text().nullable(),
    subject: model.text(),
    html: model.text(),
    status: model.text().default('draft'),
    locale: model.text().nullable(),
    design: model.json().nullable(),
    variables: model.json().nullable(),
    sample_data: model.json().nullable(),
    metadata: model.json().nullable(),
    published_at: model.dateTime().nullable(),
    created_by: model.text().nullable(),
    updated_by: model.text().nullable(),
    /**
     * La tienda dueña de la plantilla. `NULL` = plantilla GLOBAL, el fallback de toda
     * tienda que no tenga la suya para esa clave.
     *
     * Es lo que permite que una marca cambie el texto de "orden confirmada" sin
     * tocárselo a las otras.
     */
    site_id: model.text().nullable(),
  })
  .indexes([
    // DOS parciales: en Postgres `NULL != NULL`, así que un único índice sobre
    // (site_id, key) dejaría pasar dos plantillas globales con la misma clave y la
    // que gane dependería del plan de ejecución.
    { on: ['key'], unique: true, where: 'site_id IS NULL AND deleted_at IS NULL' },
    { on: ['site_id', 'key'], unique: true, where: 'site_id IS NOT NULL AND deleted_at IS NULL' },
    { on: ['site_id'] },
    { on: ['status'] },
    { on: ['locale'] },
    { on: ['status', 'key'] },
  ]);

export default EmailTemplate;
