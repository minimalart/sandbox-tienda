import { MedusaService, MedusaError } from '@medusajs/framework/utils';
import {
  PaymentBenefit,
  PaymentMethodCatalog,
  PaymentSyncLog,
} from './models';
import type {
  BenefitConditions,
  BenefitEligibility,
  BenefitStatus,
  BenefitType,
  PaymentProviderCode,
  SyncResult,
} from './types';

export type BenefitRecord = {
  id: string;
  provider_code: string;
  external_id: string | null;
  title: string;
  description: string | null;
  benefit_type: string;
  discount_type: string | null;
  discount_value: number | null;
  max_installments: number | null;
  interest_rate: number | null;
  max_refund: number | null;
  minimum_amount: number | null;
  maximum_amount: number | null;
  source: string;
  read_only: boolean;
  status: string;
  priority: number;
  valid_from: Date | null;
  valid_to: Date | null;
  eligibility: BenefitEligibility | null;
  conditions: BenefitConditions | null;
  sales_channel_ids: string[] | null;
  admin_notes: string | null;
  hidden: boolean;
  last_synced_at: Date | null;
  metadata: Record<string, unknown> | null;
};

type CreateBenefitInput = {
  title: string;
  benefit_type: BenefitType;
  provider_code?: PaymentProviderCode;
  description?: string | null;
  discount_type?: string | null;
  discount_value?: number | null;
  max_installments?: number | null;
  interest_rate?: number | null;
  max_refund?: number | null;
  minimum_amount?: number | null;
  maximum_amount?: number | null;
  status?: BenefitStatus;
  priority?: number;
  valid_from?: Date | string | null;
  valid_to?: Date | string | null;
  eligibility?: BenefitEligibility | null;
  conditions?: BenefitConditions | null;
  sales_channel_ids?: string[] | null;
  admin_notes?: string | null;
  hidden?: boolean;
};

/** Campos que SIEMPRE se pueden editar, incluso en beneficios sincronizados. */
type EditableAlwaysInput = {
  priority?: number;
  hidden?: boolean;
  sales_channel_ids?: string[] | null;
  admin_notes?: string | null;
  status?: BenefitStatus;
};

type ProductScope = {
  salesChannelId?: string | null;
  collectionId?: string | null;
  categoryIds?: string[];
  brandId?: string | null;
};

type ListActiveOptions = {
  salesChannelId?: string | null;
  benefit_type?: BenefitType;
  provider_code?: PaymentProviderCode;
};

function toDate(v: Date | string | null | undefined): Date | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

class PaymentBenefitsModuleService extends MedusaService({
  PaymentBenefit,
  PaymentMethodCatalog,
  PaymentSyncLog,
}) {
  /**
   * Estado efectivo derivado de las fechas. No confía solo en el campo guardado:
   * si venció (valid_to < now) → 'expired'; si aún no empezó → 'scheduled'.
   * Respeta 'disabled' / 'draft' / 'sync_error' (no se recalculan).
   */
  computeStatus(benefit: Pick<BenefitRecord, 'status' | 'valid_from' | 'valid_to'>, now = new Date()): BenefitStatus {
    if (benefit.status === 'disabled' || benefit.status === 'draft' || benefit.status === 'sync_error') {
      return benefit.status as BenefitStatus;
    }
    const from = toDate(benefit.valid_from);
    const to = toDate(benefit.valid_to);
    if (to && to.getTime() < now.getTime()) return 'expired';
    if (from && from.getTime() > now.getTime()) return 'scheduled';
    return 'active';
  }

  /** ¿El beneficio está visible y vigente para mostrarse al comprador? */
  isVisibleNow(benefit: BenefitRecord, now = new Date()): boolean {
    if (benefit.hidden) return false;
    return this.computeStatus(benefit, now) === 'active';
  }

  /** ¿El beneficio aplica al canal dado? sin canales asignados = todos. */
  matchesSalesChannel(benefit: BenefitRecord, salesChannelId?: string | null): boolean {
    const ids = Array.isArray(benefit.sales_channel_ids) ? benefit.sales_channel_ids : [];
    if (ids.length === 0) return true;
    if (!salesChannelId) return false;
    return ids.includes(salesChannelId);
  }

  /**
   * Beneficios visibles y vigentes, opcionalmente filtrados por canal / tipo /
   * proveedor, ordenados por prioridad desc (para resolver incompatibles, PRD §14).
   */
  async listActiveBenefits(opts: ListActiveOptions = {}): Promise<BenefitRecord[]> {
    const now = new Date();
    const filters: Record<string, unknown> = {};
    if (opts.benefit_type) filters.benefit_type = opts.benefit_type;
    if (opts.provider_code) filters.provider_code = opts.provider_code;

    const rows = (await this.listPaymentBenefits(filters, {
      order: { priority: 'DESC' },
      take: 500,
    })) as unknown as BenefitRecord[];

    return rows.filter(
      (b) => this.isVisibleNow(b, now) && this.matchesSalesChannel(b, opts.salesChannelId),
    );
  }

  /**
   * Beneficios aplicables a un producto: resuelve eligibility (global + los que
   * matcheen por product / collection / category / brand del producto).
   */
  async getBenefitsForProduct(productId: string, scope: ProductScope = {}): Promise<BenefitRecord[]> {
    const active = await this.listActiveBenefits({ salesChannelId: scope.salesChannelId });
    const categoryIds = new Set(scope.categoryIds ?? []);

    return active.filter((b) => {
      const elig = (b.eligibility ?? { scope: 'global', ids: [] }) as BenefitEligibility;
      switch (elig.scope) {
        case 'global':
          return true;
        case 'product':
          return elig.ids.includes(productId);
        case 'collection':
          return !!scope.collectionId && elig.ids.includes(scope.collectionId);
        case 'category':
          return elig.ids.some((id) => categoryIds.has(id));
        case 'brand':
          return !!scope.brandId && elig.ids.includes(scope.brandId);
        default:
          return false;
      }
    });
  }

  /** Crea un beneficio manual (editable). */
  async createManualBenefit(input: CreateBenefitInput): Promise<BenefitRecord> {
    if (!input.title?.trim()) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, 'El título es obligatorio.');
    }
    const created = await this.createPaymentBenefits({
      provider_code: input.provider_code ?? 'manual',
      external_id: null,
      title: input.title.trim(),
      description: input.description ?? null,
      benefit_type: input.benefit_type,
      discount_type: input.discount_type ?? null,
      discount_value: input.discount_value ?? null,
      max_installments: input.max_installments ?? null,
      interest_rate: input.interest_rate ?? null,
      max_refund: input.max_refund ?? null,
      minimum_amount: input.minimum_amount ?? null,
      maximum_amount: input.maximum_amount ?? null,
      source: 'manual',
      read_only: false,
      status: input.status ?? 'active',
      priority: input.priority ?? 0,
      valid_from: toDate(input.valid_from),
      valid_to: toDate(input.valid_to),
      eligibility: input.eligibility ?? { scope: 'global', ids: [] },
      conditions: input.conditions ?? null,
      sales_channel_ids: input.sales_channel_ids ?? [],
      admin_notes: input.admin_notes ?? null,
      hidden: input.hidden ?? false,
    } as never);
    return (Array.isArray(created) ? created[0] : created) as BenefitRecord;
  }

  /**
   * Edita un beneficio. En beneficios read-only (sincronizados) solo se permiten
   * los campos "siempre editables" (prioridad, visibilidad, canales, notas,
   * estado). En manuales se acepta el patch completo (PRD §8/§14).
   */
  async updateBenefit(
    id: string,
    input: CreateBenefitInput & EditableAlwaysInput,
  ): Promise<BenefitRecord> {
    const existing = (await this.retrievePaymentBenefit(id)) as unknown as BenefitRecord;

    const patch: Record<string, unknown> = { id };
    const setAlways = () => {
      if (input.priority !== undefined) patch.priority = input.priority;
      if (input.hidden !== undefined) patch.hidden = input.hidden;
      if (input.sales_channel_ids !== undefined) patch.sales_channel_ids = input.sales_channel_ids;
      if (input.admin_notes !== undefined) patch.admin_notes = input.admin_notes;
      if (input.status !== undefined) patch.status = input.status;
    };

    setAlways();

    if (!existing.read_only) {
      // Campos oficiales editables solo en beneficios manuales.
      const officialKeys: (keyof CreateBenefitInput)[] = [
        'title', 'description', 'benefit_type', 'discount_type', 'discount_value',
        'max_installments', 'interest_rate', 'max_refund', 'minimum_amount',
        'maximum_amount', 'eligibility', 'conditions', 'provider_code',
      ];
      for (const k of officialKeys) {
        if (input[k] !== undefined) patch[k] = input[k];
      }
      if (input.valid_from !== undefined) patch.valid_from = toDate(input.valid_from);
      if (input.valid_to !== undefined) patch.valid_to = toDate(input.valid_to);
    }

    const updated = await this.updatePaymentBenefits(patch as never);
    return (Array.isArray(updated) ? updated[0] : updated) as BenefitRecord;
  }

  /** Upsert de un medio de pago del catálogo crudo (usado por los adapters). */
  async upsertCatalogMethod(input: {
    provider_code: PaymentProviderCode;
    external_id: string;
    name: string;
    payment_type_id?: string | null;
    status?: string | null;
    thumbnail_url?: string | null;
    min_allowed_amount?: number | null;
    max_allowed_amount?: number | null;
    max_interest_free_installments?: number | null;
    raw?: Record<string, unknown> | null;
  }): Promise<void> {
    const existing = await this.listPaymentMethodCatalogs({
      provider_code: input.provider_code,
      external_id: input.external_id,
    });
    const now = new Date();
    const data = {
      provider_code: input.provider_code,
      external_id: input.external_id,
      name: input.name,
      payment_type_id: input.payment_type_id ?? null,
      status: input.status ?? null,
      thumbnail_url: input.thumbnail_url ?? null,
      min_allowed_amount: input.min_allowed_amount ?? null,
      max_allowed_amount: input.max_allowed_amount ?? null,
      max_interest_free_installments: input.max_interest_free_installments ?? null,
      raw: input.raw ?? null,
      last_synced_at: now,
    };
    if (existing[0]) {
      await this.updatePaymentMethodCatalogs({ id: (existing[0] as { id: string }).id, ...data });
    } else {
      await this.createPaymentMethodCatalogs(data);
    }
  }

  /**
   * Upsert de un beneficio SINCRONIZADO (read_only) por (provider_code,
   * external_id). En update preserva los campos que el admin controla
   * (hidden, priority, sales_channel_ids, admin_notes) y solo pisa los oficiales.
   */
  async upsertSyncedBenefit(
    provider_code: PaymentProviderCode,
    external_id: string,
    data: {
      title: string;
      description?: string | null;
      benefit_type: BenefitType;
      max_installments?: number | null;
      interest_rate?: number | null;
      conditions?: BenefitConditions | null;
      metadata?: Record<string, unknown> | null;
    },
  ): Promise<void> {
    const now = new Date();
    const existing = await this.listPaymentBenefits({ provider_code, external_id });
    const official = {
      title: data.title,
      description: data.description ?? null,
      benefit_type: data.benefit_type,
      max_installments: data.max_installments ?? null,
      interest_rate: data.interest_rate ?? null,
      conditions: data.conditions ?? null,
      metadata: data.metadata ?? null,
      last_synced_at: now,
    };
    if (existing[0]) {
      await this.updatePaymentBenefits({ id: (existing[0] as { id: string }).id, ...official });
    } else {
      await this.createPaymentBenefits({
        provider_code,
        external_id,
        source: provider_code,
        read_only: true,
        status: 'active',
        priority: 0,
        hidden: false,
        sales_channel_ids: [],
        eligibility: { scope: 'global', ids: [] },
        ...official,
      } as never);
    }
  }

  /** Registra el resultado de una corrida de sync. */
  async logSync(result: SyncResult & { started_at: Date; finished_at?: Date }): Promise<void> {
    await this.createPaymentSyncLogs({
      provider_code: result.provider_code,
      status: result.status,
      items_synced: result.items_synced,
      message: result.message ?? null,
      started_at: result.started_at,
      finished_at: result.finished_at ?? new Date(),
    });
  }

  /** Métricas para el dashboard del backoffice (PRD §11). */
  /**
   * `where` acota los beneficios que entran en las cuentas. Se pasa desde la ruta con
   * el predicado de la tienda activa: sin él, el dashboard suma los beneficios de
   * TODAS las tiendas y el operador toma decisiones sobre números que no son suyos.
   */
  async getDashboard(where: Record<string, unknown> = {}): Promise<{
    total: number;
    active: number;
    expiring_soon: number;
    sync_errors: number;
    last_sync: { provider_code: string; status: string; finished_at: Date | null } | null;
  }> {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const all = (await this.listPaymentBenefits(where, { take: 1000 })) as unknown as BenefitRecord[];

    let active = 0;
    let expiringSoon = 0;
    let syncErrors = 0;
    for (const b of all) {
      const status = this.computeStatus(b, now);
      if (status === 'active' && !b.hidden) active += 1;
      if (status === 'sync_error') syncErrors += 1;
      const to = toDate(b.valid_to);
      if (status === 'active' && to && to.getTime() <= in7Days.getTime()) expiringSoon += 1;
    }

    const logs = await this.listPaymentSyncLogs({}, { order: { finished_at: 'DESC' }, take: 1 });
    const last = (logs[0] as { provider_code: string; status: string; finished_at: Date | null } | undefined) ?? null;

    return {
      total: all.length,
      active,
      expiring_soon: expiringSoon,
      sync_errors: syncErrors,
      last_sync: last,
    };
  }
}

export default PaymentBenefitsModuleService;
