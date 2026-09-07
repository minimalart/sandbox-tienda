/** Override the SDK's cached active-store header when opening global settings. */
export const appSettingsSiteHeaders = (siteId?: string | null): Record<string, string> => ({
  'x-site-id': siteId || '*',
});
