"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mercadoPagoAdapter = void 0;
const constants_1 = require("../constants");
async function mpFetch(path, accessToken) {
    const res = await fetch(`${constants_1.MP_API_BASE}${path}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`MP ${path} → HTTP ${res.status} ${body.slice(0, 200)}`);
    }
    return (await res.json());
}
/** Máximo de cuotas sin interés (installment_rate === 0) de un set de payer_costs. */
function maxInterestFree(entries) {
    let max = 0;
    for (const entry of entries) {
        for (const pc of entry.payer_costs ?? []) {
            if ((pc.installment_rate ?? 1) === 0 && (pc.installments ?? 0) > max) {
                max = pc.installments ?? 0;
            }
        }
    }
    return max;
}
/**
 * Adapter de Mercado Pago. Sincroniza SOLO lo que la API pública de MP expone
 * de forma verificable:
 *  - medios de pago  → GET /v1/payment_methods
 *  - cuotas sin interés (snapshot) → GET /v1/payment_methods/installments
 *
 * Descuentos / reintegros / promos bancarias NO tienen endpoint público de
 * lectura → se cargan manualmente (adapter `manual`).
 */
exports.mercadoPagoAdapter = {
    code: 'mercadopago',
    supportsSync: true,
    async validate(ctx) {
        if (!ctx.accessToken)
            return { ok: false, message: 'Falta MERCADOPAGO_ACCESS_TOKEN' };
        try {
            await mpFetch('/v1/payment_methods', ctx.accessToken);
            return { ok: true };
        }
        catch (e) {
            return { ok: false, message: e instanceof Error ? e.message : String(e) };
        }
    },
    async sync(ctx) {
        const started_at = new Date();
        if (!ctx.accessToken) {
            const result = {
                provider_code: 'mercadopago',
                status: 'error',
                items_synced: 0,
                message: 'Falta MERCADOPAGO_ACCESS_TOKEN',
            };
            await ctx.service.logSync({ ...result, started_at });
            return result;
        }
        try {
            const methods = await mpFetch('/v1/payment_methods', ctx.accessToken);
            let items = 0;
            for (const m of methods) {
                // Snapshot de cuotas para tarjetas con BIN de ejemplo conocido.
                let maxFree = null;
                const bin = constants_1.SAMPLE_BINS[m.id];
                if ((m.payment_type_id === 'credit_card' || m.payment_type_id === 'debit_card') && bin) {
                    try {
                        const entries = await mpFetch(`/v1/payment_methods/installments?amount=${constants_1.INSTALLMENTS_REFERENCE_AMOUNT}&payment_method_id=${encodeURIComponent(m.id)}&bin=${bin}`, ctx.accessToken);
                        maxFree = maxInterestFree(entries);
                    }
                    catch (e) {
                        ctx.logger?.warn(`[payment-benefits] installments ${m.id}: ${e instanceof Error ? e.message : String(e)}`);
                    }
                }
                await ctx.service.upsertCatalogMethod({
                    provider_code: 'mercadopago',
                    external_id: m.id,
                    name: m.name,
                    payment_type_id: m.payment_type_id ?? null,
                    status: m.status ?? null,
                    thumbnail_url: m.secure_thumbnail ?? m.thumbnail ?? null,
                    min_allowed_amount: m.min_allowed_amount ?? null,
                    max_allowed_amount: m.max_allowed_amount ?? null,
                    max_interest_free_installments: maxFree,
                    raw: m,
                });
                items += 1;
                // Beneficio de cuotas sin interés, si hay.
                if (maxFree && maxFree > 1) {
                    await ctx.service.upsertSyncedBenefit('mercadopago', `mp:installments:${m.id}`, {
                        title: `${maxFree} cuotas sin interés con ${m.name}`,
                        description: `Pagá en hasta ${maxFree} cuotas sin interés abonando con ${m.name} (Mercado Pago).`,
                        benefit_type: 'installments',
                        max_installments: maxFree,
                        interest_rate: 0,
                        conditions: { payment_method: m.id, card_brand: m.id },
                        metadata: { reference_amount: constants_1.INSTALLMENTS_REFERENCE_AMOUNT },
                    });
                    items += 1;
                }
            }
            const result = {
                provider_code: 'mercadopago',
                status: 'ok',
                items_synced: items,
                message: `Sincronizados ${methods.length} medios de pago.`,
            };
            await ctx.service.logSync({ ...result, started_at });
            return result;
        }
        catch (e) {
            const result = {
                provider_code: 'mercadopago',
                status: 'error',
                items_synced: 0,
                message: e instanceof Error ? e.message : String(e),
            };
            await ctx.service.logSync({ ...result, started_at });
            return result;
        }
    },
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVyY2Fkb3BhZ28tYWRhcHRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL3BheW1lbnQtYmVuZWZpdHMvcHJvdmlkZXJzL21lcmNhZG9wYWdvLWFkYXB0ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsNENBQXVGO0FBc0J2RixLQUFLLFVBQVUsT0FBTyxDQUFJLElBQVksRUFBRSxXQUFtQjtJQUN6RCxNQUFNLEdBQUcsR0FBRyxNQUFNLEtBQUssQ0FBQyxHQUFHLHVCQUFXLEdBQUcsSUFBSSxFQUFFLEVBQUU7UUFDL0MsT0FBTyxFQUFFLEVBQUUsYUFBYSxFQUFFLFVBQVUsV0FBVyxFQUFFLEVBQUU7S0FDcEQsQ0FBQyxDQUFDO0lBQ0gsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEVBQUUsQ0FBQztRQUNaLE1BQU0sSUFBSSxHQUFHLE1BQU0sR0FBRyxDQUFDLElBQUksRUFBRSxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUM5QyxNQUFNLElBQUksS0FBSyxDQUFDLE1BQU0sSUFBSSxXQUFXLEdBQUcsQ0FBQyxNQUFNLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQzNFLENBQUM7SUFDRCxPQUFPLENBQUMsTUFBTSxHQUFHLENBQUMsSUFBSSxFQUFFLENBQU0sQ0FBQztBQUNqQyxDQUFDO0FBRUQsc0ZBQXNGO0FBQ3RGLFNBQVMsZUFBZSxDQUFDLE9BQThCO0lBQ3JELElBQUksR0FBRyxHQUFHLENBQUMsQ0FBQztJQUNaLEtBQUssTUFBTSxLQUFLLElBQUksT0FBTyxFQUFFLENBQUM7UUFDNUIsS0FBSyxNQUFNLEVBQUUsSUFBSSxLQUFLLENBQUMsV0FBVyxJQUFJLEVBQUUsRUFBRSxDQUFDO1lBQ3pDLElBQUksQ0FBQyxFQUFFLENBQUMsZ0JBQWdCLElBQUksQ0FB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