const DEFAULT_DELAYS_MINUTES = [1, 5, 30, 120, 720] as const;

export function normalizeRetryDelays(value: unknown): number[] {
  const source = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && Array.isArray((value as { delays?: unknown }).delays)
      ? (value as { delays: unknown[] }).delays
      : null;
  if (!source) return [...DEFAULT_DELAYS_MINUTES];
  const delays = source
    .map(Number)
    .filter((minutes) => Number.isFinite(minutes) && minutes > 0 && minutes <= 24 * 60)
    .slice(0, 10);
  return delays.length ? delays : [...DEFAULT_DELAYS_MINUTES];
}

export function nextDeliveryRetryAt(attempts: number, configured?: unknown): Date | null {
  const delays = normalizeRetryDelays(configured);
  const minutes = delays[attempts - 1];
  if (minutes == null) return null;
  return new Date(Date.now() + minutes * 60_000);
}
