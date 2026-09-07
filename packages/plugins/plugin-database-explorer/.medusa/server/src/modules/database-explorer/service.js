"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
const access_control_1 = require("./access-control");
const defaults_1 = require("./defaults");
const models_1 = require("./models");
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
class DatabaseExplorerModuleService extends (0, utils_1.MedusaService)({
    DatabaseExplorerAuditLog: models_1.DatabaseExplorerAuditLog,
    DatabaseExplorerColumnConfig: models_1.DatabaseExplorerColumnConfig,
    DatabaseExplorerRelationConfig: models_1.DatabaseExplorerRelationConfig,
    DatabaseExplorerSavedView: models_1.DatabaseExplorerSavedView,
    DatabaseExplorerTableConfig: models_1.DatabaseExplorerTableConfig,
}) {
    get knex() {
        return this.__container__.manager.getKnex();
    }
    async informationSchema(tableNames) {
        if (!tableNames.length)
            return [];
        return this.knex('information_schema.columns')
            .select('table_name', 'column_name', 'data_type')
            .where('table_schema', 'public')
            .whereIn('table_name', tableNames)
            .orderBy('ordinal_position', 'asc');
    }
    async rawInformationSchema() {
        return this.knex('information_schema.columns')
            .select('table_name', 'column_name', 'data_type')
            .where('table_schema', 'public')
            .whereNotLike('table_name', 'mikro_orm%')
            .orderBy('table_name', 'asc')
            .orderBy('ordinal_position', 'asc');
    }
    defaultTable(tableName) {
        return defaults_1.DEFAULT_DATABASE_EXPLORER_TABLES.find((table) => table.table_name === tableName);
    }
    async definitions(includeDisabled = false) {
        const storedTables = (await this.listDatabaseExplorerTableConfigs({}, { take: 500, order: { table_name: 'ASC' } }));
        const storedColumns = (await this.listDatabaseExplorerColumnConfigs({}, { take: 5000, order: { table_name: 'ASC', column_name: 'ASC' } }));
        const tableNames = Array.from(new Set([
            ...defaults_1.DEFAULT_DATABASE_EXPLORER_TABLES.map((table) => table.table_name),
            ...storedTables.map((table) => table.table_name).filter(Boolean),
        ]));
        const actualColumns = await this.informationSchema(tableNames);
        const actualByTable = new Map();
        for (const column of actualColumns) {
            const list = actualByTable.get(column.table_name) ?? [];
            list.push(column);
            actualByTable.set(column.table_name, list);
        }
        const storedTableByName = new Map(storedTables.map((table) => [table.table_name, table]));
        const storedColumnsByKey = new Map(storedColumns.map((column) => [`${column.table_name}.${column.column_name}`, column]));
        return tableNames
            .map((tableName) => {
            const actual = actualByTable.get(tableName) ?? [];
            const defaults = this.defaultTable(tableName);
            const storedTable = storedTableByName.get(tableName);
            const columns = actual
                .map((column) => {
                const defaultColumn = defaults?.columns.find((candidate) => candidate.column_name === column.column_name);
                const storedColumn = storedColumnsByKey.get(`${tableName}.${column.column_name}`);
                if (!defaultColumn && !storedColumn)
                    return null;
                return {
                    ...defaultColumn,
                    ...storedColumn,
                    column_name: column.column_name,
                    data_type: storedColumn?.data_type ?? defaultColumn?.data_type ?? column.data_type,
                };
            })
                .filter((column) => !!column);
            if (!actual.length || !columns.length)
                return null;
            const definition = {
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
            .filter((definition) => !!definition);
    }
    async listTables(includeDisabled = false) {
        return this.definitions(includeDisabled);
    }
    async listAllPublicTablesForSettings() {
        const actual = await this.rawInformationSchema();
        const grouped = new Map();
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
    async retrieveDefinition(tableName, includeDisabled = false) {
        (0, access_control_1.assertSafeIdentifier)(tableName, 'table name');
        const tables = await this.definitions(includeDisabled);
        const table = tables.find((candidate) => candidate.table_name === tableName);
        if (!table) {
            throw new Error(`Table is not enabled: ${tableName}`);
        }
        return table;
    }
    applyQuery(query, normalized) {
        for (const filter of normalized.filters) {
            query.where(filter.column, filter.value);
        }
        if (normalized.search) {
            const pattern = `%${normalized.search.term.replace(/[%_]/g, '\\$&')}%`;
            query.where((builder) => {
                for (const column of normalized.search.columns) {
                    builder.orWhereRaw('??::text ILIKE ? ESCAPE \'\\\'', [column, pattern]);
                }
            });
        }
        return query;
    }
    async getRows(tableName, input, actorId) {
        const started = Date.now();
        const table = await this.retrieveDefinition(tableName);
        const normalized = (0, access_control_1.normalizeRowsQuery)(table, input);
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
                rows: rows.map((row) => (0, access_control_1.maskRow)(table, row)),
                count,
                limit: normalized.limit,
                offset: normalized.offset,
            };
        }
        catch (error) {
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
    async getRow(tableName, id, actorId) {
        const started = Date.now();
        const table = await this.retrieveDefinition(tableName);
        const normalized = (0, access_control_1.normalizeRowsQuery)(table, {});
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
        return { table, row: (0, access_control_1.maskRow)(table, row) };
    }
    async listRelations() {
        const tables = await this.definitions();
        const enabledNames = new Set(tables.map((table) => table.table_name));
        const configured = (await this.listDatabaseExplorerRelationConfigs({ enabled: true }, { take: 500 }));
        const relations = configured
            .filter((relation) => enabledNames.has(relation.source_table) && enabledNames.has(relation.target_table))
            .map((relation) => ({ ...relation, inferred: false }));
        const byBaseName = new Map();
        for (const table of tables) {
            byBaseName.set(table.table_name, table.table_name);
            byBaseName.set(table.table_name.replace(/s$/, ''), table.table_name);
        }
        for (const table of tables) {
            for (const column of table.columns) {
                if (!column.column_name.endsWith('_id'))
                    continue;
                const base = column.column_name.slice(0, -3);
                const target = byBaseName.get(base);
                if (!target || target === table.table_name)
                    continue;
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
                has_sensitive_fields: table.columns.some((column) => column.masked === true || column.sensitive === true),
            })),
            edges: relations,
        };
    }
    async listSavedViews() {
        const saved = (await this.listDatabaseExplorerSavedViews({ enabled: true }, { take: 200, order: { name: 'ASC' } }));
        return [...DEFAULT_SAVED_VIEWS, ...saved];
    }
    async runSavedView(viewId, input, actorId) {
        const views = await this.listSavedViews();
        const view = views.find((candidate) => candidate.id === viewId);
        if (!view)
            throw new Error(`Saved view not found: ${viewId}`);
        const filters = {
            ...(view.filters_json ?? {}),
            ...(input.filters ?? {}),
        };
        const sort = view.sort_json ?? {};
        const result = await this.getRows(view.table_name, {
            ...input,
            filters,
            sort: input.sort ?? sort.column ?? null,
            direction: input.direction ?? sort.direction ?? null,
        }, actorId);
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
    async listAudit(opts = {}) {
        const limit = Math.min(Math.max(Number(opts.limit ?? 50), 1), 100);
        const offset = Math.max(Number(opts.offset ?? 0), 0);
        const [audit_logs, count] = await this.listAndCountDatabaseExplorerAuditLogs({}, { take: limit, skip: offset, order: { created_at: 'DESC' } });
        return { audit_logs, count, limit, offset };
    }
    async upsertTableConfig(input) {
        (0, access_control_1.assertSafeIdentifier)(input.table_name, 'table name');
        const existing = (await this.listDatabaseExplorerTableConfigs({ table_name: input.table_name }, { take: 1 }))[0];
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
            await this.updateDatabaseExplorerTableConfigs({ id: existing.id, ...payload });
            return this.retrieveDatabaseExplorerTableConfig(existing.id);
        }
        return this.createDatabaseExplorerTableConfigs(payload);
    }
    async upsertColumnConfig(tableName, input) {
        (0, access_control_1.assertSafeIdentifier)(tableName, 'table name');
        (0, access_control_1.assertSafeIdentifier)(input.column_name, 'column name');
        const existing = (await this.listDatabaseExplorerColumnConfigs({ table_name: tableName, column_name: input.column_name }, { take: 1 }))[0];
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
            await this.updateDatabaseExplorerColumnConfigs({ id: existing.id, ...payload });
            return this.retrieveDatabaseExplorerColumnConfig(existing.id);
        }
        return this.createDatabaseExplorerColumnConfigs(payload);
    }
    async audit(input) {
        try {
            await this.createDatabaseExplorerAuditLogs({
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
        }
        catch (error) {
            console.warn('[database-explorer] audit write failed:', error instanceof Error ? error.message : error);
        }
    }
}
exports.default = DatabaseExplorerModuleService;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2RhdGFiYXNlLWV4cGxvcmVyL3NlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxxREFBMEQ7QUFDMUQscURBUTBCO0FBQzFCLHlDQUE4RDtBQUM5RCxxQ0FNa0I7QUF1Q2xCLE1BQU0sbUJBQW1CLEdBQUc7SUFDMUI7UUFDRSxFQUFFLEVBQUUsdUJBQXVCO1FBQzNCLElBQUksRUFBRSxzQ0FBc0M7UUFDNUMsV0FBVyxFQUFFLHFEQUFxRDtRQUNsRSxVQUFVLEVBQUUsT0FBTztRQUNuQixZQUFZLEVBQUUsRUFBRTtRQUNoQixTQUFTLEVBQUUsRUFBRSxNQUFNLEVBQUUsWUFBWSxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUU7S0FDdkQ7SUFDRDtRQUNFLEVBQUUsRUFBRSxtQkFBbUI7UUFDdkIsSUFBSSxFQUFFLHdCQUF3QjtRQUM5QixXQUFXLEVBQUUsb0RBQW9EO1FBQ2pFLFVBQVUsRUFBRSxrQkFBa0I7UUFDOUIsWUFBWSxFQUFFLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRTtRQUNsQyxTQUFTLEVBQUUsRUFBRSxNQUFNLEVBQUUsWUFBWSxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUU7S0FDdkQ7SUFDRDtRQUNFLEVBQUUsRUFBRSxpQkFBaUI7UUFDckIsSUFBSSxFQUFFLDBCQUEwQjtRQUNoQyxXQUFXLEVBQUUsMERBQTBEO1FBQ3ZFLFVBQVUsRUFBRSxpQkFBaUI7UUFDN0IsWUFBWSxFQUFFLEVBQUU7UUFDaEIsU0FBUyxFQUFFLEVBQUUsTUFBTSxFQUFFLFlBQVksRUFBRSxTQUFTLEVBQUUsTUFBTSxFQUFFO0tBQ3ZEO0NBQ0YsQ0FBQztBQUVGLE1BQU0sNkJBQThCLFNBQVEsSUFBQSxxQkFBYSxFQUFDO0lBQ3hELHdCQUF3QixFQUF4QixpQ0FBd0I7SUFDeEIsNEJBQTRCLEVBQTVCLHFDQUE0QjtJQUM1Qiw4QkFB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