import {
  canLoadService,
  googleConsentMode,
  type AnalyticsSettings,
  type ConsentState,
} from '../consent/contract';
import { consentPathPrefix } from '../consent/site-scope';

export const googleAnalyticsService = {
  id: 'google-analytics',
  category: 'analytics',
  name: 'Google Analytics 4',
  withoutConsent: 'allow' as const,
};
let allowed = false;
let measurementId = '';
let initialized = '';
let configuredId = '';
let pathPrefix = '';
export const analyticsPermitted = () =>
  allowed &&
  typeof window !== 'undefined' &&
  consentPathPrefix(window.location.pathname ?? '') === pathPrefix;
export const analyticsTarget = () => measurementId;

export function configureAnalytics(config: AnalyticsSettings | null, state: ConsentState): boolean {
  if (typeof window === 'undefined') return false;
  const id = config?.measurementId ?? '';
  pathPrefix = config?.pathPrefix ?? '';
  allowed = Boolean(
    config?.enabled &&
      consentPathPrefix(window.location.pathname ?? '') === pathPrefix &&
      /^G-[A-Za-z0-9]+$/.test(id) &&
      canLoadService({ ...googleAnalyticsService, category: config.consentCategory }, state)
  );
  if (measurementId && measurementId !== id)
    (window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`] = true;
  measurementId = id;
  if (!id) return false;
  (window as unknown as Record<string, unknown>)[`ga-disable-${id}`] = !allowed;
  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function () {
      window.dataLayer!.push(arguments);
    };
  const categories = state.active ? state.categories : { analytics: true, marketing: true };
  const key = `${id}:${state.active}`;
  window.gtag('consent', initialized === key ? 'update' : 'default', googleConsentMode(categories));
  initialized = key;
  return allowed;
}

export function initializeAnalytics() {
  if (!allowed || !measurementId || configuredId === measurementId) return;
  configuredId = measurementId;
  window.gtag?.('js', new Date());
  window.gtag?.('config', measurementId, { send_page_view: false });
}
