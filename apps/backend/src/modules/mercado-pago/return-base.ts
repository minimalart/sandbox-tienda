/** Only exact, server-resolved store roots can receive the buyer after payment. */
export function safeReturnBase(fallback: string, candidate: string | null | undefined, allowed: string[]): string {
  if (!candidate) return fallback;
  try {
    const target = new URL(candidate);
    if (target.username || target.password || target.search || target.hash) return fallback;
    const normalized = target.href.replace(/\/+$/, '');
    return allowed.some(root => new URL(root).href.replace(/\/+$/, '') === normalized) ? normalized : fallback;
  } catch { return fallback; }
}
