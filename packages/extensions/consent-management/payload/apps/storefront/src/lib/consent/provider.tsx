'use client';
import { useEffect, useState, type ReactNode } from 'react';
import * as engine from 'vanilla-cookieconsent';
import 'vanilla-cookieconsent/dist/cookieconsent.css';
import './theme.css';
import { ConsentContext } from './context';
import {
  effectiveCategories,
  type ConsentAwareService,
  type ConsentSettings,
  type ConsentState,
} from './contract';

const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  );
const words = {
  en: {
    title: 'We use cookies',
    description:
      'We use cookies to operate the store and, with your permission, understand how you use it.',
    accept: 'Accept all',
    reject: 'Reject optional',
    preferences: 'Cookie preferences',
    save: 'Save preferences',
    close: 'Close',
    privacy: 'Privacy policy',
    cookies: 'Cookie policy',
  },
  es: {
    title: 'Usamos cookies',
    description: 'Usamos cookies para operar la tienda y, con tu permiso, entender cómo la usás.',
    accept: 'Aceptar todas',
    reject: 'Rechazar opcionales',
    preferences: 'Preferencias de cookies',
    save: 'Guardar preferencias',
    close: 'Cerrar',
    privacy: 'Política de privacidad',
    cookies: 'Política de cookies',
  },
};

export default function ConsentProvider({
  settings,
  siteId,
  services,
  children,
}: {
  settings: ConsentSettings | null;
  siteId: string;
  services: ConsentAwareService[];
  children: ReactNode;
}) {
  const active = settings?.enabled === true;
  const [initializedSettings, setInitializedSettings] = useState<ConsentSettings | null>(null);
  const [state, setState] = useState<ConsentState>({
    active,
    ready: !active,
    categories: { necessary: true },
  });
  useEffect(() => {
    if (!settings?.enabled) {
      setState({ active: false, ready: true, categories: { necessary: true } });
      return;
    }
    let disposed = false;
    const syncTheme = () => {
      const source = document.querySelector('[data-storefront-theme]') ?? document.documentElement;
      const modal = document.getElementById('cc-main');
      if (!modal) return;
      const computed = getComputedStyle(source);
      for (const token of [
        '--background',
        '--foreground',
        '--muted',
        '--border',
        '--primary-color',
        '--primary-foreground',
      ]) {
        const value = computed.getPropertyValue(token);
        if (value) modal.style.setProperty(token, value);
      }
    };
    const themeObserver = new MutationObserver(syncTheme);
    themeObserver.observe(document.documentElement, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'data-mode'],
    });
    const sync = (event?: string) => {
      if (disposed) return;
      const categories = effectiveCategories(
        settings,
        engine.getCookie().categories ?? [],
        engine.validConsent()
      );
      setInitializedSettings(settings);
      setState({ active: true, ready: true, categories });
      // Synchronous listeners can close provider event gates before React renders.
      window.dispatchEvent(
        new CustomEvent('brick:consent:state', {
          detail: { active: true, ready: true, categories },
        })
      );
      if (event) {
        window.dispatchEvent(new CustomEvent(event, { detail: { categories } }));
        const accepted = Object.entries(categories).some(
          ([key, value]) => key !== 'necessary' && value
        );
        window.dispatchEvent(
          new CustomEvent(accepted ? 'consent:accepted' : 'consent:rejected', {
            detail: { categories },
          })
        );
      }
    };
    const translations = Object.fromEntries(
      (['en', 'es'] as const).map((locale) => {
        const w = words[locale];
        const legal = [
          [settings.privacyPolicyUrl, w.privacy],
          [settings.cookiePolicyUrl, w.cookies],
        ]
          .filter(([url]) => url && /^(https?:\/\/|\/(?!\/))/.test(url))
          .map(([url, label]) => `<a href="${escape(url!)}">${escape(label!)}</a>`)
          .join(' · ');
        return [
          locale,
          {
            consentModal: {
              title: w.title,
              description: w.description,
              acceptAllBtn:
                settings.mode === 'informational'
                  ? locale === 'es'
                    ? 'Entendido'
                    : 'Got it'
                  : w.accept,
              ...(settings.showRejectAll && settings.mode !== 'informational'
                ? { acceptNecessaryBtn: w.reject }
                : {}),
              ...(settings.showPreferences ? { showPreferencesBtn: w.preferences } : {}),
              footer: legal,
            },
            preferencesModal: {
              title: w.preferences,
              acceptAllBtn: w.accept,
              ...(settings.mode !== 'informational' ? { acceptNecessaryBtn: w.reject } : {}),
              savePreferencesBtn: w.save,
              closeIconLabel: w.close,
              sections: Object.entries(settings.categories)
                .filter(([id, c]) => id === 'necessary' || c.enabled)
                .map(([id, c]) => ({
                  title: escape(c.name[locale]),
                  linkedCategory: id,
                  description:
                    escape(c.description[locale]) +
                    services
                      .filter((s) => s.category === id)
                      .map((s) => `<br>${escape(s.name)}`)
                      .join(''),
                })),
            },
          },
        ];
      })
    );
    engine.reset(false);
    void engine
      .run({
        mode: settings.mode === 'opt-in' ? 'opt-in' : 'opt-out',
        revision: settings.consentRevision,
        cookie: {
          name: `brick_consent_${siteId.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
          domain: '',
          path: '/',
          sameSite: 'Lax',
        },
        manageScriptTags: false,
        hideFromBots: false,
        categories: Object.fromEntries(
          Object.entries(settings.categories)
            .filter(([id, c]) => id === 'necessary' || c.enabled)
            .map(([id]) => [
              id,
              {
                enabled: id === 'necessary' || settings.mode !== 'opt-in',
                readOnly: id === 'necessary' || settings.mode === 'informational',
              },
            ])
        ),
        language: {
          default: document.documentElement.lang.startsWith('en') ? 'en' : 'es',
          translations,
        },
        onFirstConsent: () => sync('consent:first'),
        onConsent: () => sync(),
        onChange: () => sync('consent:changed'),
        onModalReady: syncTheme,
        onModalShow: syncTheme,
      })
      .then(() => sync())
      .catch(() => {
        // Engine failure must never permit optional services.
        if (!disposed) setState({ active: true, ready: false, categories: { necessary: true } });
      });
    const open = () => engine.showPreferences();
    window.addEventListener('brick:consent:preferences', open);
    return () => {
      disposed = true;
      themeObserver.disconnect();
      window.removeEventListener('brick:consent:preferences', open);
      engine.reset(false);
    };
  }, [settings, siteId, services]);
  // Fail closed during a new site's first render, before the effect initializes.
  const effectiveState = !active
    ? { active: false, ready: true, categories: { necessary: true } }
    : initializedSettings !== settings
      ? { active: true, ready: false, categories: { necessary: true } }
      : state;
  return <ConsentContext.Provider value={effectiveState}>{children}</ConsentContext.Provider>;
}
