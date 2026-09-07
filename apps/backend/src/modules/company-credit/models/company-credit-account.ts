import { model } from '@medusajs/framework/utils';
import { CompanyCreditTransaction } from './company-credit-transaction';

/**
 * Cuenta corriente de una Company mayorista (una por empresa: `company_id` único).
 *
 * - `credit_limit`: límite de crédito (entero, unidad mayor de la moneda — NO centavos).
 * - `current_balance`: saldo UTILIZADO. Arranca en 0 y sube con las compras. Solo
 *   se modifica vía movimientos (ledger); nunca a mano.
 * - crédito disponible = credit_limit − current_balance (derivado, no persistido).
 */
export const CompanyCreditAccount = model
  .define('company_credit_account', {
    id: model.id({ prefix: 'ccacc' }).primaryKey(),
    company_id: model.text().unique(),
    // 'active' | 'suspended' | 'blocked'
    status: model.text().default('active'),
    currency_code: model.text().default('ars'),
    credit_limit: model.number().default(0),
    current_balance: model.number().default(0),
    payment_terms_days: model.number().nullable(),
    notes: model.text().nullable(),
    metadata: model.json().nullable(),
    transactions: model.hasMany(() => CompanyCreditTransaction, {
      mappedBy: 'account',
    }),
  })
  .indexes([{ on: ['status'] }]);

export default CompanyCreditAccount;
