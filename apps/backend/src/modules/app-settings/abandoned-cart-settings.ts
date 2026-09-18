import type { MedusaContainer } from '@medusajs/framework/types';
import type { SiteResolution } from '../../lib/multistore/types';
import type { AppSettingState } from './resolve';
import { findNamespace } from './descriptors';
import { getStates } from './service';

/** Read-only compatibility: legacy WhatsApp assignments remain visible in the
 * form and effective at runtime until the recovery setting is explicitly set. */
export async function withLegacyCartTemplates(
  container: MedusaContainer,
  states: AppSettingState[],
  resolution: SiteResolution
): Promise<AppSettingState[]> {
  if (!states.some((state) => state.namespace === 'extension:abandoned-cart')) return states;
  const whatsapp = findNamespace('extension:whatsapp');
  if (!whatsapp) return states;
  const legacy = await getStates(
    container,
    whatsapp.settings.filter((setting) => setting.key.startsWith('KAPSO_TEMPLATE_CART_ABANDONED_')),
    resolution
  );
  return mergeLegacyCartTemplates(states, legacy);
}

export function mergeLegacyCartTemplates(
  states: AppSettingState[],
  legacy: AppSettingState[]
): AppSettingState[] {
  return states.map((state) => {
    const match = /^ABANDONED_CART_WHATSAPP_TEMPLATE_([123])$/.exec(state.key);
    if (
      state.namespace !== 'extension:abandoned-cart' ||
      !match ||
      !['default', 'off', 'unset'].includes(state.source)
    )
      return state;
    const prior = legacy.find((item) => item.key === `KAPSO_TEMPLATE_CART_ABANDONED_${match[1]}`);
    return typeof prior?.value === 'string' && prior.value
      ? { ...state, value: prior.value, source: prior.source }
      : state;
  });
}
