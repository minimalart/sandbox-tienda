import { MedusaService, MedusaError } from '@medusajs/framework/utils';
import { CompanyCreditAccount, CompanyCreditTransaction } from './models';
import type {
  CompanyCreditAccountStatus,
  CompanyCreditTransactionType,
} from './types';

type AccountRecord = {
  id: string;
  company_id: string;
  status: string;
  currency_code: string;
  credit_limit: number;
  current_balance: number;
  payment_terms_days: number | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
};

type CreateAccountInput = {
  company_id: string;
  credit_limit: number;
  currency_code?: string;
  status?: CompanyCreditAccountStatus;
  payment_terms_days?: number | null;
  notes?: string | null;
};

type UpdateConditionsInput = {
  credit_limit?: number;
  status?: CompanyCreditAccountStatus;
  payment_terms_days?: number | null;
  notes?: string | null;
};

type ApplyTransactionInput = {
  accountId: string;
  type: CompanyCreditTransactionType;
  /** Monto del movimiento. Positivo salvo `ajuste`, que admite +/-. */
  amount: number;
  order_id?: string | null;
  created_by?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Devuelve el delta con signo que un movimiento aplica al saldo UTILIZADO.
 * - compra / nota_debito → +amount
 * - pago / nota_credito  → −amount
 * - ajuste               → el amount tal cual (permite + o −)
 */
function signedDelta(type: CompanyCreditTransactionType, amount: number): number {
  switch (type) {
    case 'compra':
    case 'nota_debito':
      return Math.abs(amount);
    case 'pago':
    case 'nota_credito':
      return -Math.abs(amount);
    case 'ajuste':
      return amount;
    default:
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Tipo de movimiento inválido: ${type}`,
      );
  }
}

class CompanyCreditModuleService extends MedusaService({
  CompanyCreditAccount,
  CompanyCreditTransaction,
}) {
  /** Cuenta corriente de una empresa (o null si no tiene). */
  async getAccountByCompany(companyId: string): Promise<AccountRecord | null> {
    const rows = await this.listCompanyCreditAccounts({ company_id: companyId });
    return (rows[0] as AccountRecord | undefined) ?? null;
  }

  /** Crédito disponible = límite − saldo utilizado (derivado, no persistido). */
  availableCredit(account: Pick<AccountRecord, 'credit_limit' | 'current_balance'>): number {
    return account.credit_limit - account.current_balance;
  }

  /** ¿Puede cargar `amount` a la cuenta? Activa + crédito suficiente. */
  canCharge(account: AccountRecord, amount: number): boolean {
    return account.status === 'active' && this.availableCredit(account) >= amount;
  }

  /** Crea la cuenta corriente (una por empresa). Falla si ya existe. */
  async createAccount(input: CreateAccountInput): Promise<AccountRecord> {
    const existing = await this.getAccountByCompany(input.company_id);
    if (existing) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        'La empresa ya tiene una cuenta corriente.',
      );
    }
    if (!Number.isFinite(input.credit_limit) || input.credit_limit < 0) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        'El límite de crédito debe ser un número mayor o igual a 0.',
      );
    }
    const created = await this.createCompanyCreditAccounts({
      company_id: input.company_id,
      credit_limit: input.credit_limit,
      currency_code: input.currency_code ?? 'ars',
      status: input.status ?? 'active',
      current_balance: 0,
      payment_terms_days: input.payment_terms_days ?? null,
      notes: input.notes ?? null,
    });
    return (Array.isArray(created) ? created[0] : created) as AccountRecord;
  }

  /**
   * Edita condiciones de la cuenta (límite, estado, días de pago, notas).
   * NUNCA toca el balance: el saldo utilizado solo se mueve vía movimientos.
   */
  async updateConditions(
    accountId: string,
    input: UpdateConditionsInput,
  ): Promise<AccountRecord> {
    const patch: Record<string, unknown> = { id: accountId };
    if (input.credit_limit !== undefined) {
      if (!Number.isFinite(input.credit_limit) || input.credit_limit < 0) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          'El límite de crédito debe ser un número mayor o igual a 0.',
        );
      }
      patch.credit_limit = input.credit_limit;
    }
    if (input.status !== undefined) patch.status = input.status;
    if (input.payment_terms_days !== undefined) {
      patch.payment_terms_days = input.payment_terms_days;
    }
    if (input.notes !== undefined) patch.notes = input.notes;

    const updated = await this.updateCompanyCreditAccounts(patch as any);
    return (Array.isArray(updated) ? updated[0] : updated) as AccountRecord;
  }

  /**
   * Aplica un movimiento al ledger (append-only) y actualiza el saldo utilizado
   * de forma atómica-ish (read-modify-write, igual que el módulo points; promover
   * a workflow con lock si hubiera escritura concurrente por empresa).
   *
   * Única fuente de verdad del balance: la usan tanto los movimientos manuales del
   * admin como la compra automática del subscriber de `order.placed`.
   */
  async applyTransaction(
    input: ApplyTransactionInput,
  ): Promise<{ transaction: any; account: AccountRecord }> {
    if (!Number.isFinite(input.amount) || input.amount === 0) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        'El monto del movimiento debe ser un número distinto de 0.',
      );
    }
    // Compras/pagos/notas exigen monto positivo; solo `ajuste` admite negativo.
    if (input.type !== 'ajuste' && input.amount < 0) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        'El monto debe ser positivo para este tipo de movimiento.',
      );
    }

    const account = (await this.retrieveCompanyCreditAccount(
      input.accountId,
    )) as AccountRecord;

    const delta = signedDelta(input.type, input.amount);
    const balanceBefore = account.current_balance;
    const balanceAfter = balanceBefore + delta;

    if (balanceAfter < 0) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        'El movimiento dejaría el saldo utilizado en negativo.',
      );
    }

    const created = await this.createCompanyCreditTransactions({
      account_id: account.id,
      company_id: account.company_id,
      type: input.type,
      amount: Math.abs(input.amount),
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      currency_code: account.currency_code,
      order_id: input.order_id ?? null,
      created_by: input.created_by ?? null,
      notes: input.notes ?? null,
      metadata: input.metadata ?? null,
    });
    const transaction = Array.isArray(created) ? created[0] : created;

    const updated = (await this.updateCompanyCreditAccounts({
      id: account.id,
      current_balance: balanceAfter,
    })) as AccountRecord;

    return { transaction, account: Array.isArray(updated) ? updated[0] : updated };
  }
}

export default CompanyCreditModuleService;
