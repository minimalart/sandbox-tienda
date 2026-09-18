'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import PrivacySlot from '../privacy-slot';
import type { PrivacyConfiguration } from './contract';
import { consentPathPrefix } from './site-scope';

export default function PrivacyRoot({
  config,
  children,
}: {
  config: PrivacyConfiguration;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const scope = consentPathPrefix(pathname ?? config.pathPrefix);
  const [fetched, setFetched] = useState<PrivacyConfiguration | null>(null);
  const resolved = scope === config.pathPrefix ? config : fetched;
  const ready = scope === resolved?.pathPrefix;
  useEffect(() => {
    if (ready) return;
    const controller = new AbortController();
    const slug = scope.split('/')[2] ?? '';
    void fetch(`/api/store/privacy?slug=${encodeURIComponent(slug)}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error('Privacy settings unavailable');
        return response.json();
      })
      .then((value: PrivacyConfiguration) => {
        if (!controller.signal.aborted && value.pathPrefix === scope) setFetched(value);
      })
      .catch(() => {
        /* Stay blocked until configuration can be resolved. */
      });
    return () => controller.abort();
  }, [ready, scope]);
  const effective =
    ready && resolved
      ? resolved
      : {
          ...config,
          siteId: `pending:${scope}`,
          pathPrefix: scope,
          consent: null,
          analytics: null,
          clarity: null,
          available: false,
          legacyAllowed: false,
        };
  return (
    <PrivacySlot key={`${scope}:${effective.siteId}`} config={effective}>
      {children}
    </PrivacySlot>
  );
}
