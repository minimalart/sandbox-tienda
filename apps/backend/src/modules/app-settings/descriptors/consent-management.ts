import { defineSettings } from './types';

const text = (en: string, es: string) => ({ en, es });
export const defaultConsentSettings = {
  enabled: false,
  mode: 'opt-in',
  showRejectAll: true,
  showPreferences: true,
  consentRevision: 1,
  localeMode: 'storefront',
  privacyPolicyUrl: '',
  cookiePolicyUrl: '',
  categories: {
    necessary: {
      enabled: true,
      name: text('Necessary', 'Necesarias'),
      description: text('Essential store functionality.', 'Funciones esenciales de la tienda.'),
    },
    analytics: {
      enabled: true,
      name: text('Analytics', 'Analítica'),
      description: text(
        'Helps us understand store usage.',
        'Nos ayudan a entender el uso de la tienda.'
      ),
    },
    marketing: {
      enabled: true,
      name: text('Marketing', 'Marketing'),
      description: text('Advertising and remarketing.', 'Publicidad y remarketing.'),
    },
    preferences: {
      enabled: true,
      name: text('Preferences', 'Preferencias'),
      description: text('Remembers optional preferences.', 'Recuerdan preferencias opcionales.'),
    },
  },
};

export function validateConsentSettings(value: unknown): string | null {
  const v = value as typeof defaultConsentSettings;
  if (
    !v ||
    typeof v !== 'object' ||
    typeof v.enabled !== 'boolean' ||
    !['opt-in', 'opt-out', 'informational'].includes(v.mode) ||
    typeof v.showRejectAll !== 'boolean' ||
    typeof v.showPreferences !== 'boolean' ||
    v.localeMode !== 'storefront' ||
    !Number.isInteger(v.consentRevision) ||
    v.consentRevision < 1
  )
    return 'Invalid consent configuration / Configuración de consentimiento inválida';
  if (!v.categories || !v.categories.necessary?.enabled || Object.keys(v.categories).length > 32)
    return 'Necessary is required / Necesarias es obligatoria';
  for (const [id, c] of Object.entries(v.categories)) {
    if (
      !/^[a-z][a-z0-9-]{0,63}$/.test(id) ||
      !c ||
      typeof c.enabled !== 'boolean' ||
      !['en', 'es'].every(
        (lang) =>
          typeof c.name?.[lang as 'en'] === 'string' &&
          c.name[lang as 'en'].length <= 120 &&
          typeof c.description?.[lang as 'en'] === 'string' &&
          c.description[lang as 'en'].length <= 2000
      )
    )
      return 'Invalid category / Categoría inválida';
  }
  for (const url of [v.privacyPolicyUrl, v.cookiePolicyUrl]) {
    if (url && (typeof url !== 'string' || !/^(https?:\/\/|\/(?!\/))/.test(url)))
      return 'Invalid policy URL / URL de política inválida';
  }
  return null;
}

export default defineSettings({
  namespace: 'extension:consent-management',
  title: 'Privacy & Cookies',
  defaultScope: 'site',
  settings: [
    {
      key: 'CONFIG',
      env: [],
      type: 'json',
      tier: 'runtime',
      group: 'Privacy & Cookies',
      label: 'Consent configuration / Configuración de consentimiento',
      default: defaultConsentSettings,
      refine: validateConsentSettings,
    },
  ],
});
