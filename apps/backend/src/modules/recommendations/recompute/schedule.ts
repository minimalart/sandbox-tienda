import type { MedusaContainer } from '@medusajs/framework/types';
import { RECOMMENDATION_ENGINE_MODULE } from '..';
import { mergeStrategyConfig } from '../config';
import type RecommendationEngineModuleService from '../service';

/**
 * Encolado de recálculos (PRD §13).
 *
 * Crea la fila `recommendation_version` en estado `building`, que es la entrada de
 * cola: el drainer la levanta después. Separar "decidir qué toca" de "ejecutarlo" es
 * lo que garantiza que NUNCA corran dos builds de la misma estrategia a la vez —
 * basta con no encolar si ya hay uno pendiente, y eso es una lectura indexada.
 */

/** Períodos por cadencia, en milisegundos. */
const PERIOD_MS: Record<string, number> = {
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
};

export type EnqueueResult = {
  enqueued: string[];
  skipped: Array<{ strategy_key: string; reason: string }>;
};

type StrategyRow = {
  id: string;
  key: string;
  kind: string;
  enabled: boolean;
  cadence: string;
  config: unknown;
  sales_channel_id: string | null;
  last_built_at: string | Date | null;
};

/**
 * Decide si una estrategia tiene que recalcularse. Función PURA.
 *
 * `manual` nunca se recalcula. Sin `last_built_at` sí: es el primer build. Si no, se
 * exige que haya pasado el período de su cadencia — con una tolerancia del 10% para
 * que un cron que dispara unos segundos antes no saltee la corrida del día.
 */
export function isDue(
  strategy: Pick<StrategyRow, 'kind' | 'cadence' | 'enabled' | 'last_built_at'>,
  now: Date,
): { due: boolean; reason?: string } {
  if (!strategy.enabled) return { due: false, reason: 'estrategia deshabilitada' };
  if (strategy.kind === 'manual') return { due: false, reason: 'las manuales no se recalculan' };
  if (strategy.cadence === 'manual') return { due: false, reason: 'cadencia manual' };

  const period = PERIOD_MS[strategy.cadence];
  if (!period) return { due: false, reason: `cadencia desconocida: ${strategy.cadence}` };

  if (!strategy.last_built_at) return { due: true };

  const last = new Date(strategy.last_built_at).getTime();
  if (!Number.isFinite(last)) return { due: true };

  const elapsed = now.getTime() - last;
  // Tolerancia del 10%: un cron horario que dispara a los 59'50" no debe saltear.
  return elapsed >= period * 0.9
    ? { due: true }
    : { due: false, reason: 'todavía no cumplió el período' };
}

/**
 * Encola las estrategias que corresponde. Idempotente: si ya hay una versión en
 * `building` o `ready` para una estrategia, no encola otra.
 */
export async function enqueueDueBuilds(
  container: MedusaContainer,
  options: { now?: Date; only_strategy_key?: string; triggered_by?: 'cron' | 'manual' | 'api' } = {},
): Promise<EnqueueResult> {
  const service = container.resolve(
    RECOMMENDATION_ENGINE_MODULE,
  ) as unknown as RecommendationEngineModuleService;

  const now = options.now ?? new Date();
  const strategies = (await service.listRecommendationStrategies(
    options.only_strategy_key ? { key: options.only_strategy_key } : {},
    { take: 200 },
  )) as unknown as StrategyRow[];

  // Una sola lectura de lo pendiente para todas las estrategias.
  const pending = (await service.listRecommendationVersions(
    { status: ['building', 'ready'] },
    { take: 500 },
  )) as unknown as Array<{ strategy_key: string }>;
  const alreadyPending = new Set(pending.map((version) => version.strategy_key));

  const enqueued: string[] = [];
  const skipped: EnqueueResult['skipped'] = [];

  for (const strategy of strategies) {
    if (alreadyPending.has(strategy.key)) {
      skipped.push({ strategy_key: strategy.key, reason: 'ya hay una corrida pendiente' });
      continue;
    }

    // Un pedido manual saltea el chequeo de período pero NO el de tipo: forzar un
    // recálculo de relaciones manuales no tiene sentido.
    if (options.triggered_by === 'manual') {
      if (strategy.kind === 'manual') {
        skipped.push({ strategy_key: strategy.key, reason: 'las manuales no se recalculan' });
        continue;
      }
    } else {
      const verdict = isDue(strategy, now);
      if (!verdict.due) {
        skipped.push({ strategy_key: strategy.key, reason: verdict.reason ?? 'no corresponde' });
        continue;
      }
    }

    await service.createRecommendationVersions({
      strategy_key: strategy.key,
      sales_channel_id: strategy.sales_channel_id,
      status: 'building',
      triggered_by: options.triggered_by ?? 'cron',
      started_at: now,
      // Config congelada: si el merchant cambia los mínimos a mitad de la corrida,
      // esa corrida sigue con los que empezó.
      config_snapshot: mergeStrategyConfig(strategy.config),
    } as never);

    enqueued.push(strategy.key);
  }

  return { enqueued, skipped };
}
