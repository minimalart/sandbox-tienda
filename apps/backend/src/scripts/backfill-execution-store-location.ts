/**
 * M10 — Backfill OPCIONAL de delivery_execution.store_location_id.
 *
 * La migración Migration20260622180000 agrega la columna store_location_id a
 * delivery_execution, pero las ejecuciones PREVIAS quedan en NULL. Este script
 * las resuelve por la SUCURSAL de su zona: para cada ejecución con
 * store_location_id NULL y delivery_zone_id no nulo, copia el
 * store_location_id de su delivery_zone.
 *
 * NO es obligatorio: analytics y los filtros usan una estrategia híbrida
 * (columna directa OR zonas de la sucursal), así que los históricos siguen
 * apareciendo bajo su sucursal aunque la columna esté NULL. Correr este backfill
 * solo si se quiere materializar la columna directa (filtros más simples y
 * consistentes a futuro).
 *
 * Idempotente: solo toca filas con store_location_id NULL; re-ejecutable.
 *
 * Run with:
 *   dotenv -e .env -- medusa exec ./src/scripts/backfill-execution-store-location.ts
 *
 * NOTE: requiere DB alcanzable (igual que las migraciones / otros backfills).
 */
import type { ExecArgs } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

const PAGE = 1000;
const UPDATE_BATCH = 200;

export default async function backfillExecutionStoreLocation({
  container,
}: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const delivery: {
    updateDeliveryExecutions: (
      data: Array<{ id: string; store_location_id: string }>,
    ) => Promise<unknown>;
  } = container.resolve('delivery');

  logger.info('================================================');
  logger.info('M10 backfill: delivery_execution.store_location_id (por zona)...');
  logger.info('================================================');

  // 1) Mapa zona → store_location_id (una sola pasada, las zonas son pocas).
  const zoneToStore = new Map<string, string>();
  {
    let skip = 0;
    for (;;) {
      const { data: zones } = (await query.graph({
        entity: 'delivery_zone',
        fields: ['id', 'store_location_id'],
        pagination: { take: PAGE, skip },
      })) as {
        data: Array<{ id: string; store_location_id?: string | null }>;
      };
      if (zones.length === 0) break;
      for (const z of zones) {
        if (z.store_location_id) zoneToStore.set(z.id, z.store_location_id);
      }
      skip += zones.length;
      if (zones.length < PAGE) break;
    }
  }
  logger.info(`  Zonas con sucursal: ${zoneToStore.size}`);

  // 2) Ejecuciones sin store_location_id pero con zona resoluble.
  const updates: Array<{ id: string; store_location_id: string }> = [];
  let scanned = 0;
  let skip = 0;
  for (;;) {
    const { data: executions } = (await query.graph({
      entity: 'delivery_execution',
      fields: ['id', 'store_location_id', 'delivery_zone_id'],
      filters: { store_location_id: null },
      pagination: { take: PAGE, skip },
    })) as {
      data: Array<{
        id: string;
        store_location_id?: string | null;
        delivery_zone_id?: string | null;
      }>;
    };
    if (executions.length === 0) break;
    for (const e of executions) {
      scanned++;
      if (e.store_location_id) continue;
      const storeId = e.delivery_zone_id
        ? zoneToStore.get(e.delivery_zone_id)
        : undefined;
      if (storeId) updates.push({ id: e.id, store_location_id: storeId });
    }
    skip += executions.length;
    if (executions.length < PAGE) break;
  }

  logger.info(
    `  Escaneadas ${scanned} ejecuciones sin tienda; ${updates.length} resolubles por zona.`,
  );

  let updated = 0;
  for (let i = 0; i < updates.length; i += UPDATE_BATCH) {
    const batch = updates.slice(i, i + UPDATE_BATCH);
    await delivery.updateDeliveryExecutions(batch);
    updated += batch.length;
    logger.info(`  Actualizadas ${updated}/${updates.length}.`);
  }

  logger.info('================================================');
  logger.info('Backfill M10 completo.');
  logger.info(`  Ejecuciones actualizadas: ${updated}`);
  logger.info(
    '  Las no resueltas (sin zona, ej. Andreani nacional) quedan en NULL a propósito.',
  );
}
