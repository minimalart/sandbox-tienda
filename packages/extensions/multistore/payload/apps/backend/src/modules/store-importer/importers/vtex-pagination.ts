import type { ImporterContext, ImportReport, NormalizedProduct } from '../../../lib/catalog/types';
import type { ConnectionConfig } from '../config';
import { SourceHttpError, type JsonTransport } from '../http';

type Facet = { key: string; value: string };
type Partition = { facets: Facet[]; legacyCategory?: string };
const PAGE_SIZE = 50;
const MAX_PAGES = 50;
const MAX_REQUESTS = 3000;
const MAX_PARTITIONS = 200;

/** VTEX exposes filtered searches at /product_search/{key}/{value} and
 * /facets/{key}/{value} (v1 uses product-search). Discover filters from the
 * current query, never infer category slugs from product display names.
 * https://developers.vtex.com/docs/guides/get-a-list-of-the-possible-facets-for-a-specific-search */
export async function recoverVtexPages(
  ctx: ImporterContext,
  transport: JsonTransport,
  normalize: (raw: any, config: Partial<ConnectionConfig>) => NormalizedProduct | null
): Promise<NormalizedProduct[]> {
  const config = (ctx.sourceConfig ?? {}) as Partial<ConnectionConfig>;
  const origin = new URL(ctx.sourceUrl).origin;
  let strategy = config.searchStrategy ?? 'auto';
  const report: ImportReport = {
    strategy,
    complete: false,
    fetched: 0,
    excluded: 0,
    warnings: [],
    queries: [],
    issues: [],
    pendingCoverage: [],
  };
  const products = new Map<string, NormalizedProduct>();
  const observed = new Set<string>();
  const limit = ctx.targetCount ?? 50000;
  let requests = 0;
  let stopped: string | undefined;
  const queryName = (p: Partition) =>
    p.legacyCategory
      ? `category:${p.legacyCategory}`
      : p.facets.map((f) => `${f.key}=${f.value}`).join(' / ') || 'catalog';
  const urlFor = (kind: string, p: Partition, page: number, facets = false, count = PAGE_SIZE) => {
    const prefix = config.sourceChannel
      ? '/api/intelligent-search/v1/'
      : '/api/io/_v/api/intelligent-search/';
    const path =
      kind === 'intelligent-search'
        ? `${prefix}${facets ? 'facets' : config.sourceChannel ? 'product-search' : 'product_search'}/${p.facets.map((f) => `${encodeURIComponent(f.key)}/${encodeURIComponent(f.value)}`).join('/')}`
        : '/api/catalog_system/pub/products/search';
    const url = new URL(path, origin);
    if (kind === 'intelligent-search') {
      if (!facets) {
        url.searchParams.set('page', String(page));
        url.searchParams.set('count', String(count));
        url.searchParams.set('sort', 'name:asc');
      }
      url.searchParams.set('hideUnavailableItems', 'false');
    } else {
      url.searchParams.set('_from', String((page - 1) * PAGE_SIZE));
      url.searchParams.set('_to', String((page - 1) * PAGE_SIZE + count - 1));
      if (p.legacyCategory) url.searchParams.set('fq', `C:/${p.legacyCategory}/`);
    }
    if (config.sourceChannel) url.searchParams.set('sc', config.sourceChannel);
    return url.toString();
  };
  const cancelled = async () => {
    if (await ctx.shouldCancel?.()) stopped = 'cancelled';
    if (requests >= MAX_REQUESTS) stopped ??= 'request_limit';
    return !!stopped;
  };
  const read = async (url: string) => {
    requests++;
    const response = await transport(url);
    if ([401, 403].includes(response.status)) throw new SourceHttpError(response.status);
    return response;
  };
  const issue = (
    partition: Partition,
    page: number,
    stage: 'search' | 'facets',
    reason: string,
    status?: number
  ) => {
    report.issues!.push({
      query: queryName(partition),
      page,
      stage,
      reason,
      ...(status ? { status } : {}),
    });
  };
  if (!(await cancelled()) && strategy === 'auto') {
    const probe = await read(urlFor('intelligent-search', { facets: [] }, 1, false, 1));
    if (probe.status === 429 || probe.status >= 500) throw new SourceHttpError(probe.status);
    if (probe.status >= 200 && probe.status < 300 && Array.isArray(probe.body?.products))
      strategy = 'intelligent-search';
    else if ([404, 405].includes(probe.status) || (probe.status >= 200 && probe.status < 300))
      strategy = 'legacy';
    else throw new SourceHttpError(probe.status);
  }
  report.strategy =
    strategy === 'intelligent-search' && config.sourceChannel ? 'intelligent-search-v1' : strategy;
  ctx.logger?.info(`Estrategia VTEX: ${report.strategy}.`);
  let categoryTree: any[] | undefined;
  const visited = new Set<string>();

  const split = async (partition: Partition): Promise<Partition[][]> => {
    if (await cancelled()) return [];
    let response;
    try {
      if (strategy === 'legacy') {
        if (!categoryTree) {
          const url = new URL('/api/catalog_system/pub/category/tree/50', origin);
          if (config.sourceChannel) url.searchParams.set('sc', config.sourceChannel);
          response = await read(url.toString());
          if (response.status !== 200 || !Array.isArray(response.body)) {
            issue(partition, 1, 'facets', 'category_tree_error', response.status);
            return [];
          }
          categoryTree = response.body;
        }
        const find = (nodes: any[]): any => {
          for (const node of nodes) {
            if (String(node.id) === partition.legacyCategory) return node;
            const child = find(Array.isArray(node.children) ? node.children : []);
            if (child) return child;
          }
        };
        const nodes = partition.legacyCategory
          ? (find(categoryTree!)?.children ?? [])
          : categoryTree!;
        return [
          nodes
            .filter((n: any) => n.id != null)
            .map((n: any) => ({ facets: [], legacyCategory: String(n.id) })),
        ];
      }
      response = await read(urlFor(strategy, partition, 1, true));
    } catch (error) {
      if (error instanceof SourceHttpError && [401, 403].includes(error.status)) throw error;
      issue(
        partition,
        1,
        'facets',
        'source_error',
        error instanceof SourceHttpError ? error.status : undefined
      );
      return [];
    }
    if (response.status !== 200 || !Array.isArray(response.body?.facets)) {
      issue(partition, 1, 'facets', 'invalid_facets', response.status);
      return [];
    }
    // Categories first, then other concrete TEXT facets (brand/specifications).
    // Sampling never establishes completeness: compare distinct IDs to totals.
    return response.body.facets
      .filter((f: any) => f.type === 'TEXT' && Array.isArray(f.values))
      .map((f: any) =>
        f.values.filter(
          (v: any) =>
            typeof v.key === 'string' &&
            v.key &&
            typeof v.value === 'string' &&
            v.value &&
            !partition.facets.some((selected) => selected.key === v.key) &&
            !v.selected
        )
      )
      .filter((values: any[]) => values.length)
      .sort(
        (a: any[], b: any[]) =>
          Number(!a[0].key.startsWith('category-')) - Number(!b[0].key.startsWith('category-'))
      )
      .map((values: any[]) =>
        values.map((v: any) => ({ facets: [...partition.facets, { key: v.key, value: v.value }] }))
      );
  };

  const scan = async (partition: Partition, depth = 0): Promise<Set<string>> => {
    const seen = new Set<string>();
    const name = queryName(partition);
    if (visited.has(name) || (await cancelled())) return seen;
    if (visited.size >= MAX_PARTITIONS) {
      stopped = 'partition_limit';
      return seen;
    }
    visited.add(name);
    const diagnostic: NonNullable<ImportReport['queries']>[number] = {
      query: name,
      page: 0,
      observed: 0,
      complete: false,
    };
    report.queries!.push(diagnostic);
    const fingerprints = new Set<string>();
    let needsSplit = false;
    for (let page = 1; page <= MAX_PAGES; page++) {
      if (await cancelled()) break;
      diagnostic.page = page;
      let response;
      try {
        response = await read(urlFor(strategy, partition, page));
      } catch (error) {
        if (error instanceof SourceHttpError && [401, 403].includes(error.status)) throw error;
        if (!observed.size) throw error;
        diagnostic.reason = 'source_error';
        issue(
          partition,
          page,
          'search',
          diagnostic.reason,
          error instanceof SourceHttpError ? error.status : undefined
        );
        break;
      }
      if (response.status < 200 || response.status >= 300) {
        if (!observed.size) throw new SourceHttpError(response.status);
        diagnostic.reason = 'source_error';
        issue(partition, page, 'search', diagnostic.reason, response.status);
        break;
      }
      const rows = strategy === 'intelligent-search' ? response.body?.products : response.body;
      if (!Array.isArray(rows)) {
        if (!observed.size) throw new Error('Formato de catálogo VTEX inválido.');
        diagnostic.reason = 'invalid_page';
        issue(partition, page, 'search', diagnostic.reason);
        break;
      }
      const total = response.body?.recordsFiltered;
      if (typeof total === 'number' && Number.isSafeInteger(total) && total >= 0) {
        diagnostic.estimatedTotal = Math.max(diagnostic.estimatedTotal ?? 0, total);
        if (depth === 0) report.estimatedTotal = diagnostic.estimatedTotal;
      }
      const fingerprint = rows
        .map((p: any) => String(p.productId))
        .sort()
        .join('|');
      if (rows.length && fingerprints.has(fingerprint)) {
        diagnostic.reason = 'repeated_page';
        issue(partition, page, 'search', diagnostic.reason);
        break;
      }
      fingerprints.add(fingerprint);
      for (const raw of rows) {
        const id = String(raw.productId ?? '').trim();
        if (!id) {
          issue(partition, page, 'search', 'missing_product_identity');
          continue;
        }
        seen.add(id);
        if (observed.has(id)) continue;
        if (products.size >= limit) {
          stopped = 'target_limit';
          break;
        }
        observed.add(id);
        const product = normalize(raw, config);
        const skipped = Math.max(
          0,
          (Array.isArray(raw.items) ? raw.items.length : 0) - (product?.variants?.length ?? 0)
        );
        report.excludedSkus = (report.excludedSkus ?? 0) + skipped;
        if (skipped && report.warnings.length < 30)
          report.warnings.push(
            `Producto ${id.slice(0, 100)}: ${skipped} SKU sin identidad u oferta válida; se conservan los anteriores.`
          );
        if (product) products.set(id, product);
        else report.excluded++;
      }
      diagnostic.observed = seen.size;
      if (products.size >= limit) {
        stopped = 'target_limit';
        break;
      }
      const totalReached =
        diagnostic.estimatedTotal !== undefined && seen.size >= diagnostic.estimatedTotal;
      if (totalReached || rows.length < PAGE_SIZE) {
        diagnostic.complete =
          totalReached ||
          (diagnostic.estimatedTotal === undefined &&
            !report.issues!.some((i) => i.query === name));
        if (!diagnostic.complete) diagnostic.reason = 'source_partial';
        needsSplit = !diagnostic.complete;
        break;
      }
      if (page === MAX_PAGES) {
        needsSplit = true;
        diagnostic.reason = 'provider_limit';
      }
    }
    if (needsSplit && !stopped && depth < 8) {
      const groups = await split(partition);
      for (const children of groups) {
        for (const child of children) {
          if (stopped) break;
          for (const id of await scan(child, depth + 1)) seen.add(id);
        }
        if (diagnostic.estimatedTotal !== undefined && seen.size >= diagnostic.estimatedTotal)
          break;
      }
      diagnostic.observed = seen.size;
      // Unknown root totals cannot prove that partitions cover products without
      // an advertised facet; never turn successful child queries into false success.
      diagnostic.complete =
        diagnostic.estimatedTotal !== undefined &&
        seen.size >= diagnostic.estimatedTotal &&
        !stopped;
      if (diagnostic.complete) delete diagnostic.reason;
    }
    if (!diagnostic.complete) diagnostic.reason = stopped ?? diagnostic.reason ?? 'source_partial';
    return seen;
  };
  if (!stopped) await scan({ facets: [] });
  report.fetched = products.size;
  report.observed = observed.size;
  report.pendingCount =
    report.estimatedTotal === undefined
      ? undefined
      : Math.max(0, report.estimatedTotal - observed.size);
  report.complete =
    !stopped &&
    (report.estimatedTotal !== undefined
      ? observed.size >= report.estimatedTotal &&
        !report.issues!.some((i) => i.reason === 'missing_product_identity')
      : report.queries![0]?.complete === true);
  if (!report.complete) {
    report.reason = stopped ?? report.queries![0]?.reason ?? 'source_partial';
    report.pendingCoverage = report
      .queries!.filter((q) => !q.complete)
      .map((q) => ({
        query: q.query,
        page: q.page,
        reason: q.reason ?? report.reason!,
        remaining:
          q.estimatedTotal === undefined ? undefined : Math.max(0, q.estimatedTotal - q.observed),
      }));
    report.warnings.push(
      `Recuperación parcial: ${report.reason}. Cobertura pendiente: ${report.pendingCount ?? 'desconocida'} productos.`
    );
  }
  ctx.report?.(report);
  return [...products.values()];
}
