import type { BenefitConditions, BenefitEligibility, BenefitStatus, BenefitType, PaymentProviderCode, SyncResult } from './types';
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
declare const PaymentBenefitsModuleService_base: import("@medusajs/framework/utils").MedusaServiceReturnType<import("@medusajs/framework/utils").ModelConfigurationsToConfigTemplate<{
    readonly PaymentBenefit: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        provider_code: import("@medusajs/framework/utils").TextProperty;
        external_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        title: import("@medusajs/framework/utils").TextProperty;
        description: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        benefit_type: import("@medusajs/framework/utils").TextProperty;
        discount_type: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        discount_value: import("@medusajs/framework/utils").NullableModifier<number, import("@medusajs/framework/utils").NumberProperty>;
        max_installments: import("@medusajs/framework/utils").NullableModifier<number, import("@medusajs/framework/utils").NumberProperty>;
        interest_rate: import("@medusajs/framework/utils").NullableModifier<number, import("@medusajs/framework/utils").NumberProperty>;
        max_refund: import("@medusajs/framework/utils").NullableModifier<number, import("@medusajs/framework/utils").NumberProperty>;
        minimum_amount: import("@medusajs/framework/utils").NullableModifier<number, import("@medusajs/framework/utils").NumberProperty>;
        maximum_amount: import("@medusajs/framework/utils").NullableModifier<number, import("@medusajs/framework/utils").NumberProperty>;
        source: import("@medusajs/framework/utils").TextProperty;
        read_only: import("@medusajs/framework/utils").BooleanProperty;
        status: import("@medusajs/framework/utils").TextProperty;
        priority: import("@medusajs/framework/utils").NumberProperty;
        valid_from: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
        valid_to: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
        eligibility: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        conditions: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        sales_channel_ids: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        admin_notes: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        hidden: import("@medusajs/framework/utils").BooleanProperty;
        last_synced_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
        metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
    }>, "payment_benefit">;
    readonly PaymentMethodCatalog: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        provider_code: import("@medusajs/framework/utils").TextProperty;
        external_id: import("@medusajs/framework/utils").TextProperty;
        name: import("@medusajs/framework/utils").TextProperty;
        payment_type_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        status: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        thumbnail_url: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        min_allowed_amount: import("@medusajs/framework/utils").NullableModifier<number, import("@medusajs/framework/utils").NumberProperty>;
        max_allowed_amount: import("@medusajs/framework/utils").NullableModifier<number, import("@medusajs/framework/utils").NumberProperty>;
        max_interest_free_installments: import("@medusajs/framework/utils").NullableModifier<number, import("@medusajs/framework/utils").NumberProperty>;
        raw: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        last_synced_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
        site_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    }>, "payment_method_catalog">;
    readonly PaymentSyncLog: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        provider_code: import("@medusajs/framework/utils").TextProperty;
        status: import("@medusajs/framework/utils").TextProperty;
        items_synced: import("@medusajs/framework/utils").NumberProperty;
        message: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        started_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
        finished_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
    }>, "payment_sync_log">;
}>>;
declare class PaymentBenefitsModuleService extends PaymentBenefitsModuleService_base {
    /**
     * Estado efectivo derivado de las fechas. No confía solo en el campo guardado:
     * si venció (valid_to < now) → 'expired'; si aún no empezó → 'scheduled'.
     * Respeta 'disabled' / 'draft' / 'sync_error' (no se recalculan).
     */
    computeStatus(benefit: Pick<BenefitRecord, 'status' | 'valid_from' | 'valid_to'>, now?: Date): BenefitStatus;
    /** ¿El beneficio está visible y vigente para mostrarse al comprador? */
    isVisibleNow(benefit: BenefitRecord, now?: Date): boolean;
    /** ¿El beneficio aplica al canal dado? sin canales asignados = todos. */
    matchesSalesChannel(benefit: BenefitRecord, salesChannelId?: string | null): boolean;
    /**
     * Beneficios visibles y vigentes, opcionalmente filtrados por canal / tipo /
     * proveedor, ordenados por prioridad desc (para resolver incompatibles, PRD §14).
     */
    listActiveBenefits(opts?: ListActiveOptions): Promise<BenefitRecord[]>;
    /**
     * Beneficios aplicables a un producto: resuelve eligibility (global + los que
     * matcheen por product / collection / category / brand del producto).
     */
    getBenefitsForProduct(productId: string, scope?: ProductScope): Promise<BenefitRecord[]>;
    /** Crea un beneficio manual (editable). */
    createManualBenefit(input: CreateBenefitInput): Promise<BenefitRecord>;
    /**
     * Edita un beneficio. En beneficios read-only (sincronizados) solo se permiten
     * los campos "siempre editables" (prioridad, visibilidad, canales, notas,
     * estado). En manuales se acepta el patch completo (PRD §8/§14).
     */
    updateBenefit(id: string, input: CreateBenefitInput & EditableAlwaysInput): Promise<BenefitRecord>;
    /** Upsert de un medio de pago del catálogo crudo (usado por los adapters). */
    upsertCatalogMethod(input: {
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
    }): Promise<void>;
    /**
     * Upsert de un beneficio SINCRONIZADO (read_only) por (provider_code,
     * external_id). En update preserva los campos que el admin controla
     * (hidden, priority, sales_channel_ids, admin_notes) y solo pisa los oficiales.
     */
    upsertSyncedBenefit(provider_code: PaymentProviderCode, external_id: string, data: {
        title: string;
        description?: string | null;
        benefit_type: BenefitType;
        max_installments?: number | null;
        interest_rate?: number | null;
        conditions?: BenefitConditions | null;
        metadata?: Record<string, unknown> | null;
    }): Promise<void>;
    /** Registra el resultado de una corrida de sync. */
    logSync(result: SyncResult & {
        started_at: Date;
        finished_at?: Date;
    }): Promise<void>;
    /** Métricas para el dashboard del backoffice (PRD §11). */
    /**
     * `where` acota los beneficios que entran en las cuentas. Se pasa desde la ruta con
     * el predicado de la tienda activa: sin él, el dashboard suma los beneficios de
     * TODAS las tiendas y el operador toma decisiones sobre números que no son suyos.
     */
    getDashboard(where?: Record<string, unknown>): Promise<{
        total: number;
        active: number;
        expiring_soon: number;
        sync_errors: number;
        last_sync: {
            provider_code: string;
            status: string;
            finished_at: Date | null;
        } | null;
    }>;
}
export default PaymentBenefitsModuleService;
