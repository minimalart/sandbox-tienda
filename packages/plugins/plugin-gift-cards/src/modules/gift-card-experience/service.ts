import { MedusaError, MedusaService } from '@medusajs/framework/utils';
import { randomUUID } from 'node:crypto';
import { createGiftCardToken } from './crypto';
import { nextDeliveryRetryAt } from './backoff';
import { attributeGiftCardLedger, type StoreCreditLedgerTransaction } from './attribution';
import {
  GiftCardDelivery,
  GiftCardDeliveryAttempt,
  GiftCardDesign,
  GiftCardSettings,
  GiftCardEvent,
} from './models';
import type {
  CreateGiftCardDeliveryIntentInput,
  GiftCardDeliveryRow,
  GiftCardDesignRow,
  GiftCardSettingsRow,
} from './types';

const truncateError = (error: unknown, max = 1000): string => {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/[\r\n\t]+/g, ' ').slice(0, max);
};

class GiftCardExperienceModuleService extends MedusaService({
  GiftCardDesign,
  GiftCardDelivery,
  GiftCardDeliveryAttempt,
  GiftCardSettings,
  GiftCardEvent,
}) {
  private get knex(): any {
    return (this as any).__container__.manager.getKnex();
  }

  /**
   * La configuración EFECTIVA de una tienda: la suya si la definió, la global si no.
   *
   * Es precedencia, no unión. Y la creación perezosa sigue siendo sobre la fila
   * GLOBAL: crear una fila por tienda la primera vez que alguien mira la pantalla
   * congelaría los defaults de ese momento, y a partir de ahí cambiar el global ya
   * no se propagaría a esa tienda. La fila de la tienda nace recién cuando alguien
   * guarda algo distinto (`upsertSettingsForSite`).
   *
   * `siteId` es OBLIGATORIO —`string | null`, no opcional— por lo mismo que en
   * `ga4/service.ts upsertBuiltinSetting`: mientras se podía omitir, se omitió en los
   * cuatro lugares donde más caro sale. `createGiftCardIntentsForOrder` sellaba
   * `expires_at`, `timezone`, `scheduled_at` y el diseño por defecto de la fila
   * GLOBAL en la entrega de una tienda que había configurado la suya, y eso queda
   * escrito en `gift_card_delivery` para siempre. Un default acá deja el mismo camino
   * abierto para el próximo call site; escribir `null` es una decisión que se lee en
   * el diff.
   */
  async getSettings(siteId: string | null): Promise<GiftCardSettingsRow> {
    if (siteId) {
      const [own] = await this.listGiftCardSettings(
        { singleton_key: 'default', site_id: siteId },
        { take: 1 },
      );
      if (own) return own as unknown as GiftCardSettingsRow;
    }
    const [settings] = await this.listGiftCardSettings(
      { singleton_key: 'default', site_id: null },
      { take: 1 },
    );
    if (settings) return settings as unknown as GiftCardSettingsRow;
    try {
      return (await this.createGiftCardSettings({
        singleton_key: 'default',
        site_id: null,
      })) as unknown as GiftCardSettingsRow;
    } catch {
      const [raced] = await this.listGiftCardSettings(
        { singleton_key: 'default', site_id: null },
        { take: 1 },
      );
      if (!raced) throw new Error('Unable to initialize gift card settings.');
      return raced as unknown as GiftCardSettingsRow;
    }
  }

  /**
   * Guarda la configuración de UNA tienda, creando su fila si todavía no existe.
   *
   * Los valores parten de la configuración efectiva —no de los defaults del modelo—
   * porque el operador abre la pantalla, ve el valor heredado, cambia un campo y
   * guarda: espera que el resto quede como lo estaba viendo.
   */
  async upsertSettingsForSite(
    siteId: string | null,
    values: Record<string, unknown>,
  ): Promise<GiftCardSettingsRow> {
    const current = await this.getSettings(siteId);
    const ownsRow = (current as unknown as { site_id?: string | null }).site_id === siteId;
    if (ownsRow) {
      return (await this.updateGiftCardSettings({
        id: (current as unknown as { id: string }).id,
        ...values,
      })) as unknown as GiftCardSettingsRow;
    }
    const { id: _ignored, ...inherited } = current as unknown as Record<string, unknown>;
    return (await this.createGiftCardSettings({
      ...inherited,
      site_id: siteId,
      singleton_key: 'default',
      ...values,
    })) as unknown as GiftCardSettingsRow;
  }

  async ensureDefaultDesign(): Promise<GiftCardDesignRow> {
    const [existing] = await this.listGiftCardDesigns({ public_id: 'brand-default' }, { take: 1 });
    if (existing) return existing as unknown as GiftCardDesignRow;
    try {
      return (await this.createGiftCardDesigns({
        public_id: 'brand-default',
        name: 'Diseño de marca',
        occasion: 'brand',
        desktop_image_url: '/images/gift-card-default.svg',
        mobile_image_url: '/images/gift-card-default.svg',
        text_color: '#FFFFFF',
        content_position: 'center',
        active: true,
        sort_order: 0,
      })) as unknown as GiftCardDesignRow;
    } catch {
      const [raced] = await this.listGiftCardDesigns({ public_id: 'brand-default' }, { take: 1 });
      if (!raced) throw new Error('Unable to initialize the default gift card design.');
      return raced as unknown as GiftCardDesignRow;
    }
  }

  async resolveDesign(publicId: string, includeInactive = false): Promise<GiftCardDesignRow | null> {
    const filters: Record<string, unknown> = { public_id: publicId };
    if (!includeInactive) filters.active = true;
    const [design] = await this.listGiftCardDesigns(filters, { take: 1 });
    return (design as unknown as GiftCardDesignRow) ?? null;
  }

  /**
   * `scope` es el filtro de tienda que arma el call site (`siteColumnFilter` con
   * `GIFT_CARD_DESIGN_SITE_SCOPE`). Llega por parámetro y no se resuelve acá porque el
   * servicio de un módulo recibe un container aislado y no puede resolver el registro
   * de tiendas — mismo motivo que `resolve-site-sql.ts`.
   *
   * Opcional a propósito: los call sites internos que sólo necesitan saber si hay
   * algún diseño vivo no tienen tienda que pasar, y obligarlos a `{}` no los haría más
   * correctos. Lo que importa es que la ruta del storefront SÍ lo pase.
   */
  async listActiveDesigns(scope: Record<string, unknown> = {}): Promise<GiftCardDesignRow[]> {
    await this.ensureDefaultDesign();
    return (await this.listGiftCardDesigns(
      { active: true, ...scope },
      { order: { sort_order: 'ASC', created_at: 'ASC' } },
    )) as unknown as GiftCardDesignRow[];
  }

  async findDeliveryByKey(idempotencyKey: string): Promise<GiftCardDeliveryRow | null> {
    const [delivery] = await this.listGiftCardDeliveries({ idempotency_key: idempotencyKey }, { take: 1 });
    return (delivery as unknown as GiftCardDeliveryRow) ?? null;
  }

  async createDeliveryIntent(input: CreateGiftCardDeliveryIntentInput): Promise<{ created: boolean; delivery: GiftCardDeliveryRow }> {
    const existing = await this.findDeliveryByKey(input.idempotency_key);
    if (existing) return { created: false, delivery: existing };
    const token = createGiftCardToken();
    const designSnapshot = {
      public_id: input.design.public_id,
      name: input.design.name,
      occasion: input.design.occasion,
      desktop_image_url: input.design.desktop_image_url,
      mobile_image_url: input.design.mobile_image_url,
      text_color: input.design.text_color,
      content_position: input.design.content_position,
    };
    try {
      const delivery = await this.createGiftCardDeliveries({
        idempotency_key: input.idempotency_key,
        order_id: input.order_id,
        order_display_id: input.order_display_id ?? null,
        line_item_id: input.line_item_id,
        unit_index: input.unit_index,
        buyer_customer_id: input.buyer_customer_id ?? null,
        buyer_email: input.buyer_email.toLowerCase(),
        delivery_mode: input.config.delivery_mode,
        recipient_email: input.config.recipient_email ?? null,
        recipient_name: input.config.recipient_name ?? null,
        sender_name: input.config.sender_name ?? null,
        anonymous: input.config.anonymous,
        message: input.config.message ?? null,
        design_id: input.design.public_id,
        design_snapshot: designSnapshot,
        currency_code: input.currency_code.toLowerCase(),
        face_value: input.face_value,
        paid_amount: input.paid_amount,
        timezone: input.timezone,
        scheduled_at: input.scheduled_at ?? null,
        expires_at: input.expires_at ?? null,
        token_hash: token.hash,
        token_encrypted: token.encrypted,
        issuance_status: 'awaiting_payment',
        delivery_status: 'not_ready',
        attempts: 0,
      });
      await this.recordEvent('purchase', delivery as unknown as GiftCardDeliveryRow);
      return { created: true, delivery: delivery as unknown as GiftCardDeliveryRow };
    } catch (error) {
      const raced = await this.findDeliveryByKey(input.idempotency_key);
      if (raced) return { created: false, delivery: raced };
      throw error;
    }
  }

  async claimIssuance(deliveryId: string, paidAt: Date): Promise<GiftCardDeliveryRow | null> {
    const staleBefore = new Date(Date.now() - 10 * 60_000);
    const rows = await this.knex('gift_card_delivery')
      .where({ id: deliveryId })
      .whereNull('deleted_at')
      .where((builder: any) => {
        builder.whereIn('issuance_status', ['awaiting_payment', 'failed']).orWhere((stale: any) => {
          stale.where('issuance_status', 'processing').andWhere('processing_started_at', '<=', staleBefore);
        });
      })
      .update({ issuance_status: 'processing', processing_started_at: new Date(), paid_at: paidAt, last_error: null, updated_at: new Date() })
      .returning('*');
    return (rows[0] as GiftCardDeliveryRow | undefined) ?? null;
  }

  async cancelUnissuedDeliveriesForOrder(orderId: string): Promise<number> {
    return this.knex('gift_card_delivery')
      .where({ order_id: orderId })
      .whereIn('issuance_status', ['awaiting_payment', 'failed'])
      .whereNull('deleted_at')
      .update({
        issuance_status: 'canceled',
        delivery_status: 'canceled',
        next_retry_at: null,
        processing_started_at: null,
        updated_at: new Date(),
      });
  }

  async findOfficialGiftCardByIdempotencyKey(idempotencyKey: string): Promise<{ id: string; code: string } | null> {
    const row = await this.knex('loyalty_gift_card')
      .select(['id', 'code'])
      .whereRaw("metadata->>'idempotency_key' = ?", [idempotencyKey])
      .whereNull('deleted_at')
      .first();
    return row ?? null;
  }

  async retrieveOfficialGiftCard(giftCardId: string): Promise<{ id: string; code: string } | null> {
    return (await this.knex('loyalty_gift_card')
      .select(['id', 'code'])
      .where({ id: giftCardId })
      .whereNull('deleted_at')
      .first()) ?? null;
  }

  async getCustomerWallet(customerId: string): Promise<Array<Record<string, unknown>>> {
    const accounts = await this.knex('store_credit_account as account')
      .leftJoin('store_credit_account_transaction as transaction', function joinTransactions(this: any) {
        this.on('transaction.account_id', '=', 'account.id').onNull('transaction.deleted_at');
      })
      .where('account.customer_id', customerId)
      .whereNull('account.deleted_at')
      .groupBy('account.id', 'account.currency_code')
      .select(['account.id', 'account.currency_code'])
      .select(this.knex.raw(`COALESCE(SUM(CASE WHEN transaction.type = 'credit' THEN transaction.amount ELSE -transaction.amount END), 0)::float AS balance`));
    for (const account of accounts) {
      account.movements = await this.knex('store_credit_account_transaction as movement')
        .leftJoin('gift_card_delivery as delivery', function joinDelivery(this: any) {
          this.on('delivery.store_credit_account_id', '=', 'movement.reference_id').onNull('delivery.deleted_at');
        })
        .leftJoin('loyalty_gift_card as official_card', function joinOfficialCard(this: any) {
          this.on('official_card.id', '=', 'delivery.gift_card_id').onNull('official_card.deleted_at');
        })
        .select([
          'movement.id', 'movement.amount', 'movement.type', 'movement.reference',
          'movement.reference_id', 'movement.note', 'movement.created_at',
          'delivery.id as gift_card_delivery_id',
        ])
        .select(this.knex.raw(`CASE
          WHEN delivery.id IS NOT NULL THEN 'gift_card'
          WHEN movement.reference ILIKE '%refund%' OR movement.reference ILIKE '%return%' THEN 'refund'
          ELSE 'adjustment'
        END AS origin`))
        .select(this.knex.raw(`CASE WHEN official_card.code IS NULL THEN NULL
          ELSE '•••• •••• ' || RIGHT(REGEXP_REPLACE(official_card.code, '[^A-Za-z0-9]', '', 'g'), 4)
        END AS masked_code`))
        .where({ 'movement.account_id': account.id })
        .whereNull('movement.deleted_at')
        .orderBy('movement.created_at', 'desc')
        .limit(50);
    }
    return accounts as Array<Record<string, unknown>>;
  }

  async getDeliveryOperations(deliveryId: string): Promise<{ attempts: unknown[]; events: unknown[] }> {
    const attempts = await this.knex('gift_card_delivery_attempt')
      .select(['id', 'attempt_no', 'channel', 'trigger', 'status', 'recipient', 'provider_message_id', 'error', 'attempted_at', 'completed_at', 'metadata'])
      .where({ delivery_id: deliveryId })
      .whereNull('deleted_at')
      .orderBy('attempted_at', 'desc');
    const events = await this.knex('gift_card_event')
      .select(['id', 'event', 'occurred_at', 'metadata'])
      .where({ delivery_id: deliveryId })
      .whereNull('deleted_at')
      .orderBy('occurred_at', 'desc');
    return { attempts, events };
  }

  async markIssued(deliveryId: string, values: { giftCardId: string; storeCreditAccountId?: string | null; deliveryStatus: 'pending' | 'scheduled' | 'sent'; claimedCustomerId?: string | null }): Promise<void> {
    const now = new Date();
    await this.updateGiftCardDeliveries({
      id: deliveryId,
      gift_card_id: values.giftCardId,
      store_credit_account_id: values.storeCreditAccountId ?? null,
      issuance_status: 'issued',
      delivery_status: values.deliveryStatus,
      issued_at: now,
      processing_started_at: null,
      claimed_at: values.claimedCustomerId ? now : null,
      claimed_customer_id: values.claimedCustomerId ?? null,
      next_retry_at: values.deliveryStatus === 'pending' ? now : null,
      last_error: null,
    });
    const issued = await this.retrieveGiftCardDelivery(deliveryId);
    await this.recordEvent('issued', issued as unknown as GiftCardDeliveryRow);
  }

  async markIssuanceFailed(deliveryId: string, error: unknown): Promise<void> {
    await this.updateGiftCardDeliveries({
      id: deliveryId,
      issuance_status: 'failed',
      processing_started_at: null,
      last_error: truncateError(error),
    });
  }

  async claimDueDeliveries(limit = 20): Promise<GiftCardDeliveryRow[]> {
    const now = new Date();
    const candidates = await this.knex('gift_card_delivery')
      .select('*')
      .whereNull('deleted_at')
      .whereIn('delivery_status', ['pending', 'failed', 'scheduled'])
      .where((builder: any) => builder.whereNull('next_retry_at').orWhere('next_retry_at', '<=', now))
      .where((builder: any) => builder.whereNull('scheduled_at').orWhere('scheduled_at', '<=', now))
      .orderBy('created_at', 'asc')
      .limit(Math.max(limit * 3, 30));
    const claimed: GiftCardDeliveryRow[] = [];
    for (const candidate of candidates) {
      const rows = await this.knex('gift_card_delivery')
        .where({ id: candidate.id })
        .whereIn('delivery_status', ['pending', 'failed', 'scheduled'])
        .update({ delivery_status: 'processing', processing_started_at: now, updated_at: now })
        .returning('*');
      if (rows[0]) claimed.push(rows[0] as GiftCardDeliveryRow);
      if (claimed.length >= limit) break;
    }
    return claimed;
  }

  async startAttempt(delivery: GiftCardDeliveryRow, trigger: 'initial' | 'automatic_retry' | 'manual_resend' | 'fallback_buyer', recipient: string): Promise<{ id: string }> {
    const attemptNo = (delivery.attempts ?? 0) + 1;
    const attempt = await this.createGiftCardDeliveryAttempts({
      delivery_id: delivery.id,
      attempt_no: attemptNo,
      channel: 'email',
      trigger,
      status: 'processing',
      recipient: recipient.toLowerCase(),
      attempted_at: new Date(),
    });
    await this.updateGiftCardDeliveries({ id: delivery.id, attempts: attemptNo });
    return attempt as unknown as { id: string };
  }

  async auditSecureLink(delivery: GiftCardDeliveryRow, actorId: string): Promise<void> {
    await this.createGiftCardDeliveryAttempts({
      delivery_id: delivery.id,
      // Audit reads must not consume an email retry number. Negative timestamps
      // keep the immutable audit row unique without changing the outbox state.
      attempt_no: -Date.now(),
      channel: 'audit',
      trigger: 'secure_link',
      status: 'sent',
      recipient: actorId,
      attempted_at: new Date(),
      completed_at: new Date(),
      metadata: { action: 'secure_link_revealed' },
    });
  }

  async markDeliverySent(deliveryId: string, attemptId: string, values: { notificationId?: string | null; providerMessageId?: string | null }): Promise<void> {
    const now = new Date();
    await this.updateGiftCardDeliveryAttempts({
      id: attemptId,
      status: 'sent',
      notification_id: values.notificationId ?? null,
      provider_message_id: values.providerMessageId ?? null,
      completed_at: now,
    });
    await this.updateGiftCardDeliveries({
      id: deliveryId,
      delivery_status: 'sent',
      sent_at: now,
      processing_started_at: null,
      next_retry_at: null,
      provider_message_id: values.providerMessageId ?? null,
      last_error: null,
    });
    const sent = await this.retrieveGiftCardDelivery(deliveryId);
    await this.recordEvent('sent', sent as unknown as GiftCardDeliveryRow);
  }

  async markDeliveryFailed(delivery: GiftCardDeliveryRow, attemptId: string, error: unknown, retryDelays: unknown): Promise<'failed' | 'dead_letter'> {
    const attempts = (delivery.attempts ?? 0) + 1;
    const nextRetry = nextDeliveryRetryAt(attempts, retryDelays);
    const status = nextRetry ? 'failed' : 'dead_letter';
    const message = truncateError(error);
    await this.updateGiftCardDeliveryAttempts({ id: attemptId, status: 'failed', error: message, completed_at: new Date() });
    await this.updateGiftCardDeliveries({
      id: delivery.id,
      delivery_status: status,
      attempts,
      next_retry_at: nextRetry,
      processing_started_at: null,
      failed_at: new Date(),
      last_error: message,
    });
    return status;
  }

  async markFallbackSent(deliveryId: string): Promise<void> {
    await this.updateGiftCardDeliveries({ id: deliveryId, fallback_sent_at: new Date() });
  }

  async cancelScheduledDelivery(deliveryId: string): Promise<GiftCardDeliveryRow> {
    const rows = await this.knex('gift_card_delivery')
      .where({ id: deliveryId, delivery_status: 'scheduled' })
      .whereNull('deleted_at')
      .update({ delivery_status: 'canceled', next_retry_at: null, updated_at: new Date() })
      .returning('*');
    if (!rows[0]) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, 'Solo se puede cancelar una notificación programada.');
    }
    return rows[0] as GiftCardDeliveryRow;
  }

  async updateRecipientBeforeSending(deliveryId: string, recipientEmail: string): Promise<GiftCardDeliveryRow> {
    const normalizedEmail = recipientEmail.toLowerCase();
    const rows = await this.knex('gift_card_delivery')
      .where({ id: deliveryId, delivery_mode: 'recipient' })
      .whereRaw('LOWER(buyer_email) <> ?', [normalizedEmail])
      .whereIn('delivery_status', ['scheduled', 'pending', 'failed', 'dead_letter'])
      .whereNull('sent_at')
      .whereNull('deleted_at')
      .update({ recipient_email: normalizedEmail, updated_at: new Date() })
      .returning('*');
    if (!rows[0]) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, 'El destinatario no se puede modificar o coincide con el comprador.');
    }
    return rows[0] as GiftCardDeliveryRow;
  }

  async consumeToken(deliveryId: string, customerId: string): Promise<'claimed' | 'same_customer' | 'unavailable'> {
    const rows = await this.knex('gift_card_delivery')
      .where({ id: deliveryId, issuance_status: 'issued' })
      .whereNull('claimed_at')
      .whereNull('deleted_at')
      .where((builder: any) => builder.whereNull('expires_at').orWhere('expires_at', '>', new Date()))
      .update({ claimed_at: new Date(), claimed_customer_id: customerId, updated_at: new Date() })
      .returning('id');
    if (rows[0]) return 'claimed';
    const current = await this.knex('gift_card_delivery').select('claimed_customer_id').where({ id: deliveryId }).first();
    return current?.claimed_customer_id === customerId ? 'same_customer' : 'unavailable';
  }

  async releaseConsumedToken(deliveryId: string, customerId: string): Promise<void> {
    await this.knex('gift_card_delivery')
      .where({ id: deliveryId, claimed_customer_id: customerId })
      .update({ claimed_at: null, claimed_customer_id: null, updated_at: new Date() });
  }

  private async attributedGiftBalances(limit = 2_000, recordMilestones = true): Promise<Map<string, { delivery: GiftCardDeliveryRow; remaining: number; target_account_id: string }>> {
    const deliveries = await this.knex('gift_card_delivery')
      .select('*')
      .whereNotNull('claimed_at')
      .whereNotNull('store_credit_account_id')
      .whereNull('deleted_at')
      .orderBy('claimed_at', 'asc')
      .limit(limit) as GiftCardDeliveryRow[];
    if (!deliveries.length) return new Map();
    const sourceToDelivery = new Map(deliveries.map((delivery) => [delivery.store_credit_account_id!, delivery]));
    const claimCredits = await this.knex('store_credit_account_transaction')
      .select(['account_id', 'reference_id'])
      .where({ type: 'credit', reference: 'store-credit' })
      .whereIn('reference_id', [...sourceToDelivery.keys()])
      .whereNull('deleted_at');
    const targetAccountIds = [...new Set(claimCredits.map((credit: any) => String(credit.account_id)))];
    if (!targetAccountIds.length) return new Map();
    const transactions = await this.knex('store_credit_account_transaction')
      .select(['id', 'account_id', 'amount', 'type', 'reference', 'reference_id', 'created_at'])
      .whereIn('account_id', targetAccountIds)
      .whereNull('deleted_at')
      .orderBy([{ column: 'created_at', order: 'asc' }, { column: 'id', order: 'asc' }]);
    const result = new Map<string, { delivery: GiftCardDeliveryRow; remaining: number; target_account_id: string }>();
    const attributed = attributeGiftCardLedger(transactions as StoreCreditLedgerTransaction[], new Set(sourceToDelivery.keys()));
    for (const [sourceAccountId, balance] of attributed) {
      const delivery = sourceToDelivery.get(sourceAccountId);
      if (!delivery) continue;
      if (recordMilestones && balance.first_used_at) await this.recordUsageMilestone(delivery, 'first_use', balance.first_used_at);
      if (recordMilestones && balance.exhausted_at) await this.recordUsageMilestone(delivery, 'exhausted', balance.exhausted_at);
      result.set(delivery.id, { delivery, remaining: balance.remaining, target_account_id: balance.target_account_id });
    }
    return result;
  }

  private async recordUsageMilestone(delivery: GiftCardDeliveryRow, event: 'first_use' | 'exhausted', occurredAt: Date): Promise<boolean> {
    const column = event === 'first_use' ? 'first_used_at' : 'exhausted_at';
    const rows = await this.knex('gift_card_delivery')
      .where({ id: delivery.id })
      .whereNull(column)
      .whereNull('deleted_at')
      .update({ [column]: occurredAt, updated_at: new Date() })
      .returning('id');
    if (!rows[0]) return false;
    await this.createGiftCardEvents({
      delivery_id: delivery.id,
      event,
      design_id: delivery.design_id,
      currency_code: delivery.currency_code,
      amount: Number(delivery.face_value),
      occurred_at: occurredAt,
      metadata: { attribution: 'fifo_store_credit_ledger' },
    });
    (delivery as GiftCardDeliveryRow & { first_used_at?: Date; exhausted_at?: Date })[column] = occurredAt;
    return true;
  }

  async reconcileUsageMilestones(): Promise<{ first_use: number; exhausted: number }> {
    const before = await this.knex('gift_card_delivery')
      .whereNull('deleted_at')
      .select(this.knex.raw('COUNT(first_used_at)::int AS first_use'))
      .select(this.knex.raw('COUNT(exhausted_at)::int AS exhausted'))
      .first();
    await this.attributedGiftBalances();
    const after = await this.knex('gift_card_delivery')
      .whereNull('deleted_at')
      .select(this.knex.raw('COUNT(first_used_at)::int AS first_use'))
      .select(this.knex.raw('COUNT(exhausted_at)::int AS exhausted'))
      .first();
    return {
      first_use: Number(after?.first_use ?? 0) - Number(before?.first_use ?? 0),
      exhausted: Number(after?.exhausted ?? 0) - Number(before?.exhausted ?? 0),
    };
  }

  async listExpiringNotificationCandidates(days: number, limit = 100): Promise<GiftCardDeliveryRow[]> {
    const now = new Date();
    const cutoff = new Date(now.getTime() + Math.max(1, days) * 86_400_000);
    return this.knex('gift_card_delivery')
      .select('*')
      .where({ issuance_status: 'issued' })
      .whereNull('claimed_at')
      .whereNull('deleted_at')
      .where('expires_at', '>', now)
      .andWhere('expires_at', '<=', cutoff)
      .orderBy('expires_at', 'asc')
      .limit(limit);
  }

  async listBalanceReminderCandidates(days: number, limit = 100): Promise<Array<{ delivery: GiftCardDeliveryRow; remaining: number; customer_email: string }>> {
    const balances = await this.attributedGiftBalances();
    const cutoff = Date.now() - Math.max(1, days) * 86_400_000;
    const candidates = [...balances.values()]
      .filter(({ delivery, remaining }) => remaining > 0 && Boolean(delivery.claimed_customer_id) && new Date(delivery.claimed_at!).getTime() <= cutoff)
      .slice(0, limit);
    if (!candidates.length) return [];
    const customerIds = [...new Set(candidates.map(({ delivery }) => delivery.claimed_customer_id!))];
    const customers = await this.knex('customer').select(['id', 'email']).whereIn('id', customerIds).whereNull('deleted_at');
    const emails = new Map<string, string>(customers.map((customer: any) => [String(customer.id), String(customer.email).toLowerCase()]));
    return candidates.flatMap(({ delivery, remaining }) => {
      const email = emails.get(delivery.claimed_customer_id!);
      return email ? [{ delivery, remaining, customer_email: email }] : [];
    });
  }

  async claimLifecycleNotification(delivery: GiftCardDeliveryRow, event: 'balance_reminder' | 'expiring_notice'): Promise<string | null> {
    const id = `gcevent_${randomUUID().replace(/-/g, '')}`;
    const rows = await this.knex('gift_card_event').insert({
      id,
      delivery_id: delivery.id,
      event,
      design_id: delivery.design_id,
      currency_code: delivery.currency_code,
      amount: Number(delivery.face_value),
      occurred_at: new Date(),
      metadata: { status: 'processing' },
      created_at: new Date(),
      updated_at: new Date(),
    }).onConflict().ignore().returning('id');
    return rows[0]?.id ?? null;
  }

  async completeLifecycleNotification(eventId: string, notificationId?: string | null): Promise<void> {
    await this.knex('gift_card_event').where({ id: eventId }).update({
      metadata: { status: 'sent', notification_id: notificationId ?? null },
      updated_at: new Date(),
    });
  }

  async releaseLifecycleNotification(eventId: string): Promise<void> {
    await this.knex('gift_card_event').where({ id: eventId }).delete();
  }

  async requeueDelivery(deliveryId: string): Promise<GiftCardDeliveryRow> {
    const delivery = (await this.retrieveGiftCardDelivery(deliveryId)) as unknown as GiftCardDeliveryRow;
    if (!['failed', 'dead_letter', 'sent'].includes(delivery.delivery_status)) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, 'La entrega no se puede reenviar en su estado actual.');
    }
    await this.updateGiftCardDeliveries({
      id: deliveryId,
      delivery_status: 'pending',
      next_retry_at: new Date(),
      processing_started_at: null,
      last_error: null,
      metadata: { ...(delivery.metadata ?? {}), manual_resend: true },
    });
    return (await this.retrieveGiftCardDelivery(deliveryId)) as unknown as GiftCardDeliveryRow;
  }

  async markClaimed(deliveryId: string, customerId: string): Promise<void> {
    await this.updateGiftCardDeliveries({ id: deliveryId, claimed_at: new Date(), claimed_customer_id: customerId });
  }

  async findDeliveryByTokenHash(hash: string): Promise<GiftCardDeliveryRow | null> {
    const [delivery] = await this.listGiftCardDeliveries({ token_hash: hash }, { take: 1 });
    return (delivery as unknown as GiftCardDeliveryRow) ?? null;
  }

  async applySendGridEvent(input: {
    eventId: string;
    messageId: string;
    event: 'delivered' | 'deferred' | 'bounce' | 'dropped';
    occurredAt: Date;
  }): Promise<boolean> {
    return this.knex.transaction(async (transaction: any) => {
      const inserted = await transaction('gift_card_webhook_event').insert({
        event_id: input.eventId,
        provider: 'sendgrid',
        event_type: input.event,
        message_id: input.messageId,
        occurred_at: input.occurredAt,
      }).onConflict('event_id').ignore().returning('event_id');
      if (!inserted[0]) return false;
      const delivery = await transaction('gift_card_delivery')
        .where({ provider_message_id: input.messageId })
        .whereNull('deleted_at')
        .first();
      if (!delivery) return false;
      const latest = await transaction('gift_card_delivery_attempt')
        .where({ delivery_id: delivery.id })
        .whereNull('deleted_at')
        .orderBy('attempt_no', 'desc')
        .first();
      if (latest) {
        await transaction('gift_card_delivery_attempt').where({ id: latest.id }).update({
          status: input.event === 'delivered' ? 'delivered' : input.event === 'deferred' ? latest.status : 'failed',
          completed_at: input.occurredAt,
          metadata: { ...(latest.metadata ?? {}), sendgrid_event_id: input.eventId, sendgrid_event: input.event },
          updated_at: new Date(),
        });
      }
      if (input.event === 'delivered') {
        await transaction('gift_card_delivery').where({ id: delivery.id }).update({
          delivery_status: 'delivered', delivered_at: input.occurredAt, updated_at: new Date(),
        });
        await transaction('gift_card_event').insert({
          id: `gcevent_${input.eventId.slice(0, 40)}`,
          delivery_id: delivery.id, event: 'delivered', design_id: delivery.design_id,
          currency_code: delivery.currency_code, amount: delivery.face_value,
          occurred_at: input.occurredAt, created_at: new Date(), updated_at: new Date(),
        }).onConflict('id').ignore();
      } else if (input.event === 'bounce' || input.event === 'dropped') {
        await transaction('gift_card_delivery').where({ id: delivery.id }).update({
          delivery_status: 'dead_letter', failed_at: input.occurredAt,
          last_error: `SendGrid ${input.event}`, updated_at: new Date(),
        });
      }
      return true;
    });
  }

  /**
   * `deliveryIds` acota las entregas que entran en el agregado. Lo arma la ruta con el
   * predicado de la tienda activa: sin él, los KPIs suman las gift cards de TODAS las
   * tiendas y el operador decide sobre números que no son suyos.
   *
   * `null` = sin acotar, que es el comportamiento de antes.
   */
  async analytics(deliveryIds?: string[] | null): Promise<Record<string, unknown>> {
    const scoped = <T extends { whereIn: (c: string, v: string[]) => T }>(q: T): T =>
      deliveryIds ? q.whereIn('id', deliveryIds) : q;

    const [summary] = await scoped(this.knex('gift_card_delivery'))
      .whereNull('deleted_at')
      .select(this.knex.raw('COUNT(*)::int AS sold_count'))
      .select(this.knex.raw('COUNT(claimed_at)::int AS claimed_count'))
      .select(this.knex.raw('COUNT(delivered_at)::int AS delivered_count'))
      .select(this.knex.raw('COUNT(first_used_at)::int AS first_use_count'))
      .select(this.knex.raw('COUNT(exhausted_at)::int AS exhausted_count'))
      .select(this.knex.raw(`COALESCE(AVG(EXTRACT(EPOCH FROM (claimed_at - issued_at))) FILTER (WHERE claimed_at IS NOT NULL AND issued_at IS NOT NULL), 0)::float AS average_seconds_to_claim`))
      .select(this.knex.raw(`COALESCE(AVG(EXTRACT(EPOCH FROM (first_used_at - issued_at))) FILTER (WHERE first_used_at IS NOT NULL AND issued_at IS NOT NULL), 0)::float AS average_seconds_to_first_use`));
    const perCurrency = await scoped(this.knex('gift_card_delivery'))
      .whereNull('deleted_at')
      .groupBy('currency_code')
      .select('currency_code')
      .select(this.knex.raw('COUNT(*)::int AS sold_count'))
      .select(this.knex.raw('COALESCE(AVG(paid_amount), 0)::float AS average_paid_amount'))
      .select(this.knex.raw('COALESCE(SUM(face_value), 0)::float AS face_value_total'))
      .select(this.knex.raw('COALESCE(SUM(paid_amount), 0)::float AS paid_total'))
      .select(this.knex.raw('COALESCE(SUM(face_value - paid_amount), 0)::float AS campaign_bonus_total'))
      .select(this.knex.raw(`COALESCE(SUM(CASE WHEN issuance_status = 'issued' AND claimed_at IS NULL THEN face_value ELSE 0 END), 0)::float AS unclaimed_face_value`));
    const byDesign = await this.knex('gift_card_delivery')
      .whereNull('deleted_at')
      .groupBy('design_id')
      .select('design_id')
      .select(this.knex.raw('COUNT(*)::int AS sold_count'))
      .select(this.knex.raw('COUNT(claimed_at)::int AS claimed_count'))
      .select(this.knex.raw(`ROUND((COUNT(claimed_at)::numeric / NULLIF(COUNT(*), 0)) * 100, 2)::float AS claim_rate`));
    const byStatus = await this.knex('gift_card_delivery')
      .whereNull('deleted_at')
      .groupBy('delivery_status')
      .select('delivery_status')
      .count('* as count');
    const funnel = await this.knex('gift_card_event')
      .where('occurred_at', '>=', new Date(Date.now() - 30 * 86_400_000))
      .groupBy('event').select('event').count('* as count');
    const attributed = await this.attributedGiftBalances(2_000, false);
    const claimedRemaining = new Map<string, number>();
    for (const { delivery, remaining } of attributed.values()) {
      const currency = delivery.currency_code.toLowerCase();
      claimedRemaining.set(currency, (claimedRemaining.get(currency) ?? 0) + remaining);
    }
    const enrichedCurrency = perCurrency.map((row: any) => ({
      ...row,
      unused_attributed_balance: Number(row.unclaimed_face_value ?? 0) + (claimedRemaining.get(String(row.currency_code).toLowerCase()) ?? 0),
    }));
    return { ...summary, per_currency: enrichedCurrency, by_design: byDesign, by_delivery_status: byStatus, funnel_30d: funnel };
  }

  async recordEvent(
    event: 'view' | 'purchase' | 'issued' | 'sent' | 'delivered' | 'claimed' | 'first_use' | 'exhausted' | 'balance_reminder' | 'expiring_notice',
    delivery?: GiftCardDeliveryRow | null,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.createGiftCardEvents({
      delivery_id: delivery?.id ?? null, event,
      design_id: delivery?.design_id ?? null,
      currency_code: delivery?.currency_code ?? null,
      amount: delivery ? Number(delivery.face_value) : null,
      occurred_at: new Date(), metadata: metadata ?? null,
    });
  }
}

export { truncateError };
export default GiftCardExperienceModuleService;
