/**
 * Harness de evaluación de relevancia del buscador.
 *
 * Existe para que los ajustes de relevancia sean decisiones MEDIDAS y no
 * discusiones. Corre el mismo set de queries bajo varias configuraciones
 * nombradas e imprime una tabla comparativa con Precision@K, recall, tasa de
 * cero-resultados y latencia.
 *
 * Fue lo que decidió dos cosas en la config actual:
 *   - la escalera de pesos (con todos los campos en 10, los pesos no ordenaban
 *     nada porque bajo `max_score` sólo actúan como desempate);
 *   - descartar `_text_match(buckets: 8)`, que degradaba 3 de 4 queries dejando
 *     que `metadata.ranking` se comiera la relevancia.
 *
 * Un caso se considera acertado si la raíz esperada aparece en el título O en el
 * path de categoría: un término de categoría ("limpieza") es relevante cuando el
 * producto ESTÁ en esa categoría, aunque el título no repita la palabra. Medir
 * sólo contra el título penaliza justamente el comportamiento deseado.
 *
 * Run with:
 *   pnpm typesense:relevance
 *   or: dotenv -e .env -- medusa exec ./src/scripts/typesense-relevance-eval.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ExecArgs } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import TypeSenseService from '../modules/typesense/service';
import {
  STOREFRONT_TYPESENSE_QUERY_BY,
  STOREFRONT_TYPESENSE_TYPO_PARAMS,
} from '../modules/typesense/search-defaults';

const TOP_K = 5;

type EvalCase = {
  q: string;
  label: string;
  expectRoot?: string;
  expectFoundGt?: number;
  rejectRegex?: string;
};

type Config = { name: string; params: Record<string, unknown> };

const STOCK = '_eval(stock_available:>0):desc';
const RANK = 'metadata.ranking(missing_values: last):desc';

/**
 * Configuraciones a comparar. `actual` es lo que el storefront manda hoy;
 * las otras son las alternativas descartadas, que se dejan para poder re-medirlas
 * cuando el catálogo cambie en vez de re-discutirlas de memoria.
 */
const CONFIGS: Config[] = [
  {
    name: 'actual',
    params: {
      query_by: STOREFRONT_TYPESENSE_QUERY_BY,
      ...STOREFRONT_TYPESENSE_TYPO_PARAMS,
      sort_by: `${STOCK},_text_match:desc,${RANK}`,
    },
  },
  {
    name: 'baseline-viejo',
    params: {
      query_by: 'title,description,brand.name,categories.name,variants.sku',
      query_by_weights: '10,3,10,10,10',
      num_typos: 2,
      sort_by: `${STOCK},_text_match:desc,${RANK}`,
    },
  },
  {
    name: 'con-buckets',
    params: {
      query_by: STOREFRONT_TYPESENSE_QUERY_BY,
      ...STOREFRONT_TYPESENSE_TYPO_PARAMS,
      sort_by: `${STOCK},_text_match(buckets: 8):desc,${RANK}`,
    },
  },
  {
    name: 'max-weight',
    params: {
      query_by: STOREFRONT_TYPESENSE_QUERY_BY,
      ...STOREFRONT_TYPESENSE_TYPO_PARAMS,
      text_match_type: 'max_weight',
      sort_by: `${STOCK},_text_match:desc,${RANK}`,
    },
  },
];

const fold = (s: string): string =>
  s
    .normalize('NFD')
    // biome-ignore lint/suspicious/noMisleadingCharacterClass: rango de diacríticos combinatorios
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

type Metrics = {
  hits: number;
  possible: number;
  found: number;
  zeroResults: number;
  rejected: number;
  /**
   * Cuántas veces un resultado que matchea SÓLO por categoría se cuela por
   * delante de uno que matchea por título.
   *
   * Es la única métrica que discrimina si el orden respeta la escalera de pesos.
   * P@1, P@5 y MRR NO la detectan, porque un producto bien categorizado cuenta
   * como relevante en las tres — y aun así estar mal ordenado.
   */
  titleDemotions: number;
  times: number[];
};

const emptyMetrics = (): Metrics => ({
  hits: 0,
  possible: 0,
  found: 0,
  zeroResults: 0,
  rejected: 0,
  titleDemotions: 0,
  times: [],
});

const percentile = (values: number[], p: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0;
};

export default async function typesenseRelevanceEval({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const service = new TypeSenseService();

  const fixturePath = join(
    __dirname,
    '..',
    'modules',
    'typesense',
    '__fixtures__',
    'relevance-queries.json'
  );
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
    cases: EvalCase[];
  };
  const cases: EvalCase[] = [...fixture.cases];

  // Sembrar con analytics REALES: las queries que de verdad fallan en producción
  // valen más que cualquier caso imaginado en un fixture.
  try {
    // Las colecciones de analytics guardan el término en `term`, no en `q`.
    const noResults = await service.getQueriesWithoutResults(25);
    for (const row of noResults) {
      if (row.term && !cases.some((c) => c.q === row.term)) {
        cases.push({ q: row.term, label: 'prod-sin-resultados', expectFoundGt: 0 });
      }
    }
    const popular = await service.getPopularSearchQueries(25);
    for (const row of popular) {
      if (row.term && !cases.some((c) => c.q === row.term)) {
        cases.push({ q: row.term, label: 'prod-populares', expectFoundGt: 0 });
      }
    }
    logger.info(`Eval set: ${cases.length} casos (${fixture.cases.length} del fixture + analytics)`);
  } catch (err) {
    logger.warn(
      `No se pudieron leer analytics; se evalúa sólo el fixture. ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  const results = new Map<string, Metrics>();
  const regressions: string[] = [];

  for (const config of CONFIGS) {
    const m = emptyMetrics();

    for (const c of cases) {
      let found = 0;
      let titles: string[] = [];
      let paths: string[] = [];
      let timeMs = 0;

      try {
        const res = (await service.search({
          q: c.q,
          ...config.params,
          per_page: TOP_K,
        } as Parameters<typeof service.search>[0])) as {
          found?: number;
          search_time_ms?: number;
          hits?: Array<{ document?: { title?: string; category_path_label?: string } }>;
        };
        found = res.found ?? 0;
        timeMs = res.search_time_ms ?? 0;
        titles = (res.hits ?? []).map((h) => h.document?.title ?? '');
        paths = (res.hits ?? []).map((h) => h.document?.category_path_label ?? '');
      } catch (err) {
        logger.error(
          `[${config.name}] "${c.q}" falló: ${err instanceof Error ? err.message : String(err)}`
        );
        continue;
      }

      m.found += found;
      m.times.push(timeMs);
      if (found === 0) m.zeroResults++;

      if (c.expectRoot) {
        const root = fold(c.expectRoot);
        m.possible += TOP_K;
        // `byTitle[i]`: el término está en el TÍTULO (peso alto).
        // Si no, pero cuenta como hit, matcheó por categoría (peso bajo).
        const byTitle: boolean[] = [];
        for (let i = 0; i < titles.length; i++) {
          const inTitle = fold(titles[i] ?? '').includes(root);
          if (inTitle || fold(paths[i] ?? '').includes(root)) {
            m.hits++;
            byTitle.push(inTitle);
          }
        }
        // Un match por categoría delante de uno por título significa que el orden
        // dejó de respetar los pesos.
        const lastTitle = byTitle.lastIndexOf(true);
        const firstCategory = byTitle.indexOf(false);
        if (lastTitle >= 0 && firstCategory >= 0 && firstCategory < lastTitle) {
          m.titleDemotions++;
        }
      }

      if (c.rejectRegex) {
        const re = new RegExp(c.rejectRegex);
        if (titles.some((t) => re.test(t))) {
          m.rejected++;
          if (config.name === 'actual') {
            regressions.push(`"${c.q}" devolvió un resultado que debía rechazar (/${c.rejectRegex}/)`);
          }
        }
      }

      if (typeof c.expectFoundGt === 'number' && found <= c.expectFoundGt) {
        if (config.name === 'actual' && c.expectFoundGt >= 0) {
          regressions.push(`"${c.q}" encontró ${found}, se esperaba > ${c.expectFoundGt}`);
        }
      }
    }

    results.set(config.name, m);
  }

  logger.info('');
  logger.info(
    `${'config'.padEnd(16)}${'P@5'.padStart(8)}${'recall'.padStart(9)}${'cero'.padStart(6)}${'rechaz'.padStart(8)}${'ordenMal'.padStart(10)}${'p50'.padStart(7)}${'p95'.padStart(7)}`
  );
  logger.info('-'.repeat(71));
  for (const [name, m] of results) {
    const p = m.possible > 0 ? `${Math.round((100 * m.hits) / m.possible)}%` : 'n/a';
    logger.info(
      `${name.padEnd(16)}${p.padStart(8)}${String(m.found).padStart(9)}${String(m.zeroResults).padStart(6)}${String(m.rejected).padStart(8)}${String(m.titleDemotions).padStart(10)}${`${percentile(m.times, 50)}ms`.padStart(7)}${`${percentile(m.times, 95)}ms`.padStart(7)}`
    );
  }
  logger.info('');
  logger.info(
    'ordenMal = veces que un match sólo-por-categoría quedó delante de uno por título.'
  );
  logger.info(
    '  Es lo que decidió descartar `_text_match(buckets)`: P@5 y MRR no lo detectan.'
  );

  const actual = results.get('actual');
  const baseline = results.get('baseline-viejo');
  if (actual && baseline && baseline.possible > 0 && actual.possible > 0) {
    const a = (100 * actual.hits) / actual.possible;
    const b = (100 * baseline.hits) / baseline.possible;
    logger.info('');
    logger.info(
      `Precision@${TOP_K} vs baseline: ${b.toFixed(0)}% → ${a.toFixed(0)}% (${a >= b ? '+' : ''}${(a - b).toFixed(0)} pts)`
    );
    const p95Actual = percentile(actual.times, 95);
    const p95Base = percentile(baseline.times, 95);
    if (p95Base > 0 && p95Actual > p95Base * 1.5) {
      logger.warn(
        `⚠️  p95 se degradó más de 1.5×: ${p95Base}ms → ${p95Actual}ms. Más campos en query_by y un typo_tokens_threshold alto cuestan CPU.`
      );
    }
  }

  if (regressions.length > 0) {
    logger.info('');
    logger.warn(`⚠️  ${regressions.length} expectativas incumplidas en la config actual:`);
    for (const r of regressions) logger.warn(`   - ${r}`);
  }
}
