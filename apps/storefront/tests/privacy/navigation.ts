import { useSyncExternalStore } from 'react';
const subscribe = (fn: () => void) => {
  window.addEventListener('popstate', fn);
  return () => window.removeEventListener('popstate', fn);
};
export function usePathname() {
  return useSyncExternalStore(subscribe, () => location.pathname);
}
export function useSearchParams() {
  return new URLSearchParams(location.search);
}
