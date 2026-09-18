/** Explicit allowlist: a future private provider field must never reach the browser. */
export function publicConsent(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, any>;
  return {
    enabled: v.enabled === true,
    mode: v.mode,
    showRejectAll: v.showRejectAll === true,
    showPreferences: v.showPreferences === true,
    consentRevision: v.consentRevision,
    localeMode: 'storefront',
    privacyPolicyUrl: v.privacyPolicyUrl,
    cookiePolicyUrl: v.cookiePolicyUrl,
    categories: Object.fromEntries(
      Object.entries(v.categories ?? {}).map(([id, raw]) => {
        const c = raw as Record<string, any>;
        return [
          id,
          {
            enabled: id === 'necessary' || c.enabled === true,
            name: { en: c.name?.en, es: c.name?.es },
            description: { en: c.description?.en, es: c.description?.es },
          },
        ];
      })
    ),
  };
}
export function publicAnalytics(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  return {
    enabled: v.enabled === true,
    measurementId: v.measurementId,
    consentCategory: v.consentCategory,
  };
}
export function publicClarity(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  return { enabled: v.enabled === true, projectId: v.projectId, consentCategory: 'analytics' };
}
