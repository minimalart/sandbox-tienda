import { MedusaError } from '@medusajs/framework/utils';
import type { SiteResolution } from '../../lib/multistore/types';

/** Protege mutaciones de planes; un plan global sólo se edita en vista global. */
export function assertPlanInSite(
  resolution: SiteResolution,
  plan: { sales_channel_id?: string | null },
): void {
  if (resolution.status === 'unknownSite') {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, 'La tienda seleccionada no existe.');
  }
  if (resolution.status !== 'site') return;
  if (!plan.sales_channel_id || !resolution.site.channel_ids.includes(plan.sales_channel_id)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Plan no encontrado en esta tienda.');
  }
}

export function planChannelForSite(
  resolution: SiteResolution,
  requested: string | null | undefined,
): string | null {
  if (resolution.status === 'unknownSite') {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, 'La tienda seleccionada no existe.');
  }
  if (resolution.status !== 'site') return requested ?? null;
  if (requested && !resolution.site.channel_ids.includes(requested)) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'El canal indicado no pertenece a la tienda seleccionada.',
    );
  }
  return requested ?? resolution.site.channel_ids[0] ?? null;
}
