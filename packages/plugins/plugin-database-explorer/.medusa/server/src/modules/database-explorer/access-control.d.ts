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
    order: {
        column: string;
        direction: SortDirection;
    } | null;
    search: {
        term: string;
        columns: string[];
    } | null;
    filters: Array<{
        column: string;
        value: unknown;
    }>;
    select: string[];
};
export declare const MAX_ROWS_LIMIT = 100;
export declare function assertSafeIdentifier(value: string, label: string): void;
export declare function getVisibleColumns(table: DatabaseExplorerTableDefinition): DatabaseExplorerColumnDefinition[];
export declare function maskValue(value: unknown): unknown;
export declare function maskRow(table: DatabaseExplorerTableDefinition, row: Record<string, unknown>): Record<string, unknown>;
export declare function normalizeRowsQuery(table: DatabaseExplorerTableDefinition, input: RowsQueryInput): NormalizedRowsQuery;
