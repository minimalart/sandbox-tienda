import { MedusaService } from '@medusajs/framework/utils';
import { AbandonedCart, AbandonedCartNotification } from './models';
import {
  getAbandonedCartConfig,
  nextStepFor,
  type AbandonedCartConfig,
  type AbandonedCartStep,
} from './config';
import {
  isContactable,
  nextEligibleAfter,
  shapeMetrics,
  type AbandonedCartMetrics,
  type MetricsAggregateRow,
} from './lib';
import type {
  AbandonedCartChannel,
  AbandonedCartNotificationStatus,
  AbandonedCartStatus,
} from './types';

/** Datos en vivo de un carrito, ya normalizados por el job antes del upsert. */
export type AbandonedCartSnapshot = {
  cart_id: string;
  email: string | null;
  phone: string | null;
  customer_id: string | null;
  sales_channel_id: string | null;
  cart_total: number | null;
  currency_code: string | null;
  /** `updated_at` del carrito core: define la inactividad. */
  last_activity_at: Date;
};

const HOUR_MS = 60 * 60 * 1000;

class AbandonedCartModuleService extends MedusaService({
  AbandonedCart,
  AbandonedCartNotification,
}) {
  getConfig(): AbandonedCartConfig {
    return getAbandonedCartConfig();
  }

  /**
   * Crea o actualiza el tracking de un carrito. Nunca reabre un carrito ya
   * `recovered`/`cancelled`. En altas nuevas, `next_eligible_at` = actividad +
   * primer paso; en existentes, refresca contacto/valor/actividad y reprograma la
   * secuencia cuando hace falta (ver abajo).
   */
  async upsertFromSnapshot(
    snapshot: AbandonedCartSnapshot,
    config: AbandonedCartConfig,
  ): Promise<{ record: any; created: boolean }> {
    const existing = (
      await this.listAbandonedCarts({ cart_id: snapshot.cart_id })
    )[0];

    if (existing) {
      if (existing.status === 'recovered' || existing.status === 'cancelled') {
        return { record: existing, created: false };
      }

      const previousActivity = existing.last_activity_at
        ? new Date(existing.last_activity_at)
        : null;
      // El cliente volvió a tocar el carrito: el reloj de inactividad se reinicia.
      const revived = previousActivity
        ? snapshot.last_activity_at.getTime() > previousActivity.getTime()
        : true;
      // Se trackea sin contacto y el contacto apareció después (el cliente cargó
      // el email en el checkout): hay que volver a programarlo.
      const gainedContact =
        !isContactable(existing) &&
        isContactable(snapshot) &&
        existing.next_eligible_at == null;

      const nextEligible =
        revived || gainedContact
          ? nextEligibleAfter(
              snapshot.last_activity_at,
              existing.last_step_sent ?? 0,
              config,
            )
          : existing.next_eligible_at;

      const [updated] = await this.updateAbandonedCarts([
        {
          id: existing.id,
          email: snapshot.email,
          phone: snapshot.phone,
          customer_id: snapshot.customer_id,
          sales_channel_id: snapshot.sales_channel_id,
          cart_total: snapshot.cart_total,
          currency_code: snapshot.currency_code,
          last_activity_at: snapshot.last_activity_at,
          next_eligible_at: nextEligible,
        },
      ]);
      return { record: updated, created: false };
    }

    const nextEligible = nextEligibleAfter(snapshot.last_activity_at, 0, config);
    const [created] = await this.createAbandonedCarts([
      {
        cart_id: snapshot.cart_id,
        email: snapshot.email,
        phone: snapshot.phone,
        customer_id: snapshot.customer_id,
        sales_channel_id: snapshot.sales_channel_id,
        cart_total: snapshot.cart_total,
        currency_code: snapshot.currency_code,
        status: 'pending' satisfies AbandonedCartStatus,
        last_step_sent: 0,
        next_eligible_at: nextEligible,
        last_activity_at: snapshot.last_activity_at,
      },
    ]);
    return { record: created, created: true };
  }

  /** Tracking vencido para el próximo paso (candidatos a notificar). */
  async listDue(now: Date, limit: number): Promise<any[]> {
    return this.listAbandonedCarts(
      {
        status: ['pending', 'notified'],
        next_eligible_at: { $lte: now, $ne: null },
      },
      { take: limit, order: { next_eligible_at: 'ASC' } },
    );
  }

  /** Horas de inactividad de un tracking respecto de `now`. */
  idleHoursFor(record: { last_activity_at?: Date | string | null }, now: Date): number {
    const last = record.last_activity_at
      ? new Date(record.last_activity_at)
      : now;
    return (now.getTime() - last.getTime()) / HOUR_MS;
  }

  /** El paso que corresponde enviar ahora para un tracking, o null. */
  resolveNextStep(
    record: { last_step_sent?: number | null; last_activity_at?: Date | string | null },
    config: AbandonedCartConfig,
    now: Date,
  ): AbandonedCartStep | null {
    return nextStepFor(
      config,
      record.last_step_sent ?? 0,
      this.idleHoursFor(record, now),
    );
  }

  /**
   * Registra el resultado de un envío (idempotente por paso+canal), avanza
   * `last_step_sent` cuando el paso se completó y recalcula `next_eligible_at`
   * hacia el siguiente paso (o null si no hay más).
   */
  async recordStepResult(input: {
    abandonedCartId: string;
    step: number;
    results: Array<{
      channel: AbandonedCartChannel;
      template: string | null;
      recipient: string | null;
      status: AbandonedCartNotificationStatus;
      error?: string | null;
    }>;
    config: AbandonedCartConfig;
    now: Date;
  }): Promise<void> {
    const { abandonedCartId, step, results, config, now } = input;

    for (const r of results) {
      const dup = (
        await this.listAbandonedCartNotifications({
          abandoned_cart_id: abandonedCartId,
          step,
          channel: r.channel,
        })
      )[0];
      if (dup) continue;
      await this.createAbandonedCartNotifications([
        {
          abandoned_cart_id: abandonedCartId,
          step,
          channel: r.channel,
          template: r.template,
          recipient: r.recipient,
          status: r.status,
          error: r.error ?? null,
          sent_at: now,
        },
      ]);
    }

    const record = await this.retrieveAbandonedCart(abandonedCartId);
    const last = new Date(record.last_activity_at ?? now);
    const nextEligible = nextEligibleAfter(last, step, config);

    // `notified` solo si algo SALIÓ de verdad. Marcarlo incondicionalmente hacía
    // que la métrica "Notificados" contara carritos cuyo envío se saltó o falló
    // (ej. paso sin destinatario), inflando el número con contactos inexistentes.
    const sent = results.some((r) => r.status === 'sent');

    await this.updateAbandonedCarts([
      {
        id: abandonedCartId,
        // Se avanza el paso igual que si hubiera salido: si no, el barrido
        // reintenta el mismo paso cada corrida para siempre.
        last_step_sent: step,
        ...(sent ? { status: 'notified' satisfies AbandonedCartStatus } : {}),
        next_eligible_at: nextEligible,
      },
    ]);
  }

  /**
   * Saca un tracking de la cola de notificación sin cerrarlo: sigue contando en
   * las métricas de abandono, pero deja de ser `due`. Se usa cuando no hay forma
   * de contactar al cliente; si más adelante aparece un email o teléfono,
   * `upsertFromSnapshot` lo reprograma.
   */
  async deferUntilContactable(abandonedCartId: string): Promise<void> {
    await this.updateAbandonedCarts([
      { id: abandonedCartId, next_eligible_at: null },
    ]);
  }

  /**
   * Métricas agregadas del tracking, opcionalmente acotadas a un canal de venta.
   *
   * Agrega en SQL a propósito: la versión anterior traía hasta 10.000 filas y las
   * reducía en memoria, así que pasada esa marca las métricas no eran lentas sino
   * DIRECTAMENTE FALSAS, sin ningún aviso. Ahora la cardinalidad del resultado es
   * (estados × monedas × canales × contactable), no la cantidad de carritos.
   *
   * Usa knex crudo porque `MedusaService` no expone agregaciones; mismo escape
   * hatch que `modules/vimeo-video/service.ts`.
   */
  async getMetrics(filters?: {
    sales_channel_id?: string;
  }): Promise<AbandonedCartMetrics> {
    const manager = (this as any).__container__.manager;
    const knex = manager.getKnex();

    const query = knex('abandoned_cart')
      .whereNull('deleted_at')
      .select('status', 'currency_code', 'sales_channel_id')
      .select(
        knex.raw(
          '(email IS NOT NULL OR phone IS NOT NULL) AS contactable',
        ),
      )
      .count('* AS count')
      .sum('cart_total AS value')
      .groupBy('status', 'currency_code', 'sales_channel_id', 'contactable');

    if (filters?.sales_channel_id) {
      query.where('sales_channel_id', filters.sales_channel_id);
    }

    const rows = (await query) as Array<{
      status: string;
      currency_code: string | null;
      sales_channel_id: string | null;
      contactable: boolean;
      count: string | number;
      value: string | number | null;
    }>;

    return shapeMetrics(
      rows.map(
        (r): MetricsAggregateRow => ({
          status: r.status,
          currency_code: r.currency_code,
          sales_channel_id: r.sales_channel_id,
          contactable: Boolean(r.contactable),
          // pg devuelve COUNT como bigint (string) y SUM(numeric) como string.
          count: Number(r.count) || 0,
          value: Number(r.value) || 0,
        }),
      ),
    );
  }

  /**
   * Marca como recuperado (se convirtió en orden). Corta la secuencia. `orderId`
   * puede ser null cuando se detecta el carrito ya completado sin conocer la orden.
   */
  async markRecoveredByCartId(
    cartId: string,
    orderId: string | null,
  ): Promise<boolean> {
    const record = (await this.listAbandonedCarts({ cart_id: cartId }))[0];
    if (!record || record.status === 'recovered') return false;
    await this.updateAbandonedCarts([
      {
        id: record.id,
        status: 'recovered' satisfies AbandonedCartStatus,
        recovered_order_id: orderId,
        next_eligible_at: null,
      },
    ]);
    return true;
  }
}

export default AbandonedCartModuleService;
