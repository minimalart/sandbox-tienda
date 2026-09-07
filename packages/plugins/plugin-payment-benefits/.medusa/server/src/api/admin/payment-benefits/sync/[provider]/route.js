"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const mercatto_plugin_runtime_1 = require("@minimalart/mercatto-plugin-runtime");
const utils_1 = require("@medusajs/framework/utils");
const payment_benefits_1 = require("../../../../../modules/payment-benefits");
const providers_1 = require("../../../../../modules/payment-benefits/providers");
const request_1 = require("../../../../../lib/multistore/request");
const types_1 = require("../../../../../lib/multistore/types");
/**
 * POR QUÉ ACÁ NO VA `assertIdInSite` NI `assertRowInSite`, y qué se puso en su lugar.
 *
 * `:provider` NO es una PK: es un código de adapter que vive en CÓDIGO —`getProvider`
 * lo busca en el objeto `PROVIDERS` de `modules/payment-benefits/providers/index.ts`,
 * que hoy tiene dos claves fijas, `mercadopago` y `manual`—. No hay fila que chequear,
 * así que un guard por id acá sería un guard sobre la tabla equivocada: aparecería en
 * el diff, la revisión lo daría por cerrado y el agujero seguiría abierto. Es el mismo
 * caso que `admin/ga4-builtins/[key]`.
 *
 * El agujero real está más abajo y ya está documentado, en la franja de
 * `admin/routes/payment-benefits/settings/page.tsx`: esta corrida usa las credenciales
 * de la INSTANCIA (`process.env.MERCADOPAGO_ACCESS_TOKEN`) y escribe el catálogo
 * GLOBAL, porque `upsertCatalogMethod` resuelve la fila por `(provider_code,
 * external_id)` SIN `site_id` y la crea sin él —el modelo tiene la columna y hasta dos
 * índices únicos parciales para distinguir global de propia, pero el upsert no la
 * usa—. Lo mismo `upsertSyncedBenefit`, que crea el beneficio con
 * `sales_channel_ids: []`, o sea visible en todas. Cerrarlo de verdad es que el sync
 * tome las credenciales por tienda (`site_credential` ya existe) y que esos dos upserts
 * reciban el `site_id`: ninguna de las dos cosas se arregla en esta ruta.
 *
 * Lo que SÍ se puede aplicar acá es el eje sobre QUIÉN dispara una escritura que es de
 * todos. Con una tienda secundaria activa, este botón le pisa a las demás el catálogo
 * que leen —con la cuenta de MP de la instancia, que no es la suya— y encima lo hace
 * debajo de un badge que dice "esto es de tu tienda". Fail-closed: se permite desde la
 * vista de instancia y desde la principal, que es de quien es la fila global por
 * historia (mismo argumento que `inherit-global-for-main` en `scope.ts`).
 */
async function assertMayRunInstanceSync(req, res) {
    const resolution = await (0, request_1.siteFromRequest)(req);
    // Un id de tienda stale rompe, no degrada: mismo criterio y mismo código que
    // `lib/multistore/scope.ts:86` y que `app-settings`, para que el admin sepa limpiar
    // la tienda que tiene persistida y volver a elegir.
    if (resolution.status === 'unknownSite') {
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, `${types_1.UNKNOWN_SITE_ERROR_CODE}: la tienda solicitada no existe o fue eliminada.`);
    }
    // `singleSite`, `allSites` y `registryAbsent` pasan: no hay otra tienda a la que
    // pisarle nada, o quien pide está mirando la instancia entera y sabe qué toca.
    if (resolution.status !== 'site' || resolution.site.is_main)
        return true;
    // 403 y no 404, al revés que los guards por id: acá no hay existencia que ocultar
    // —los códigos de proveedor están en el código, no en la base—, y un 404 diría
    // "no existe" sobre algo que sí existe. Lo que corresponde decir es POR QUÉ no.
    res.status(403).json({
        message: 'La sincronización de proveedores es de la instancia: usa las credenciales de ' +
            'entorno y escribe el catálogo global que leen todas las tiendas. Ejecutala desde ' +
            'la tienda principal o sin tienda activa.',
    });
    return false;
}
/** Dispara la sincronización de un proveedor (PRD §13: POST /sync/provider/{id}). */
async function POST(req, res) {
    if (!(await assertMayRunInstanceSync(req, res)))
        return;
    const code = req.params.provider;
    const provider = (0, providers_1.getProvider)(code);
    if (!provider) {
        res.status(404).json({ message: `Proveedor desconocido: ${code}` });
        return;
    }
    if (!provider.supportsSync) {
        res.status(400).json({ message: `El proveedor ${code} no soporta sincronización.` });
        return;
    }
    const service = req.scope.resolve(payment_benefits_1.PAYMENT_BENEFITS_MODULE);
    const logger = req.scope.resolve(utils_1.ContainerRegistrationKeys.LOGGER);
    const result = await provider.sync({
        service,
        accessToken: (0, mercatto_plugin_runtime_1.getAppSettingsSyncReader)()?.('extension:mercadopago', 'MERCADOPAGO_ACCESS_TOKEN') || process.env.MERCADOPAGO_ACCESS_TOKEN,
        logger,
    });
    res.status(result.status === 'ok' ? 200 : 502).json({ result });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL3BheW1lbnQtYmVuZWZpdHMvc3luYy9bcHJvdmlkZXJdL3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBc0VBLG9CQTJCQztBQWpHRCxpRkFBK0U7QUFFL0UscURBQW1GO0FBQ25GLDhFQUFrRjtBQUVsRixpRkFBZ0Y7QUFDaEYsbUVBQXdFO0FBQ3hFLCtEQUE4RTtBQUU5RTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBMkJHO0FBQ0gsS0FBSyxVQUFVLHdCQUF3QixDQUNyQyxHQUErQixFQUMvQixHQUFtQjtJQUVuQixNQUFNLFVBQVUsR0FBRyxNQUFNLElBQUEseUJBQWUsRUFBQyxHQUFHLENBQUMsQ0FBQztJQUU5Qyw2RUFBNkU7SUFDN0Usb0ZBQW9GO0lBQ3BGLG9EQUFvRDtJQUNwRCxJQUFJLFVBQVUsQ0FBQyxNQUFNLEtBQUssYUFBYSxFQUFFLENBQUM7UUFDeEMsTUFBTSxJQUFJLG1CQUFXLENBQ25CLG1CQUFXLENBQUMsS0FBSyxDQUFDLFlBQVksRUFDOUIsR0FBRywrQkFBdUIsbURBQW1ELENBQzlFLENBQUM7SUFDSixDQUFDO0lBRUQsaUZBQWlGO0lBQ2pGLCtFQUErRTtJQUMvRSxJQUFJLFVBQVUsQ0FBQyxNQUFNLEtBQUssTUFBTSxJQUFJLFVBQVUsQ0FBQyxJQUFJLENBQUMsT0FBTztRQUFFLE9BQU8sSUFBSSxDQUFDO0lBRXpFLGtGQUFrRjtJQUNsRiwrRUFBK0U7SUFDL0UsZ0ZBQWdGO0lBQ2hGLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDO1FBQ25CLE9BQU8sRUFDTCwrRUFBK0U7WUFDL0UsbUZBQW1GO1lBQ25GLDBDQUEwQztLQUM3QyxDQUFDLENBQUM7SUFDSCxPQUFPLEtBQUssQ0FBQztBQUNmLENBQUM7QUFFRCxxRkFBcUY7QUFDOUUsS0FBSyxVQUFVLElBQUksQ0FBQyxHQUErQixFQUFFLEdBQW1CO0lBQzdFLElBQUksQ0FBQyxDQUFDLE1BQU0sd0JBQXdCLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQUUsT0FBTztJQUV4RCxNQUFNLElBQUksR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLFFBQWtCLENBQUM7SUFDM0MsTUFBTSxRQUFRLEdBQUcsSUFBQSx1QkFBVyxFQUFDLElBQUksQ0FBQyxDQUFDO0lBQ25DLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUNkLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLDBCQUEwQixJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDcEUsT0FBTztJQUNULENBQUM7SUFDRCxJQUFJLENBQUMsUUFBUSxDQUFDLFlBQVksRUFBRSxDQUFDO1FBQzNCLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLGdCQUFnQixJQUFJLDZCQUE2QixFQUFFLENBQUMsQ0FBQztRQUNyRixPQUFPO0lBQ1QsQ0FBQztJQUVELE1BQU0sT0FBTyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUErQiwwQ0FBdUIsQ0FBQyxDQUFDO0lBQ3pGLE1BQU0sTUFBTSxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLGlDQUF5QixDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBRW5FLE1BQU0sTUFBTSxHQUFHLE1BQU0sUUFBUSxDQUFDLElBQUksQ0FBQztRQUNqQyxPQUFPO1FBQ1AsV0FBVyxFQUNSLElBQUEsa0RBQXdCLEdBQUUsRUFBRSxDQUFDLHVCQUF1QixFQUFFLDBCQUEwQixDQUVuRSxJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsd0JBQXdCO1FBQ3hELE1BQU07S0FDUCxDQUFDLENBQUM7SUFFSCxHQUFHLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUM7QUFDbEUsQ0FBQyJ9