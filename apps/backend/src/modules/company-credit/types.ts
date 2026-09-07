/**
 * Cuenta corriente B2B (crédito comercial). Cada Company mayorista puede tener
 * UNA cuenta corriente: una línea de crédito administrada desde el backoffice
 * cuyo saldo utilizado (`current_balance`) solo se mueve vía movimientos del
 * ledger (nunca a mano). El crédito disponible se DERIVA: credit_limit − current_balance.
 */
export const COMPANY_CREDIT_MODULE = 'company_credit';

/** Estado de la cuenta corriente. Solo `active` habilita el medio de pago. */
export type CompanyCreditAccountStatus = 'active' | 'suspended' | 'blocked';

/**
 * Tipos de movimiento. El signo sobre el saldo utilizado (`current_balance`):
 * - compra / nota_debito → +amount (aumenta el saldo utilizado)
 * - pago / nota_credito  → −amount (disminuye el saldo utilizado)
 * - ajuste               → según el signo del amount (+/-)
 */
export type CompanyCreditTransactionType =
  | 'compra'
  | 'pago'
  | 'nota_credito'
  | 'nota_debito'
  | 'ajuste';

/** Movimientos que el admin puede registrar a mano (compra es solo vía orden). */
export const MANUAL_TRANSACTION_TYPES: CompanyCreditTransactionType[] = [
  'pago',
  'nota_credito',
  'nota_debito',
  'ajuste',
];
