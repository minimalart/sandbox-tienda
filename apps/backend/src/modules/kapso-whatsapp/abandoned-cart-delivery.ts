import { readSettingsViaPg } from '../app-settings/read-via-pg';
import { resolveSiteViaSql } from '../../lib/multistore/resolve-site-sql';
import { readSiteCredentialsViaSql } from '../../lib/multistore/credentials';

type Pg = { raw: (sql: string, bindings?: unknown[]) => Promise<{ rows?: any[] }> };

/** Recovery notifications must use the sender and language belonging to the cart. */
export async function abandonedCartDelivery(pg: Pg, data: Record<string, unknown>) {
  let site = await resolveSiteViaSql(pg, {
    siteId: typeof data.site_id === 'string' ? data.site_id : undefined,
    salesChannelId: typeof data.sales_channel_id === 'string' ? data.sales_channel_id : undefined,
  });
  if (site.status === 'allSites' || site.status === 'unknownSite')
    throw new Error('Cannot resolve the WhatsApp store');
  if (site.status === 'singleSite') site = { status: 'site', site: site.site };
  const settings = await readSettingsViaPg('extension:whatsapp', pg, site);
  const credentials = await readSiteCredentialsViaSql<{
    apiKey?: string;
    baseUrl?: string;
    phoneNumberId?: string;
  }>(pg, 'kapso', site);
  if (credentials.status === 'missing' && credentials.reason === 'undecryptable')
    throw new Error('Cannot decrypt WhatsApp credentials');
  /**
   * The API key and the sender are ONE credential: a Kapso key only grants access
   * to ITS own WhatsApp configuration. Taking the store key with the instance
   * sender returns 401 `Invalid credentials for WhatsApp configuration` and the
   * message is silently never delivered. So the pair is taken whole, or not used.
   */
  const ownPair =
    credentials.status === 'found' &&
    credentials.source === 'site' &&
    credentials.value.apiKey &&
    credentials.value.phoneNumberId
      ? credentials.value
      : null;
  const apiKey = ownPair ? ownPair.apiKey : settings?.KAPSO_API_KEY;
  const phoneNumberId = ownPair ? ownPair.phoneNumberId : settings?.KAPSO_PHONE_NUMBER_ID;
  const language = settings?.KAPSO_TEMPLATE_LANG;
  if (
    typeof apiKey !== 'string' ||
    !apiKey ||
    typeof phoneNumberId !== 'string' ||
    !phoneNumberId ||
    typeof language !== 'string' ||
    !language
  )
    throw new Error('Configure WhatsApp credentials, sender and language for this store');
  return {
    apiKey,
    phoneNumberId,
    baseUrl: ownPair?.baseUrl
      ? ownPair.baseUrl
      : typeof settings?.KAPSO_BASE_URL === 'string'
        ? settings.KAPSO_BASE_URL
        : 'https://api.kapso.ai',
    template: {
      name: String(data.cart_abandoned_template_name),
      language: { code: language },
      components: [
        {
          type: 'body',
          parameters: [data.customer_name, data.total, data.recovery_url].map((value) => ({
            type: 'text',
            text: String(value ?? ''),
          })),
        },
      ],
    },
  };
}
