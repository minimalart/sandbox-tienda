import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { siteFromRequest } from '../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../lib/multistore/scope';
import { STORE_LOCATION_SITE_SCOPE } from '../../../../../modules/store-location/site-scope';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { provisionBranchWorkflow } from '../../../../../workflows/provision-branch';
import { PostAdminBranchConfig } from '../../validators';

type LinkedChannel = {
  id: string;
  name?: string;
  metadata?: Record<string, unknown> | null;
};

/**
 * Reads a branch's commercial wiring: operational flags + its linked sales
 * channels (with the channel_type stamped on each channel's metadata).
 */
async function readBranchConfig(req: MedusaRequest, id: string) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = await query.graph({
    entity: 'store_location',
    fields: [
      'id',
      'active',
      'stock_location_id',
      'sales_channels.id',
      'sales_channels.name',
      'sales_channels.metadata',
    ],
    filters: { id },
  });

  const branch = data?.[0];
  if (!branch) return null;

  return {
    id: branch.id,
    active: branch.active,
    stock_location_id: branch.stock_location_id ?? null,
    sales_channels: ((branch.sales_channels ?? []) as LinkedChannel[]).map((sc) => ({
      id: sc.id,
      name: sc.name,
      channel_type: (sc.metadata?.channel_type as string | undefined) ?? null,
    })),
  };
}

/**
 * GET /admin/store-locations/:id/branch-config
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  // El id del padre. Guardarlo alcanza: esta ruta no es alcanzable por otra vía.
  await assertIdInSite(req.scope, await siteFromRequest(req), STORE_LOCATION_SITE_SCOPE, req.params.id as string);

  try {
    const config = await readBranchConfig(req, req.params.id as string);
    if (!config) return res.status(404).json({ message: 'Store location not found' });
    return res.status(200).json({ branch_config: config });
  } catch (error) {
    console.error('[Admin StoreLocations] Error reading branch config:', error);
    return res.status(500).json({ message: 'Error reading branch config' });
  }
}

/**
 * POST /admin/store-locations/:id/branch-config — provision/sync the branch's
 * stock location + sales channels (links + channel_type) transactionally.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  // El id del padre. Guardarlo alcanza: esta ruta no es alcanzable por otra vía.
  await assertIdInSite(req.scope, await siteFromRequest(req), STORE_LOCATION_SITE_SCOPE, req.params.id as string);

  try {
    const validated = PostAdminBranchConfig.parse(req.body);
    const id = req.params.id as string;

    await provisionBranchWorkflow(req.scope).run({
      input: {
        store_location_id: id,
        stock_location_id: validated.stock_location_id,
        active: validated.active,
        sales_channels: validated.sales_channels,
      },
    });

    const config = await readBranchConfig(req, id);
    return res.status(200).json({ branch_config: config });
  } catch (error) {
    // NEVER gate on `instanceof Error` here. Medusa's workflow engines
    // round-trip the transaction checkpoint through JSON, and an Error's
    // `message` is non-enumerable — so a failed step arrives as a PLAIN object
    // and `instanceof Error` is false, which turned every failure into the
    // generic fallback below with the real cause lost. Duck-type the message
    // instead (the steps redefine it as enumerable so it survives), and log the
    // raw value so an unrecognised shape is still inspectable.
    const detail = (error as { message?: unknown } | null)?.message;
    const message = typeof detail === 'string' && detail ? detail : 'Error provisioning branch';
    console.error('[Admin StoreLocations] Error provisioning branch:', message, error);
    return res.status(400).json({ message });
  }
}
