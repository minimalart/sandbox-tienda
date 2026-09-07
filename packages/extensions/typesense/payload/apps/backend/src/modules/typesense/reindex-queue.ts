import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { reindexProductsByIds } from './reindex';
import { recordFailedEventSync } from './run-sync';
import { truncateError } from './sanitize';

/**
 * Cola con debounce para los reindexados disparados por evento.
 *
 * NO es un extra: `reindexProductsByIds` reconstruye el mapa COMPLETO de
 * categorías y re-consulta TODAS las promociones activas en cada llamada. Sin
 * agrupar, un import de 5.000 productos son 5.000 barridos completos de
 * categorías + promociones — el mismo patrón que tumbó el vCPU en la auditoría
 * seo-geo. Con la cola, esa ráfaga colapsa en unos pocos flushes.
 *
 * Los ids se acumulan en un `Set` (dedupe gratis) y se vacían cuando pasan
 * `DEBOUNCE_MS` sin actividad nueva, o antes si se junta `MAX_BATCH`. Los
 * subscribers hacen `enqueueProductReindex(...)` y vuelven en el acto: el evento
 * no espera al índice.
 */

const DEBOUNCE_MS = 3_000;
/** Techo del lote: evita que una ráfaga larga postergue el flush para siempre. */
const MAX_BATCH = 500;

type QueueState = {
  pending: Set<string>;
  timer: NodeJS.Timeout | null;
  flushing: Promise<void> | null;
  container: MedusaContainer;
};

// Estado por proceso: la cola es un acelerador local, no una garantía
// distribuida. Con varios contenedores cada uno agrupa lo suyo, que es
// exactamente lo que se busca (menos barridos por contenedor).
let state: QueueState | null = null;

/**
 * Encola productos para reindexar. Devuelve en el acto (no espera el flush).
 * `source` sólo se usa para el log del fallo.
 */
export function enqueueProductReindex(
  container: MedusaContainer,
  productIds: Array<string | null | undefined>,
  source: string
): void {
  const ids = productIds.filter((id): id is string => Boolean(id));
  if (ids.length === 0) return;

  if (!state) {
    state = { pending: new Set(), timer: null, flushing: null, container };
  }
  // El container de un subscriber es un scope hijo del global; guardar el último
  // alcanza porque `resolve` de QUERY/LOGGER llega igual al registro raíz.
  state.container = container;
  for (const id of ids) state.pending.add(id);

  if (state.pending.size >= MAX_BATCH) {
    void flushNow(source);
    return;
  }

  if (state.timer) clearTimeout(state.timer);
  state.timer = setTimeout(() => void flushNow(source), DEBOUNCE_MS);
  // Un timer pendiente no debe demorar el apagado del proceso.
  state.timer.unref?.();
}

/** Vacía la cola ya mismo (lo usan el tope de lote y los tests). */
export async function flushProductReindexQueue(source = 'manual-flush'): Promise<void> {
  await flushNow(source);
}

async function flushNow(source: string): Promise<void> {
  const current = state;
  if (!current) return;
  if (current.timer) {
    clearTimeout(current.timer);
    current.timer = null;
  }
  // Serializa los flushes: dos barridos concurrentes duplicarían justo el
  // trabajo caro que esta cola existe para evitar.
  if (current.flushing) {
    await current.flushing;
    if (current.pending.size === 0) return;
  }
  if (current.pending.size === 0) return;

  const batch = [...current.pending];
  current.pending.clear();

  const run = (async () => {
    const logger = current.container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
    try {
      const { upserted, removed } = await reindexProductsByIds(current.container, batch);
      logger.info(
        `[Typesense Queue] ${source}: ${upserted} indexados / ${removed} borrados (lote de ${batch.length}).`
      );
    } catch (error) {
      logger.warn(
        `[Typesense Queue] ${source}: falló el lote de ${batch.length} productos: ${truncateError(error)}`
      );
      // Un fallo por evento sí deja fila de log: es la única forma de enterarse
      // de que el índice quedó atrás sin correr un sync manual.
      await recordFailedEventSync(current.container, {
        productIds: batch,
        error,
        source,
      });
    }
  })();

  current.flushing = run;
  try {
    await run;
  } finally {
    if (current.flushing === run) current.flushing = null;
  }

  // Lo que entró mientras corría el lote se despacha detrás.
  if (current.pending.size > 0 && !current.timer) {
    current.timer = setTimeout(() => void flushNow(source), DEBOUNCE_MS);
    current.timer.unref?.();
  }
}
