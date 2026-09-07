import { model } from '@medusajs/framework/utils';

/**
 * Empresa mayorista (B2B). Compra en el canal Wholesale. El pricing mayorista se
 * aplica vía el customer_group vinculado (price list nativa de Medusa).
 */
export const Company = model
  .define('company', {
    id: model.id({ prefix: 'cmp' }).primaryKey(),
    name: model.text(),
    slug: model.text(),
    legal_name: model.text().nullable(),
    tax_id: model.text().nullable(),
    status: model.text().default('active'),
    // Canal Wholesale al que pertenecen las compras de la empresa.
    sales_channel_id: model.text().nullable(),
    // Lever de pricing mayorista (price list nativa targetea este grupo).
    customer_group_id: model.text().nullable(),
    // Referencia opcional a la price list de Medusa.
    price_list_id: model.text().nullable(),
    // Perfil de facturación por defecto (billing-profile module).
    default_billing_profile_id: model.text().nullable(),
    metadata: model.json().nullable(),
  })
  .indexes([
    { on: ['slug'] },
    { on: ['status'] },
    { on: ['sales_channel_id'] },
    { on: ['customer_group_id'] },
  ]);

export default Company;
