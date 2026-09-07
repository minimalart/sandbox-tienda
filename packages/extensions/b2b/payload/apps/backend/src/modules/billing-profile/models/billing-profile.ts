import { model } from '@medusajs/framework/utils';

/**
 * Perfil de facturación reutilizable de un customer. Para Factura A los campos
 * fiscales son obligatorios (se validan en la capa de API). Un customer puede
 * tener varios; solo uno con is_default=true.
 */
export const BillingProfile = model
  .define('billing_profile', {
    id: model.id({ prefix: 'bp' }).primaryKey(),
    customer_id: model.text(),
    label: model.text(),
    // 'final_consumer' | 'invoice_a'
    invoice_type: model.text().default('invoice_a'),
    // 'responsable_inscripto' | 'monotributo' | 'exento' | 'consumidor_final'
    tax_condition: model.text(),
    // 'CUIT' | 'DNI'
    document_type: model.text().default('CUIT'),
    document_number: model.text(),
    legal_name: model.text(),
    billing_email: model.text(),
    billing_phone: model.text().nullable(),
    address_line_1: model.text(),
    address_line_2: model.text().nullable(),
    city: model.text(),
    province: model.text(),
    postal_code: model.text(),
    country_code: model.text().default('ar'),
    is_default: model.boolean().default(false),
    metadata: model.json().nullable(),
  })
  .indexes([{ on: ['customer_id'] }, { on: ['is_default'] }]);

export default BillingProfile;
