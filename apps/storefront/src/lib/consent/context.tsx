'use client';
import { createContext, useContext } from 'react';
import type { ConsentAwareService, ConsentState } from './contract';
import { canLoadService } from './contract';

const absent: ConsentState = { active: false, ready: true, categories: { necessary: true } };
export const ConsentContext = createContext<ConsentState>(absent);
export function useConsent() {
  const state = useContext(ConsentContext);
  return {
    ...state,
    canLoadService: (service: ConsentAwareService) => canLoadService(service, state),
    openConsentPreferences,
  };
}
export function openConsentPreferences() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('brick:consent:preferences'));
}
export function ConsentPreferencesLink() {
  const consent = useConsent();
  if (!consent.active) return null;
  const es = typeof document === 'undefined' || !document.documentElement.lang.startsWith('en');
  return (
    <button
      type="button"
      className="text-sm underline underline-offset-2"
      onClick={openConsentPreferences}
    >
      {es ? 'Preferencias de cookies' : 'Cookie preferences'}
    </button>
  );
}
