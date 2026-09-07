"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.channelOfOrder = channelOfOrder;
const utils_1 = require("@medusajs/framework/utils");
/**
 * El canal de la orden que originó una entrega de gift card.
 *
 * Lo comparten el envío (`delivery.ts`) y los avisos de vencimiento y saldo
 * (`lifecycle.ts`): las tres cosas son mails que salen a un comprador y tienen que
 * llevar la marca de la tienda que vendió la tarjeta.
 *
 * Se lee por SQL crudo y no por el módulo de órdenes porque esto corre dentro del
 * módulo de gift cards, que no lo declara como dependencia.
 *
 * Un fallo devuelve `null` y el mail sale con la marca global. Es deliberado: la marca
 * nunca puede voltear una entrega ya cobrada.
 */
async function channelOfOrder(container, orderId) {
    if (!orderId)
        return null;
    try {
        const pg = container.resolve(utils_1.ContainerRegistrationKeys.PG_CONNECTION);
        const result = await pg.raw(`SELECT "sales_channel_id" FROM "order" WHERE "id" = ? AND "deleted_at" IS NULL LIMIT 1`, [orderId]);
        return result?.rows?.[0]?.sales_channel_id ?? null;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3JkZXItY2hhbm5lbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2dpZnQtY2FyZC1leHBlcmllbmNlL29yZGVyLWNoYW5uZWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFnQkEsd0NBb0JDO0FBcENELHFEQUFzRTtBQUd0RTs7Ozs7Ozs7Ozs7O0dBWUc7QUFDSSxLQUFLLFVBQVUsY0FBYyxDQUNsQyxTQUEwQixFQUMxQixPQUFrQztJQUVsQyxJQUFJLENBQUMsT0FBTztRQUFFLE9BQU8sSUFBSSxDQUFDO0lBQzFCLElBQUksQ0FBQztRQUNILE1BQU0sRUFBRSxHQUFHLFNBQVMsQ0FBQyxPQUFPLENBQUMsaUNBQXlCLENBQUMsYUFBYSxDQUtuRSxDQUFDO1FBQ0YsTUFBTSxNQUFNLEdBQUcsTUFBTSxFQUFFLENBQUMsR0FBRyxDQUN6Qix3RkFBd0YsRUFDeEYsQ0FBQyxPQUFPLENBQUMsQ0FDVixDQUFDO1FBQ0YsT0FBTyxNQUFNLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsZ0JBQWdCLElBQUksSUFBSSxDQUFDO0lBQ3JELENBQUM7SUFBQyxNQUFNLENBQUM7UUFDUCxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7QUFDSCxDQUFDIn0=