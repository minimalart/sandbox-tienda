export type ConsentCategory =
  | 'necessary'
  | 'preferences'
  | 'analytics'
  | 'marketing'
  | (string & {});
export type LocalizedText = { en: string; es: string };
export type CategoryConfig = { enabled: boolean; name: LocalizedText; description: LocalizedText };
export type ConsentSettings = {
  enabled: boolean;
  mode: 'informational' | 'opt-in' | 'opt-out';
  showRejectAll: boolean;
  showPreferences: boolean;
  consentRevision: number;
  categories: Record<string, CategoryConfig>;
  privacyPolicyUrl?: string;
  cookiePolicyUrl?: string;
  localeMode: 'storefront';
};
export type ConsentAwareService = {
  id: string;
  category: ConsentCategory;
  name: string;
  withoutConsent: 'allow' | 'deny';
};
export type AnalyticsSettings = {
  enabled: boolean;
  measurementId: string;
  consentCategory: string;
  pathPrefix?: string;
};
export type PrivacyConfiguration = {
  clarityAvailable?: boolean;
  clarity?: {
    enabled: boolean;
    projectId: string;
    consentCategory: 'analytics';
    pathPrefix?: string;
  } | null;
  siteId: string;
  consent: ConsentSettings | null;
  analytics: AnalyticsSettings | null;
  legacyAllowed: boolean;
  analyticsAvailable: boolean;
  available: boolean;
  pathPrefix: string;
};
export type ConsentState = { active: boolean; ready: boolean; categories: Record<string, boolean> };

export function canLoadService(service: ConsentAwareService, state: ConsentState): boolean {
  if (!state.ready) return false;
  if (!state.active) return service.withoutConsent === 'allow';
  return state.categories[service.category] === true;
}

export function effectiveCategories(
  settings: ConsentSettings,
  accepted: string[],
  valid: boolean
): Record<string, boolean> {
  return Object.fromEntries(
    Object.entries(settings.categories).map(([id, category]) => [
      id,
      id === 'necessary' ||
        (category.enabled &&
          (settings.mode === 'informational' ||
            (valid ? accepted.includes(id) : settings.mode === 'opt-out'))),
    ])
  );
}

export function googleConsentMode(categories: Record<string, boolean>) {
  const permission = (id: string) => (categories[id] ? ('granted' as const) : ('denied' as const));
  return {
    analytics_storage: permission('analytics'),
    ad_storage: permission('marketing'),
    ad_user_data: permission('marketing'),
    ad_personalization: permission('marketing'),
  };
}
