"use server";

import { sdk } from "@lib/config";
import type { HttpTypes } from "@medusajs/types";

// ============================================================================
// TIPOS
// ============================================================================

export interface ListCollectionsOptions {
  limit?: number;
  offset?: number;
  fields?: string;
}

export interface CollectionsResponse {
  collections: HttpTypes.StoreCollection[];
  count: number;
}

// ============================================================================
// REPOSITORIO DE COLECCIONES
// ============================================================================

/**
 * Lista todas las colecciones
 * Usa sdk.store.collection.list() del SDK oficial de Medusa
 */
export async function listCollections(
  options: ListCollectionsOptions = {}
): Promise<CollectionsResponse> {
  const { limit = 100, offset = 0, fields } = options;

  const { collections, count } = await sdk.store.collection.list({
    limit,
    offset,
    ...(fields && { fields }),
  });

  return { collections, count: count ?? collections.length };
}

/**
 * Obtiene una colección por su handle
 * Usa sdk.store.collection.list() con filtro de handle
 */
export async function getCollectionByHandle(
  handle: string
): Promise<HttpTypes.StoreCollection | null> {
  const { collections } = await sdk.store.collection.list({
    handle,
    fields: "*products",
  } as Parameters<typeof sdk.store.collection.list>[0]);

  return collections[0] ?? null;
}

/**
 * Obtiene una colección por su ID
 * Usa sdk.store.collection.retrieve()
 */
export async function getCollectionById(
  id: string
): Promise<HttpTypes.StoreCollection | null> {
  try {
    const { collection } = await sdk.store.collection.retrieve(id);

    return collection;
  } catch (error) {
    console.error("[CollectionsRepository] Error fetching collection:", error);
    return null;
  }
}
