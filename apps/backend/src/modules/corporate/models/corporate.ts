import { model } from '@medusajs/framework/utils';

/**
 * Organización B2B. Fuente de verdad de la empresa. El `customer_group_id` es
 * OPCIONAL (nullable): solo se vincula un customer group nativo cuando hace
 * falta pricing/promos diferenciales — no se crea uno por empresa por defecto.
 */
export const Corporate = model
  .define('corporate', {
    id: model.id({ prefix: 'corp' }).primaryKey(),
    name: model.text(),
    slug: model.text(),
    legal_name: model.text().nullable(),
    tax_id: model.text().nullable(),
    email_domain: model.text().nullable(),
    // 'pending' | 'active' | 'suspended' | 'archived'
    status: model.text().default('pending'),
    // customer_group nativo vinculado (opcional).
    customer_group_id: model.text().nullable(),
    metadata: model.json().nullable(),
    /**
     * La tienda dueña de la empresa. `NULL` = global de la instancia.
     *
     * El eje va SÓLO acá: miembros, reglas e invitaciones cuelgan de la empresa por
     * `corporate_id` y heredan su tienda de ahí. Repetirlo en las tres invitaría a
     * que una escritura se lo olvide y deje una fila contradiciendo a su empresa.
     *
     * Las empresas existentes quedan en `NULL` y se siguen viendo desde cualquier
     * tienda: esconder una cuenta B2B viva el día del deploy le cortaría el acceso
     * al comprador sin que nadie lo haya decidido.
     */
    site_id: model.text().nullable(),
  })
  .indexes([
    { on: ['slug'] },
    { on: ['status'] },
    { on: ['customer_group_id'] },
    { on: ['email_domain'] },
  ]);

export default Corporate;
