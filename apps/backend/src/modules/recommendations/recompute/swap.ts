import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { MedusaContainer } from '@medusajs/framework/types';
import { invalidateActiveVersions } from '../serve/cache';

/**
 * Activación de una versión (PRD §12).
 *
 * Todo el diseño de versionado existe para esto: el recálculo escribe relaciones con
 * `version_id` de una versión en construcción, que el serve NO lee (filtra por la
 * versión activa). Recién al final se cambia el puntero. Consecuencias:
 *
 *  - no hay ventana de lectura a medio construir;
 *  - un build fallido no toca la versión anterior, que sigue sirviendo;
 *  - la activación es un UPDATE de dos filas, o sea sub-milisegundo.
 *
 * "Una sola versión activa por estrategia y canal" es un invariante de BASE
 * (`UQ_recommendation_version_active`), no una convención: sin él, dos builds
 * concurrentes podrían dejar dos versiones activas y el serve mezclaría relaciones de
 * ambas. El `for update` de acá serializa el swap; el índice es la red de seguridad.
 */

type KnexLike = {
  transaction: <T>(handler: (trx: TrxLike) => Promise<T>) => Promise<T>;
};

type TrxLike = {
  raw: (sql: string, bindings?: unknown[]) => Promise<{ rows?: unknown[] }>;
};

export type SwapResult = {
  activated_version_id: string;
  superseded_version_id: string | null;
};

/**
 * Marca la versión como activa y la anterior como superseded, en una transacción.
 *
 * `sales_channel_id` null significa versión global. El `coalesce` en el WHERE hace
 * que "global" sea un valor comparable y no un caso especial: sin él, `= null` nunca
 * matchearía y el swap dejaría dos activas.
 */
export async function activateVersion(
  container: MedusaContainer,
  input: { version_id: string; strategy_key: string; sales_channel_id: string | null; duration_ms?: number },
): Promise<SwapResult> {
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as unknown as KnexLike;

  const result = await knex.transaction(async (trx) => {
    // `for update` bloquea la fila activa: si dos builds de la misma estrategia
    // llegan juntos, el segundo espera y ve el estado ya cambiado.
    const previous = await trx.raw(
      `select id from "recommendation_version"
       where strategy_key = ?
         and coalesce(sales_channel_id, '') = coalesce(?, '')
         and status = 'active'
         and deleted_at is null
       for update`,
      [input.strategy_key, input.sales_channel_id],
    );
    const previousId = ((previous?.rows ?? [])[0] as { id?: string } | undefined)?.id ?? null;

    // La anterior se marca ANTES de activar la nueva: el índice único parcial no
    // tolera dos activas ni por un instante dentro de la transacción.
    if (previousId) {
      await trx.raw(
        `update "recommendation_version"
         set status = 'superseded', updated_at = now()
         where id = ?`,
        [previousId],
      );
    }

    await trx.raw(
      `update "recommendation_version"
       set status = 'active', activated_at = now(), finished_at = coalesce(finished_at, now()),
           duration_ms = coalesce(?, duration_ms), updated_at = now()
       where id = ?`,
      [input.duration_ms ?? null, input.version_id],
    );

    return { activated_version_id: input.version_id, superseded_version_id: previousId };
  });

  // El memo de versiones activas TIENE que invalidarse acá: si quedara viejo hasta el
  // TTL, el serve seguiría leyendo relaciones de una versión ya reemplazada.
  invalidateActiveVersions();

  return result;
}
