"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
const models_1 = require("./models");
function toDate(v) {
    if (v == null)
        return null;
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
}
class PaymentBenefitsModuleService extends (0, utils_1.MedusaService)({
    PaymentBenefit: models_1.PaymentBenefit,
    PaymentMethodCatalog: models_1.PaymentMethodCatalog,
    PaymentSyncLog: models_1.PaymentSyncLog,
}) {
    /**
     * Estado efectivo derivado de las fechas. No confía solo en el campo guardado:
     * si venció (valid_to < now) → 'expired'; si aún no empezó → 'scheduled'.
     * Respeta 'disabled' / 'draft' / 'sync_error' (no se recalculan).
     */
    computeStatus(benefit, now = new Date()) {
        if (benefit.status === 'disabled' || benefit.status === 'draft' || benefit.status === 'sync_error') {
            return benefit.status;
        }
        const from = toDate(benefit.valid_from);
        const to = toDate(benefit.valid_to);
        if (to && to.getTime() < now.getTime())
            return 'expired';
        if (from && from.getTime() > now.getTime())
            return 'scheduled';
        return 'active';
    }
    /** ¿El beneficio está visible y vigente para mostrarse al comprador? */
    isVisibleNow(benefit, now = new Date()) {
        if (benefit.hidden)
            return false;
        return this.computeStatus(benefit, now) === 'active';
    }
    /** ¿El beneficio aplica al canal dado? sin canales asignados = todos. */
    matchesSalesChannel(benefit, salesChannelId) {
        const ids = Array.isArray(benefit.sales_channel_ids) ? benefit.sales_channel_ids : [];
        if (ids.length === 0)
            return true;
        if (!salesChannelId)
            return false;
        return ids.includes(salesChannelId);
    }
    /**
     * Beneficios visibles y vigentes, opcionalmente filtrados por canal / tipo /
     * proveedor, ordenados por prioridad desc (para resolver incompatibles, PRD §14).
     */
    async listActiveBenefits(opts = {}) {
        const now = new Date();
        const filters = {};
        if (opts.benefit_type)
            filters.benefit_type = opts.benefit_type;
        if (opts.provider_code)
            filters.provider_code = opts.provider_code;
        const rows = (await this.listPaymentBenefits(filters, {
            order: { priority: 'DESC' },
            take: 500,
        }));
        return rows.filter((b) => this.isVisibleNow(b, now) && this.matchesSalesChannel(b, opts.salesChannelId));
    }
    /**
     * Beneficios aplicables a un producto: resuelve eligibility (global + los que
     * matcheen por product / collection / category / brand del producto).
     */
    async getBenefitsForProduct(productId, scope = {}) {
        const active = await this.listActiveBenefits({ salesChannelId: scope.salesChannelId });
        const categoryIds = new Set(scope.categoryIds ?? []);
        return active.filter((b) => {
            const elig = (b.eligibility ?? { scope: 'global', ids: [] });
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
    async createManualBenefit(input) {
        if (!input.title?.trim()) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, 'El título es obligatorio.');
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
        });
        return (Array.isArray(created) ? created[0] : created);
    }
    /**
     * Edita un beneficio. En beneficios read-only (sincronizados) solo se permiten
     * los campos "siempre editables" (prioridad, visibilidad, canales, notas,
     * estado). En manuales se acepta el patch completo (PRD §8/§14).
     */
    async updateBenefit(id, input) {
        const existing = (await this.retrievePaymentBenefit(id));
        const patch = { id };
        const setAlways = () => {
            if (input.priority !== undefined)
                patch.priority = input.priority;
            if (input.hidden !== undefined)
                patch.hidden = input.hidden;
            if (input.sales_channel_ids !== undefined)
                patch.sales_channel_ids = input.sales_channel_ids;
            if (input.admin_notes !== undefined)
                patch.admin_notes = input.admin_notes;
            if (input.status !== undefined)
                patch.status = input.status;
        };
        setAlways();
        if (!existing.read_only) {
            // Campos oficiales editables solo en beneficios manuales.
            const officialKeys = [
                'title', 'description', 'benefit_type', 'discount_type', 'discount_value',
                'max_installments', 'interest_rate', 'max_refund', 'minimum_amount',
                'maximum_amount', 'eligibility', 'conditions', 'provider_code',
            ];
            for (const k of officialKeys) {
                if (input[k] !== undefined)
                    patch[k] = input[k];
            }
            if (input.valid_from !== undefined)
                patch.valid_from = toDate(input.valid_from);
            if (input.valid_to !== undefined)
                patch.valid_to = toDate(input.valid_to);
        }
        const updated = await this.updatePaymentBenefits(patch);
        return (Array.isArray(updated) ? updated[0] : updated);
    }
    /** Upsert de un medio de pago del catálogo crudo (usado por los adapters). */
    async upsertCatalogMethod(input) {
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
            await this.updatePaymentMethodCatalogs({ id: existing[0].id, ...data });
        }
        else {
            await this.createPaymentMethodCatalogs(data);
        }
    }
    /**
     * Upsert de un beneficio SINCRONIZADO (read_only) por (provider_code,
     * external_id). En update preserva los campos que el admin controla
     * (hidden, priority, sales_channel_ids, admin_notes) y solo pisa los oficiales.
     */
    async upsertSyncedBenefit(provider_code, external_id, data) {
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
            await this.updatePaymentBenefits({ id: existing[0].id, ...official });
        }
        else {
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
            });
        }
    }
    /** Registra el resultado de una corrida de sync. */
    async logSync(result) {
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
    async getDashboard(where = {}) {
        const now = new Date();
        const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const all = (await this.listPaymentBenefits(where, { take: 1000 }));
        let active = 0;
        let expiringSoon = 0;
        let syncErrors = 0;
        for (const b of all) {
            const status = this.computeStatus(b, now);
            if (status === 'active' && !b.hidden)
                active += 1;
            if (status === 'sync_error')
                syncErrors += 1;
            const to = toDate(b.valid_to);
            if (status === 'active' && to && to.getTime() <= in7Days.getTime())
                expiringSoon += 1;
        }
        const logs = await this.listPaymentSyncLogs({}, { order: { finished_at: 'DESC' }, take: 1 });
        const last = logs[0] ?? null;
        return {
            total: all.length,
            active,
            expiring_soon: expiringSoon,
            sync_errors: syncErrors,
            last_sync: last,
        };
    }
}
exports.default = PaymentBenefitsModuleService;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL3BheW1lbnQtYmVuZWZpdHMvc2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLHFEQUF1RTtBQUN2RSxxQ0FJa0I7QUFvRmxCLFNBQVMsTUFBTSxDQUFDLENBQW1DO0lBQ2pELElBQUksQ0FBQyxJQUFJLElBQUk7UUFBRSxPQUFPLElBQUksQ0FBQztJQUMzQixNQUFNLENBQUMsR0FBRyxDQUFDLFlBQVksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzlDLE9BQU8sTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDOUMsQ0FBQztBQUVELE1BQU0sNEJBQTZCLFNBQVEsSUFBQSxxQkFBYSxFQUFDO0lBQ3ZELGNBQWMsRUFBZCx1QkFBYztJQUNkLG9CQUFvQixFQUFwQiw2QkFBb0I7SUFDcEIsY0FBYyxFQUFkLHVCQUFjO0NBQ2YsQ0FBQztJQUNBOzs7O09BSUc7SUFDSCxhQUFhLENBQUMsT0FBa0UsRUFBRSxHQUFHLEdBQUcsSUFBSSxJQUFJLEVBQUU7UUFDaEcsSUFBSSxPQUFPLENBQUMsTUFBTSxLQUFLLFVBQVUsSUFBSSxPQUFPLENBQUMsTUFBTSxLQUFLLE9BQU8sSUFBSSxPQUFPLENBQUMsTUFBTSxLQUFLLFlBQVksRUFBRSxDQUFDO1lBQ25HLE9BQU8sT0FBTyxDQUFDLE1BQXVCLENBQUM7UUFDekMsQ0FBQztRQUNELE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDeEMsTUFBTSxFQUFFLEdBQUcsTUFBTSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUNw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