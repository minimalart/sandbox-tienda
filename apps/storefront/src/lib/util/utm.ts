const UTM_COOKIE_NAME = "_utm_params";
const UTM_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

export type UtmKey = (typeof UTM_KEYS)[number];

export interface UtmParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  landing_page?: string;
  referrer?: string;
}

/**
 * Parses UTM parameters from a URL search string.
 * Returns null if no UTM params are found.
 */
export function parseUtmFromSearch(search: string): UtmParams | null {
  if (!search) return null;

  const params = new URLSearchParams(search);
  const utm: UtmParams = {};
  let hasUtm = false;

  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value) {
      utm[key] = value;
      hasUtm = true;
    }
  }

  return hasUtm ? utm : null;
}

/**
 * Serializes UTM params to a cookie-safe JSON string.
 */
export function serializeUtm(params: UtmParams): string {
  return encodeURIComponent(JSON.stringify(params));
}

/**
 * Deserializes UTM params from a cookie value.
 */
export function deserializeUtm(cookieValue: string): UtmParams | null {
  try {
    const decoded = decodeURIComponent(cookieValue);
    const parsed = JSON.parse(decoded);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as UtmParams;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Builds the Set-Cookie header value for UTM params.
 * Used in proxy (Edge runtime).
 */
export function buildUtmCookieValue(params: UtmParams): string {
  return serializeUtm(params);
}

/**
 * Reads UTM params from a cookie string (document.cookie format).
 * Works client-side.
 */
export function getUtmFromCookieString(cookieString: string): UtmParams | null {
  const match = cookieString
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${UTM_COOKIE_NAME}=`));

  if (!match) return null;

  const value = match.substring(UTM_COOKIE_NAME.length + 1);
  return deserializeUtm(value);
}

/**
 * Reads UTM params from document.cookie (client-side only).
 * Returns empty object if no UTM data found.
 */
export function getUtmParams(): UtmParams {
  if (typeof document === "undefined") return {};
  return getUtmFromCookieString(document.cookie) || {};
}

/**
 * Checks if UTM params object has any meaningful data.
 */
export function hasUtmData(params: UtmParams): boolean {
  return UTM_KEYS.some((key) => !!params[key]);
}

export { UTM_COOKIE_NAME, UTM_COOKIE_MAX_AGE };
