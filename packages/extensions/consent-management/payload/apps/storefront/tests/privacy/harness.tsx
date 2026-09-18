import { createRoot } from 'react-dom/client';
import PrivacyRoot from '../../src/lib/consent/root';
import { ConsentPreferencesLink } from '../../src/lib/consent/context';
import { consentPathPrefix } from '../../src/lib/consent/site-scope';
import type { ConsentSettings, PrivacyConfiguration } from '../../src/lib/consent/contract';
import { defaultConsentSettings } from '../../../backend/src/modules/app-settings/descriptors/consent-management';
const query = new URLSearchParams(location.search);
const settings = {
  ...defaultConsentSettings,
  enabled: query.get('enabled') !== 'false',
  mode: query.get('mode') || 'opt-in',
  consentRevision: Number(query.get('revision') || 1),
} as ConsentSettings;
const pathPrefix = consentPathPrefix(location.pathname);
const config: PrivacyConfiguration = {
  clarity: query.has('clarity')
    ? {
        enabled: true,
        projectId: query.get('clarity') || 'abc123',
        consentCategory: 'analytics',
        pathPrefix,
      }
    : null,
  siteId: query.get('site') || 'a',
  pathPrefix,
  available: true,
  analyticsAvailable: true,
  legacyAllowed: true,
  consent: settings,
  analytics: {
    enabled: true,
    measurementId: query.get('site') === 'b' ? 'G-STOREB' : 'G-STOREA',
    consentCategory: 'analytics',
    pathPrefix,
  },
};
Object.assign(window, { __fixtureConsent: settings });
document.documentElement.lang = query.get('lang') || 'es';
const navigate = (path: string) => {
  history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
};
createRoot(document.getElementById('root')!).render(
  <PrivacyRoot config={config}>
    <h1>Privacy integration fixture</h1>
    <ConsentPreferencesLink />
    <button onClick={() => navigate('/next' + location.search)}>Navigate</button>
    <button onClick={() => navigate('/demo/c')}>Change store</button>
  </PrivacyRoot>
);
