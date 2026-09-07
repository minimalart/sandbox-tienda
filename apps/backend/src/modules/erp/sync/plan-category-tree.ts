import type { ErpCategoryNode } from '../adapters/types';
import { categoryNameNeedsUpdate, normalizeCategoryName } from './category-name';
import { slugify } from './slug';

/**
 * Clasificación PURA del espejo del árbol de categorías del ERP en
 * `product_category` (testeable sin container): decide qué categorías hay que
 * crear, cuáles actualizar y cuáles quedaron huérfanas.
 *
 * La identidad de una categoría del ERP es su `external_id`
 * (`<provider>:<código>`), NO su nombre ni su handle. Eso es lo que hace que el
 * espejo sea idempotente y que un rename en el ERP se propague sin duplicar, y
 * es también lo que distingue "categoría que administra el ERP" de "categoría
 * que puso un humano" — la base del modo aditivo (ver `plan-category-assignments`).
 *
 * Lo que este planner NUNCA toca de una categoría existente:
 * - `handle`: es la URL del storefront. Cambiarlo rompe links, SEO y cualquier
 *   redirect cargado a mano.
 * - `name` cuando lo guardado ya coincide, salvo caso o tildes, con lo que el
 *   normalizador escribiría: el ERP manda el árbol en mayúsculas sostenidas y
 *   sin tildes, así que pisarlo revertiría en cada corrida una corrección
 *   editorial. La comparación va contra el nombre YA normalizado, no contra el
 *   crudo del ERP — ver `categoryNameNeedsUpdate` en `category-name`.
 * - `is_active` / `is_internal`: alguien pudo ocultar un nodo a propósito.
 * - `rank` en updates, salvo `syncRank` explícito: el módulo de producto
 *   re-rankea a TODOS los hermanos cuando recibe `rank`, y en la raíz los nodos
 *   del ERP comparten hermanos con las categorías manuales → se reordenarían
 *   solas en cada corrida.
 */

export type ExistingCategory = {
  id: string;
  name: string;
  handle: string;
  external_id: string | null;
  parent_category_id: string | null;
  rank: number;
  metadata: Record<string, unknown> | null;
  created_at?: string | null;
};

export type CategoryCreate = {
  external_id: string;
  code: string;
  name: string;
  handle: string;
  rank: number;
  /** `null` = raíz. El applier resuelve el id con lo creado en el nivel anterior. */
  parent_code: string | null;
  metadata: Record<string, unknown>;
};

export type CategoryUpdate = {
  id: string;
  code: string;
  /** Patch listo para `updateProductCategoriesWorkflow`, SIN `parent_category_id`. */
  patch: Record<string, unknown>;
  /** Presente solo si `changed` incluye `parent_category_id`; lo resuelve el applier. */
  parent_code: string | null;
  changed: string[];
};

export type CategoryTreePlan = {
  /** Un bucket por nivel, en orden: el nivel N tiene que existir antes del N+1. */
  creates: CategoryCreate[][];
  updates: CategoryUpdate[];
  unchanged: number;
  /** `code` → id de Medusa de los nodos que YA existen. El applier suma los creados. */
  resolved: Map<string, string>;
  /** Categorías del ERP que el ERP ya no informa. Se reportan; NUNCA se borran. */
  orphans: ExistingCategory[];
  warnings: string[];
};

/** Identidad estable de una categoría del ERP dentro de Medusa. */
export function externalIdFor(provider: string, code: string): string {
  return `${provider}:${code}`;
}

/** `true` si la categoría la administra este provider (y por lo tanto la puede mover). */
export function isErpOwned(externalId: string | null | undefined, provider: string): boolean {
  return typeof externalId === 'string' && externalId.startsWith(`${provider}:`);
}

/** Metadatos que el espejo mantiene en la categoría. Prefijo `erp_` para no chocar. */
function categoryMetadata(node: ErpCategoryNode, provider: string): Record<string, unknown> {
  return {
    erp_source: provider,
    erp_code: node.code,
    erp_level: node.level,
    erp_rank: node.rank,
    ...(node.image_url ? { erp_image_url: node.image_url } : {}),
  };
}

const metadataDiffers = (
  current: Record<string, unknown> | null,
  desired: Record<string, unknown>
): boolean => Object.entries(desired).some(([key, value]) => (current?.[key] ?? null) !== (value ?? null));

export function planCategoryTree(input: {
  nodes: ErpCategoryNode[];
  existing: ExistingCategory[];
  provider: string;
  /** Forzar el `rank` del ERP también en updates. Default recomendado: false. */
  syncRank?: boolean;
  /** Adoptar una categoría manual con el mismo handle en vez de crear una duplicada. */
  adoptByHandle?: boolean;
}): CategoryTreePlan {
  const { nodes, existing, provider } = input;
  const syncRank = input.syncRank ?? false;
  const adoptByHandle = input.adoptByHandle ?? false;

  const plan: CategoryTreePlan = {
    creates: [],
    updates: [],
    unchanged: 0,
    resolved: new Map(),
    orphans: [],
    warnings: [],
  };
  if (!nodes.length) return plan;

  // ── Índices ────────────────────────────────────────────────────────────────
  // `external_id` NO tiene unique index en la DB del core, así que puede haber
  // duplicados (p. ej. si alguien clonó una categoría). Se toma la más vieja
  // para que el resultado sea estable corrida a corrida.
  const byExternalId = new Map<string, ExistingCategory>();
  const byHandle = new Map<string, ExistingCategory>();
  const usedHandles = new Set<string>();
  for (const category of existing) {
    usedHandles.add(category.handle);
    byHandle.set(category.handle, category);
    if (!isErpOwned(category.external_id, provider)) continue;
    const key = category.external_id as string;
    const previous = byExternalId.get(key);
    if (!previous) {
      byExternalId.set(key, category);
      continue;
    }
    const older = (previous.created_at ?? '') <= (category.created_at ?? '') ? previous : category;
    const loser = older === previous ? category : previous;
    byExternalId.set(key, older);
    plan.warnings.push(
      `Hay más de una categoría con external_id "${key}" (se usa ${older.id} y se ignora ${loser.id}).`
    );
  }

  const uniqueHandle = (base: string): string => {
    let handle = base || 'categoria';
    let index = 2;
    while (usedHandles.has(handle)) handle = `${base || 'categoria'}-${index++}`;
    usedHandles.add(handle);
    return handle;
  };

  const nodeByCode = new Map(nodes.map((node) => [node.code, node]));
  /** Ruta completa de NOMBRES desde la raíz, para que el handle desambigüe ramas. */
  const namePath = (node: ErpCategoryNode): string[] => {
    const path: string[] = [];
    let current: ErpCategoryNode | undefined = node;
    const seen = new Set<string>();
    while (current && !seen.has(current.code)) {
      seen.add(current.code);
      path.unshift(current.name);
      current = current.parent_code ? nodeByCode.get(current.parent_code) : undefined;
    }
    return path;
  };

  // ── BFS por nivel: el padre tiene que estar resuelto antes que el hijo ──────
  const maxLevel = nodes.reduce((max, node) => Math.max(max, node.level), 0);
  const seenCodes = new Set<string>();

  for (let level = 0; level <= maxLevel; level++) {
    const bucket: CategoryCreate[] = [];
    const levelNodes = nodes.filter((node) => node.level === level);

    for (const node of levelNodes) {
      seenCodes.add(node.code);
      const externalId = externalIdFor(provider, node.code);

      // El padre puede no estar resuelto todavía si se crea en esta misma
      // corrida: en ese caso el applier lo completa con el id recién creado.
      let parentCode = node.parent_code;
      if (parentCode && !nodeByCode.has(parentCode)) {
        plan.warnings.push(
          `La categoría "${node.name}" (${node.code}) cuelga de ${parentCode}, que el ERP no informó: se crea en la raíz.`
        );
        parentCode = null;
      }
      const parentId = parentCode ? (plan.resolved.get(parentCode) ?? null) : null;
      const desiredMetadata = categoryMetadata(node, provider);

      let match = byExternalId.get(externalId);
      if (!match && adoptByHandle) {
        const candidate = byHandle.get(slugify(namePath(node).join(' ')));
        if (candidate && !candidate.external_id) match = candidate;
      }

      if (!match) {
        bucket.push({
          external_id: externalId,
          code: node.code,
          name: normalizeCategoryName(node.name),
          // El handle sigue saliendo del nombre CRUDO: `slugify` baja a
          // minúsculas y saca tildes, así que normalizar no lo movería — pero
          // dejarlo explícito evita que un cambio futuro en el normalizador
          // reescriba URLs ya publicadas.
          handle: uniqueHandle(slugify(namePath(node).join(' '))),
          rank: node.rank,
          parent_code: parentCode,
          metadata: desiredMetadata,
        });
        continue;
      }

      plan.resolved.set(node.code, match.id);

      const patch: Record<string, unknown> = {};
      const changed: string[] = [];
      // La pregunta es "¿lo guardado ya es lo que yo escribiría?", NO "¿el ERP
      // dice otra cosa?". Contra el nombre CRUDO, una reescritura editorial
      // (`Llanas, espátulas y fratachos`) se leería como rename y se revertiría
      // en cada corrida; contra el normalizado, sobrevive. Y si la única
      // diferencia es el caso o una tilde que el diccionario todavía no conoce,
      // gana lo que está en Medusa: eso es la corrección hecha a mano.
      if (categoryNameNeedsUpdate(match.name, node.name)) {
        patch.name = normalizeCategoryName(node.name);
        changed.push('name');
      }
      if (match.external_id !== externalId) {
        patch.external_id = externalId; // adopción por handle
        changed.push('external_id');
      }
      // El padre cambió si el id no coincide, o si el padre es un create de esta
      // corrida (el existente no puede estar apuntando a algo que no existe).
      const parentPending = Boolean(parentCode) && parentId === null;
      if (parentPending || match.parent_category_id !== parentId) {
        changed.push('parent_category_id');
      }
      if (syncRank && match.rank !== node.rank) {
        patch.rank = node.rank;
        changed.push('rank');
      }
      if (metadataDiffers(match.metadata, desiredMetadata)) {
        patch.metadata = { ...(match.metadata ?? {}), ...desiredMetadata };
        changed.push('metadata');
      }

      if (!changed.length) {
        plan.unchanged++;
        continue;
      }
      plan.updates.push({ id: match.id, code: node.code, patch, parent_code: parentCode, changed });
    }

    if (bucket.length) plan.creates.push(bucket);
  }

  // ── Huérfanas: del ERP pero fuera del árbol actual ─────────────────────────
  for (const category of existing) {
    if (!isErpOwned(category.external_id, provider)) continue;
    const code = (category.external_id as string).slice(provider.length + 1);
    if (!seenCodes.has(code)) plan.orphans.push(category);
  }

  return plan;
}
