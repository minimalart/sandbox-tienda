import { MedusaError, MedusaService } from '@medusajs/framework/utils';
import {
  CancellationCase,
  RecurringLog,
  RecurringMetricsDaily,
  RecurringOffer,
  RecurringOrder,
  RecurringOrderItem,
  RecurringSetting,
  RenewalAttempt,
  RenewalCycle,
  SubscriptionAlert,
  SubscriptionCancellationReason,
  SubscriptionNotification,
  SubscriptionPlan,
  SubscriptionPlanOffer,
  SubscriptionTarget,
} from './models';
import { getRecurringOrderConfig, type RecurringOrderConfig } from './config';
import { addInterval, buildManageUrl } from './lib';
import { getKapsoSettings } from '../kapso-whatsapp/settings';
import type {
  RecurringFrequencyInterval,
  RecurringOrderStatus,
  RenewalAttemptResult,
  RenewalCycleStatus,
} from './types';

type RecurringOrderRow = {
  id: string;
  status?: string;
  frequency_interval?: string;
  frequency_count?: number;
  consecutive_failures?: number;
  next_execution_at?: Date | string | null;
};

type RenewalCycleRow = {
  id: string;
  recurring_order_id?: string;
  status?: string;
  scheduled_at?: Date | string;
  attempt_count?: number;
};

class RecurringOrderModuleService extends MedusaService({
  RecurringOrder,
  RecurringOrderItem,
  RenewalCycle,
  RenewalAttempt,
  RecurringSetting,
  RecurringOffer,
  RecurringMetricsDaily,
  RecurringLog,
  CancellationCase,
  SubscriptionPlan,
  SubscriptionPlanOffer,
  SubscriptionTarget,
  SubscriptionAlert,
  SubscriptionCancellationReason,
  SubscriptionNotification,
}) {
  /**
   * Auditoría best-effort: registra un evento del activity log de la
   * suscripción. NUNCA lanza — un log caído no puede romper la operación.
   */
  async log(input: {
    recurring_order_id: string;
    event: string;
    actor_type?: 'customer' | 'admin' | 'system';
    actor_id?: string | null;
    data?: Record<string, unknown> | null;
  }): Promise<void> {
    try {
      await this.createRecurringLogs([
        {
          recurring_order_id: input.recurring_order_id,
          event: input.event,
          actor_type: input.actor_type ?? 'system',
          actor_id: input.actor_id ?? null,
          data: (input.data ?? null) as Record<string, unknown> | null,
        },
      ]);
    } catch {
      // Silencioso a propósito.
    }
  }
  getConfig(): RecurringOrderConfig {
    return getRecurringOrderConfig();
  }

  /**
   * Upsert de la config de elegibilidad de un canal (null = default global).
   * La unicidad por canal se garantiza acá (Postgres permite N nulls en
   * índices únicos, así que no sirve un unique de DB para la fila global).
   */
  async upsertRecurringSetting(input: {
    sales_channel_id: string | null;
    scope: 'all' | 'selected';
    category_ids: string[];
    tag_values: string[];
    product_ids: string[];
    frequency_discounts?: Array<{
      interval: RecurringFrequencyInterval;
      count: number;
      percentage: number;
    }>;
    retention_discount?: { percentage: number; cycles: number } | null;
    reminder_hours?: number | null;
    expiration_hours?: number | null;
    max_attempts?: number | null;
    retry_hours?: number | null;
    max_consecutive_failures?: number | null;
    stock_policy?: string | null;
    price_change_policy?: string | null;
    price_change_threshold_pct?: number | null;
  }): Promise<any> {
    const [existing] = await this.listRecurringSettings(
      { sales_channel_id: input.sales_channel_id },
      { take: 1 },
    );
    // model.json() tipa los arrays como Record<string, unknown>: cast necesario.
    const payload = input as unknown as Record<string, unknown>;
    if (existing) {
      const [updated] = await this.updateRecurringSettings([
        { id: existing.id, ...payload },
      ]);
      return updated;
    }
    const [created] = await this.createRecurringSettings([payload]);
    return created;
  }

  /**
   * Upsert de un override de descuento por producto (canal null = global).
   * Unicidad (canal, producto) garantizada acá, igual que en settings.
   */
  async upsertRecurringOffer(input: {
    sales_channel_id: string | null;
    product_id: string;
    discounts: Array<{
      interval: RecurringFrequencyInterval;
      count: number;
      percentage: number;
    }>;
    enabled: boolean;
  }): Promise<any> {
    const [existing] = await this.listRecurringOffers(
      { sales_channel_id: input.sales_channel_id, product_id: input.product_id },
      { take: 1 },
    );
    const payload = input as unknown as Record<string, unknown>;
    if (existing) {
      const [updated] = await this.updateRecurringOffers([{ id: existing.id, ...payload }]);
      return updated;
    }
    const [created] = await this.createRecurringOffers([payload]);
    return created;
  }

  /**
   * Ciclos vencidos elegibles para ejecutar: `scheduled` o `failed` reintentable
   * (`processed_at IS NULL`; un failed con `processed_at` es terminal). Filtra
   * por suscripción `active` para que las pausadas no ocupen el batch en cada
   * corrida (sus ciclos quedan y se retoman al reanudar).
   */
  async listDueCycles(now: Date, limit: number): Promise<any[]> {
    return this.listRenewalCycles(
      {
        status: ['scheduled', 'failed', 'retrying_stock'],
        processed_at: null,
        scheduled_at: { $lte: now },
        recurring_order: { status: 'active' },
      },
      { take: limit, order: { scheduled_at: 'ASC' } },
    );
  }

  /**
   * Ciclos en `pending_payment` sin recordatorio enviado cuya generación
   * (`processed_at`) tiene más de `reminderHours`.
   */
  async listReminderDue(now: Date, config: RecurringOrderConfig, limit: number): Promise<any[]> {
    const threshold = new Date(now.getTime() - config.reminderHours * 60 * 60 * 1000);
    return this.listRenewalCycles(
      {
        status: 'pending_payment',
        reminder_sent_at: null,
        processed_at: { $lte: threshold, $ne: null },
      },
      { take: limit, order: { processed_at: 'ASC' } },
    );
  }

  /** Ciclos en `pending_payment` cuyo link ya venció. */
  async listExpired(now: Date, limit: number): Promise<any[]> {
    return this.listRenewalCycles(
      {
        status: 'pending_payment',
        expires_at: { $lte: now, $ne: null },
      },
      { take: limit, order: { expires_at: 'ASC' } },
    );
  }

  /**
   * Garantiza que la suscripción tenga un ciclo futuro agendado. Ancla el
   * cálculo a `fromDate` (el `scheduled_at` del ciclo anterior, no la fecha de
   * pago) para que la cadencia no acumule drift. Si el resultado quedara en el
   * pasado (p. ej. reanudación tardía) lo trae a `now`.
   */
  async ensureNextCycle(
    recurringOrder: RecurringOrderRow,
    fromDate: Date,
    now: Date = new Date(),
  ): Promise<any | null> {
    const open = await this.listRenewalCycles(
      {
        recurring_order_id: recurringOrder.id,
        status: [
          'scheduled',
          'processing',
          'retrying_stock',
          'awaiting_charge',
          'pending_payment',
        ],
      },
      { take: 1 },
    );
    if (open.length > 0) return null;

    const interval = (recurringOrder.frequency_interval ?? 'month') as RecurringFrequencyInterval;
    const count = recurringOrder.frequency_count ?? 1;
    let next = addInterval(fromDate, interval, count);
    if (next.getTime() < now.getTime()) next = now;

    const [cycle] = await this.createRenewalCycles([
      {
        recurring_order_id: recurringOrder.id,
        scheduled_at: next,
        status: 'scheduled' satisfies RenewalCycleStatus,
        idempotency_key: `${recurringOrder.id}:${next.toISOString()}`,
      },
    ]);
    await this.updateRecurringOrders([
      { id: recurringOrder.id, next_execution_at: next },
    ]);
    return cycle;
  }

  /** Abre un intento de ejecución para un ciclo. */
  async openAttempt(cycleId: string, now: Date = new Date()): Promise<any> {
    const [attempt] = await this.createRenewalAttempts([
      {
        renewal_cycle_id: cycleId,
        started_at: now,
        result: 'running' satisfies RenewalAttemptResult,
      },
    ]);
    return attempt;
  }

  /** Cierra el intento `running` más reciente del ciclo con su resultado. */
  async closeOpenAttempt(
    cycleId: string,
    result: RenewalAttemptResult,
    error: string | null = null,
    now: Date = new Date(),
  ): Promise<void> {
    const [open] = await this.listRenewalAttempts(
      { renewal_cycle_id: cycleId, result: 'running' },
      { take: 1, order: { started_at: 'DESC' } },
    );
    if (!open) return;
    await this.updateRenewalAttempts([
      { id: open.id, result, error, finished_at: now },
    ]);
  }

  /**
   * Cierra el ciclo como exitoso cuando la orden se generó (subscriber de
   * `order.placed`). Idempotente: si el ciclo ya está `success` no hace nada.
   * Reactiva la suscripción, resetea la racha de fallos y agenda el próximo ciclo.
   */
  async markCycleSuccess(
    cycleId: string,
    orderId: string,
    now: Date = new Date(),
  ): Promise<boolean> {
    const cycle = await this.retrieveRenewalCycle(cycleId);
    if (cycle.status === 'success') return false;

    await this.updateRenewalCycles([
      {
        id: cycleId,
        status: 'success' satisfies RenewalCycleStatus,
        generated_order_id: orderId,
        payment_status: 'paid',
        processed_at: cycle.processed_at ?? now,
      },
    ]);
    await this.closeOpenAttempt(cycleId, 'success', null, now);

    const ro = await this.retrieveRecurringOrder(cycle.recurring_order_id);
    // No pisar estados terminales/deliberados: si el cliente canceló o pausó
    // mientras el pago estaba pendiente, se respeta (la orden ya generada vale).
    const reactivate = ro.status === 'pending_payment' || ro.status === 'active';
    await this.updateRecurringOrders([
      {
        id: ro.id,
        ...(reactivate ? { status: 'active' satisfies RecurringOrderStatus } : {}),
        last_execution_at: now,
        consecutive_failures: 0,
      },
    ]);
    if (reactivate) {
      await this.ensureNextCycle(ro, new Date(cycle.scheduled_at), now);
    }
    await this.log({
      recurring_order_id: ro.id,
      event: 'cycle_success',
      data: { cycle_id: cycleId, order_id: orderId },
    });
    return true;
  }

  /**
   * Fallo TERMINAL de un ciclo (agotó reintentos de ejecución o expiró el link).
   * Suma a la racha de fallos: bajo el máximo, la suscripción sigue activa y se
   * agenda el próximo ciclo (el cliente "perdió" esta entrega); al alcanzarlo,
   * cae a `failed` y requiere reanudación manual.
   */
  async failCycleTerminal(input: {
    cycleId: string;
    error: string;
    paymentStatus?: 'expired' | null;
    config: RecurringOrderConfig;
    now?: Date;
  }): Promise<{ subscriptionFailed: boolean; recurringOrder: any }> {
    const now = input.now ?? new Date();
    const cycle = await this.retrieveRenewalCycle(input.cycleId);

    await this.updateRenewalCycles([
      {
        id: input.cycleId,
        status: 'failed' satisfies RenewalCycleStatus,
        processed_at: cycle.processed_at ?? now,
        last_error: input.error,
        ...(input.paymentStatus ? { payment_status: input.paymentStatus } : {}),
      },
    ]);
    await this.closeOpenAttempt(input.cycleId, 'failed', input.error, now);

    const ro = await this.retrieveRecurringOrder(cycle.recurring_order_id);
    if (ro.status === 'cancelled' || ro.status === 'completed') {
      return { subscriptionFailed: false, recurringOrder: ro };
    }

    const failures = (ro.consecutive_failures ?? 0) + 1;
    const subscriptionFailed = failures >= input.config.maxConsecutiveFailures;
    await this.updateRecurringOrders([
      {
        id: ro.id,
        consecutive_failures: failures,
        status: (subscriptionFailed
          ? 'failed'
          : ro.status === 'paused'
            ? 'paused'
            : 'active') satisfies RecurringOrderStatus,
        ...(subscriptionFailed ? { next_execution_at: null } : {}),
      },
    ]);
    if (!subscriptionFailed && ro.status !== 'paused') {
      await this.ensureNextCycle(ro, new Date(cycle.scheduled_at), now);
    }
    await this.log({
      recurring_order_id: ro.id,
      event: input.paymentStatus === 'expired' ? 'cycle_expired' : 'cycle_failed',
      data: {
        cycle_id: input.cycleId,
        error: input.error,
        subscription_failed: subscriptionFailed,
      },
    });
    return { subscriptionFailed, recurringOrder: ro };
  }

  /**
   * Fallo reintentable: re-agenda el ciclo unas horas más adelante sin marcarlo
   * terminal. El scheduler lo volverá a tomar.
   */
  async rescheduleFailedCycle(
    cycle: RenewalCycleRow,
    error: string,
    config: RecurringOrderConfig,
    now: Date = new Date(),
  ): Promise<void> {
    const retryAt = new Date(now.getTime() + config.retryHours * 60 * 60 * 1000);
    await this.updateRenewalCycles([
      {
        id: cycle.id,
        status: 'failed' satisfies RenewalCycleStatus,
        scheduled_at: retryAt,
        last_error: error,
      },
    ]);
    await this.closeOpenAttempt(cycle.id, 'failed', error, now);
  }

  /**
   * Reintento especial de stock. Mantiene la cadencia original y no incrementa
   * la racha financiera. Al vencer la ventana el ciclo se omite completo.
   */
  async retryOrSkipStockCycle(input: {
    cycle: RenewalCycleRow & { retry_until?: Date | string | null };
    retryHours: number;
    retryIntervalHours: number;
    error: string;
    now?: Date;
  }): Promise<'retrying_stock' | 'skipped'> {
    const now = input.now ?? new Date();
    const original = new Date(input.cycle.scheduled_at ?? now);
    const retryUntil = input.cycle.retry_until
      ? new Date(input.cycle.retry_until)
      : new Date(original.getTime() + input.retryHours * 60 * 60 * 1000);

    if (now >= retryUntil) {
      await this.skipCycle(input.cycle.id, 'stock-unavailable', { scheduleNext: true }, now);
      await this.upsertAlert({
        dedupe_key: `stock-cycle-skipped:${input.cycle.id}`,
        recurring_order_id: input.cycle.recurring_order_id ?? null,
        renewal_cycle_id: input.cycle.id,
        type: 'stock',
        severity: 'warning',
        title: 'Ciclo omitido por falta de stock',
        message: 'La canasta no recuperó stock dentro de la ventana configurada.',
        data: { retry_until: retryUntil.toISOString(), error: input.error },
      });
      if (input.cycle.recurring_order_id) {
        const ro = await this.retrieveRecurringOrder(input.cycle.recurring_order_id);
        if (ro.email) {
          await this.enqueueNotification({
            dedupe_key: `stock-skipped-email:${input.cycle.id}`,
            recurring_order_id: ro.id,
            renewal_cycle_id: input.cycle.id,
            sales_channel_id: ro.sales_channel_id,
            channel: 'email',
            recipient: ro.email,
            template: 'recurring-stock-skipped',
            data: {
              sales_channel_id: ro.sales_channel_id,
              recurring_order_id: ro.id,
              cycle_id: input.cycle.id,
              manage_url: buildManageUrl(ro.country_code),
            },
          });
        }
        if (
          getKapsoSettings().templates.recurringStockSkipped &&
          ro.phone &&
          (ro.metadata as { whatsapp_consent?: boolean } | null)?.whatsapp_consent
        ) {
          await this.enqueueNotification({
            dedupe_key: `stock-skipped-whatsapp:${input.cycle.id}`,
            recurring_order_id: ro.id,
            renewal_cycle_id: input.cycle.id,
            sales_channel_id: ro.sales_channel_id,
            channel: 'whatsapp',
            recipient: ro.phone,
            template: 'recurring-stock-skipped',
            data: {
              sales_channel_id: ro.sales_channel_id,
              recurring_order_id: ro.id,
              cycle_id: input.cycle.id,
              manage_url: buildManageUrl(ro.country_code),
            },
          });
        }
      }
      return 'skipped';
    }

    const retryAt = new Date(
      Math.min(
        retryUntil.getTime(),
        now.getTime() + input.retryIntervalHours * 60 * 60 * 1000,
      ),
    );
    await this.updateRenewalCycles([{
      id: input.cycle.id,
      status: 'retrying_stock' satisfies RenewalCycleStatus,
      scheduled_at: retryAt,
      retry_until: retryUntil,
      processed_at: null,
      cart_id: null,
      last_error: input.error,
    }]);
    await this.closeOpenAttempt(input.cycle.id, 'failed', input.error, now);
    await this.upsertAlert({
      dedupe_key: `stock-cycle:${input.cycle.id}`,
      recurring_order_id: input.cycle.recurring_order_id ?? null,
      renewal_cycle_id: input.cycle.id,
      type: 'stock',
      severity: 'warning',
      title: 'Renovación esperando stock',
      message: `Se reintentará la canasta completa a las ${retryAt.toISOString()}.`,
      data: { retry_at: retryAt.toISOString(), retry_until: retryUntil.toISOString() },
    });
    if (input.cycle.recurring_order_id) {
      const ro = await this.retrieveRecurringOrder(input.cycle.recurring_order_id);
      if (ro.email) {
        await this.enqueueNotification({
          dedupe_key: `stock-retry-email:${input.cycle.id}`,
          recurring_order_id: ro.id,
          renewal_cycle_id: input.cycle.id,
          sales_channel_id: ro.sales_channel_id,
          channel: 'email',
          recipient: ro.email,
          template: 'recurring-stock-unavailable',
          data: {
            sales_channel_id: ro.sales_channel_id,
            recurring_order_id: ro.id,
            cycle_id: input.cycle.id,
            retry_at: retryAt.toISOString(),
            retry_until: retryUntil.toISOString(),
            manage_url: buildManageUrl(ro.country_code),
          },
        });
      }
      if (
        getKapsoSettings().templates.recurringStockUnavailable &&
        ro.phone &&
        (ro.metadata as { whatsapp_consent?: boolean } | null)?.whatsapp_consent
      ) {
        await this.enqueueNotification({
          dedupe_key: `stock-retry-whatsapp:${input.cycle.id}`,
          recurring_order_id: ro.id,
          renewal_cycle_id: input.cycle.id,
          sales_channel_id: ro.sales_channel_id,
          channel: 'whatsapp',
          recipient: ro.phone,
          template: 'recurring-stock-unavailable',
          data: {
            sales_channel_id: ro.sales_channel_id,
            recurring_order_id: ro.id,
            cycle_id: input.cycle.id,
            retry_at: retryAt.toISOString(),
            manage_url: buildManageUrl(ro.country_code),
          },
        });
      }
      await this.log({
        recurring_order_id: input.cycle.recurring_order_id,
        event: 'cycle_retrying_stock',
        data: {
          cycle_id: input.cycle.id,
          retry_at: retryAt.toISOString(),
          retry_until: retryUntil.toISOString(),
        },
      });
    }
    return 'retrying_stock';
  }

  /** Upsert idempotente para incidentes y previsiones. */
  async upsertAlert(input: {
    dedupe_key: string;
    sales_channel_id?: string | null;
    recurring_order_id?: string | null;
    renewal_cycle_id?: string | null;
    variant_id?: string | null;
    type: string;
    severity?: string;
    title: string;
    message?: string | null;
    data?: Record<string, unknown> | null;
  }): Promise<any> {
    const [existing] = await this.listSubscriptionAlerts(
      { dedupe_key: input.dedupe_key },
      { take: 1 },
    );
    const payload = {
      ...input,
      severity: input.severity ?? 'warning',
      status: 'open',
      detected_at: new Date(),
      resolved_at: null,
    };
    if (existing) {
      const [updated] = await this.updateSubscriptionAlerts([{ id: existing.id, ...payload }]);
      return updated;
    }
    const [created] = await this.createSubscriptionAlerts([payload]);
    return created;
  }

  async resolveAlert(dedupeKey: string, now: Date = new Date()): Promise<void> {
    const [existing] = await this.listSubscriptionAlerts(
      { dedupe_key: dedupeKey, status: 'open' },
      { take: 1 },
    );
    if (existing) {
      await this.updateSubscriptionAlerts([{
        id: existing.id,
        status: 'resolved',
        resolved_at: now,
      }]);
    }
  }

  /** Outbox idempotente: una clave representa un mensaje lógico, no un intento. */
  async enqueueNotification(input: {
    dedupe_key: string;
    recurring_order_id?: string | null;
    renewal_cycle_id?: string | null;
    sales_channel_id?: string | null;
    channel: 'email' | 'whatsapp';
    recipient: string;
    template: string;
    data?: Record<string, unknown> | null;
  }): Promise<any> {
    const [existing] = await this.listSubscriptionNotifications(
      { dedupe_key: input.dedupe_key },
      { take: 1 },
    );
    if (existing) return existing;
    const [created] = await this.createSubscriptionNotifications([{
      ...input,
      status: 'pending',
      attempt_count: 0,
      next_attempt_at: new Date(),
    }]);
    return created;
  }

  /** Pausa la suscripción. El ciclo abierto queda agendado; el scheduler lo saltea. */
  async pauseRecurringOrder(id: string, now: Date = new Date()): Promise<any> {
    const ro = await this.retrieveRecurringOrder(id);
    if (ro.status === 'cancelled' || ro.status === 'completed') {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        'La suscripción ya está finalizada.',
      );
    }
    const [updated] = await this.updateRecurringOrders([
      { id, status: 'paused' satisfies RecurringOrderStatus, paused_at: now },
    ]);
    return updated;
  }

  /**
   * Reanuda una suscripción pausada o caída. Resetea la racha de fallos y deja
   * un ciclo ejecutable: el existente (re-agendado si se pide una fecha o si es
   * terminal-inexistente) o uno nuevo a partir de ahora.
   */
  async resumeRecurringOrder(
    id: string,
    nextExecutionAt?: Date | null,
    now: Date = new Date(),
  ): Promise<any> {
    const ro = await this.retrieveRecurringOrder(id);
    if (ro.status !== 'paused' && ro.status !== 'failed') {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        'Solo se puede reanudar una suscripción pausada o caída.',
      );
    }
    const [updated] = await this.updateRecurringOrders([
      {
        id,
        status: 'active' satisfies RecurringOrderStatus,
        paused_at: null,
        consecutive_failures: 0,
      },
    ]);

    const [open] = await this.listRenewalCycles(
      { recurring_order_id: id, status: ['scheduled', 'awaiting_authorization', 'pending_payment'] },
      { take: 1, order: { scheduled_at: 'ASC' } },
    );
    if (open) {
      if (nextExecutionAt && open.status === 'scheduled') {
        await this.updateRenewalCycles([
          { id: open.id, scheduled_at: nextExecutionAt },
        ]);
        await this.updateRecurringOrders([{ id, next_execution_at: nextExecutionAt }]);
      }
      // Un `scheduled` en el pasado se ejecuta en el próximo cron: es el
      // comportamiento deseado de "reanudar ya".
      return updated;
    }
    const scheduledAt = nextExecutionAt ?? now;
    await this.createRenewalCycles([
      {
        recurring_order_id: id,
        scheduled_at: scheduledAt,
        status: 'scheduled' satisfies RenewalCycleStatus,
      },
    ]);
    await this.updateRecurringOrders([{ id, next_execution_at: scheduledAt }]);
    return updated;
  }

  /** Cancela la suscripción (terminal) y saltea el ciclo agendado si lo hay. */
  async cancelRecurringOrder(
    id: string,
    reason: string | null = null,
    now: Date = new Date(),
  ): Promise<any> {
    const ro = await this.retrieveRecurringOrder(id);
    if (ro.status === 'cancelled') return ro;
    const [updated] = await this.updateRecurringOrders([
      {
        id,
        status: 'cancelled' satisfies RecurringOrderStatus,
        cancelled_at: now,
        next_execution_at: null,
        ...(reason
          ? { metadata: { ...(ro.metadata ?? {}), cancel_reason: reason } }
          : {}),
      },
    ]);
    const open = await this.listRenewalCycles(
      {
        recurring_order_id: id,
        status: [
          'scheduled', 'forecasted', 'quoted', 'inventory_reserved',
          'processing', 'retrying_stock', 'awaiting_authorization',
          'awaiting_charge', 'past_due', 'pending_payment',
        ],
      },
      { take: 100 },
    );
    for (const cycle of open) {
      await this.skipCycle(cycle.id, 'subscription-cancelled', { scheduleNext: false }, now);
    }
    return updated;
  }

  /** Saltea el ciclo (skip_next_cycle, cancelación, feature apagada) y agenda el próximo si corresponde. */
  async skipCycle(
    cycleId: string,
    reason: string,
    options: { scheduleNext: boolean },
    now: Date = new Date(),
  ): Promise<void> {
    const cycle = await this.retrieveRenewalCycle(cycleId);
    await this.updateRenewalCycles([
      {
        id: cycleId,
        status: 'skipped' satisfies RenewalCycleStatus,
        processed_at: now,
        last_error: null,
        metadata: { ...(cycle.metadata ?? {}), skip_reason: reason },
      },
    ]);
    await this.closeOpenAttempt(cycleId, 'skipped', reason, now);
    if (options.scheduleNext) {
      const ro = await this.retrieveRecurringOrder(cycle.recurring_order_id);
      await this.ensureNextCycle(ro, new Date(cycle.scheduled_at), now);
    }
    await this.log({
      recurring_order_id: cycle.recurring_order_id,
      event: 'cycle_skipped',
      data: { cycle_id: cycleId, reason },
    });
  }
}

export default RecurringOrderModuleService;
