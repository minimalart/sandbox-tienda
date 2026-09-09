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
