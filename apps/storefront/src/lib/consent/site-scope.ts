/** Public route identity; host changes always create a new document. */
export function consentPathPrefix(pathname: string): string {
  return /^\/demo\/([^/]+)/.exec(pathname)?.[0] ?? '';
}
