import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { authorizeCheckoutAdmin, checkoutErrorResponse } from '../../../../../modules/demo-store/checkout/http';
import { maskedPeople, mapOrderUnits } from '../../../../../modules/demo-store/checkout/assignments';

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  try {
    const query: any = req.scope.resolve(ContainerRegistrationKeys.QUERY);
    const { data } = await query.graph({ entity: 'order', fields: ['id', 'sales_channel_id', 'items.*'], filters: { id: req.params.id } });
    const order = data[0];
    if (!order) return res.status(404).json({ message: 'Pedido no encontrado.' });
    const { data: links } = await query.graph({ entity: 'order_cart', fields: ['cart_id'], filters: { order_id: order.id } });
    if (!links[0]?.cart_id) return res.json({ checkout: null });
    const pg: any = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
    const session = await pg('site_checkout_session').where({ cart_id: links[0].cart_id }).first();
    if (!session?.snapshot_id) return res.json({ checkout: null });
    const snapshot = await pg('site_checkout_snapshot').where({ id: session.snapshot_id, cart_id: links[0].cart_id }).first();
    if (!snapshot) return res.json({ checkout: null });
    const reveal = req.query.documents === '1';
    const actor = await authorizeCheckoutAdmin(req, snapshot.site_id, reveal);
    // The immutable snapshot identifies the historical site even after channel reassignment.
    let canView = false;
    try { await authorizeCheckoutAdmin(req, snapshot.site_id, true); canView = true; } catch { /* masked view remains available */ }
    if (reveal) await pg('site_checkout_access_log').insert({ actor_id: actor, site_id: snapshot.site_id, order_id: order.id });
    return res.json({ checkout: { site_id: snapshot.site_id, version: snapshot.policy_version, people: reveal ? snapshot.people : maskedPeople(snapshot.people), units: mapOrderUnits(snapshot.units, order.items), can_view_documents: canView } });
  } catch (error) { return checkoutErrorResponse(res, error, req); }
}
