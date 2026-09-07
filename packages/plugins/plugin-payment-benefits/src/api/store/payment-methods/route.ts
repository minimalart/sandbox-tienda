import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { PAYMENT_BENEFITS_MODULE } from '../../../modules/payment-benefits';
import type PaymentBenefitsModuleService from '../../../modules/payment-benefits/service';
import { siteFromPublishableKey } from '../../../lib/multistore/publishable-key';
import { siteColumnFilter } from '../../../lib/multistore/scope';
import { PAYMENT_METHOD_CATALOG_SITE_SCOPE } from '../../../modules/payment-benefits/site-scope';

type CatalogRow = {
  id: string;
  provider_code: string;
  external_id: string;
  name: string;
  payment_type_id: string | null;
  status: string | null;
  thumbnail_url: string | null;
  max_interest_free_installments: number | null;
};

/**
 * Catálogo público de medios de pago sincronizados (con logos). Alimenta el
 * "Ver todos los medios de pago" de la ficha de producto. Incluye TODOS los
 * medios activos, tengan o no cuotas sin interés.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<PaymentBenefitsModuleService>(PAYMENT_BENEFITS_MODULE);
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
  const rows = (await service.listPaymentMethodCatalogs(
    siteColumnFilter(await siteFromPublishableKey(req), PAYMENT_METHOD_CATALOG_SITE_SCOPE),
    { order: { payment_type_id: 'ASC', name: 'ASC' }, take: 500 },
  )) as unknown as CatalogRow[];

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
