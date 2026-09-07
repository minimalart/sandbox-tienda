import { MedusaService } from '@medusajs/framework/utils';
import {
  assertSafeIdentifier,
  maskRow,
  normalizeRowsQuery,
  type DatabaseExplorerColumnDefinition,
  type DatabaseExplorerTableDefinition,
  type NormalizedRowsQuery,
  type RowsQueryInput,
} from './access-control';
import { DEFAULT_DATABASE_EXPLORER_TABLES } from './defaults';
import {
  DatabaseExplorerAuditLog,
  DatabaseExplorerColumnConfig,
  DatabaseExplorerRelationConfig,
  DatabaseExplorerSavedView,
  DatabaseExplorerTableConfig,
} from './models';

type InformationSchemaColumn = {
  table_name: string;
  column_name: string;
  data_type: string;
};

type AuditInput = {
  user_id?: string | null;
  action: string;
  table_name?: string | null;
  record_id?: string | null;
  view_id?: string | null;
  filters_json?: Record<string, unknown> | null;
  duration_ms?: number | null;
  success?: boolean;
  error_message?: string | null;
};

type RowsResult = {
  table: DatabaseExplorerTableDefinition;
  rows: Array<Record<string, unknown>>;
  count: number;
  limit: number;
  offset: number;
};

type Relation = {
  id: string;
  source_table: string;
  source_column: string;
  target_table: string;
  target_column: string;
  relation_type: string;
  display_name: string | null;
  inferred: boolean;
};

const DEFAULT_SAVED_VIEWS = [
  {
    id: 'orders-payment-errors',
    name: 'Ordenes con posible problema de pago',
    description: 'Ordenes filtrables por estado de pago para soporte.',
    table_name: 'order',
    filters_json: {},
    sort_json: { column: 'created_at', direction: 'desc' },
  },
  {
    id: 'erp-failed-outbox',
    name: 'ERP outbox con errores',
    description: 'Eventos ERP pendientes, fallidos o en dead letter.',
    table_name: 'erp_outbox_event',
    filters_json: { status: 'failed' },
    sort_json: { column: 'created_at', direction: 'desc' },
  },
  {
    id: 'products-by-sku',
    name: 'Buscar variantes por SKU',
    description: 'Vista operativa para ubicar variantes por SKU o barcode.',
    table_name: 'product_variant',
    filters_json: {},
    sort_json: { column: 'created_at', direction: 'desc' },
  },
];

class DatabaseExplorerModuleService extends MedusaService({
  DatabaseExplorerAuditLog,
  DatabaseExplorerColumnConfig,
  DatabaseExplorerRelationConfig,
  DatabaseExplorerSavedView,
  DatabaseExplorerTableConfig,
}) {
  private get knex() {
    return (this as any).__container__.manager.getKnex();
  }

  private async informationSchema(tableNames: string[]): Promise<InformationSchemaColumn[]> {
    if (!tableNames.length) return [];

    return this.knex('information_schema.columns')
      .select('table_name', 'column_name', 'data_type')
      .where('table_schema', 'public')
      .whereIn('table_name', tableNames)
      .orderBy('ordinal_position', 'asc');
  }

  private async rawInformationSchema(): Promise<InformationSchemaColumn[]> {
    return this.knex('information_schema.columns')
      .select('table_name', 'column_name', 'data_type')
      .where('table_schema', 'public')
      .whereNotLike('table_name', 'mikro_orm%')
      .orderBy('table_name', 'asc')
      .orderBy('ordinal_position', 'asc');
  }

  private defaultTable(tableName: string) {
    return DEFAULT_DATABASE_EXPLORER_TABLES.find((table) => table.table_name === tableName);
  }

  private async definitions(includeDisabled = false): Promise<DatabaseExplorerTableDefinition[]> {
    const storedTables = (await (this as any).listDatabaseExplorerTableConfigs(
      {},
      { take: 500, order: { table_name: 'ASC' } }
    )) as Array<Partial<DatabaseExplorerTableDefinition> & { id: string }>;
    const storedColumns = (await (this as any).listDatabaseExplorerColumnConfigs(
      {},
      { take: 5000, order: { table_name: 'ASC', column_name: 'ASC' } }
    )) as Array<DatabaseExplorerColumnDefinition & { table_name: string; id: string }>;

    const tableNames = Array.from(
      new Set([
        ...DEFAULT_DATABASE_EXPLORER_TABLES.map((table) => table.table_name),
        ...storedTables.map((table) => table.table_name).filter(Boolean),
      ])
    ) as string[];

    const actualColumns = await this.informationSchema(tableNames);
    const actualByTable = new Map<string, InformationSchemaColumn[]>();
    for (const column of actualColumns) {
      const list = actualByTable.get(column.table_name) ?? [];
      list.push(column);
      actualByTable.set(column.table_name, list);
    }

    const storedTableByName = new Map(storedTables.map((table) => [table.table_name, table]));
    const storedColumnsByKey = new Map(
      storedColumns.map((column) => [`${column.table_name}.${column.column_name}`, column])
    );

    return tableNames
      .map((tableName) => {
        const actual = actualByTable.get(tableName) ?? [];
        const defaults = this.defaultTable(tableName);
        const storedTable = storedTableByName.get(tableName);
        const columns = actual
          .map((column): DatabaseExplorerColumnDefinition | null => {
            const defaultColumn = defaults?.columns.find(
              (candidate) => candidate.column_name === column.column_name
            );
            const storedColumn = storedColumnsByKey.get(`${tableName}.${column.column_name}`);
            if (!defaultColumn && !storedColumn) return null;
            return {
              ...defaultColumn,
              ...storedColumn,
              column_name: column.column_name,
              data_type: storedColumn?.data_type ?? defaultColumn?.data_type ?? column.data_type,
            };
          })
          .filter((column): column is DatabaseExplorerColumnDefinition => !!column);

        if (!actual.length || !columns.length) return null;

        const definition: DatabaseExplorerTableDefinition = {
          table_name: tableName,
          display_name: defaults?.display_name ?? tableName,
          description: defaults?.description ?? null,
          enabled: defaults?.enabled ?? false,
          show_in_visual: defaults?.show_in_visual ?? true,
          primary_label_column: defaults?.primary_label_column ?? 'id',
          default_sort_column: defaults?.default_sort_column ?? 'created_at',
          default_sort_direction: defaults?.default_sort_direction ?? 'desc',
          ...storedTable,
          columns,
        };

        return includeDisabled || definition.enabled ? definition : null;
      })
      .filter((definition): definition is DatabaseExplorerTableDefinition => !!definition);
  }

  async listTables(includeDisabled = false) {
    return this.definitions(includeDisabled);
  }

  async listAllPublicTablesForSettings() {
    const actual = await this.rawInformationSchema();
    const grouped = new Map<string, InformationSchemaColumn[]>();
    for (const column of actual) {
      const list = grouped.get(column.table_name) ?? [];
      list.push(column);
      grouped.set(column.table_name, list);
    }

    const configured = await this.definitions(true);
    const configuredByName = new Map(configured.map((table) => [table.table_name, table]));

    return Array.from(grouped.entries()).map(([tableName, columns]) => ({
      table_name: tableName,
      configured: configuredByName.has(tableName),
      enabled: configuredByName.get(tableName)?.enabled ?? false,
      columns: columns.map((column) => ({
        column_name: column.column_name,
        data_type: column.data_type,
      })),
    }));
  }

  async retrieveDefinition(tableName: string, includeDisabled = false) {
    assertSafeIdentifier(tableName, 'table name');
    const tables = await this.definitions(includeDisabled);
    const table = tables.find((candidate) => candidate.table_name === tableName);
    if (!table) {
      throw new Error(`Table is not enabled: ${tableName}`);
    }
    return table;
  }

  private applyQuery(query: any, normalized: NormalizedRowsQuery) {
    for (const filter of normalized.filters) {
      query.where(filter.column, filter.value);
    }

    if (normalized.search) {
      const pattern = `%${normalized.search.term.replace(/[%_]/g, '\\$&')}%`;
      query.where((builder: any) => {
        for (const column of normalized.search!.columns) {
          builder.orWhereRaw('??::text ILIKE ? ESCAPE \'\\\'', [column, pattern]);
        }
      });
    }
    return query;
  }

  async getRows(tableName: string, input: RowsQueryInput, actorId?: string | null): Promise<RowsResult> {
    const started = Date.now();
    const table = await this.retrieveDefinition(tableName);
    const normalized = normalizeRowsQuery(table, input);

    try {
      const rowsQuery = this.applyQuery(this.knex(table.table_name), normalized)
        .select(normalized.select)
        .limit(normalized.limit)
        .offset(normalized.offset);

      if (normalized.order) {
        rowsQuery.orderBy(normalized.order.column, normalized.order.direction);
      }

      const countQuery = this.applyQuery(this.knex(table.table_name), normalized).count({
        count: '*',
      });
      const [rows, countRows] = await Promise.all([rowsQuery, countQuery]);
      const count = Number(countRows?.[0]?.count ?? 0);

      await this.audit({
        user_id: actorId,
        action: 'list_rows',
        table_name: table.table_name,
        filters_json: input.filters ? { filters: input.filters, q: input.q ?? null } : { q: input.q ?? null },
        duration_ms: Date.now() - started,
        success: true,
      });

      return {
        table,
        rows: rows.map((row: Record<string, unknown>) => maskRow(table, row)),
        count,
        limit: normalized.limit,
        offset: normalized.offset,
      };
    } catch (error) {
      await this.audit({
        user_id: actorId,
        action: 'list_rows',
        table_name: table.table_name,
        filters_json: input.filters ? { filters: input.filters, q: input.q ?? null } : { q: input.q ?? null },
        duration_ms: Date.now() - started,
        success: false,
        error_message: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async getRow(tableName: string, id: string, actorId?: string | null) {
    const started = Date.now();
    const table = await this.retrieveDefinition(tableName);
    const normalized = normalizeRowsQuery(table, {});
    const [row] = await this.knex(table.table_name)
      .select(normalized.select)
      .where('id', id)
      .limit(1);

    await this.audit({
      user_id: actorId,
      action: 'retrieve_row',
      table_name: table.table_name,
      record_id: id,
      duration_ms: Date.now() - started,
      success: !!row,
    });

    if (!row) {
      throw new Error(`Record not found: ${id}`);
    }
    return { table, row: maskRow(table, row) };
  }

  async listRelations(): Promise<Relation[]> {
    const tables = await this.definitions();
    const enabledNames = new Set(tables.map((table) => table.table_name));
    const configured = (await (this as any).listDatabaseExplorerRelationConfigs(
      { enabled: true },
      { take: 500 }
    )) as Relation[];
    const relations: Relation[] = configured
      .filter(
        (relation) =>
          enabledNames.has(relation.source_table) && enabledNames.has(relation.target_table)
      )
      .map((relation) => ({ ...relation, inferred: false }));

    const byBaseName = new Map<string, string>();
    for (const table of tables) {
      byBaseName.set(table.table_name, table.table_name);
      byBaseName.set(table.table_name.replace(/s$/, ''), table.table_name);
    }

    for (const table of tables) {
      for (const column of table.columns) {
        if (!column.column_name.endsWith('_id')) continue;
        const base = column.column_name.slice(0, -3);
        const target = byBaseName.get(base);
        if (!target || target === table.table_name) continue;
        relations.push({
          id: `inferred:${table.table_name}.${column.column_name}:${target}.id`,
          source_table: table.table_name,
          source_column: column.column_name,
          target_table: target,
          target_column: 'id',
          relation_type: 'many_to_one',
          display_name: null,
          inferred: true,
        });
      }
    }

    return relations;
  }

  async schemaGraph() {
    const [tables, relations] = await Promise.all([this.definitions(), this.listRelations()]);
    return {
      nodes: tables
        .filter((table) => table.show_in_visual !== false)
        .map((table) => ({
          id: table.table_name,
          label: table.display_name ?? table.table_name,
          table_name: table.table_name,
          description: table.description ?? null,
          primary_label_column: table.primary_label_column ?? null,
          fields: table.columns.slice(0, 8).map((column) => ({
            column_name: column.column_name,
            data_type: column.data_type ?? null,
            masked: column.masked === true || column.sensitive === true,
          })),
          has_sensitive_fields: table.columns.some(
            (column) => column.masked === true || column.sensitive === true
          ),
        })),
      edges: relations,
    };
  }

  async listSavedViews() {
    const saved = (await (this as any).listDatabaseExplorerSavedViews(
      { enabled: true },
      { take: 200, order: { name: 'ASC' } }
    )) as typeof DEFAULT_SAVED_VIEWS;
    return [...DEFAULT_SAVED_VIEWS, ...saved];
  }

  async runSavedView(viewId: string, input: RowsQueryInput, actorId?: string | null) {
    const views = await this.listSavedViews();
    const view = views.find((candidate) => candidate.id === viewId);
    if (!view) throw new Error(`Saved view not found: ${viewId}`);
    const filters = {
      ...((view.filters_json as Record<string, unknown> | null) ?? {}),
      ...(input.filters ?? {}),
    };
    const sort = (view.sort_json as { column?: string; direction?: string } | null) ?? {};
    const result = await this.getRows(
      view.table_name,
      {
        ...input,
        filters,
        sort: input.sort ?? sort.column ?? null,
        direction: input.direction ?? sort.direction ?? null,
      },
      actorId
    );
    await this.audit({
      user_id: actorId,
      action: 'run_saved_view',
      table_name: view.table_name,
      view_id: view.id,
      filters_json: { filters },
      success: true,
    });
    return { view, ...result };
  }

  async listAudit(opts: { limit?: number; offset?: number } = {}) {
    const limit = Math.min(Math.max(Number(opts.limit ?? 50), 1), 100);
    const offset = Math.max(Number(opts.offset ?? 0), 0);
    const [audit_logs, count] = await (this as any).listAndCountDatabaseExplorerAuditLogs(
      {},
      { take: limit, skip: offset, order: { created_at: 'DESC' } }
    );
    return { audit_logs, count, limit, offset };
  }

  async upsertTableConfig(input: Partial<DatabaseExplorerTableDefinition> & { table_name: string }) {
    assertSafeIdentifier(input.table_name, 'table name');
    const existing = (
      (await (this as any).listDatabaseExplorerTableConfigs(
        { table_name: input.table_name },
        { take: 1 }
      )) as Array<{ id: string }>
    )[0];
    const payload = {
      table_name: input.table_name,
      display_name: input.display_name ?? null,
      description: input.description ?? null,
      enabled: input.enabled ?? false,
      show_in_visual: input.show_in_visual ?? true,
      primary_label_column: input.primary_label_column ?? null,
      default_sort_column: input.default_sort_column ?? null,
      default_sort_direction: input.default_sort_direction === 'asc' ? 'asc' : 'desc',
    };
    if (existing) {
      await (this as any).updateDatabaseExplorerTableConfigs({ id: existing.id, ...payload });
      return (this as any).retrieveDatabaseExplorerTableConfig(existing.id);
    }
    return (this as any).createDatabaseExplorerTableConfigs(payload);
  }

  async upsertColumnConfig(
    tableName: string,
    input: DatabaseExplorerColumnDefinition
  ) {
    assertSafeIdentifier(tableName, 'table name');
    assertSafeIdentifier(input.column_name, 'column name');
    const existing = (
      (await (this as any).listDatabaseExplorerColumnConfigs(
        { table_name: tableName, column_name: input.column_name },
        { take: 1 }
      )) as Array<{ id: string }>
    )[0];
    const payload = {
      table_name: tableName,
      column_name: input.column_name,
      display_name: input.display_name ?? null,
      data_type: input.data_type ?? null,
      visible: input.visible ?? false,
      masked: input.masked ?? false,
      searchable: input.searchable ?? false,
      filterable: input.filterable ?? false,
      sortable: input.sortable ?? false,
      sensitive: input.sensitive ?? false,
    };
    if (existing) {
      await (this as any).updateDatabaseExplorerColumnConfigs({ id: existing.id, ...payload });
      return (this as any).retrieveDatabaseExplorerColumnConfig(existing.id);
    }
    return (this as any).createDatabaseExplorerColumnConfigs(payload);
  }

  async audit(input: AuditInput): Promise<void> {
    try {
      await (this as any).createDatabaseExplorerAuditLogs({
        user_id: input.user_id ?? null,
        action: input.action,
        table_name: input.table_name ?? null,
        record_id: input.record_id ?? null,
        view_id: input.view_id ?? null,
        filters_json: input.filters_json ?? null,
        duration_ms: input.duration_ms ?? null,
        success: input.success ?? true,
        error_message: input.error_message ?? null,
      });
    } catch (error) {
      console.warn(
        '[database-explorer] audit write failed:',
        error instanceof Error ? error.message : error
      );
    }
  }
}

export default DatabaseExplorerModuleService;
