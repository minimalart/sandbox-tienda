// MIRROR de `packages/shared/src/types.ts`. Ver nota en `./index.ts`.
/** Shared cross-app types. Extend per project. */

export interface PaginatedResponse<T> {
  items: T[];
  count: number;
  offset: number;
  limit: number;
}

export type SortDirection = 'asc' | 'desc';
