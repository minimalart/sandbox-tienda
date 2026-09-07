import { model } from '@medusajs/framework/utils';

/**
 * NewsletterSubscription — una alta al newsletter desde el storefront.
 *
 * ─── POR QUÉ SE PERSISTE SI EL DESTINO ES BREVO ─────────────────────────────
 *
 * Porque el destino puede no estar. El endpoint que esta extensión reemplaza
 * validaba el mail, lo tiraba a un `console.log` y devolvía `success: true`: el
 * visitante veía "¡Te suscribiste correctamente!" y no quedaba NADA en ningún
 * lado. Meses de altas perdidas sin un solo error.
 *
 * La fila es la red. Se escribe SIEMPRE y antes de hablar con Brevo, así que un
 * 500 de la API, una key vencida o una extensión sin configurar cuestan la
 * sincronización pero nunca el contacto: queda acá, con el motivo escrito en
 * `sync_error`, y se puede reintentar desde el admin.
 *
 * `sync_status` es lo que hace auditable la promesa que le hicimos al visitante:
 *
 *   pending  — recién creada; todavía no se intentó.
 *   synced   — Brevo la aceptó (201 alta / 204 actualización).
 *   failed   — se intentó y falló. `sync_error` dice por qué.
 *   skipped  — no se intentó: la tienda no tiene credenciales o está apagada.
 *              NO es un error de Brevo y no se arregla reintentando: se arregla
 *              cargando la API key y la lista en Ajustes.
 *
 * ─── UNICIDAD ───────────────────────────────────────────────────────────────
 *
 * Un mail por tienda, no un mail por instancia: el mismo visitante puede
 * suscribirse en dos tiendas del mismo backend y son dos altas a dos listas de
 * Brevo distintas. El índice es parcial (`deleted_at IS NULL`) para que borrar
 * una suscripción y volver a darla de alta no choque contra el fantasma.
 */
export const NewsletterSubscription = model
  .define('newsletter_subscription', {
    id: model.id({ prefix: 'nls' }).primaryKey(),
    email: model.text(),
    /**
     * La tienda que mostró el formulario, resuelta desde la publishable key.
     *
     * `NULL` = no se pudo resolver (proyecto sin multitienda, o una key sin
     * canal). NO significa "todas": una suscripción es de UNA tienda. Se guarda
     * igual en vez de rechazarla, por el mismo motivo que la fila existe.
     */
    site_id: model.text().nullable(),
    source: model.text().nullable(),
    sync_status: model.text().default('pending'),
    sync_error: model.text().nullable(),
    synced_at: model.dateTime().nullable(),
    /** A qué lista de Brevo fue. Se guarda el valor USADO, no el configurado. */
    provider_list_id: model.text().nullable(),
    ip: model.text().nullable(),
    user_agent: model.text().nullable(),
    metadata: model.json().nullable(),
  })
  .indexes([
    { on: ['email', 'site_id'], unique: true, where: 'deleted_at IS NULL' },
    { on: ['sync_status'] },
    { on: ['site_id'] },
  ]);

export default NewsletterSubscription;
