import { model } from '@medusajs/framework/utils';

/**
 * ContactSubmission — un envío del formulario de contacto del storefront,
 * persistido para verlo y gestionarlo desde el backoffice.
 *
 * `status`: 'new' | 'read' | 'archived'.
 */
export const ContactSubmission = model
  .define('contact_submission', {
    id: model.id({ prefix: 'cts' }).primaryKey(),
    first_name: model.text(),
    last_name: model.text(),
    email: model.text(),
    phone: model.text().nullable(),
    message: model.text(),
    status: model.text().default('new'),
    source: model.text().nullable(),
    ip: model.text().nullable(),
    user_agent: model.text().nullable(),
    metadata: model.json().nullable(),
    /**
     * La tienda que recibió el mensaje.
     *
     * `NULL` = 'unassigned', NO 'todas': un mensaje pertenece a UNA tienda, la
     * que mostró el formulario. Los envíos anteriores a esta columna quedan en
     * `NULL` y por eso el descriptor arranca en `'all'` — esconderlos del
     * backoffice el día del deploy sería perder mensajes de clientes reales,
     * que es peor que mostrar de más. Cuando estén backfilleados se endurece a
     * `'unassigned'`.
     */
    site_id: model.text().nullable(),
  })
  .indexes([{ on: ['status'] }, { on: ['email'] }, { on: ['site_id'] }]);

export default ContactSubmission;
