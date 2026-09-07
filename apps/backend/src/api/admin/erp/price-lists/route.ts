import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

/**
 * GET /admin/erp/price-lists — price lists y customer groups de Medusa, para que
 * la pantalla de configuración arme el mapeo `precioN → lista` con selects en
 * lugar de pedirle al usuario que tipee ids.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const { data: priceLists } = (await query.graph({
    entity: 'price_list',
    fields: ['id', 'title', 'status', 'type'],
    pagination: { skip: 0, take: 200, order: { title: 'ASC' } },
  })) as { data: Array<{ id: string; title: string; status: string; type: string }> };

  const { data: customerGroups } = (await query.graph({
    entity: 'customer_group',
    fields: ['id', 'name'],
    pagination: { skip: 0, take: 200, order: { name: 'ASC' } },
  })) as { data: Array<{ id: string; name: string }> };

  const { data: shippingProfiles } = (await query.graph({
    entity: 'shipping_profile',
    fields: ['id', 'name'],
    pagination: { skip: 0, take: 50, order: { name: 'ASC' } },
  })) as { data: Array<{ id: string; name: string }> };

  // Canales, para acotar el sync de stock por demo desde la misma pantalla en
  // lugar de pedir ids a mano.
  const { data: salesChannels } = (await query.graph({
    entity: 'sales_channel',
    fields: ['id', 'name', 'is_disabled'],
    pagination: { skip: 0, take: 100, order: { name: 'ASC' } },
  })) as { data: Array<{ id: string; name: string; is_disabled: boolean }> };

  res.json({
    price_lists: priceLists,
    customer_groups: customerGroups,
    shipping_profiles: shippingProfiles,
    sales_channels: salesChannels,
  });
}
