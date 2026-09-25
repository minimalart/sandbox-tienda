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

/**
 * DESPUBLICAR: dejar de atender con el grafo, sin poner otro en su lugar.
 *
 * Es la vuelta de `publishFlowVersion`, y hasta acá no existía: la única salida de
 * `active` era que entrara OTRA versión. Un recorrido a medio terminar quedaba
 * atendiendo el único número de la tienda sin forma de sacarlo — el síntoma es que
 * el bot se come conversaciones que tendría que llevar una persona.
 *
 * El webhook ya soporta esto sin cambios: `getActiveFlow()` devuelve `null` y
 * `runFlowTurn` cede el turno sin tocar nada. Lo que faltaba era quién apagara.
 *
 * LA VERSIÓN VA A `superseded` Y NO A `draft`, aunque la pantalla diga "borrador".
 * Una versión que ya atendió clientes NO puede volver a ser editable: `saveDraft`
 * pisa el grafo del borrador que se le pida, y pisar éste dejaría la traza de esas
 * conversaciones (`node_entered` guarda `version_id`) apuntando a un dibujo que
 * nunca corrió. La ruta se encarga de dejar una COPIA en un borrador nuevo, que es
 * lo mismo que hace Restaurar y por el mismo motivo.
 *
 * Devuelve `null` cuando no había nada publicado: apretar dos veces no es un error.
 */
export async function unpublishFlowVersion(
  container: MedusaContainer,
  input: { flow_key: string; site_id: string | null },
): Promise<{ unpublished_version_id: string | null }> {
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as unknown as KnexLike;

  const result = await knex.transaction(async (trx) => {
    // El mismo `for update` que publish: dos operadores apretando a la vez —o uno
    // despublicando mientras otro publica— se serializan acá en vez de chocar.
    const current = await trx.raw(
      `select id from "whatsapp_flow_version"
       where flow_key = ?
         and coalesce(site_id, '') = coalesce(?, '')
         and status = 'active'
         and deleted_at is null
       for update`,
      [input.flow_key, input.site_id],
    );
    const id = ((current?.rows ?? [])[0] as { id?: string } | undefined)?.id ?? null;
    if (!id) return { unpublished_version_id: null };

    await trx.raw(
      `update "whatsapp_flow_version" set status = 'superseded', updated_at = now() where id = ?`,
      [id],
    );
    return { unpublished_version_id: id };
  });

  // Sin esto el bot sigue atendiendo con el grafo apagado hasta que venza el TTL —
  // que es medio minuto de conversaciones que el operador cree haber cortado.
  invalidateActiveFlows();

  return result;
}
