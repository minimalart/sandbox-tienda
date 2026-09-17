'use client';
import { useEffect } from 'react';
import { useConsent } from '../consent/context';
import {
  canLoadService,
  type ConsentState,
  type PrivacyConfiguration,
  type ConsentAwareService,
} from '../consent/contract';
import { consentPathPrefix } from '../consent/site-scope';

export const clarityService: ConsentAwareService = {
  id: 'microsoft-clarity',
  name: 'Microsoft Clarity',
  category: 'analytics',
  withoutConsent: 'allow',
};
type Clarity = ((...args: unknown[]) => void) & { q?: unknown[][] };
declare global {
  interface Window {
    clarity?: Clarity;
  }
}
let owner: string | null = null;
let running = false;
const denied = { analytics_Storage: 'denied', ad_Storage: 'denied' };
function stop() {
  if (!owner || !running) return;
  window.clarity?.('consentv2', denied);
  window.clarity?.('stop');
  running = false;
}

export default function ClarityAnalytics({
  config,
  siteId,
}: {
  config: PrivacyConfiguration['clarity'];
  siteId: string;
}) {
  const state = useConsent();
  useEffect(() => {
    const apply = (current: ConsentState) => {
      const allowed =
        config?.enabled &&
        /^[a-zA-Z0-9]{3,32}$/.test(config.projectId) &&
        consentPathPrefix(window.location.pathname) === (config.pathPrefix ?? '') &&
        canLoadService(clarityService, current);
      if (!allowed) {
        stop();
        return;
      }
      const identity = `${siteId}:${config.projectId}`;
      // The vendor tag owns document-wide state. A new tenant needs a fresh document.
      if (owner && owner !== identity) {
        stop();
        window.location.reload();
        return;
      }
      const permissions = {
        analytics_Storage: 'granted',
        ad_Storage: current.active && current.categories.marketing ? 'granted' : 'denied',
      };
      if (!owner) {
        const queue: Clarity = (...args) => {
          queue.q!.push(args);
        };
        queue.q = [];
        window.clarity = queue;
        owner = identity;
        queue('consentv2', permissions);
        const script = document.createElement('script');
        script.id = 'brick-clarity-loader';
        script.async = true;
        script.src = `https://www.clarity.ms/tag/${config.projectId}`;
        script.onerror = () => {
          stop();
          script.remove();
          owner = null;
        };
        document.head.appendChild(script);
      } else {
        if (!running) window.clarity?.('start');
        window.clarity?.('consentv2', permissions);
      }
      running = true;
    };
    apply(state);
    const change = (event: Event) => apply((event as CustomEvent<ConsentState>).detail);
    window.addEventListener('brick:consent:state', change);
    // Stop before a cross-store SPA history update can expose the new DOM to the recorder.
    const originals = { pushState: history.pushState, replaceState: history.replaceState };
    const wrappers = {} as typeof originals;
    for (const method of ['pushState', 'replaceState'] as const) {
      wrappers[method] = function (data, unused, url) {
        if (
          url &&
          consentPathPrefix(new URL(String(url), location.href).pathname) !==
            (config?.pathPrefix ?? '')
        )
          stop();
        return originals[method].call(history, data, unused, url);
      };
      history[method] = wrappers[method];
    }
    const pop = () => {
      if (consentPathPrefix(location.pathname) !== (config?.pathPrefix ?? '')) stop();
    };
    window.addEventListener('popstate', pop);
    return () => {
      stop();
      window.removeEventListener('brick:consent:state', change);
      window.removeEventListener('popstate', pop);
      for (const method of ['pushState', 'replaceState'] as const)
        if (history[method] === wrappers[method]) history[method] = originals[method];
    };
  }, [config, siteId, state.active, state.ready, state.categories]);
  return null;
}
