/** Shared cross-app types. Extend per project. */

export interface PaginatedResponse<T> {
  items: T[];
  count: number;
  offset: number;
  limit: number;
}

export type SortDirection = 'asc' | 'desc';
