'use client';
import { useMemo, type ReactNode } from 'react';
import ClarityAnalytics, { clarityService } from './analytics/clarity';
import type { PrivacyConfiguration, ConsentAwareService } from './consent/contract';
import ConsentProvider from './consent/provider';
import GoogleAnalytics from './analytics/google-analytics';
import { googleAnalyticsService } from './analytics/runtime';
export default function PrivacySlot({
  config,
  children,
}: {
  config: PrivacyConfiguration;
  children: ReactNode;
}) {
  const services = useMemo<ConsentAwareService[]>(
    () => [
      ...(config.analytics?.enabled ? [googleAnalyticsService] : []),
      ...(config.clarity?.enabled ? [clarityService] : []),
    ],
    [config.analytics?.enabled, config.clarity?.enabled]
  );
  return (
    <ConsentProvider
      key={config.siteId}
      settings={config.consent}
      siteId={config.siteId}
      services={services}
    >
      <ClarityAnalytics config={config.clarity} siteId={config.siteId} />
      <GoogleAnalytics config={config.analytics} />
      {children}
    </ConsentProvider>
  );
}
