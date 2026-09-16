import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { MedusaContainer } from '@medusajs/framework/types';

import { invalidateActiveFlows } from './cache';

/**
 * Publicar una versión del grafo.
 *
 * Clon deliberado de `modules/recommendations/recompute/swap.ts`, y por las mismas
 * razones: el editor escribe sobre un `draft` que el bot NO lee, y recién al final
 * se mueve el puntero. Un borrador a medias nunca atiende a nadie, y si publicar
 * falla la versión anterior sigue sirviendo.
 *
 * "Una sola activa por flujo y tienda" es un invariante de BASE
 * (`UQ_whatsapp_flow_version_active`), no una convención. El `for update` de acá
 * serializa dos publicaciones simultáneas; el índice es la red de seguridad.
 */

type TrxLike = { raw: (sql: string, bindings?: unknown[]) => Promise<{ rows?: unknown[] }> };
type KnexLike = { transaction: <T>(handler: (trx: TrxLike) => Promise<T>) => Promise<T> };

export type PublishResult = {
  activated_version_id: string;
  superseded_version_id: string | null;
};

export async function publishFlowVersion(
  container: MedusaContainer,
  input: { version_id: string; flow_key: string; site_id: string | null; published_by?: string | null },
): Promise<PublishResult> {
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as unknown as KnexLike;

  const result = await knex.transaction(async (trx) => {
    // Bloquea la activa: si dos operadores publican a la vez, el segundo espera y
    // ve el estado ya cambiado en vez de chocar contra el índice único.
    const previous = await trx.raw(
      `select id from "whatsapp_flow_version"
       where flow_key = ?
         and coalesce(site_id, '') = coalesce(?, '')
         and status = 'active'
         and deleted_at is null
       for update`,
      [input.flow_key, input.site_id],
    );
    const previousId = ((previous?.rows ?? [])[0] as { id?: string } | undefined)?.id ?? null;

    // La anterior se marca ANTES: el índice único no tolera dos activas ni por un
    // instante dentro de la transacción.
    if (previousId) {
      await trx.raw(
        `update "whatsapp_flow_version" set status = 'superseded', updated_at = now() where id = ?`,
        [previousId],
      );
    }

    await trx.raw(
      `update "whatsapp_flow_version"
       set status = 'active',
           published_at = now(),
           published_by = coalesce(?, published_by),
           updated_at = now()
       where id = ?`,
      [input.published_by ?? null, input.version_id],
    );

    return { activated_version_id: input.version_id, superseded_version_id: previousId };
  });

  // Sin esto el bot seguiría atendiendo con el grafo anterior hasta que venza el
  // TTL, y el operador vería su cambio publicado sin efecto.
  invalidateActiveFlows();

  return result;
}
