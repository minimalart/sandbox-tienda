"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.truncateError = void 0;
const utils_1 = require("@medusajs/framework/utils");
const node_crypto_1 = require("node:crypto");
const crypto_1 = require("./crypto");
const backoff_1 = require("./backoff");
const attribution_1 = require("./attribution");
const models_1 = require("./models");
const truncateError = (error, max = 1000) => {
    const message = error instanceof Error ? error.message : String(error);
    return message.replace(/[\r\n\t]+/g, ' ').slice(0, max);
};
exports.truncateError = truncateError;
class GiftCardExperienceModuleService extends (0, utils_1.MedusaService)({
    GiftCardDesign: models_1.GiftCardDesign,
    GiftCardDelivery: models_1.GiftCardDelivery,
    GiftCardDeliveryAttempt: models_1.GiftCardDeliveryAttempt,
    GiftCardSettings: models_1.GiftCardSettings,
    GiftCardEvent: models_1.GiftCardEvent,
}) {
    get knex() {
        return this.__container__.manager.getKnex();
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
    async getSettings(siteId) {
        if (siteId) {
            const [own] = await this.listGiftCardSettings({ singleton_key: 'default', site_id: siteId }, { take: 1 });
            if (own)
                return own;
        }
        const [settings] = await this.listGiftCardSettings({ singleton_key: 'default', site_id: null }, { take: 1 });
        if (settings)
            return settings;
        try {
            return (await this.createGiftCardSettings({
                singleton_key: 'default',
                site_id: null,
            }));
        }
        catch {
            const [raced] = await this.listGiftCardSettings({ singleton_key: 'default', site_id: null }, { take: 1 });
            if (!raced)
                throw new Error('Unable to initialize gift card settings.');
            return raced;
        }
    }
    /**
     * Guarda la configuración de UNA tienda, creando su fila si todavía no existe.
     *
     * Los valores parten de la configuración efectiva —no de los defaults del modelo—
     * porque el operador abre la pantalla, ve el valor heredado, cambia un campo y
     * guarda: espera que el resto quede como lo estaba viendo.
     */
    async upsertSettingsForSite(siteId, values) {
        const current = await this.getSettings(siteId);
        const ownsRow = current.site_id === siteId;
        if (ownsRow) {
            return (await this.updateGiftCardSettings({
                id: current.id,
                ...values,
            }));
        }
        const { id: _ignored, ...inherited } = current;
        return (await this.createGiftCardSettings({
            ...inherited,
            site_id: siteId,
            singleton_key: 'default',
            ...values,
        }));
    }
    async ensureDefaultDesign() {
        const [existing] = await this.listGiftCardDesigns({ public_id: 'brand-default' }, { take: 1 });
        if (existing)
            return existing;
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
            }));
        }
        catch {
            const [raced] = await this.listGiftCardDesigns({ public_id: 'brand-default' }, { take: 1 });
            if (!raced)
                throw new Error('Unable to initialize the default gift card design.');
            return raced;
        }
    }
    async resolveDesign(publicId, includeInactive = false) {
        const filters = { public_id: publicId };
        if (!includeInactive)
            filters.active = true;
        const [design] = await this.listGiftCardDesigns(filters, { take: 1 });
        return design ?? null;
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
    async listActiveDesigns(scope = {}) {
        await this.ensureDefaultDesign();
        return (await this.listGiftCardDesigns({ active: true, ...scope }, { order: { sort_order: 'ASC', created_at: 'ASC' } }));
    }
    async findDeliveryByKey(idempotencyKey) {
        const [delivery] = await this.listGiftCardDeliveries({ idempotency_key: idempotencyKey }, { take: 1 });
        return delivery ?? null;
    }
    async createDeliveryIntent(input) {
        const existing = await this.findDeliveryByKey(input.idempotency_key);
        if (existing)
            return { created: false, delivery: existing };
        const token = (0, crypto_1.createGiftCardToken)();
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
            await this.recordEvent('purchase', delivery);
            return { created: true, delivery: delivery };
        }
        catch (error) {
            const raced = await this.findDeliveryByKey(input.idempotency_key);
            if (raced)
                return { created: false, delivery: raced };
            throw error;
        }
    }
    async claimIssuance(deliveryId, paidAt) {
        const staleBefore = new Date(Date.now() - 10 * 60_000);
        const rows = await this.knex('gift_card_delivery')
            .where({ id: deliveryId })
            .whereNull('deleted_at')
            .where((builder) => {
            builder.whereIn('issuance_status', ['awaiting_payment', 'failed']).orWhere((stale) => {
                stale.where('issuance_status', 'processing').andWhere('processing_started_at', '<=', staleBefore);
            });
        })
            .update({ issuance_status: 'processing', processing_started_at: new Date(), paid_at: paidAt, last_error: null, updated_at: new Date() })
            .returning('*');
        return rows[0] ?? null;
    }
    async cancelUnissuedDeliveriesForOrder(orderId) {
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
    async findOfficialGiftCardByIdempotencyKey(idempotencyKey) {
        const row = await this.knex('loyalty_gift_card')
            .select(['id', 'code'])
            .whereRaw("metadata->>'idempotency_key' = ?", [idempotencyKey])
            .whereNull('deleted_at')
            .first();
        return row ?? null;
    }
    async retrieveOfficialGiftCard(giftCardId) {
        return (await this.knex('loyalty_gift_card')
            .select(['id', 'code'])
            .where({ id: giftCardId })
            .whereNull('deleted_at')
            .first()) ?? null;
    }
    async getCustomerWallet(customerId) {
        const accounts = await this.knex('store_credit_account as account')
            .leftJoin('store_credit_account_transaction as transaction', function joinTransactions() {
            this.on('transaction.account_id', '=', 'account.id').onNull('transaction.deleted_at');
        })
            .where('account.customer_id', customerId)
            .whereNull('account.deleted_at')
            .groupBy('account.id', 'account.currency_code')
            .select(['account.id', 'account.currency_code'])
            .select(this.knex.raw(`COALESCE(SUM(CASE WHEN transaction.type = 'credit' THEN transaction.amount ELSE -transaction.amount END), 0)::float AS balance`));
        for (const account of accounts) {
            account.movements = await this.knex('store_credit_account_transaction as movement')
                .leftJoin('gift_card_delivery as delivery', function joinDelivery() {
                this.on('delivery.store_credit_account_id', '=', 'movement.reference_id').onNull('delivery.deleted_at');
            })
                .leftJoin('loyalty_gift_card as official_card', function joinOfficialCard() {
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
        return accounts;
    }
    async getDeliveryOperations(deliveryId) {
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
    async markIssued(deliveryId, values) {
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
        await this.recordEvent('issued', issued);
    }
    async markIssuanceFailed(deliveryId, error) {
        await this.updateGiftCardDeliveries({
            id: deliveryId,
            issuance_status: 'failed',
            processing_started_at: null,
            last_error: truncateError(error),
        });
    }
    async claimDueDeliveries(limit = 20) {
        const now = new Date();
        const candidates = await this.knex('gift_card_delivery')
            .select('*')
            .whereNull('deleted_at')
            .whereIn('delivery_status', ['pending', 'failed', 'scheduled'])
            .where((builder) => builder.whereNull('next_retry_at').orWhere('next_retry_at', '<=', now))
            .where((builder) => builder.whereNull('scheduled_at').orWhere('scheduled_at', '<=', now))
            .orderBy('created_at', 'asc')
            .limit(Math.max(limit * 3, 30));
        const claimed = [];
        for (const candidate of candidates) {
            const rows = await this.knex('gift_card_delivery')
                .where({ id: candidate.id })
                .whereIn('delivery_status', ['pending', 'failed', 'scheduled'])
                .update({ delivery_status: 'processing', processing_started_at: now, updated_at: now })
                .returning('*');
            if (rows[0])
                claimed.push(rows[0]);
            if (claimed.length >= limit)
                break;
        }
        return claimed;
    }
    async startAttempt(delivery, trigger, recipient) {
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
        return attempt;
    }
    async auditSecureLink(delivery, actorId) {
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
    async markDeliverySent(deliveryId, attemptId, values) {
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
        await this.recordEvent('sent', sent);
    }
    async markDeliveryFailed(delivery, attemptId, error, retryDelays) {
        const attempts = (delivery.attempts ?? 0) + 1;
        const nextRetry = (0, backoff_1.nextDeliveryRetryAt)(attempts, retryDelays);
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
    async markFallbackSent(deliveryId) {
        await this.updateGiftCardDeliveries({ id: deliveryId, fallback_sent_at: new Date() });
    }
    async cancelScheduledDelivery(deliveryId) {
        const rows = await this.knex('gift_card_delivery')
            .where({ id: deliveryId, delivery_status: 'scheduled' })
            .whereNull('deleted_at')
            .update({ delivery_status: 'canceled', next_retry_at: null, updated_at: new Date() })
            .returning('*');
        if (!rows[0]) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_ALLOWED, 'Solo se puede cancelar una notificación programada.');
        }
        return rows[0];
    }
    async updateRecipientBeforeSending(deliveryId, recipientEmail) {
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
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_ALLOWED, 'El destinatario no se puede modificar o coincide con el comprador.');
        }
        return rows[0];
    }
    async consumeToken(deliveryId, customerId) {
        const rows = await this.knex('gift_card_delivery')
            .where({ id: deliveryId, issuance_status: 'issued' })
            .whereNull('claimed_at')
            .whereNull('deleted_at')
            .where((builder) => builder.whereNull('expires_at').orWhere('expires_at', '>', new Date()))
            .update({ claimed_at: new Date(), claimed_customer_id: customerId, updated_at: new Date() })
            .returning('id');
        if (rows[0])
            return 'claimed';
        const current = await this.knex('gift_card_delivery').select('claimed_customer_id').where({ id: deliveryId }).first();
        return current?.claimed_customer_id === customerId ? 'same_customer' : 'unavailable';
    }
    async releaseConsumedToken(deliveryId, customerId) {
        await this.knex('gift_card_delivery')
            .where({ id: deliveryId, claimed_customer_id: customerId })
            .update({ claimed_at: null, claimed_customer_id: null, updated_at: new Date() });
    }
    async attributedGiftBalances(limit = 2_000, recordMilestones = true) {
        const deliveries = await this.knex('gift_card_delivery')
            .select('*')
            .whereNotNull('claimed_at')
            .whereNotNull('store_credit_account_id')
            .whereNull('deleted_at')
            .orderBy('claimed_at', 'asc')
            .limit(limit);
        if (!deliveries.length)
            return new Map();
        const sourceToDelivery = new Map(deliveries.map((delivery) => [delivery.store_credit_account_id, delivery]));
        const claimCredits = await this.knex('store_credit_account_transaction')
            .select(['account_id', 'reference_id'])
            .where({ type: 'credit', reference: 'store-credit' })
            .whereIn('reference_id', [...sourceToDelivery.keys()])
            .whereNull('deleted_at');
        const targetAccountIds = [...new Set(claimCredits.map((credit) => String(credit.account_id)))];
        if (!targetAccountIds.length)
            return new Map();
        const transactions = await this.knex('store_credit_account_transaction')
            .select(['id', 'account_id', 'amount', 'type', 'reference', 'reference_id', 'created_at'])
            .whereIn('account_id', targetAccountIds)
            .whereNull('deleted_at')
            .orderBy([{ column: 'created_at', order: 'asc' }, { column: 'id', order: 'asc' }]);
        const result = new Map();
        const attributed = (0, attribution_1.attributeGiftCardLedger)(transactions, new Set(sourceToDelivery.keys()));
        for (const [sourceAccountId, balance] of attributed) {
            const delivery = sourceToDelivery.get(sourceAccountId);
            if (!delivery)
                continue;
            if (recordMilestones && balance.first_used_at)
                await this.recordUsageMilestone(delivery, 'first_use', balance.first_used_at);
            if (recordMilestones && balance.exhausted_at)
                await this.recordUsageMilestone(delivery, 'exhausted', balance.exhausted_at);
            result.set(delivery.id, { delivery, remaining: balance.remaining, target_account_id: balance.target_account_id });
        }
        return result;
    }
    async recordUsageMilestone(delivery, event, occurredAt) {
        const column = event === 'first_use' ? 'first_used_at' : 'exhausted_at';
        const rows = await this.knex('gift_card_delivery')
            .where({ id: delivery.id })
            .whereNull(column)
            .whereNull('deleted_at')
            .update({ [column]: occurredAt, updated_at: new Date() })
            .returning('id');
        if (!rows[0])
            return false;
        await this.createGiftCardEvents({
            delivery_id: delivery.id,
            event,
            design_id: delivery.design_id,
            currency_code: delivery.currency_code,
            amount: Number(delivery.face_value),
            occurred_at: occurredAt,
            metadata: { attribution: 'fifo_store_credit_ledger' },
        });
        delivery[column] = occurredAt;
        return true;
    }
    async reconcileUsageMilestones() {
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
    async listExpiringNotificationCandidates(days, limit = 100) {
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
    async listBalanceReminderCandidates(days, limit = 100) {
        const balances = await this.attributedGiftBalances();
        const cutoff = Date.now() - Math.max(1, days) * 86_400_000;
        const candidates = [...balances.values()]
            .filter(({ delivery, remaining }) => remaining > 0 && Boolean(delivery.claimed_customer_id) && new Date(delivery.claimed_at).getTime() <= cutoff)
            .slice(0, limit);
        if (!candidates.length)
            return [];
        const customerIds = [...new Set(candidates.map(({ delivery }) => delivery.claimed_customer_id))];
        const customers = await this.knex('customer').select(['id', 'email']).whereIn('id', customerIds).whereNull('deleted_at');
        const emails = new Map(customers.map((customer) => [String(customer.id), String(customer.email).toLowerCase()]));
        return candidates.flatMap(({ delivery, remaining }) => {
            const email = emails.get(delivery.claimed_customer_id);
            return email ? [{ delivery, remaining, customer_email: email }] : [];
        });
    }
    async claimLifecycleNotification(delivery, event) {
        const id = `gcevent_${(0, node_crypto_1.randomUUID)().replace(/-/g, '')}`;
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
    async completeLifecycleNotification(eventId, notificationId) {
        await this.knex('gift_card_event').where({ id: eventId }).update({
            metadata: { status: 'sent', notification_id: notificationId ?? null },
            updated_at: new Date(),
        });
    }
    async releaseLifecycleNotification(eventId) {
        await this.knex('gift_card_event').where({ id: eventId }).delete();
    }
    async requeueDelivery(deliveryId) {
        const delivery = (await this.retrieveGiftCardDelivery(deliveryId));
        if (!['failed', 'dead_letter', 'sent'].includes(delivery.delivery_status)) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_ALLOWED, 'La entrega no se puede reenviar en su estado actual.');
        }
        await this.updateGiftCardDeliveries({
            id: deliveryId,
            delivery_status: 'pending',
            next_retry_at: new Date(),
            processing_started_at: null,
            last_error: null,
            metadata: { ...(delivery.metadata ?? {}), manual_resend: true },
        });
        return (await this.retrieveGiftCardDelivery(deliveryId));
    }
    async markClaimed(deliveryId, customerId) {
        await this.updateGiftCardDeliveries({ id: deliveryId, claimed_at: new Date(), claimed_customer_id: customerId });
    }
    async findDeliveryByTokenHash(hash) {
        const [delivery] = await this.listGiftCardDeliveries({ token_hash: hash }, { take: 1 });
        return delivery ?? null;
    }
    async applySendGridEvent(input) {
        return this.knex.transaction(async (transaction) => {
            const inserted = await transaction('gift_card_webhook_event').insert({
                event_id: input.eventId,
                provider: 'sendgrid',
                event_type: input.event,
                message_id: input.messageId,
                occurred_at: input.occurredAt,
            }).onConflict('event_id').ignore().returning('event_id');
            if (!inserted[0])
                return false;
            const delivery = await transaction('gift_card_delivery')
                .where({ provider_message_id: input.messageId })
                .whereNull('deleted_at')
                .first();
            if (!delivery)
                return false;
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
            }
            else if (input.event === 'bounce' || input.event === 'dropped') {
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
    async analytics(deliveryIds) {
        const scoped = (q) => deliveryIds ? q.whereIn('id', deliveryIds) : q;
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
        const claimedRemaining = new Map();
        for (const { delivery, remaining } of attributed.values()) {
            const currency = delivery.currency_code.toLowerCase();
            claimedRemaining.set(currency, (claimedRemaining.get(currency) ?? 0) + remaining);
        }
        const enrichedCurrency = perCurrency.map((row) => ({
            ...row,
            unused_attributed_balance: Number(row.unclaimed_face_value ?? 0) + (claimedRemaining.get(String(row.currency_code).toLowerCase()) ?? 0),
        }));
        return { ...summary, per_currency: enrichedCurrency, by_design: byDesign, by_delivery_status: byStatus, funnel_30d: funnel };
    }
    async recordEvent(event, delivery, metadata) {
        await this.createGiftCardEvents({
            delivery_id: delivery?.id ?? null, event,
            design_id: delivery?.design_id ?? null,
            currency_code: delivery?.currency_code ?? null,
            amount: delivery ? Number(delivery.face_value) : null,
            occurred_at: new Date(), metadata: metadata ?? null,
        });
    }
}
exports.default = GiftCardExperienceModuleService;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2dpZnQtY2FyZC1leHBlcmllbmNlL3NlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscURBQXVFO0FBQ3ZFLDZDQUF5QztBQUN6QyxxQ0FBK0M7QUFDL0MsdUNBQWdEO0FBQ2hELCtDQUEyRjtBQUMzRixxQ0FNa0I7QUFRbEIsTUFBTSxhQUFhLEdBQUcsQ0FBQyxLQUFjLEVBQUUsR0FBRyxHQUFHLElBQUksRUFBVSxFQUFFO0lBQzNELE1BQU0sT0FBTyxHQUFHLEtBQUssWUFBWSxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUN2RSxPQUFPLE9BQU8sQ0FBQyxPQUFPLENBQUMsWUFBWSxFQUFFLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFDMUQsQ0FBQyxDQUFDO0FBeXVCTyxzQ0FBYTtBQXZ1QnRCLE1BQU0sK0JBQWdDLFNBQVEsSUFBQSxxQkFBYSxFQUFDO0lBQzFELGNBQWMsRUFBZCx1QkFBYztJQUNkLGdCQUFnQixFQUFoQix5QkFBZ0I7SUFDaEIsdUJBQXVCLEVBQXZCLGdDQUF1QjtJQUN2QixnQkFBZ0IsRUFBaEIseUJBQWdCO0lBQ2hCLGFBQWEsRUFBYixzQkFBYTtDQUNkLENBQUM7SUFDQSxJQUFZLElBQUk7UUFDZCxPQUFRLElBQVksQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQ3ZELENBQUM7SUFFRDs7Ozs7Ozs7Ozs7Ozs7Ozs7T0FpQkc7SUFDSCxLQUFLLENBQUMsV0FBVyxDQUFDLE1BQXFCO1FBQ3JDLElBQUksTUFBTSxFQUFFLENBQUM7WUFDWCxNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsTUFBTSxJQUFJLENBQUMsb0JBQW9C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