import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import {
  ADVISOR_DIMENSIONS,
  classifyProduct,
  type AdvisorDimension,
} from '../../../../modules/typesense/advisor';
import { getAdvisorConfig } from '../../../../lib/whatsapp/advisor/config';
import {
  TECHNICAL_DIMENSIONS,
  TECHNICAL_SCOPE_LABEL,
  familyIsMapped,
  inTechnicalScope,
} from './_scope';

import { siteFromRequest } from '../../../../lib/multistore/request';


/** `null` = la fila GLOBAL, el fallback de toda tienda sin config propia. */
const siteOf = async (req: MedusaRequest): Promise<string | null> => {
  const resolution = await siteFromRequest(req);
  return resolution.status === 'site' ? resolution.site.id : null;
};

/**
 * Auditoría de cobertura del asesor guiado (etapa 1 del lanzamiento, PRD §31).
 *
 * Corre el clasificador sobre el catálogo REAL y responde cuántos productos
 * quedan con cada valor por dimensión, más las categorías y familias que ninguna
 * regla toca. Es lo que dice si el flujo guiado es viable ANTES de construir la
 * UX: si el 80% de la superficie queda en `unknown`, preguntar por superficie no
 * sirve para nada.
 *
 * No re-indexa nada: sólo lee y clasifica en memoria. Va como ruta admin porque
 * `medusa exec` no es usable en producción (bootea un segundo Medusa → OOM).
 *
 *   GET /admin/whatsapp-advisor/audit
 *   GET /admin/whatsapp-advisor/audit?sales_channel_id=sc_…   (acota a un canal)
 *   GET /admin/whatsapp-advisor/audit?samples=5               (ejemplos por hueco)
 */

const PAGE = 200;
/** Tope de páginas: 20.000 productos alcanzan y evitan colgar el request. */
const MAX_PAGES = 100;

type AnyRecord = Record<string, any>;

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (input: unknown) => Promise<{ data: unknown[] }>;
  };
  const q = req.query as Record<string, string | undefined>;
  const channelId = q.sales_channel_id;
  const sampleLimit = Math.min(Math.max(Number(q.samples) || 3, 0), 20);

  const { rules } = await getAdvisorConfig(req.scope, await siteOf(req));

  const counts: Record<AdvisorDimension, Record<string, number>> = {
    surface: {}, product_type: {}, environment: {}, special_use: {}, base: {},
  };
  /**
   * Denominador y huecos POR DIMENSIÓN: las técnicas sólo cuentan los productos
   * a los que la pregunta les llegaría (ver `TECHNICAL_DIMENSIONS`).
   */
  const scoped = Object.fromEntries(
    ADVISOR_DIMENSIONS.map((dim) => [dim, { denominator: 0, unknown: 0 }]),
  ) as Record<AdvisorDimension, { denominator: number; unknown: number }>;
  /** Categorías/familias que NINGUNA regla toca, con cuántos productos arrastran. */
  const unmappedCategories = new Map<string, { count: number; name: string }>();
  const unmappedFamilies = new Map<string, number>();
  const samples: Record<string, string[]> = {};
  let total = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const { data } = await query.graph({
      entity: 'product',
      fields: [
        'id',
        'title',
        'metadata',
        'categories.id',
        'categories.name',
        'categories.external_id',
        'sales_channels.id',
      ],
      filters: { status: 'published' },
      pagination: { skip: page * PAGE, take: PAGE },
    });
    const products = (data ?? []) as AnyRecord[];
    if (products.length === 0) break;

    for (const product of products) {
      if (channelId) {
        const channels = Array.isArray(product.sales_channels) ? product.sales_channels : [];
        if (!channels.some((c: AnyRecord) => c?.id === channelId)) continue;
      }
      total++;

      const attributes = classifyProduct(product, rules);
      if (attributes) {
        const technical = inTechnicalScope(attributes.advisor_product_type);

        for (const dim of ADVISOR_DIMENSIONS) {
          const values = attributes[`advisor_${dim}` as keyof typeof attributes];
          if (values.length === 0) {
            counts[dim]['(vacío)'] = (counts[dim]['(vacío)'] ?? 0) + 1;
          }
          for (const value of values) {
            counts[dim][value] = (counts[dim][value] ?? 0) + 1;
          }

          // Fuera de alcance: no suma al denominador ni aporta ejemplos. Un
          // "Abre balde plástico" en los samples de `environment:unknown` manda
          // a buscar una regla que no hay que escribir.
          if (TECHNICAL_DIMENSIONS.has(dim) && !technical) continue;

          scoped[dim].denominator++;
          const isHole = values.length === 0 || values.includes(rules.unknown_value);
          if (!isHole) continue;
          scoped[dim].unknown++;
          if (sampleLimit > 0) {
            const list = (samples[`${dim}:${rules.unknown_value}`] ??= []);
            if (list.length < sampleLimit) list.push(String(product.title ?? product.id));
          }
        }
      }

      // Huecos de reglas: código de categoría y familia sin ninguna asignación.
      const prefix = rules.category_external_id_prefix;
      for (const category of (Array.isArray(product.categories) ? product.categories : []) as AnyRecord[]) {
        const externalId = typeof category?.external_id === 'string' ? category.external_id : '';
        if (!externalId) continue;
        if (prefix && !externalId.startsWith(prefix)) continue;
        const code = (prefix ? externalId.slice(prefix.length) : externalId).toUpperCase();
        let mapped = false;
        for (let len = code.length; len >= 2; len -= 2) {
          if (rules.by_category_code[code.slice(0, len)]) { mapped = true; break; }
        }
        if (!mapped) {
          const entry = unmappedCategories.get(code) ?? { count: 0, name: String(category?.name ?? '') };
          entry.count++;
          unmappedCategories.set(code, entry);
        }
      }
      const family = product.metadata?.family ?? product.metadata?.zeus_familia;
      if (typeof family === 'string' && family) {
        if (!familyIsMapped(family, rules.by_family)) {
          unmappedFamilies.set(family, (unmappedFamilies.get(family) ?? 0) + 1);
        }
      }
    }

    if (products.length < PAGE) break;
  }

  /**
   * Cobertura sólo de las dimensiones que llevan `unknown`: ahí sí un producto
   * sin clasificar es un hueco. `special_use` NO entra — vacío significa "sin uso
   * especial", así que medirlo como cobertura daría un 2% alarmante y falso; para
   * esa dimensión se informa cuántos productos tienen alguno.
   *
   * Cada fila lleva su `denominator`, y las técnicas además el `scope` que lo
   * acota: el porcentaje de una dimensión no se puede leer contra `total`.
   */
  const coverage = Object.fromEntries(
    ADVISOR_DIMENSIONS.map((dim) => {
      if (!rules.fill_unknown.includes(dim)) {
        const assigned = total - (counts[dim]['(vacío)'] ?? 0);
        return [dim, { measured: false, assigned, note: 'vacío = no aplica, no es un hueco' }];
      }
      const { denominator, unknown } = scoped[dim];
      const known = denominator - unknown;
      return [
        dim,
        {
          measured: true,
          known,
          unknown,
          percent: denominator ? Math.round((known / denominator) * 1000) / 10 : 0,
          denominator,
          ...(TECHNICAL_DIMENSIONS.has(dim) ? { scope: TECHNICAL_SCOPE_LABEL } : {}),
        },
      ];
    }),
  );

  const byCount = <T>(entries: Array<[string, T]>, of: (v: T) => number) =>
    entries.sort((a, b) => of(b[1]) - of(a[1]));

  res.json({
    total,
    sales_channel_id: channelId ?? null,
    rules_version: rules.version,
    coverage,
    counts,
    unmapped_categories: byCount([...unmappedCategories.entries()], (v) => v.count).map(
      ([code, v]) => ({ code, name: v.name, products: v.count }),
    ),
    unmapped_families: byCount([...unmappedFamilies.entries()], (v) => v).map(([name, products]) => ({
      name,
      products,
    })),
    samples,
  });
};
