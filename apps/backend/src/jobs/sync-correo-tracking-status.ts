/**
 * Correo Argentino — job de sincronización de estado de envíos.
 *
 * Recorre las DeliveryExecutions con `provider_type='correo_argentino'` NO
 * terminales, consulta el estado en Correo y, por cada novedad, ejecuta
 * `transition-delivery-execution` con el target de la state machine operativa.
 * Ese workflow es el ÚNICO lugar que proyecta a Medusa
 * (`createOrderShipmentWorkflow` / `markFulfillmentAsDelivered`), con
 * idempotencia sobre `shipped_at`/`delivered_at`.
 *
 * Espeja `sync-andreani-tracking-status.ts` (misma paginación con `$nin` sobre
 * los estados terminales, misma compensación de drift de offset, mismo gate de
 * horario hábil) con UNA diferencia de fondo:
 *
 * **Consulta el tracking en LOTE.** `GET /tracking` de Correo acepta un ARRAY de
 * tracking numbers, así que una página de 200 ejecuciones se resuelve con
 * `pollStatusBatch()` en 8 requests (`CORREO_TRACKING_BATCH_SIZE = 25`) en vez de
 * las 200 que haría un `pollStatus()` por envío. El job de Andreani hace una
 * llamada por envío porque su API no ofrece otra cosa.
 *
 * ⚠️⚠️ PRIMERA COSA A VERIFICAR CONTRA `apitest` CUANDO LLEGUEN LAS CREDENCIALES:
 * **cómo se pasan los tracking numbers a `GET /v1/tracking`.** Está EN DISPUTA y
 * nadie lo probó todavía — el manual los documenta como array en el CUERPO de un
 * GET, y `PaqarClient.getTracking()` los manda como query param repetido
 * (`?trackingNumbers=A&trackingNumbers=B`). Si la forma que usa el client no es
 * la que acepta el gateway, este job NO SINCRONIZA NADA: cada lote va a fallar y
 * lo único que se va a ver es un `warn` por corrida, con los envíos quedándose
 * para siempre en el estado que tenían. Verificarlo con UN tracking number real
 * antes de dar el sync por funcionando; el resto del recorrido (paginación,
 * drift, batcheo) está cubierto por tests y no depende de eso.
 *
 * La normalización NO se duplica acá: el adapter la delega en
 * `normalizeCorreoTrackingItem`, que es la única fuente de verdad del mapeo
 * `statusId` → estado interno (y la única que loguea los `statusId` sin mapear,
 * que es cómo se reconstruye la tabla que Correo no publica).
 *
 * El recorrido vive en `syncCorreoTrackingPages()`, con sus dependencias
 * INYECTADAS. El backend no tiene runner de integración: esa separación es lo que
 * permite testear el batcheo y la compensación de drift sin base de datos ni HTTP.
 */

import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import {
  DELIVERY_TERMINAL_STATUSES,
  type DeliveryExecutionStatus,
} from '../modules/delivery/types';
import type {
  DeliveryExecutionRecord,
  NormalizedStatusUpdate,
} from '../modules/delivery/providers/types';
import { CorreoArgentinoDeliveryProvider } from '../modules/delivery/providers/correo-argentino';
import { extractErrorMessage } from '../modules/correo-argentino-fulfillment/utils/errors';
import {
  getCorreoOperationSettings,
  getCorreoSettings,
} from '../modules/correo-argentino-fulfillment/settings';
import transitionDeliveryExecutionWorkflow from '../workflows/transition-delivery-execution';
import { loadLazyModule, sourceSpecifier } from '../lib/lazy-module';

/** Sólo el tipo: `typeof import()` no emite nada, así que no acopla el arranque. */
type DeliveryProviderRegistry = typeof import('../modules/delivery/providers/registry.js');

/** Ejecuciones traídas por página. Mismo criterio de memoria que Andreani. */
export const PAGE_SIZE = 200;

/** `source` del TrackingEvent que queda en el timeline de la ejecución. */
export const CORREO_SYNC_EVENT_SOURCE = 'correo-tracking-sync';

/**
 * ¿La hora cae dentro de la ventana 8–21 ART?
 *
 * Sólo la VENTANA, sin el flag: quien decide si el gate aplica es el llamador,
 * porque el flag ya no vive únicamente en `process.env` — se resuelve con
 * `app-settings` y puede venir de la base. `now` se inyecta para testear las dos
 * puntas sin depender de la hora de CI. El offset de ART es fijo (-3): Argentina
 * no tiene DST.
 */
export function withinCorreoBusinessWindow(now: Date = new Date()): boolean {
  const artHour = (now.getUTCHours() - 3 + 24) % 24;
  return artHour >= 8 && artHour <= 21;
}

/**
 * Gate de horario hábil leyendo el flag de un `env` (opt-in, igual que Andreani).
 *
 * Se conserva porque es la forma pura y testeable del gate completo. El job ya no
 * la usa: resuelve el flag con `getCorreoOperationSettings()`, que respeta la
 * precedencia base → env → default.
 */
export function inCorreoBusinessHours(
  now: Date = new Date(),
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (env.CORREO_ARGENTINO_TRACKING_BUSINESS_HOURS_ONLY !== 'true') return true;
  return withinCorreoBusinessWindow(now);
}

/** Dependencias del recorrido. Todas inyectadas: ni DB ni HTTP acá. */
export interface CorreoSyncPorts {
  /** Una página de ejecuciones de Correo NO terminales, ordenada por id ASC. */
  listOpenExecutions: (
    skip: number,
    take: number,
  ) => Promise<DeliveryExecutionRecord[]>;
  /**
   * Estado de TODAS las ejecuciones de la página en la menor cantidad de
   * llamadas posible. Devuelve `execution_id → update`; una ejecución ausente
   * significa "sin novedad".
   */
  pollBatch: (
    executions: DeliveryExecutionRecord[],
  ) => Promise<Map<string, NormalizedStatusUpdate>>;
  /** Aplica la transición (en producción, el workflow de transición). */
  transition: (input: {
    execution_id: string;
    to_status: DeliveryExecutionStatus;
    event: unknown;
  }) => Promise<void>;
  logger: Pick<Logger, 'info' | 'warn' | 'error'>;
  pageSize?: number;
}

export interface CorreoSyncStats {
  reviewed: number;
  transitioned: number;
  unchanged: number;
  errors: number;
  pages: number;
  /** Llamadas a `pollBatch`: UNA por página, no una por envío. */
  polls: number;
}

/**
 * Recorre las páginas de ejecuciones abiertas y aplica las transiciones.
 *
 * COMPENSACIÓN DE DRIFT DE OFFSET (heredada de Andreani, y sutil): la query
 * filtra con `$nin` sobre los estados terminales, así que cada ejecución que pasa
 * a `delivered`/`canceled` durante el recorrido SALE del set. Si el offset
 * avanzara siempre `+PAGE_SIZE`, las filas que se fueron correrían a las que les
 * siguen hacia atrás y se saltearían ejecuciones sin revisar. Por eso el offset
 * avanza solo por las que SIGUEN en el set (`PAGE_SIZE - leftSet`).
 */
export async function syncCorreoTrackingPages(
  ports: CorreoSyncPorts,
): Promise<CorreoSyncStats> {
  const pageSize = Math.max(Math.trunc(ports.pageSize ?? PAGE_SIZE) || 0, 1);
  const terminal = new Set<string>(DELIVERY_TERMINAL_STATUSES);

  const stats: CorreoSyncStats = {
    reviewed: 0,
    transitioned: 0,
    unchanged: 0,
    errors: 0,
    pages: 0,
    polls: 0,
  };

  let skip = 0;

  for (;;) {
    const page = await ports.listOpenExecutions(skip, pageSize);
    if (page.length === 0) break;
    stats.pages++;

    // Sin tracking number no hay nada que consultar: el envío todavía no se dio
    // de alta en Correo (el provider deja `tracking_number` en null a propósito,
    // no inventa placeholders `PENDING-*` como Andreani).
    const trackable = page.filter((execution) =>
      Boolean(execution.tracking_number?.trim()),
    );

    // Cuántas ejecuciones de ESTA página salen del set filtrado por $nin.
    let leftSet = 0;

    if (trackable.length > 0) {
      let updates: Map<string, NormalizedStatusUpdate>;
      try {
        // UNA llamada por PÁGINA. El adapter parte internamente en lotes de
        // CORREO_TRACKING_BATCH_SIZE; acá no se itera envío por envío.
        stats.polls++;
        updates = await ports.pollBatch(trackable);
      } catch (error) {
        // Ni un fallo de la consulta puede tumbar el recorrido: se cuentan como
        // errores y se sigue con la próxima página (el offset avanza igual, así
        // que no hay riesgo de loop infinito).
        stats.errors += trackable.length;
        ports.logger.warn(
          `[correo-sync] No se pudo consultar el tracking de ${trackable.length} envío(s): ${extractErrorMessage(error)}`,
        );
        updates = new Map();
      }

      for (const execution of trackable) {
        stats.reviewed++;

        const update = updates.get(execution.id);
        // Sin transición que aplicar: TN sin historial, estado no mapeable
        // (`unknown`), `preImposición` (que proyecta a null a propósito: Correo
        // todavía no tiene el paquete) o el mismo estado que ya tenía.
        if (!update?.status || update.status === execution.status) {
          stats.unchanged++;
          continue;
        }

        const target = update.status;
        if (terminal.has(target)) leftSet++;

        try {
          await ports.transition({
            execution_id: execution.id,
            to_status: target,
            event: {
              source: CORREO_SYNC_EVENT_SOURCE,
              raw_status: update.raw_status,
              events: update.events,
            },
          });

          stats.transitioned++;
          ports.logger.info(
            `[correo-sync] Ejecución ${execution.id} → ${target} (raw ${String(
              update.raw_status ?? '?',
            )})`,
          );
        } catch (error) {
          stats.errors++;
          // Si la transición se rechazó, la ejecución NO salió del set: hay que
          // deshacer el descuento del offset o la próxima página se saltearía
          // una fila.
          if (terminal.has(target)) leftSet--;
          ports.logger.warn(
            `[correo-sync] Error sincronizando la ejecución ${execution.id}: ${extractErrorMessage(error)}`,
          );
        }
      }
    }

    // Última página parcial → no hay más por traer.
    if (page.length < pageSize) break;
    skip += pageSize - leftSet;
  }

  return stats;
}

export default async function syncCorreoTrackingStatusJob(
  container: MedusaContainer,
): Promise<void> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

  // Provider no configurado: sin API key no hay a quién preguntarle.
  //
  // Se pregunta por la configuración EFECTIVA de la instancia y no por
  // `process.env`: desde la migración a `app-settings` la API key puede estar sólo
  // en la base, y con el chequeo viejo el job se salteaba en silencio para siempre.
  // Es el scope de instancia a propósito — un job no tiene tienda, y basta con que
  // ALGUIEN pueda consultar tracking para que valga la pena recorrer las
  // ejecuciones abiertas.
  if (!getCorreoSettings().apiKey) return;

  const { trackingBusinessHoursOnly } = getCorreoOperationSettings();
  if (trackingBusinessHoursOnly && !withinCorreoBusinessWindow()) {
    logger.info('[correo-sync] Fuera de horario hábil ART, salteando.');
    return;
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  // El registry se importa en DIFERIDO, no arriba del archivo. Dos motivos, los
  // dos concretos:
  //  - Importarlo arrastra el adapter de Andreani → su client → un
  //    `import axios, { AxiosInstance }` que el type-stripping de node:test no
  //    sabe borrar, y eso hace IMPOSIBLE importar este módulo desde un test.
  //    Con el import diferido, `syncCorreoTrackingPages` (que es donde vive toda
  //    la lógica riesgosa: batcheo y drift de offset) queda testeable.
  //  - Medusa carga este módulo en el boot para leer `config`. Diferir el
  //    registry saca los clients de los carriers del arranque.
  // La carga va por `loadLazyModule` y NO por `await import('…/registry.js')`:
  // ese `.js` compilaba pero NO RESOLVÍA en producción, y tiraba el job entero
  // todas las horas (`Cannot find module '…/modules/delivery/providers/registry.js'`,
  // 2026-09-18 13:00:00). El porqué está en `lib/lazy-module.ts`.
  const { getDeliveryProvider } = await loadLazyModule<DeliveryProviderRegistry>(
    'el registry de providers de delivery',
    () => require('../modules/delivery/providers/registry'),
    () => import(sourceSpecifier('../modules/delivery/providers/registry')),
  );

  // El adapter se resuelve por el registry (instancia cacheada por container).
  // El `instanceof` no es defensivo de más: `getDeliveryProvider` devuelve el
  // tipo abstracto y `pollStatusBatch` es propio de Correo — sin la guarda, un
  // registry mal armado explotaría con un TypeError opaco en producción.
  const adapter = getDeliveryProvider(
    CorreoArgentinoDeliveryProvider.identifier,
    container,
  );
  if (!(adapter instanceof CorreoArgentinoDeliveryProvider)) {
    logger.error(
      `[correo-sync] El provider registrado para '${CorreoArgentinoDeliveryProvider.identifier}' no es el adapter de Correo — se saltea la corrida.`,
    );
    return;
  }

  const stats = await syncCorreoTrackingPages({
    logger,
    listOpenExecutions: async (skip, take) => {
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
          provider_type: CorreoArgentinoDeliveryProvider.identifier,
          status: { $nin: [...DELIVERY_TERMINAL_STATUSES] },
        },
        // `order` estable: la compensación de drift asume un orden
        // determinístico entre páginas. Sin ORDER BY, Postgres puede devolver
        // las filas en otro orden al mutar el set y se saltearían ejecuciones.
        pagination: { skip, take, order: { id: 'ASC' } },
      });
      return (page ?? []) as DeliveryExecutionRecord[];
    },
    pollBatch: (executions) => adapter.pollStatusBatch(executions),
    transition: async (input) => {
      await transitionDeliveryExecutionWorkflow(container).run({ input });
    },
  });

  if (stats.reviewed === 0) {
    logger.info(
      '[correo-sync] No hay ejecuciones de Correo abiertas con envío creado.',
    );
    return;
  }

  logger.info(
    `[correo-sync] Listo — ${stats.reviewed} revisadas en ${stats.polls} consulta(s) de tracking, ` +
      `${stats.transitioned} transicionadas, ${stats.unchanged} sin cambio, ${stats.errors} errores.`,
  );
}

export const config = {
  name: 'sync-correo-tracking-status',
  schedule: process.env.CORREO_ARGENTINO_TRACKING_SYNC_SCHEDULE || '0 * * * *',
};
