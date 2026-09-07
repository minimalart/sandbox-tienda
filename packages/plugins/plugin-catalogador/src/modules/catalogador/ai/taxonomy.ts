import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { MedusaContainer } from '@medusajs/framework/types';

/**
 * Taxonomía existente del comercio (categorías y tags). A diferencia del tool
 * original (árbol hardcodeado), en Mercatto la taxonomía es dinámica por tienda:
 * se lee en runtime y se le exige a la IA reutilizar SÓLO entidades existentes
 * (PRD §12.1: no crear categorías/tags nuevos automáticamente).
 */
export type TaxonomyCategory = { id: string; name: string; path: string };
export type TaxonomyTag = { id: string; value: string };

export type Taxonomy = {
  categories: TaxonomyCategory[];
  tags: TaxonomyTag[];
  categoryByNormalizedName: Map<string, TaxonomyCategory>;
  tagByNormalizedValue: Map<string, TaxonomyTag>;
};

/** Normaliza acentos/caso para matching robusto (portado del tool original). */
export function normalizeName(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

/** Carga todas las categorías y tags existentes y arma índices de matching. */
export async function loadTaxonomy(container: MedusaContainer): Promise<Taxonomy> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  // Se leen las categorías PLANAS (id, name, parent_category_id) y el path se
  // arma caminando el árbol en memoria. Se evita el nesting
  // `parent_category.parent_category.name` a propósito: el self-relation de
  // product_category no lo resuelve de forma confiable vía query.graph (el resto
  // del repo también camina por parent_category_id, ver typesense-sync/loader).
  const { data: rawCats } = await query.graph({
    entity: 'product_category',
    fields: ['id', 'name', 'parent_category_id'],
    pagination: { skip: 0, take: 5000 },
  });

  type CatNode = { id: string; name: string; parent: string | null };
  const catNodes: CatNode[] = (rawCats as Array<Record<string, unknown>>).map((c) => ({
    id: c.id as string,
    name: c.name as string,
    parent: (c.parent_category_id as string | null) ?? null,
  }));
  const byId = new Map<string, CatNode>(catNodes.map((c) => [c.id, c] as [string, CatNode]));

  const buildPath = (id: string): string => {
    const parts: string[] = [];
    let cursor: string | null = id;
    const guard = new Set<string>();
    while (cursor && byId.has(cursor) && !guard.has(cursor)) {
      guard.add(cursor);
      const node: CatNode | undefined = byId.get(cursor);
      if (!node) break;
      parts.unshift(node.name);
      cursor = node.parent;
    }
    return parts.join(' > ');
  };

  const categories: TaxonomyCategory[] = catNodes.map((c) => ({
    id: c.id,
    name: c.name,
    path: buildPath(c.id),
  }));

  const { data: rawTags } = await query.graph({
    entity: 'product_tag',
    fields: ['id', 'value'],
    pagination: { skip: 0, take: 5000 },
  });
  const tags: TaxonomyTag[] = (rawTags as Array<Record<string, unknown>>).map((t) => ({
    id: t.id as string,
    value: t.value as string,
  }));

  const categoryByNormalizedName = new Map<string, TaxonomyCategory>();
  for (const c of categories) {
    categoryByNormalizedName.set(normalizeName(c.name), c);
    categoryByNormalizedName.set(normalizeName(c.path), c);
  }
  const tagByNormalizedValue = new Map<string, TaxonomyTag>();
  for (const t of tags) tagByNormalizedValue.set(normalizeName(t.value), t);

  return { categories, tags, categoryByNormalizedName, tagByNormalizedValue };
}

/** Resuelve nombres/paths propuestos por la IA a IDs reales existentes. */
export function resolveCategoryIds(taxonomy: Taxonomy, proposed: string[]): string[] {
  const ids = new Set<string>();
  for (const p of proposed ?? []) {
    const hit = taxonomy.categoryByNormalizedName.get(normalizeName(p));
    if (hit) ids.add(hit.id);
  }
  return [...ids];
}

/** Resuelve valores de tag propuestos a IDs existentes (descarta inexistentes). */
export function resolveTagIds(taxonomy: Taxonomy, proposed: string[]): string[] {
  const ids = new Set<string>();
  for (const p of proposed ?? []) {
    const hit = taxonomy.tagByNormalizedValue.get(normalizeName(p));
    if (hit) ids.add(hit.id);
  }
  return [...ids];
}
