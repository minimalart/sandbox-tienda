export type DatabaseExplorerColumnDefinition = {
  column_name: string;
  display_name?: string | null;
  data_type?: string | null;
  visible?: boolean | null;
  masked?: boolean | null;
  searchable?: boolean | null;
  filterable?: boolean | null;
  sortable?: boolean | null;
  sensitive?: boolean | null;
};

export type DatabaseExplorerTableDefinition = {
  table_name: string;
  display_name?: string | null;
  description?: string | null;
  enabled?: boolean | null;
  show_in_visual?: boolean | null;
  primary_label_column?: string | null;
  default_sort_column?: string | null;
  default_sort_direction?: SortDirection | null;
  columns: DatabaseExplorerColumnDefinition[];
};

export type SortDirection = 'asc' | 'desc';

export type RowsQueryInput = {
  limit?: string | number | null;
  offset?: string | number | null;
  sort?: string | null;
  direction?: string | null;
  q?: string | null;
  filters?: Record<string, unknown> | null;
};

export type NormalizedRowsQuery = {
  limit: number;
  offset: number;
  order: { column: string; direction: SortDirection } | null;
  search: { term: string; columns: string[] } | null;
  filters: Array<{ column: string; value: unknown }>;
  select: string[];
};

export const MAX_ROWS_LIMIT = 100;
const DEFAULT_ROWS_LIMIT = 25;
const IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export function assertSafeIdentifier(value: string, label: string): void {
  if (!IDENTIFIER_PATTERN.test(value)) {
    throw new Error(`Unsafe ${label}: ${value}`);
  }
}

export function getVisibleColumns(
  table: DatabaseExplorerTableDefinition
): DatabaseExplorerColumnDefinition[] {
  assertSafeIdentifier(table.table_name, 'table name');
  return table.columns.filter((column) => {
    assertSafeIdentifier(column.column_name, 'column name');
    return column.visible !== false;
  });
}

export function maskValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'string') return '[masked]';

  const [local, domain] = value.split('@');
  if (local && domain) {
    return `${local.slice(0, 1)}***@${domain}`;
  }
  if (value.length <= 4) return '[masked]';
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

export function maskRow(
  table: DatabaseExplorerTableDefinition,
  row: Record<string, unknown>
): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const column of getVisibleColumns(table)) {
    const value = row[column.column_name];
    output[column.column_name] =
      column.masked || column.sensitive ? maskValue(value) : value;
  }
  return output;
}

function toBoundedNumber(value: unknown, fallback: number, max?: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  const integer = Math.floor(parsed);
  return max ? Math.min(integer, max) : integer;
}

function normalizeDirection(value: unknown, fallback: SortDirection): SortDirection {
  return value === 'asc' || value === 'desc' ? value : fallback;
}

export function normalizeRowsQuery(
  table: DatabaseExplorerTableDefinition,
  input: RowsQueryInput
): NormalizedRowsQuery {
  const visibleColumns = getVisibleColumns(table);
  const visibleColumnNames = new Set(visibleColumns.map((column) => column.column_name));
  const searchableColumns = visibleColumns
    .filter((column) => column.searchable === true)
    .map((column) => column.column_name);
  const filterableColumns = new Set(
    visibleColumns
      .filter((column) => column.filterable === true)
      .map((column) => column.column_name)
  );
  const sortableColumns = new Set(
    visibleColumns
      .filter((column) => column.sortable === true)
      .map((column) => column.column_name)
  );

  const requestedSort =
    typeof input.sort === 'string' && sortableColumns.has(input.sort)
      ? input.sort
      : null;
  const defaultSort =
    table.default_sort_column &&
    visibleColumnNames.has(table.default_sort_column) &&
    sortableColumns.has(table.default_sort_column)
      ? table.default_sort_column
      : null;
  const sortColumn = requestedSort ?? defaultSort;
  const fallbackDirection = table.default_sort_direction === 'asc' ? 'asc' : 'desc';

  const filters = Object.entries(input.filters ?? {})
    .filter(([column, value]) => filterableColumns.has(column) && value !== '')
    .map(([column, value]) => ({ column, value }));

  const term = typeof input.q === 'string' ? input.q.trim() : '';

  return {
    limit: toBoundedNumber(input.limit, DEFAULT_ROWS_LIMIT, MAX_ROWS_LIMIT),
    offset: toBoundedNumber(input.offset, 0),
    order: sortColumn
      ? {
          column: sortColumn,
          direction: normalizeDirection(input.direction, fallbackDirection),
        }
      : null,
    search: term && searchableColumns.length ? { term, columns: searchableColumns } : null,
    filters,
    select: visibleColumns.map((column) => column.column_name),
  };
}
