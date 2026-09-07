import { model } from '@medusajs/framework/utils';
import { CompanyCreditAccount } from './company-credit-account';

/**
 * Movimiento del libro de cuenta corriente. Ledger APPEND-ONLY: nunca se edita
 * ni se elimina; se compensa con nuevos movimientos.
 *
 * `amount` siempre positivo (unidad mayor de la moneda). El efecto sobre el saldo
 * lo define `type` (ver types.ts). `balance_before`/`balance_after` snapshotean el
 * saldo utilizado antes y después del movimiento (auditoría).
 */
export const CompanyCreditTransaction = model
  .define('company_credit_transaction', {
    id: model.id({ prefix: 'cctxn' }).primaryKey(),
    company_id: model.text(),
    // 'compra' | 'pago' | 'nota_credito' | 'nota_debito' | 'ajuste'
    type: model.text(),
    amount: model.number(),
    balance_before: model.number(),
    balance_after: model.number(),
    currency_code: model.text().default('ars'),
    // Orden que originó el movimiento (solo compras). Nullable.
    order_id: model.text().nullable(),
    // Usuario admin que registró el movimiento manual, o 'system' en compras.
    created_by: model.text().nullable(),
    notes: model.text().nullable(),
    metadata: model.json().nullable(),
    account: model.belongsTo(() => CompanyCreditAccount, {
      mappedBy: 'transactions',
    }),
  })
  .indexes([
    { on: ['company_id'] },
    { on: ['order_id'] },
    { on: ['type'] },
  ]);

export default CompanyCreditTransaction;
