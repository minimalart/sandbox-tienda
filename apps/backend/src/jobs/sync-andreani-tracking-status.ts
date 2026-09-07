/**
 * Andreani — job de sincronización de estado de envíos (M2).
 *
 * Recorre las DeliveryExecutions con provider_type='andreani' NO terminales,
 * consulta el estado en Andreani vía el adapter (andreaniAdapter.pollStatus) y,
 * por cada update, ejecuta el workflow `transition-delivery-execution` con el
 * status target de la state machine operativa. Ese workflow es el único lugar
 * que proyecta a Medusa (createOrderShipmentWorkflow / markFulfillmentAsDelivered)
 * con idempotencia sobre shipped_at/delivered_at.
 *
 * Comportamiento observable idéntico al job legacy:
 *  - misma cadencia (ANDREANI_TRACKING_SYNC_SCHEDULE, default cada hora),
 *  - mismo business-hours gate (ANDREANI_TRACKING_BUSINESS_HOURS_ONLY, 8–21 ART),
 *  - misma idempotencia: la proyección a Medusa solo ocurre si el fulfillment
 *    aún no está shipped/delivered (decidido dentro del workflow leyendo el
 *    fulfillment ANTES de proyectar).
 *
 * Compatibilidad con datos pre-M1: las órdenes/fulfillments viejos que aún NO
 * tienen DeliveryExecution simplemente no aparecen en este recorrido (iteramos
 * por delivery_execution, no por fulfillment), así que el job no los toca ni
 * rompe. La creación del sidecar para fulfillments existentes es responsabilidad
 * del workflow create-delivery-execution / sus subscribers, no de este job.
 */

import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import {
  getAndreaniSettings,
  hasAndreaniCredentials,
} from '../modules/andreani-fulfillment/settings';
import {
  DELIVERY_TERMINAL_STATUSES,
  type DeliveryExecutionStatus,
} from '../modules/delivery/types';
import { getDeliveryProvider } from '../modules/delivery/providers/registry';
import { AndreaniDeliveryProvider } from '../modules/delivery/providers/andreani';
import type { DeliveryExecutionRecord } from '../modules/delivery/providers/types';
import transitionDeliveryExecutionWorkflow from '../workflows/transition-delivery-execution';

/**
 * `ANDREANI_TRACKING_BUSINESS_HOURS_ONLY` es `scope: 'instance'` a propósito: este
 * job recorre las ejecuciones de TODAS las tiendas en una sola pasada, así que no
 * hay forma de que respete dos horarios distintos. Se lee por el camino sincrónico
 * de `app-settings`, que para un descriptor de instancia da el valor correcto
 * (`global ?? env ?? default`).
 */
function inBusinessHours(): boolean {
  if (!getAndreaniSettings().trackingBusinessHoursOnly) return true;
  const utcHour = new Date().getUTCHours();
  const artHour = (utcHour - 3 + 24) % 24;
  return artHour >= 8 && artHour <= 21;
}

export default async function syncAndreaniTrackingStatusJob(
  container: MedusaContainer,
): Promise<void> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

  // Gate de "provider no configurado". Mira las credenciales de la INSTANCIA, que es
  // lo que puede leer sin una orden en la mano.
  //
  // LIMITACIÓN CONOCIDA: una instalación donde SÓLO las tiendas tienen credenciales
  // propias (`site_credential`) y la instancia no tiene ninguna queda con el sync
  // apagado. Es el mismo agujero que `AndreaniDeliveryProvider.pollStatus`, que
  // consulta el estado con `getAndreaniClient()` — o sea, la cuenta de la instancia —
  // sobre envíos que se dieron de alta con la cuenta de la tienda. Arreglarlo pide
  // que la `DeliveryExecution` sepa de qué tienda es, y eso vive en el módulo
  // `delivery`.
  if (!hasAndreaniCredentials(getAndreaniSettings().options)) return;
  if (!inBusinessHours()) {
    logger.info('[andreani-sync] Fuera de horario hábil ART, salteando.');
    return;
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const adapter = getDeliveryProvider(
    AndreaniDeliveryProvider.identifier,
    container,
  );

  // Tamaño de página. Procesamos y descartamos cada página en vez de
  // materializar toda la tabla en memoria (el contenedor de prod corre con 2GB
  // y este job es horario): cargar TODAS las ejecuciones Andreani de golpe era
  // una de las fuentes de OOM.
  const PAGE_SIZE = 200;

  const terminal = new Set<string>(DELIVERY_TERMINAL_STATUSES);

  let skip = 0;
  let reviewed = 0;
  let transitioned = 0;
  let unchanged = 0;
  let errors = 0;

  // Solo ejecuciones Andreani NO terminales. El filtro de estado va DENTRO de la
  // query ($nin sobre los estados terminales) para que Postgres no nos devuelva
  // las entregadas/canceladas — antes se traían todas y se filtraban en JS.
  // Las órdenes pre-M1 sin sidecar no aparecen acá (iteramos por
  // delivery_execution), así que quedan a salvo.
  for (;;) {
    const { data: page } = await query.graph({
      entity: 'delivery_execution',
      fields: [
        'id',
        'provider_type',
        'status',
        'tracking_number',
        'external_shipment_id',
        'label_url',
        'attempt_count',
        'metadata',
      ],
      filters: {
        provider_type: 'andreani',
        status: { $nin: [...DELIVERY_TERMINAL_STATUSES] },
      },
      // `order` estable: la lógica de drift de abajo (skip += PAGE_SIZE -
      // leftSet) asume un orden determinístico entre páginas. Sin ORDER BY,
      // Postgres puede devolver filas en distinto orden al mutar el set y nos
      // saltearíamos/duplicaríamos ejecuciones.
      pagination: { skip, take: PAGE_SIZE, order: { id: 'ASC' } },
    });

    const open = page as DeliveryExecutionRecord[];
    if (open.length === 0) break;

    // Cuántas ejecuciones de ESTA página pasaron a terminal: salen del set
    // filtrado por $nin, así que el offset debe avanzar SOLO por las que quedan.
    // Si avanzáramos siempre +PAGE_SIZE, las filas que se fueron correrían a las
    // que les siguen hacia atrás y nos saltearíamos ejecuciones sin revisar.
    let leftSet = 0;

    for (const execution of open) {
      reviewed++;
      try {
        const update = await adapter.pollStatus(execution);

        // Sin transición que aplicar (estado sin cambios o no mapeable).
        if (!update.status || update.status === execution.status) {
          unchanged++;
          continue;
        }

        const target = update.status as DeliveryExecutionStatus;
        if (terminal.has(target)) leftSet++;

        await transitionDeliveryExecutionWorkflow(container).run({
          input: {
            execution_id: execution.id,
            to_status: target,
            event: {
              source: 'andreani-tracking-sync',
              raw_status: update.raw_status,
              events: update.events,
            },
          },
        });

        transitioned++;
        logger.info(
          `[andreani-sync] Ejecución ${execution.id} → ${target} (raw ${String(
            update.raw_status,
          )})`,
        );
      } catch (error) {
        errors++;
        logger.warn(
          `[andreani-sync] Error sincronizando ejecución ${execution.id}: ${
            (error as Error).message
          }`,
        );
      }
    }

    // Última página parcial → no hay más por traer.
    if (open.length < PAGE_SIZE) break;
    // Avanzamos el offset solo por las filas que SIGUEN en el set filtrado
    // (las que pasaron a terminal ya no las devolverá la próxima query).
    skip += PAGE_SIZE - leftSet;
  }

  if (reviewed === 0) {
    logger.info('[andreani-sync] No hay ejecuciones Andreani abiertas.');
    return;
  }

  logger.info(
    `[andreani-sync] Listo — ${reviewed} revisadas, ${transitioned} transicionadas, ${unchanged} sin cambio, ${errors} errores.`,
  );
}

/**
 * `ANDREANI_TRACKING_SYNC_SCHEDULE` sigue siendo `envOnly` y se lee de
 * `process.env` a propósito: `job-loader.js:69-78` hornea el cron al arrancar, así
 * que un valor en base no se podría aplicar sin reiniciar. El interruptor que sí se
 * configura desde el admin es "Sincronizar sólo en horario hábil".
 */
export const config = {
  name: 'sync-andreani-tracking-status',
  schedule: process.env.ANDREANI_TRACKING_SYNC_SCHEDULE || '0 * * * *',
};
