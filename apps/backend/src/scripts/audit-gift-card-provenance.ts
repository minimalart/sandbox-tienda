import type { ExecArgs, Logger } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

/**
 * Reporte read-only: QUIÉN emitió cada gift card de orden.
 *
 * Por qué existe, y por qué no alcanza `gift-cards:audit`: ese script agrupa por
 * `(reference_id, line_item_id)` y reporta los grupos con MÁS DE UNA card, o sea
 * que solo ve doble emisión. El daño principal no es ese. Si el subscriber
 * `order.placed` de `@medusajs/loyalty-plugin` emite una card y la orden nunca se
 * paga, nuestro emisor (`src/modules/gift-card-experience/process-order.ts`) nunca
 * corre: queda EXACTAMENTE UNA card, el audit de duplicados reporta limpio, y sin
 * embargo se regaló valor monetario. Un `0 duplicados` no descarta nada.
 *
 * Por qué el subscriber del plugin puede estar vivo: el patch que lo neutraliza va
 * por `pnpm.patchedDependencies`, y DigitalOcean buildea `apps/backend` con
 * `npm ci`, que no tiene mecanismo de patches y nunca lee el manifest de la raíz.
 * El patch protege local/dev, NO producción.
 *
 * Por qué la procedencia es inequívoca: solo dos caminos escriben
 * `reference = 'order'` CON `line_item_id`, y taggean el metadata distinto —
 *   - el nuestro pone `metadata.idempotency_key = gift-card:<order>:<item>:<unit>`
 *   - el del plugin pone `metadata = {}`
 * Los otros caminos del proyecto no usan `reference = 'order'`:
 * `redeem-reward.ts` usa `loyalty_reward` y la tool de IA no setea reference.
 *
 * Correr con:
 *   cd apps/backend && pnpm gift-cards:provenance
 */
export default async function auditGiftCardProvenance({ container }: ExecArgs): Promise<void> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const knex = container.resolve<any>(ContainerRegistrationKeys.PG_CONNECTION);
  const tag = '[gift-card-provenance]';

  const [totals] = await knex('loyalty_gift_card')
    .select(knex.raw('COUNT(*)::int AS total'))
    .select(knex.raw("COUNT(*) FILTER (WHERE metadata->>'idempotency_key' IS NOT NULL)::int AS ours"))
    .select(knex.raw("COUNT(*) FILTER (WHERE metadata->>'idempotency_key' IS NULL)::int AS plugin"))
    .select(knex.raw('MIN(created_at) AS first_at'))
    .select(knex.raw('MAX(created_at) AS last_at'))
    .where({ reference: 'order' })
    .whereNotNull('line_item_id')
    .whereNull('deleted_at');

  const iso = (value: unknown): string =>
    value instanceof Date ? value.toISOString() : String(value ?? '-');

  if (totals.total === 0) {
    logger.info(
      `${tag} no hay NINGUNA card de orden. El flujo todavía no tuvo tráfico acá, así que un ` +
        `"0 duplicados" no prueba nada: la exposición sigue abierta para la próxima orden con gift card.`
    );
    return;
  }

  logger.info(
    `${tag} ${totals.total} card(s) de orden: ${totals.ours} nuestras (con idempotency_key), ` +
      `${totals.plugin} del subscriber del plugin (metadata vacío). ` +
      `Primera ${iso(totals.first_at)}, última ${iso(totals.last_at)}.`
  );

  if (totals.plugin === 0) {
    logger.info(
      `${tag} ninguna card del plugin. Su subscriber order.placed no produjo valor monetario acá ` +
        `pese a que el patch no está aplicado en producción.`
    );
    return;
  }

  // Cada una se creó en order.placed, ANTES de capturar el pago. Hay que cruzarlas
  // a mano contra el estado de pago de su orden: una card sobre una orden no pagada
  // o cancelada es valor regalado.
  const cards = await knex('loyalty_gift_card')
    .select(['id', 'reference_id', 'line_item_id', 'value', 'currency_code', 'created_at'])
    .where({ reference: 'order' })
    .whereNotNull('line_item_id')
    .whereNull('deleted_at')
    .whereRaw("metadata->>'idempotency_key' IS NULL")
    .orderBy('created_at', 'desc')
    .limit(200);

  logger.warn(
    `${tag} ${totals.plugin} card(s) emitidas por el plugin en order.placed, o sea ANTES de la ` +
      `captura del pago. Se listan hasta 200, más nuevas primero. Cruzar cada orden contra su ` +
      `estado de pago: una card sobre orden no pagada o cancelada es valor regalado.`
  );
  for (const card of cards) {
    logger.warn(
      `${tag} card=${card.id} order=${card.reference_id} line_item=${card.line_item_id} ` +
        `value=${card.value} ${card.currency_code} created_at=${iso(card.created_at)}`
    );
  }
  if (totals.plugin > cards.length) {
    logger.warn(`${tag} (hay ${totals.plugin - cards.length} más que no se listaron por el límite de 200)`);
  }
}
