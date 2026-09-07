import type { MedusaContainer } from '@medusajs/framework/types';
import { MedusaError, Modules } from '@medusajs/framework/utils';
import { RECURRING_ORDER_MODULE } from '../modules/recurring-order';
import type RecurringOrderModuleService from '../modules/recurring-order/service';
import {
  processRenewalCycleWorkflow,
  type ProcessRenewalCycleInput,
  type ProcessRenewalCycleResult,
} from './process-renewal-cycle';

type LockingService = {
  execute<T>(
    keys: string | string[],
    job: () => Promise<T>,
    args?: { timeout?: number },
  ): Promise<T>;
};

export async function withSubscriptionLock<T>(
  container: MedusaContainer,
  key: string | string[],
  job: () => Promise<T>,
): Promise<T> {
  let locking: LockingService | null = null;
  try {
    locking = container.resolve<LockingService>(Modules.LOCKING);
  } catch {
    locking = null;
  }
  if (!locking) return await job();
  try {
    const keys = (Array.isArray(key) ? key : [key]).map((value) => `subscription:${value}`);
    return await locking.execute(keys, job, { timeout: 5 });
  } catch (error) {
    if (error instanceof Error && /timed?[ -]?out|acquire|locked/i.test(error.message)) {
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        'Esta suscripción está siendo procesada por otro worker.',
      );
    }
    throw error;
  }
}

/**
 * Única entrada al motor de renovación. El lock distribuido evita que cron,
 * webhook y acciones manuales preparen/cobren el mismo ciclo en paralelo. El
 * guard de estado y la clave idempotente de DB siguen siendo la segunda línea
 * de defensa cuando el módulo de locking no está configurado.
 */
export async function runRenewalCycleLocked(
  container: MedusaContainer,
  input: ProcessRenewalCycleInput,
): Promise<ProcessRenewalCycleResult> {
  const run = async (): Promise<ProcessRenewalCycleResult> => {
    const { result } = await processRenewalCycleWorkflow(container).run({ input });
    return result as ProcessRenewalCycleResult;
  };

  const service = container.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
  const cycle: any = await service.retrieveRenewalCycle(input.cycleId);
  return await withSubscriptionLock(
    container,
    [`order:${cycle.recurring_order_id}`, `renewal:${input.cycleId}`],
    run,
  );
}
