/**
 * Shared helpers for the catalog importers. Extracted from the original
 * scripts/vtex-fetch.ts so all sources normalize identically.
 */
import { publicCatalogRequests, safeCatalogResponse } from './request-context';
import { getMultistoreSettings } from './legacy-settings';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/** Statuses that mean the source is blocking/limiting us (WAF, rate limit). */
const BLOCK_STATUS = new Set([403, 429, 503]);
/** Transient server errors worth retrying but not treated as a block. */
const TRANSIENT_STATUS = new Set([500, 502, 504]);

/**
 * Thrown when the source keeps returning a block/limit status after retries.
 * Surfaced to the admin so a rate-limit reads as "reintentá en unos minutos"
 * instead of the misleading "no expone catálogo".
 */
export class RateLimitedError extends Error {
  status: number;
  url: string;
  constructor(status: number, url: string) {
    super(
      `La fuente limitó las solicitudes (HTTP ${status}). Suele ser temporal: reintentá en unos minutos.`
    );
    this.name = 'RateLimitedError';
    this.status = status;
    this.url = url;
  }
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// Global throttle gate: keep a minimum gap between outbound requests so a burst
// doesn't trip the source's rate limiter. The importer runs sequentially, so a
// single module-level gate is enough.
//
// Que el portón sea de MÓDULO —uno por proceso, no uno por tienda— es exactamente
// por lo que el ajuste que lo gobierna es `scope: 'instance'`: no hay dónde aplicar
// un valor por tienda. Ver `descriptors/multistore.ts`.
let nextAllowedAt = 0;
async function throttle(): Promise<void> {
  // Se lee EN CADA REQUEST y no una vez al importar el módulo: es lo que permite
  // subir el throttle desde el admin con una importación ya en curso y que la
  // página siguiente salga más espaciada.
  const gap = getMultistoreSettings().importThrottleMs;
  if (gap <= 0) return;
  const now = Date.now();
  if (now < nextAllowedAt) await sleep(nextAllowedAt - now);
  nextAllowedAt = Date.now() + gap;
}

function backoffMs(res: Response | null, attempt: number): number {
  const base = getMultistoreSettings().importBackoffBaseMs;
  const retryAfter = res?.headers.get('retry-after');
  if (retryAfter) {
    const secs = Number(retryAfter);
    if (Number.isFinite(secs) && secs >= 0) return Math.min(secs * 1000, 60_000);
    const at = Date.parse(retryAfter);
    if (!Number.isNaN(at)) return Math.max(0, Math.min(at - Date.now(), 60_000));
  }
  const expo = Math.min(base * 2 ** (attempt - 1), 20_000);
  return expo + Math.floor(Math.random() * Math.min(base, 250));
}

/**
 * Resilient GET: throttled, retries network errors and 429/403/503/5xx with
 * Retry-After or exponential backoff. Throws {@link RateLimitedError} if the
 * source keeps blocking after all retries. Returns the Response otherwise
 * (including 404, so callers can treat it as an empty-page signal).
 */
export async function resilientFetch(
  url: string,
  init?: RequestInit,
  retries = 4
): Promise<Response> {
  if (publicCatalogRequests.getStore()) return safeCatalogResponse(url, init);
  let lastStatus = 0;
  for (let attempt = 1; attempt <= retries; attempt++) {
    await throttle();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(url, {
        ...init,
        headers: { 'User-Agent': USER_AGENT, ...init?.headers },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (BLOCK_STATUS.has(res.status) || TRANSIENT_STATUS.has(res.status)) {
        lastStatus = res.status;
        if (attempt < retries) {
          await sleep(backoffMs(res, attempt));
          continue;
        }
        if (BLOCK_STATUS.has(res.status)) throw new RateLimitedError(res.status, url);
        return res; // transient exhausted: let the caller see the non-ok status
      }
      return res;
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof RateLimitedError) throw err;
      if (attempt === retries) throw err;
      await sleep(backoffMs(null, attempt));
    }
  }
  throw new RateLimitedError(lastStatus, url);
}

/** GET JSON via {@link resilientFetch}. Returns [] on a 404 (empty-page signal). */
export async function fetchJson(url: string, init?: RequestInit, retries = 4): Promise<unknown> {
  const res = await resilientFetch(
    url,
    { ...init, headers: { Accept: 'application/json', ...init?.headers } },
    retries
  );
  if (res.status === 404) return [];
  if (res.status === 206 || res.ok) return res.json();
  throw new Error(`HTTP ${res.status}`);
}

/** Strip HTML tags and decode the few entities catalog descriptions use. */
export function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2000);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * Build a Medusa-valid handle from a title plus a uniqueness suffix (EAN/id),
 * matching isValidHandle: ^[a-z0-9]+(?:-[a-z0-9]+)*$ (no leading/trailing/double
 * hyphens). Truncating the title can leave a trailing hyphen, so trim it first.
 */
export function buildHandle(title: string, suffix: string): string {
  const titlePart = slugify(title).slice(0, 55).replace(/-+$/, '');
  const idPart = slugify(suffix);
  return idPart ? `${titlePart}-${idPart}` : titlePart;
}

/** Normalize a user-entered store URL to an origin without trailing slash. */
export function normalizeBaseUrl(input: string): string {
  let url = input.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url.replace(/\/+$/, '');
}

/** Positive target count, or undefined for "import the full public catalog". */
export function normalizeTargetCount(targetCount?: number | null): number | undefined {
  if (!Number.isFinite(targetCount) || !targetCount || targetCount <= 0) return undefined;
  return Math.floor(targetCount);
}

export function reachedTarget(size: number, target?: number): boolean {
  return target !== undefined && size >= target;
}

export function limitToTarget<T>(items: T[], target?: number): T[] {
  return target === undefined ? items : items.slice(0, target);
}

export function targetLabel(target?: number): string {
  return target === undefined ? 'all' : String(target);
}

/**
 * Source URLs are often entered without the canonical host. Try the exact
 * origin first, then the www/non-www counterpart.
 */
export function baseUrlCandidates(input: string): string[] {
  const first = normalizeBaseUrl(input);
  const candidates = new Set<string>([first]);
  try {
    const url = new URL(first);
    if (url.hostname.startsWith('www.')) {
      url.hostname = url.hostname.slice(4);
    } else {
      url.hostname = `www.${url.hostname}`;
    }
    candidates.add(url.toString().replace(/\/+$/, ''));
  } catch {
    /* normalizeBaseUrl already gives the best-effort candidate */
  }
  return Array.from(candidates);
}
