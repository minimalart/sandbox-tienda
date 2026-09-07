"use server";

import { sdk } from "@lib/config";
import {
  CATEGORY_DETAIL_FIELDS,
  CATEGORY_NAV_FIELDS,
} from "@lib/constants/category-fields";
import type { HttpTypes } from "@medusajs/types";

// ============================================================================
// TIPOS
// ============================================================================

export interface ListCategoriesOptions {
  limit?: number;
  offset?: number;
  fields?: string;
}

// ============================================================================
// REPOSITORIO DE CATEGORÍAS
// ============================================================================

/**
 * Lista todas las categorías de productos
 * Usa sdk.store.category.list() del SDK oficial de Medusa
 */
export async function listCategories(
  options: ListCategoriesOptions = {}
): Promise<HttpTypes.StoreProductCategory[]> {
  const { limit = 100, offset = 0, fields } = options;

  const { product_categories } = await sdk.store.category.list({
    limit,
    offset,
    fields: fields ?? CATEGORY_NAV_FIELDS,
  });

  return product_categories;
}

/**
 * Obtiene una categoría por su handle
 * Usa sdk.store.category.list() con filtro de handle
 */
export async function getCategoryByHandle(
  handle: string
): Promise<HttpTypes.StoreProductCategory | null> {
  const { product_categories } = await sdk.store.category.list({
    handle,
    fields: CATEGORY_DETAIL_FIELDS,
  } as Parameters<typeof sdk.store.category.list>[0]);

  return product_categories[0] ?? null;
}

/**
 * Obtiene una categoría por su ID
 * Usa sdk.store.category.retrieve()
 */
export async function getCategoryById(
  id: string
): Promise<HttpTypes.StoreProductCategory | null> {
  try {
    const { product_category } = await sdk.store.category.retrieve(id, {
      fields: CATEGORY_DETAIL_FIELDS,
    });

    return product_category;
  } catch (error) {
    console.error("[CategoriesRepository] Error fetching category:", error);
    return null;
  }
}
