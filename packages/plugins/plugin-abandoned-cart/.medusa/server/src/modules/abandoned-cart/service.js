"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
const models_1 = require("./models");
const config_1 = require("./config");
const lib_1 = require("./lib");
const HOUR_MS = 60 * 60 * 1000;
class AbandonedCartModuleService extends (0, utils_1.MedusaService)({
    AbandonedCart: models_1.AbandonedCart,
    AbandonedCartNotification: models_1.AbandonedCartNotification,
}) {
    getConfig() {
        return (0, config_1.getAbandonedCartConfig)();
    }
    /**
     * Crea o actualiza el tracking de un carrito. Nunca reabre un carrito ya
     * `recovered`/`cancelled`. En altas nuevas, `next_eligible_at` = actividad +
     * primer paso; en existentes, refresca contacto/valor/actividad y reprograma la
     * secuencia cuando hace falta (ver abajo).
     */
    async upsertFromSnapshot(snapshot, config) {
        const existing = (await this.listAbandonedCarts({ cart_id: snapshot.cart_id }))[0];
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
            const gainedContact = !(0, lib_1.isContactable)(existing) &&
                (0, lib_1.isContactable)(snapshot) &&
                existing.next_eligible_at == null;
            const nextEligible = revived || gainedContact
                ? (0, lib_1.nextEligibleAfter)(snapshot.last_activity_at, existing.last_step_sent ?? 0, config)
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
        const nextEligible = (0, lib_1.nextEligibleAfter)(snapshot.last_activity_at, 0, config);
        const [created] = await this.createAbandonedCarts([
            {
                cart_id: snapshot.cart_id,
                email: snapshot.email,
                phone: snapshot.phone,
                customer_id: snapshot.customer_id,
                sales_channel_id: snapshot.sales_channel_id,
                cart_total: snapshot.cart_total,
                currency_code: snapshot.currency_code,
                status: 'pending',
                last_step_sent: 0,
                next_eligible_at: nextEligible,
                last_activity_at: snapshot.last_activity_at,
            },
        ]);
        return { record: created, created: true };
    }
    /** Tracking vencido para el próximo paso (candidatos a notificar). */
    async listDue(now, limit) {
        return this.listAbandonedCarts({
            status: ['pending', 'notified'],
            next_eligible_at: { $lte: now, $ne: null },
        }, { take: limit, order: { next_eligible_at: 'ASC' } });
    }
    /** Horas de inactividad de un tracking respecto de `now`. */
    idleHoursFor(record, now) {
        const last = record.last_activity_at
            ? new Date(record.last_activity_at)
            : now;
        return (now.getTime() - last.getTime()) / HOUR_MS;
    }
    /** El paso que corresponde enviar ahora para un tracking, o null. */
    resolveNextStep(record, config, now) {
        return (0, config_1.nextStepFor)(config, record.last_step_sent ?? 0, this.idleHoursFor(record, now));
    }
    /**
     * Registra el resultado de un envío (idempotente por paso+canal), avanza
     * `last_step_sent` cuando el paso se completó y recalcula `next_eligible_at`
     * hacia el siguiente paso (o null si no hay más).
     */
    async recordStepResult(input) {
        const { abandonedCartId, step, results, config, now } = input;
        for (const r of results) {
            const dup = (await this.listAbandonedCartNotifications({
                abandoned_cart_id: abandonedCartId,
                step,
                channel: r.channel,
            }))[0];
            if (dup)
                continue;
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
        const nextEligible = (0, lib_1.nextEligibleAfter)(last, step, config);
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
                ...(sent ? { status: 'notified' } : {}),
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
    async deferUntilContactable(abandonedCartId) {
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
    async getMetrics(filters) {
        const manager = this.__container__.manager;
        const knex = manager.getKnex();
        const query = knex('abandoned_cart')
            .whereNull('deleted_at')
            .select('status', 'currency_code', 'sales_channel_id')
            .select(knex.raw('(email IS NOT NULL OR phone IS NOT NULL) AS contactable'))
            .count('* AS count')
            .sum('cart_total AS value')
            .groupBy('status', 'currency_code', 'sales_channel_id', 'contactable');
        if (filters?.sales_channel_id) {
            query.where('sales_channel_id', filters.sales_channel_id);
        }
        const rows = (await query);
        return (0, lib_1.shapeMetrics)(rows.map((r) => ({
            status: r.status,
            currency_code: r.currency_code,
            sales_channel_id: r.sales_channel_id,
            contactable: Boolean(r.contactable),
            // pg devuelve COUNT como bigint (string) y SUM(numeric) como string.
            count: Number(r.count) || 0,
            value: Number(r.value) || 0,
        })));
    }
    /**
     * Marca como recuperado (se convirtió en orden). Corta la secuencia. `orderId`
     * puede ser null cuando se detecta el carrito ya completado sin conocer la orden.
     */
    async markRecoveredByCartId(cartId, orderId) {
        const record = (await this.listAbandonedCarts({ cart_id: cartId }))[0];
        if (!record || record.status === 'recovered')
            return false;
        await this.updateAbandonedCarts([
            {
                id: record.id,
                status: 'recovered',
                recovered_order_id: orderId,
                next_eligible_at: null,
            },
        ]);
        return true;
    }
}
exports.default = AbandonedCartModuleService;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2FiYW5kb25lZC1jYXJ0L3NlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxxREFBMEQ7QUFDMUQscUNBQW9FO0FBQ3BFLHFDQUtrQjtBQUNsQiwrQkFNZTtBQW9CZixNQUFNLE9BQU8sR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLElBQUksQ0FBQztBQUUvQixNQUFNLDBCQUEyQixTQUFRLElBQUEscUJBQWEsRUFBQztJQUNyRCxhQUFhLEVBQWIsc0JBQWE7SUFDYix5QkFBeUIsRUFBekIsa0NBQXlCO0NBQzFCLENBQUM7SUFDQSxTQUFTO1FBQ1AsT0FBTyxJQUFBLCtCQUFzQixHQUFFLENBQUM7SUFDbEMsQ0FBQztJQUVEOzs7OztPQUtHO0lBQ0gsS0FBSyxDQUFDLGtCQUFrQixDQUN0QixRQUErQixFQUMvQixNQUEyQjtRQUUzQixNQUFNLFFBQVEsR0FBRyxDQUNmLE1BQU0sSUFBSSxDQUFDLGtCQUFrQixDQUFDLEVBQUUsT0FBTyxFQUFFLFFBQVEsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUM3RCxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRUwsSUFBSSxRQUFRLEVBQUUsQ0FBQztZQUNiLElBQUksUUFBUSxDQUFDLE1BQU0sS0FBSyxXQUFXLElBQUksUUFBUSxDQUFDLE1BQU0sS0FBSyxXQUFXLEVBQUUsQ0FBQztnQkFDdkUsT0FBTyxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxDQUFDO1lBQzlDLENBQUM7WUFFRCxNQUFNLGdCQUFnQixHQUFHLFFBQVEsQ0FBQyxnQkFBZ0I7Z0JBQ2hELENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLENBQUM7Z0JBQ3JDLENBQUMsQ0FBQyxJQUFJLENBQUM7WUFDVCw2RUFBNkU7WUFDN0UsTUFBTSxPQUFPLEdBQUcsZ0JBQWdCO2dCQUM5QixDQUFDLENBQUMsUUFBUSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxHQUFHLGdCQUFnQixDQUFDLE9BQU8sRUFBRTtnQkFDbEUsQ0FBQyxDQUFDLElBQUksQ0FBQztZQUNULDJFQUEyRTtZQUMzRSwwREFBMEQ7WUFDMUQsTUFBTSxhQUFhLEdBQ2pCLENBQUMsSUFBQSxtQkFBYSxFQUFDLFFBQVEsQ0FBQztnQkFDeEIsSUFBQSxtQkFBYSxFQUFDLFFBQVEsQ0FBQztnQkFDdkIsUUFBUSxDQUFDLGdCQUFnQixJQUFJLElBQUksQ0FBQztZQUVwQyxNQUFNLFlBQVksR0FDaEIsT0FBTyxJQUFJLGFBQWE7Z0JBQ3RCLENBQUMsQ0FBQyxJQUFBLHVCQUFpQixFQUNmLFFBQVEsQ0FBQyxnQkFBZ0IsRUFDekIsUUFBUSxDQUFDLGNBQWMsSUFBSSxDQUFDLEVBQzVCLE1BQU0sQ0FDUDtnQkFDSCxDQUFDLENBQUMsUUFBUSxDQUFDLGdCQUFnQixDQUFDO1lBRWhDLE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxNQUFNLElBQUksQ0FBQyxvQkFBb0IsQ0FBQztnQkFDaEQ7b0JBQ0UsRUFBRSxFQUFFLFFBQVEsQ0FBQyxFQUFFO29CQUNmLEtBQUssRUFBRSxRQUFRLENBQUMsS0FBSztvQkFDckIsS0FBSyxFQUFFLFFBQVEsQ0FBQyxLQUFLO29CQUNyQixXQUFXLEVBQUUsUUFBUSxDQUFDLFdBQVc7b0JBQ2pDLGdCQUFnQixFQUFFLFFBQVEsQ0FBQyxnQkFBZ0I7b0JBQzNDLFVBQVUsRUFBRSxRQUFRLENBQUMsVUFBVTtvQkFDL0IsYUFBYSxFQUFFLFFBQVEsQ0FBQyxhQUFhO29CQUNyQyxnQkFBZ0IsRUFBRSxRQUFRLENBQUMsZ0JBQWdCO29CQUMzQyxnQkFBZ0IsRUFBRSxZQUFZO2lCQUMvQjthQUNGLENBQUMsQ0FBQztZQUNILE9BQU8sRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsQ0FBQztRQUM3QyxDQUFDO1FBRUQsTUFBTSxZQUFZLEdBQUcsSUFBQSx1QkFBaUIsRUFBQyxRQUFRLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQzdFLE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxNQUFNLElBQUksQ0FBQyxvQkFBb0IsQ0FBQztZQUNoRDtnQkFDRSxPQUFPLEVBQUUsUUFBUSxDQUFDLE9BQU87Z0JBQ3pCLEtBQUssRUFBRSxRQUFRLENBQUMsS0FBSztnQkFDckIsS0FBSyxFQUFFLFFBQVEsQ0FBQyxLQUFLO2dCQUNyQixXQUFXLEVBQUUsUUFBUSxDQUFDLFdBQVc7Z0JBQ2pDLGdCQUFnQixFQUFFLFFBQVEsQ0FBQyxnQkFBZ0I7Z0JBQzNDLFVBQVUsRUFBRSxRQUFRLENBQUMsVUFBVTtnQkFDL0IsYUFBYSxFQUFFLFFBQVEsQ0FBQyxhQUFhO2dCQUNyQyxNQUFNLEVBQUUsU0FBdUM7Z0JBQy9DLGNBQWMsRUFBRSxDQUFDO2dCQUNqQixnQkFBZ0IsRUFBRSxZQUFZO2dCQUM5QixnQkFBZ0IsRUFBRSxRQUFRLENBQUMsZ0JBQWdCO2FBQzVDO1NBQ0YsQ0FBQyxDQUFDO1FBQ0gsT0FBTyxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxDQUFDO0lBQzVDLENBQUM7SUFFRCxzRUFBc0U7SUFDdEUsS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFTLEVBQUUsS0FBYTtRQUNwQyxPQUFPLElBQUksQ0FBQyxrQkFBa0IsQ0FDNUI7WUFDRSxNQUFNLEVBQUUsQ0FBQyxTQUFTLEVBQUUsVUFBVSxDQUFDO1lBQy9CLGdCQUFnQixFQUFFLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFO1NBQzNDLEVBQ0QsRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxFQUFFLGdCQUFnQixFQUFFLEtBQUssRUFBRSxFQUFFLENBQ3BELENBQUM7SUFDSixDQUFDO0lBRUQsNkRBQTZEO0lBQzdELFlBQVksQ0FBQyxNQUFtRCxFQUFFLEdBQVM7UUFDekUsTUFBTSxJQUFJLEdBQUcsTUFBTSxDQUFDLGdCQUFnQjtZQUNsQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDO1lBQ25DLENBQUMsQ0FBQyxHQUFHLENBQUM7UUFDUixPQUFPLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRSxHQUFHLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQyxHQUFHLE9BQU8sQ0FBQztJQUNwRCxDQUFDO0lBRUQscUVBQXFFO0lBQ3JFLGVBQWUsQ0FDYixNQUFtRixFQUNuRixNQUEyQixFQUMzQixHQUFTO1FBRVQsT0FBTyxJQUFBLG9CQUFXLEVBQ2hCLE1BQU0sRUFDTixNQUFNLENBQUMsY0FBYyxJQUFJLENBQUMsRUFDMUIsSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQUUsR0FBRyxDQUFDLENBQy9CLENBQUM7SUFDSixDQUFDO0lBRUQ7Ozs7T0FJRztJQUNILEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxLQVl0QjtRQUNDLE1BQU0sRUFBRSxlQUFlLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFLEdBQUcsS0FBSyxDQUFDO1FBRTlELEtBQUssTUFBTSxDQUFDLElBQUksT0FBTyxFQUFFLENBQUM7WUFDeEIsTUFBTSxHQUFHLEdBQUcsQ0FDVixNQUFNLElBQUksQ0FBQyw4QkFBOEIsQ0FBQztnQkFDeEMsaUJBQWlCLEVBQUUsZUFBZTtnQkFDbEMsSUFBSTtnQkFDSixPQUFPLEVBQUUsQ0FBQyxDQUFDLE9BQU87YUFDbkIsQ0FBQyxDQUNILENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDTCxJQUFJLEdBQUc7Z0JBQUUsU0FBUztZQUNsQixNQUFNLElBQUksQ0FBQyxnQ0FBZ0MsQ0FBQztnQkFDMUM7b0JBQ0UsaUJBQWlCLEVBQUUsZUFBZTtvQkFDbEMsSUFBSTtvQkFDSixPQUFPLEVBQUUsQ0FBQyxDQUFDLE9BQU87b0JBQ2xCLFFBQVEsRUFBRSxDQUFDLENBQUMsUUFBUTtvQkFDcEIsU0FBUyxFQUFFLENBQUMsQ0FBQyxTQUFTO29CQUN0QixNQUFNLEVBQUUsQ0FBQyxDQUFDLE1BQU07b0JBQ2hCLEtBQUssRUFBRSxDQUFDLENBQUMsS0FBSyxJQUFJLElBQUk7b0JBQ3RCLE9BQU8sRUFBRSxHQUFHO2lCQUNiO2FBQ0YsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUVELE1BQU0sTUFBTSxHQUFHLE1BQU0sSUFBSSxDQUFDLHFCQUFxQixDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQ2pFLE1BQU0sSUFBSSxHQUFHLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsSUFBSSxHQUFHLENBQUMsQ0FBQztRQUN0RCxNQUFNLFlBQVksR0FBRyxJQUFBLHVCQUFpQixFQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFFM0QsNkVBQTZFO1FBQzdFLDRFQUE0RTtRQUM1RSw4RUFBOEU7UUFDOUUsTUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sS0FBSyxNQUFNLENBQUMsQ0FBQztRQUV0RCxNQUFNLElBQUksQ0FBQyxvQkFBb0IsQ0FBQztZQUM5QjtnQkFDRSxFQUFFLEVBQUUsZUFBZTtnQkFDbkIsbUVBQW1FO2dCQUNuRSxxREFBcUQ7Z0JBQ3JELGNBQWMsRUFBRSxJQUFJO2dCQUNwQixHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLE1BQU0sRUFBRSxVQUF3QyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztnQkFDckUsZ0JBQWdCLEVBQUUsWUFBWTthQUMvQjtTQUNGLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRDs7Ozs7T0FLRztJQUNILEtBQUssQ0FBQyxxQkFBcUIsQ0FBQyxlQUF1QjtRQUNqRCxNQUFNLElBQUksQ0FBQyxvQkFBb0IsQ0FBQztZQUM5QixFQUFFLEVBQUUsRUFBRSxlQUFlLEVBQUUsZ0JBQWdCLEVBQUUsSUFBSSxFQUFFO1NBQ2hELENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRDs7Ozs7Ozs7OztPQVVHO0lBQ0gsS0FBSyxDQUFDLFVBQVUsQ0FBQyxPQUVoQjtRQUNDLE1BQU0sT0FBTyxHQUFJLElBQVksQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDO1FBQ3BELE1BQU0sSUFBSSxHQUFHLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUUvQixNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUM7YUFDakMsU0FBUyxDQUFDLFlBQVksQ0FBQzthQUN2QixNQUFNLENBQUMsUUFBUSxFQUFFLGVBQWUsRUFBRSxrQkFBa0IsQ0FBQzthQUNyRCxNQUFNLENBQ0wsSUFBSSxDQUFDLEdBQUcsQ0FDTix5REFBeUQsQ0FDMUQsQ0FDRjthQUNBLEtBQUssQ0FBQyxZQUFZLENBQUM7YUFDbkIsR0FBRyxDQUFDLHFCQUFxQixDQUFDO2FBQzFCLE9BQU8sQ0FBQyxRQUFRLEVBQUUsZUFBZSxFQUFFLGtCQUFrQixFQUFFLGFBQWEsQ0FBQyxDQUFDO1FBRXpFLElBQUksT0FBTyxFQUFFLGdCQUFnQixFQUFFLENBQUM7WUFDOUIsS0FBSyxDQUFDLEtBQUssQ0FBQyxrQkFBa0IsRUFBRSxPQUFPLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztRQUM1RCxDQUFDO1FBRUQsTUFBTSxJQUFJLEdBQUcsQ0FBQyxNQUFNLEtBQUssQ0FPdkIsQ0FBQztRQUVILE9BQU8sSUFBQSxrQkFBWSxFQUNqQixJQUFJLENBQUMsR0FBRyxDQUNOLENBQUMsQ0FBQyxFQUF1QixFQUFFLENBQUMsQ0FBQztZQUMzQixNQUFNLEVBQUUsQ0FBQyxDQUFDLE1BQU07WUFDaEIsYUFBYSxFQUFFLENBQUMsQ0FBQyxhQUFhO1lBQzlCLGdCQUFnQixFQUFFLENBQUMsQ0FBQyxnQkFBZ0I7WUFDcEMsV0FBVyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDO1lBQ25DLHFFQUFxRTtZQUNyRSxLQUFLLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDO1lBQzNCLEtBQUssRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUM7U0FDNUIsQ0FBQyxDQUNILENBQ0YsQ0FBQztJQUNKLENBQUM7SUFFRDs7O09BR0c7SUFDSCxLQUFLLENBQUMscUJBQXFCLENBQ3pCLE1BQWMsRUFDZCxPQUFzQjtRQUV0QixNQUFNLE1BQU0sR0FBRyxDQUFDLE1BQU0sSUFBSSxDQUFDLGtCQUFrQixDQUFDLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN2RSxJQUFJLENBQUMsTUFBTSxJQUFJLE1BQU0sQ0FBQyxNQUFNLEtBQUssV0FBVztZQUFFLE9BQU8sS0FBSyxDQUFDO1FBQzNELE1BQU0sSUFBSSxDQUFDLG9CQUFvQixDQUFDO1lBQzlCO2dCQUNFLEVBQUUsRUFBRSxNQUFNLENBQUMsRUFBRTtnQkFDYixNQUFNLEVBQUUsV0FBeUM7Z0JBQ2pELGtCQUFrQixFQUFFLE9BQU87Z0JBQzNCLGdCQUFnQixFQUFFLElBQUk7YUFDdkI7U0FDRixDQUFDLENBQUM7UUFDSCxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7Q0FDRjtBQUVELGtCQUFlLDBCQUEwQixDQUFDIn0=