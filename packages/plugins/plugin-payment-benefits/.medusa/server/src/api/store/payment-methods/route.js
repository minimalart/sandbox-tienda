"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const payment_benefits_1 = require("../../../modules/payment-benefits");
const publishable_key_1 = require("../../../lib/multistore/publishable-key");
const scope_1 = require("../../../lib/multistore/scope");
const site_scope_1 = require("../../../modules/payment-benefits/site-scope");
/**
 * Catálogo público de medios de pago sincronizados (con logos). Alimenta el
 * "Ver todos los medios de pago" de la ficha de producto. Incluye TODOS los
 * medios activos, tengan o no cuotas sin interés.
 */
async function GET(req, res) {
    const service = req.scope.resolve(payment_benefits_1.PAYMENT_BENEFITS_MODULE);
    /**
     * El catálogo de MI tienda, no el de todas.
     *
     * `payment_method_catalog` se sincroniza contra la cuenta de MercadoPago de cada
     * tienda —de ahí que tenga `site_id`— así que listarlo entero mostraba, en la ficha
     * de producto, los medios habilitados en la cuenta de OTRO negocio. El cliente ve un
     * logo de una tarjeta que su checkout después no le va a ofrecer, y eso es una
     * promesa incumplida en la pantalla donde decide comprar.
     *
     * `empty: 'all'` conserva la fila global —la que sincroniza con las credenciales de
     * entorno—, que es la de toda tienda sin cuenta propia.
     */
    const rows = (await service.listPaymentMethodCatalogs((0, scope_1.siteColumnFilter)(await (0, publishable_key_1.siteFromPublishableKey)(req), site_scope_1.PAYMENT_METHOD_CATALOG_SITE_SCOPE), { order: { payment_type_id: 'ASC', name: 'ASC' }, take: 500 }));
    const payment_methods = rows
        // Escondemos medios dados de baja explícitamente ("deactive"/"inactive").
        .filter((m) => !m.status || !/deactiv|inactiv/i.test(m.status))
        .map((m) => ({
        external_id: m.external_id,
        name: m.name,
        payment_type_id: m.payment_type_id,
        thumbnail_url: m.thumbnail_url,
        max_interest_free_installments: m.max_interest_free_installments,
    }));
    res.json({ payment_methods });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL3BheW1lbnQtbWV0aG9kcy9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQXVCQSxrQkErQkM7QUFyREQsd0VBQTRFO0FBRTVFLDZFQUFpRjtBQUNqRix5REFBaUU7QUFDakUsNkVBQWlHO0FBYWpHOzs7O0dBSUc7QUFDSSxLQUFLLFVBQVUsR0FBRyxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDL0QsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQStCLDBDQUF1QixDQUFDLENBQUM7SUFDekY7Ozs7Ozs7Ozs7O09BV0c7SUFDSCxNQUFNLElBQUksR0FBRyxDQUFDLE1BQU0sT0FBTyxDQUFDLHlCQUF5QixDQUNuRCxJQUFBLHdCQUFnQixFQUFDLE1BQU0sSUFBQSx3Q0FBc0IsRUFBQyxHQUFHLENBQUMsRUFBRSw4Q0FBaUMsQ0FBQyxFQUN0RixFQUFFLEtBQUssRUFBRSxFQUFFLGVBQWUsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsQ0FDOUQsQ0FBNEIsQ0FBQztJQUU5QixNQUFNLGVBQWUsR0FBRyxJQUFJO1FBQzFCLDBFQUEwRTtTQUN6RSxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUM7U0FDOUQsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQ1gsV0FBVyxFQUFFLENBQUMsQ0FBQyxXQUFXO1FBQzFCLElBQUksRUFBRSxDQUFDLENBQUMsSUFBSTtRQUNaLGVBQWUsRUFBRSxDQUFDLENBQUMsZUFBZTtRQUNsQyxhQUFhLEVBQUUsQ0FBQyxDQUFDLGFBQWE7UUFDOUIsOEJBQThCLEVBQUUsQ0FBQyxDQUFDLDhCQUE4QjtLQUNqRSxDQUFDLENBQUMsQ0FBQztJQUVOLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxlQUFlLEVBQUUsQ0FBQyxDQUFDO0FBQ2hDLENBQUMifQ==