import { INSTALLMENTS_REFERENCE_AMOUNT, MP_API_BASE, SAMPLE_BINS } from '../constants';
import type { SyncResult } from '../types';
import type { PaymentBenefitProvider, ProviderContext } from './types';

/** Forma parcial de un medio de pago devuelto por GET /v1/payment_methods. */
type MpPaymentMethod = {
  id: string;
  name: string;
  payment_type_id?: string;
  status?: string;
  secure_thumbnail?: string;
  thumbnail?: string;
  min_allowed_amount?: number;
  max_allowed_amount?: number;
};

/** Forma parcial de GET /v1/payment_methods/installments. */
type MpInstallmentsEntry = {
  payment_method_id?: string;
  payer_costs?: Array<{ installments?: number; installment_rate?: number }>;
};

async function mpFetch<T>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(`${MP_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`MP ${path} → HTTP ${res.status} ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/** Máximo de cuotas sin interés (installment_rate === 0) de un set de payer_costs. */
function maxInterestFree(entries: MpInstallmentsEntry[]): number {
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
export const mercadoPagoAdapter: PaymentBenefitProvider = {
  code: 'mercadopago',
  supportsSync: true,

  async validate(ctx: ProviderContext) {
    if (!ctx.accessToken) return { ok: false, message: 'Falta MERCADOPAGO_ACCESS_TOKEN' };
    try {
      await mpFetch<MpPaymentMethod[]>('/v1/payment_methods', ctx.accessToken);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
  },

  async sync(ctx: ProviderContext): Promise<SyncResult> {
    const started_at = new Date();
    if (!ctx.accessToken) {
      const result: SyncResult = {
        provider_code: 'mercadopago',
        status: 'error',
        items_synced: 0,
        message: 'Falta MERCADOPAGO_ACCESS_TOKEN',
      };
      await ctx.service.logSync({ ...result, started_at });
      return result;
    }

    try {
      const methods = await mpFetch<MpPaymentMethod[]>('/v1/payment_methods', ctx.accessToken);
      let items = 0;

      for (const m of methods) {
        // Snapshot de cuotas para tarjetas con BIN de ejemplo conocido.
        let maxFree: number | null = null;
        const bin = SAMPLE_BINS[m.id];
        if ((m.payment_type_id === 'credit_card' || m.payment_type_id === 'debit_card') && bin) {
          try {
            const entries = await mpFetch<MpInstallmentsEntry[]>(
              `/v1/payment_methods/installments?amount=${INSTALLMENTS_REFERENCE_AMOUNT}&payment_method_id=${encodeURIComponent(m.id)}&bin=${bin}`,
              ctx.accessToken,
            );
            maxFree = maxInterestFree(entries);
          } catch (e) {
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
          raw: m as unknown as Record<string, unknown>,
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
            metadata: { reference_amount: INSTALLMENTS_REFERENCE_AMOUNT },
          });
          items += 1;
        }
      }

      const result: SyncResult = {
        provider_code: 'mercadopago',
        status: 'ok',
        items_synced: items,
        message: `Sincronizados ${methods.length} medios de pago.`,
      };
      await ctx.service.logSync({ ...result, started_at });
      return result;
    } catch (e) {
      const result: SyncResult = {
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
