/**
 * Serialize an object of query params into a URL query string. Skips
 * `undefined`/`null` and preserves arrays as repeated keys.
 */
export function toQueryString(query?: Record<string, unknown>): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item === undefined || item === null) continue;
        params.append(key, String(item));
      }
    } else {
      params.append(key, String(value));
    }
  }
  return params.toString();
}
