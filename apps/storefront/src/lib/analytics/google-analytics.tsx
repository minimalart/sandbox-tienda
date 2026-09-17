'use client';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef } from 'react';
import { useConsent } from '../consent/context';
import type { AnalyticsSettings, ConsentState } from '../consent/contract';
import { configureAnalytics, initializeAnalytics } from './runtime';
import { trackPageView } from './gtag';

function Tracker({ config }: { config: AnalyticsSettings | null }) {
  const consent = useConsent();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams?.toString();
  const lastPage = useRef('');
  useEffect(() => {
    const permitted = configureAnalytics(config, consent);
    const update = (event: Event) =>
      configureAnalytics(config, (event as CustomEvent<ConsentState>).detail);
    window.addEventListener('brick:consent:state', update);
    if (permitted && config) {
      initializeAnalytics();
      let script = document.getElementById('brick-ga4-loader') as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement('script');
        script.id = 'brick-ga4-loader';
        script.async = true;
        script.src =
          'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(config.measurementId);
        document.head.appendChild(script);
      }
      const url = query ? pathname + '?' + query : pathname;
      const pageKey = config.measurementId + ':' + url;
      if (pathname && lastPage.current !== pageKey) {
        trackPageView(url!);
        lastPage.current = pageKey;
      }
    } else {
      lastPage.current = '';
    }
    return () => {
      window.removeEventListener('brick:consent:state', update);
      configureAnalytics(null, { active: true, ready: false, categories: {} });
    };
  }, [config, consent.active, consent.ready, consent.categories, pathname, query]);
  return null;
}
export default function GoogleAnalytics({ config }: { config: AnalyticsSettings | null }) {
  return (
    <Suspense fallback={null}>
      <Tracker config={config} />
    </Suspense>
  );
}
