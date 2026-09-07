import type { SettingDescriptor } from './descriptors/types';

/** Fields whose account is persisted through site-credentials rather than app-settings. */
export const SITE_ACCOUNT_KEYS: Record<string, string[]> = {
  andreani: ['ANDREANI_USERNAME', 'ANDREANI_PASSWORD', 'ANDREANI_CONTRACT', 'ANDREANI_CLIENT_CODE'],
  'correo-argentino': [
    'CORREO_ARGENTINO_API_KEY',
    'CORREO_ARGENTINO_AGREEMENT',
    'CORREO_ARGENTINO_SELLER_ID',
    'CORREO_ARGENTINO_CUSTOMER_ID',
    'CORREO_ARGENTINO_MICORREO_USER',
    'CORREO_ARGENTINO_MICORREO_PASS',
  ],
  kapso: ['KAPSO_API_KEY'],
};
const siteAccountKeys = new Set(Object.values(SITE_ACCOUNT_KEYS).flat());

export const GLOBAL_INTEGRATION_IDS = [
  'openrouter',
  'embeddings',
  'arca',
  'videos',
  'typesense',
  'sendgrid',
];
export const isGlobalIntegration = (id: string): boolean => GLOBAL_INTEGRATION_IDS.includes(id);

const accountField = (d: SettingDescriptor): boolean =>
  siteAccountKeys.has(d.key) ||
  d.key === 'ARCA_CUIT_REPRESENTADA' ||
  d.type === 'secret' ||
  (d.type !== 'boolean' && /credenciales|proveedor de ia/i.test(d.group));

/** Minimalart service accounts retain their namespaces and always use instance storage. */
export const isGlobalCredential = (d: SettingDescriptor): boolean =>
  (d.namespace === 'extension:ai-assistant' && /^(OPENROUTER_|EMBEDDINGS_)/.test(d.key)) ||
  ([
    'extension:fiscal-documentation',
    'extension:videos',
    'extension:typesense',
    'extension:email-templates',
  ].includes(d.namespace) &&
    accountField(d));

export const isCredentialSetting = (d: SettingDescriptor): boolean =>
  isGlobalCredential(d) || accountField(d);

export const credentialIntegrationId = (namespace: string): string =>
  ({
    'extension:fiscal-documentation': 'arca',
    'extension:whatsapp': 'kapso',
    'extension:email-templates': 'sendgrid',
    'extension:loyalty-engine': 'loyalty',
  })[namespace] ?? namespace.replace(/^extension:/, '');
