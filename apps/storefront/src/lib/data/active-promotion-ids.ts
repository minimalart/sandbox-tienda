import "server-only";

import { getMedusaAdminClient } from "@lib/data/medusa-client";
import {
  isPromotionsGateFailure,
  resolvePromotionsGate,
} from "@lib/data/promotions-gate";
import { promotionMatchesSalesChannel } from "@lib/util/promotion-channel-filter";
import { isPromotionActiveForStorefront } from "@lib/util/promotion-active";
import { unstable_cache } from "next/cache";

type AdminPromotion = {
  id: string;
  status?: string | null;
  campaign_id?: string | null;
  campaign?: {
    status?: string | null;
    is_active?: boolean | null;
    starts_at?: string | null;
    ends_at?: string | null;
    deleted_at?: string | null;
  } | null;
  rules?: Array<{
    attribute?: string | null;
    operator?: string | null;
    values?: Array<{ value?: string | null }> | null;
  }> | null;
  application_method?: {
    target_rules?: Array<{
      attribute?: string | null;
      operator?: string | null;
      values?: Array<{ value?: string | null }> | null;
    }> | null;
    buy_rules?: Array<{
      attribute?: string | null;
      operator?: string | null;
      values?: Array<{ value?: string | null }> | null;
    }> | null;
  } | null;
};

/**
 * Fetch IDs of active promotions whose sales_channel_id rule matches the given
 * channel. Cached for 5 minutes; Typesense's product data doesn't expose
 * top-level promotion rules, so we cross-reference against admin data.
 */
const getActivePromotionIdsList = unstable_cache(
  async (salesChannelId: string): Promise<string[]> => {
    const admin = getMedusaAdminClient();
    const allowed: string[] = [];
    const limit = 100;
    let offset = 0;

    // Paginate to collect every active promotion
    // (admin.list usually caps at 100 per request)
    while (true) {
      const list = (await admin.admin.promotion.list({
        fields:
          "id,status,campaign_id,*campaign,*rules,*rules.values,*application_method.target_rules,*application_method.target_rules.values,*application_method.buy_rules,*application_method.buy_rules.values",
        limit,
        offset,
      } as Parameters<typeof admin.admin.promotion.list>[0])) as {
        promotions?: AdminPromotion[];
        count?: number;
      };

      const batch = list.promotions ?? [];
      for (const promo of batch) {
        if (!isPromotionActiveForStorefront(promo)) continue;
        const normalized = {
          rules: (promo.rules ?? undefined) as Parameters<
            typeof promotionMatchesSalesChannel
          >[0]["rules"],
          application_method: promo.application_method
            ? {
                target_rules: (promo.application_method.target_rules ??
                  undefined) as Parameters<
                  typeof promotionMatchesSalesChannel
                >[0]["application_method"] extends infer AM
                  ? AM extends { target_rules?: infer T }
                    ? T
                    : never
                  : never,
                buy_rules: (promo.application_method.buy_rules ??
                  undefined) as Parameters<
                  typeof promotionMatchesSalesChannel
                >[0]["application_method"] extends infer AM
                  ? AM extends { buy_rules?: infer T }
                    ? T
                    : never
                  : never,
              }
            : undefined,
        };
        if (promotionMatchesSalesChannel(normalized, salesChannelId)) {
          allowed.push(promo.id);
        }
      }

      if (batch.length < limit) break;
      offset += batch.length;
    }

    return allowed;
  },
  ["active-promotion-ids-for-channel"],
  { revalidate: 300 },
);

export async function getActivePromotionIdsForChannel(
  salesChannelId: string,
): Promise<Set<string>> {
  const ids = await getActivePromotionIdsList(salesChannelId);
  return new Set(ids);
}

/**
 * ¿El canal tiene al menos una promoción activa? Reusa la misma lista cacheada
 * que el enriquecimiento de precios, así no agrega requests al backend.
 *
 * Fail-CLOSED: si no se puede averiguar, el acceso no se muestra. La decisión
 * vive en `resolvePromotionsGate` (módulo puro, con test); acá sólo está el I/O.
 * Antes fallaba abierto y eso era el bug de DESDEELSUR-30 — ver el comentario de
 * cabecera de `promotions-gate.ts`.
 */
export async function hasActivePromotionsForChannel(
  salesChannelId?: string | null,
): Promise<boolean> {
  // La lista sale del Admin API. Sin clave la consulta ni se intenta: el 401 no
  // agrega información y `unstable_cache` no cachea rechazos, así que se
  // repetiría en cada render.
  const hasAdminApiKey = Boolean(process.env.MEDUSA_ADMIN_API_KEY);
  let activePromotionIds: string[] | null = null;

  if (salesChannelId && hasAdminApiKey) {
    try {
      activePromotionIds = await getActivePromotionIdsList(salesChannelId);
    } catch (error) {
      console.warn(
        "[ACTIVE-PROMOTIONS] No se pudo determinar si hay promociones activas:",
        error,
      );
    }
  }

  const gate = resolvePromotionsGate({
    salesChannelId,
    hasAdminApiKey,
    activePromotionIds,
  });

  // Que el acceso desaparezca por una tienda mal configurada tiene que dejar
  // rastro: sin esto, la única señal es una card que un día deja de estar.
  if (isPromotionsGateFailure(gate.reason)) {
    console.warn(
      `[ACTIVE-PROMOTIONS] Accesos a "Promociones" ocultos (${gate.reason}) para el canal ${salesChannelId}`,
    );
  }

  return gate.accessVisible;
}
