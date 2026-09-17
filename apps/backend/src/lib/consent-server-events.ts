import type { MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { findDescriptor } from '../modules/app-settings/descriptors';
import { resolveSettingFor } from '../modules/app-settings/service';
import { readEntriesFromBlob } from '../modules/app-settings/site-setting-store';
import { resolveSite } from './multistore/resolve-site';
import { permitsUnattributedServerEvent } from './consent-server-policy';

/** Event-bus payloads do not carry verifiable, current visitor consent.
 * Never reuse a previous cart's client_id as evidence of current permission. */
export async function canSendConsentEvent(
  container: MedusaContainer,
  raw: unknown,
  category: string
): Promise<boolean> {
  const descriptor = findDescriptor('extension:consent-management', 'CONFIG');
  if (!descriptor || category === 'necessary') return true;
  try {
    const data = raw as Record<string, unknown> | null;
    const id = typeof data?.id === 'string' ? data.id : '';
    const cartId = id.startsWith('cart_')
      ? id
      : typeof data?.cart_id === 'string'
        ? data.cart_id
        : undefined;
    const orderId = id.startsWith('order_')
      ? id
      : typeof data?.order_id === 'string'
        ? data.order_id
        : undefined;
    if (cartId || orderId) {
      const resolution = await resolveSite(container, {
        cartId,
        orderId,
        allowMainFallback: false,
      });
      if (resolution.status === 'site' || resolution.status === 'singleSite') {
        return permitsUnattributedServerEvent(
          await resolveSettingFor(container, descriptor, resolution)
        );
      }
    }
    // Unknown event origin: do not infer that it belongs to the main store.
    const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as {
      raw: (sql: string, bindings: unknown[]) => Promise<{ rows: { value: unknown }[] }>;
    };
    const result = await pg.raw(
      'SELECT value FROM site_setting WHERE namespace = ? AND deleted_at IS NULL',
      [descriptor.namespace]
    );
    return result.rows.every((row) =>
      permitsUnattributedServerEvent(readEntriesFromBlob(row.value).get('CONFIG')?.value)
    );
  } catch {
    return false;
  }
}
