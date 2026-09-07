import { defineRouteConfig } from '@medusajs/admin-sdk';
import { FolderOpen } from '@medusajs/icons';
import {
  Badge,
  Button,
  Container,
  Drawer,
  Heading,
  Input,
  Select,
  StatusBadge,
  Switch,
  Tabs,
  Text,
  Toaster,
  toast,
} from '@medusajs/ui';
import { useMemo, useState } from 'react';
import pkg from '../../../../package.json';
import {
  type DatabaseExplorerColumn,
  type DatabaseExplorerTable,
  useDatabaseExplorerAudit,
  useDatabaseExplorerGraph,
  useDatabaseExplorerRow,
  useDatabaseExplorerRows,
  useDatabaseExplorerSettingsTables,
  useDatabaseExplorerTables,
  useDatabaseExplorerViews,
  useRunDatabaseExplorerView,
  useSaveDatabaseExplorerTableSettings,
} from '../../hooks/api/database-explorer';

const PLUGIN_VERSION = pkg.version;

const PAGE_SIZE = 25;

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

function shortValue(value: unknown): string {
  const formatted = formatValue(value);
  return formatted.length > 96 ? `${formatted.slice(0, 96)}...` : formatted;
}

function labelForTable(table: DatabaseExplorerTable) {
  return table.display_name || table.table_name;
}

function primaryValue(table: DatabaseExplorerTable, row: Record<string, unknown>) {
  const key = table.primary_label_column || 'id';
  return row[key] ?? row.id ?? table.table_name;
}

function DataRowsTable({
  table,
  rows,
  onOpen,
}: {
  table: DatabaseExplorerTable;
  rows: Array<Record<string, unknown>>;
  onOpen: (id: string) => void;
}) {
  const columns = table.columns.filter((column) => column.visible !== false).slice(0, 10);

  return (
    <div className="overflow-x-auto border-t border-ui-border-base">
      <table className="w-full min-w-[760px] table-fixed">
        <thead>
          <tr className="border-b border-ui-border-base bg-ui-bg-subtle">
            {columns.map((column) => (
              <th key={column.column_name} className="px-3 py-2 text-left">
                <div className="flex items-center gap-1">
                  <Text size="xsmall" weight="plus">
                    {column.display_name || column.column_name}
                  </Text>
                  {column.masked || column.sensitive ? (
                    <Badge size="2xsmall" color="orange">
                      masked
                    </Badge>
                  ) : null}
                </div>
              </th>
            ))}
            <th className="w-24 px-3 py-2 text-right">
              <Text size="xsmall" weight="plus">
                Acciones
              </Text>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const id = String(row.id ?? '');
            return (
              <tr key={id || index} className="border-b border-ui-border-base">
                {columns.map((column) => (
                  <td key={column.column_name} className="px-3 py-2 align-top">
                    <Text
                      size="small"
                      className="block truncate text-ui-fg-subtle"
                      title={formatValue(row[column.column_name])}
                    >
                      {shortValue(row[column.column_name])}
                    </Text>
                  </td>
                ))}
                <td className="px-3 py-2 text-right">
                  <Button
                    size="small"
                    variant="transparent"
                    disabled={!id}
                    onClick={() => onOpen(id)}
                  >
                    Ver
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RecordDrawer({
  table,
  id,
  onClose,
}: {
  table?: string | null;
  id?: string | null;
  onClose: () => void;
}) {
  const { data, isLoading } = useDatabaseExplorerRow(table, id);
  const row = data?.row;

  const copyJson = async () => {
    if (!row) return;
    await navigator.clipboard.writeText(JSON.stringify(row, null, 2));
    toast.success('JSON copiado');
  };

  return (
    <Drawer open={!!id} onOpenChange={(open) => !open && onClose()}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>{data ? `${labelForTable(data.table)}: ${primaryValue(data.table, data.row)}` : 'Registro'}</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="overflow-y-auto">
          {isLoading ? (
            <Text className="text-ui-fg-subtle">Cargando...</Text>
          ) : row ? (
            <div className="flex flex-col gap-3">
              {Object.entries(row).map(([key, value]) => (
                <div key={key} className="rounded border border-ui-border-base p-3">
                  <Text size="small" weight="plus">
                    {key}
                  </Text>
                  <pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap break-words text-xs text-ui-fg-subtle">
                    {formatValue(value)}
                  </pre>
                </div>
              ))}
            </div>
          ) : (
            <Text className="text-ui-fg-subtle">No se pudo cargar el registro.</Text>
          )}
        </Drawer.Body>
        <Drawer.Footer>
          <Button variant="secondary" onClick={copyJson} disabled={!row}>
            Copiar JSON
          </Button>
          <Drawer.Close asChild>
            <Button>Cerrar</Button>
          </Drawer.Close>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
}

function ExplorerTab() {
  const [page, setPage] = useState(0);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<string | null>(null);
  const { data: tablesData, isLoading: loadingTables } = useDatabaseExplorerTables();
  const tables = tablesData?.tables ?? [];
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const activeTable = useMemo(
    () => tables.find((table) => table.table_name === (selectedTable ?? tables[0]?.table_name)),
    [selectedTable, tables]
  );
  const rows = useDatabaseExplorerRows({
    table: activeTable?.table_name,
    page,
    limit: PAGE_SIZE,
    q,
    sort,
    direction: 'desc',
  });
  const totalPages = Math.max(1, Math.ceil((rows.data?.count ?? 0) / PAGE_SIZE));

  const sortableColumns = activeTable?.columns.filter((column) => column.sortable) ?? [];

  return (
    <div className="grid grid-cols-1 gap-0 lg:grid-cols-[260px_1fr]">
      <aside className="border-b border-ui-border-base p-4 lg:border-b-0 lg:border-r">
        <Input
          placeholder="Buscar tabla..."
          value={selectedTable ?? ''}
          onChange={(event) => {
            setSelectedTable(event.target.value || null);
            setPage(0);
          }}
        />
        <div className="mt-3 flex max-h-[520px] flex-col gap-1 overflow-y-auto">
          {loadingTables ? <Text className="text-ui-fg-subtle">Cargando...</Text> : null}
          {tables
            .filter((table) =>
              selectedTable
                ? table.table_name.includes(selectedTable) ||
                  (table.display_name ?? '').toLowerCase().includes(selectedTable.toLowerCase())
                : true
            )
            .map((table) => (
              <button
                key={table.table_name}
                type="button"
                className={`rounded px-3 py-2 text-left ${
                  table.table_name === activeTable?.table_name
                    ? 'bg-ui-bg-subtle'
                    : 'hover:bg-ui-bg-subtle'
                }`}
                onClick={() => {
                  setSelectedTable(table.table_name);
                  setPage(0);
                }}
              >
                <Text size="small" weight="plus">
                  {labelForTable(table)}
                </Text>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  {table.table_name}
                </Text>
              </button>
            ))}
        </div>
      </aside>
      <section className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4">
          <div>
            <Heading>{activeTable ? labelForTable(activeTable) : 'Explorador'}</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              {activeTable?.description ?? 'Tablas habilitadas para diagnostico read-only.'}
            </Text>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Buscar..."
              value={q}
              onChange={(event) => {
                setQ(event.target.value);
                setPage(0);
              }}
              className="w-48"
            />
            <Select
              value={sort ?? activeTable?.default_sort_column ?? ''}
              onValueChange={(value) => setSort(value || null)}
              size="small"
            >
              <Select.Trigger className="w-44">
                <Select.Value placeholder="Orden" />
              </Select.Trigger>
              <Select.Content>
                {sortableColumns.map((column) => (
                  <Select.Item key={column.column_name} value={column.column_name}>
                    {column.display_name || column.column_name}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>
        </div>

        {rows.isLoading ? (
          <div className="px-6 py-8">
            <Text className="text-ui-fg-subtle">Cargando registros...</Text>
          </div>
        ) : rows.data && activeTable ? (
          <>
            <DataRowsTable table={activeTable} rows={rows.data.rows} onOpen={setSelectedRow} />
            <div className="flex items-center justify-between px-6 py-4">
              <Text size="small" className="text-ui-fg-subtle">
                {rows.data.count} registros
              </Text>
              <div className="flex items-center gap-2">
                <Button
                  size="small"
                  variant="secondary"
                  disabled={page <= 0}
                  onClick={() => setPage((current) => Math.max(0, current - 1))}
                >
                  Anterior
                </Button>
                <Text size="small" className="text-ui-fg-subtle">
                  {page + 1} / {totalPages}
                </Text>
                <Button
                  size="small"
                  variant="secondary"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="px-6 py-8">
            <Text className="text-ui-fg-subtle">No hay tablas habilitadas.</Text>
          </div>
        )}
      </section>
      <RecordDrawer
        table={activeTable?.table_name}
        id={selectedRow}
        onClose={() => setSelectedRow(null)}
      />
    </div>
  );
}

function VisualTab() {
  const { data, isLoading } = useDatabaseExplorerGraph();
  const graph = data?.graph;
  const [selected, setSelected] = useState<string | null>(null);
  const node = graph?.nodes.find((candidate) => candidate.id === selected) ?? graph?.nodes[0];
  const edges = graph?.edges.filter(
    (edge) => edge.source_table === node?.id || edge.target_table === node?.id
  );

  return (
    <div className="grid grid-cols-1 gap-0 lg:grid-cols-[1fr_320px]">
      <div className="p-6">
        {isLoading ? (
          <Text className="text-ui-fg-subtle">Cargando vista visual...</Text>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {graph?.nodes.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`rounded border p-4 text-left ${
                  item.id === node?.id
                    ? 'border-ui-border-interactive bg-ui-bg-subtle'
                    : 'border-ui-border-base'
                }`}
                onClick={() => setSelected(item.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Text weight="plus">{item.label}</Text>
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      {item.table_name}
                    </Text>
                  </div>
                  {item.has_sensitive_fields ? (
                    <Badge size="2xsmall" color="orange">
                      sensible
                    </Badge>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {item.fields.slice(0, 5).map((field) => (
                    <Badge key={field.column_name} size="2xsmall" color={field.masked ? 'orange' : 'grey'}>
                      {field.column_name}
                    </Badge>
                  ))}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      <aside className="border-t border-ui-border-base p-6 lg:border-l lg:border-t-0">
        <Heading level="h2">{node?.label ?? 'Tabla'}</Heading>
        <Text size="small" className="mt-1 text-ui-fg-subtle">
          {node?.description ?? node?.table_name}
        </Text>
        <div className="mt-4 flex flex-col gap-3">
          <Text size="small" weight="plus">
            Relaciones
          </Text>
          {edges?.length ? (
            edges.map((edge) => (
              <div key={edge.id} className="rounded border border-ui-border-base p-3">
                <Text size="small">
                  {edge.source_table}.{edge.source_column}
                </Text>
                <Text size="small" className="text-ui-fg-subtle">
                  a {edge.target_table}.{edge.target_column}
                </Text>
                <Badge size="2xsmall" color={edge.inferred ? 'blue' : 'green'}>
                  {edge.inferred ? 'inferida' : 'configurada'}
                </Badge>
              </div>
            ))
          ) : (
            <Text size="small" className="text-ui-fg-subtle">
              Sin relaciones detectadas en el subconjunto habilitado.
            </Text>
          )}
        </div>
      </aside>
    </div>
  );
}

function ViewsTab() {
  const { data } = useDatabaseExplorerViews();
  const [active, setActive] = useState<string | null>(null);
  const runner = useRunDatabaseExplorerView(active);

  return (
    <div className="grid grid-cols-1 gap-0 lg:grid-cols-[320px_1fr]">
      <aside className="border-b border-ui-border-base p-4 lg:border-b-0 lg:border-r">
        <div className="flex flex-col gap-2">
          {data?.views.map((view) => (
            <button
              key={view.id}
              type="button"
              className="rounded border border-ui-border-base p-3 text-left hover:bg-ui-bg-subtle"
              onClick={() => {
                setActive(view.id);
                runner.mutate({ limit: PAGE_SIZE, offset: 0 });
              }}
            >
              <Text size="small" weight="plus">
                {view.name}
              </Text>
              <Text size="xsmall" className="text-ui-fg-subtle">
                {view.description}
              </Text>
            </button>
          ))}
        </div>
      </aside>
      <section className="min-w-0">
        <div className="px-6 py-4">
          <Heading>{runner.data?.view.name ?? 'Vistas guardadas'}</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Accesos operativos curados para soporte.
          </Text>
        </div>
        {runner.data ? (
          <DataRowsTable table={runner.data.table} rows={runner.data.rows} onOpen={() => undefined} />
        ) : (
          <div className="px-6 py-8">
            <Text className="text-ui-fg-subtle">Selecciona una vista para ejecutarla.</Text>
          </div>
        )}
      </section>
    </div>
  );
}

function AuditTab() {
  const { data, isLoading } = useDatabaseExplorerAudit({ limit: 50, offset: 0 });
  return (
    <div className="p-6">
      {isLoading ? (
        <Text className="text-ui-fg-subtle">Cargando auditoria...</Text>
      ) : (
        <div className="overflow-x-auto rounded border border-ui-border-base">
          <table className="w-full min-w-[760px]">
            <thead className="bg-ui-bg-subtle">
              <tr>
                {['Fecha', 'Usuario', 'Accion', 'Tabla', 'Resultado', 'Duracion'].map((header) => (
                  <th key={header} className="px-3 py-2 text-left">
                    <Text size="xsmall" weight="plus">
                      {header}
                    </Text>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.audit_logs.map((log) => (
                <tr key={log.id} className="border-t border-ui-border-base">
                  <td className="px-3 py-2">
                    <Text size="small">{log.created_at ? new Date(log.created_at).toLocaleString('es-AR') : '-'}</Text>
                  </td>
                  <td className="px-3 py-2">
                    <Text size="small" className="text-ui-fg-subtle">
                      {log.user_id ?? '-'}
                    </Text>
                  </td>
                  <td className="px-3 py-2">
                    <Text size="small">{log.action}</Text>
                  </td>
                  <td className="px-3 py-2">
                    <Text size="small">{log.table_name ?? '-'}</Text>
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge color={log.success ? 'green' : 'red'}>
                      {log.success ? 'ok' : 'error'}
                    </StatusBadge>
                  </td>
                  <td className="px-3 py-2">
                    <Text size="small">{log.duration_ms ?? 0} ms</Text>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SettingsTab() {
  const { data, isLoading } = useDatabaseExplorerSettingsTables();
  const saveTable = useSaveDatabaseExplorerTableSettings();

  const toggle = async (table: { table_name: string; enabled: boolean }) => {
    try {
      await saveTable.mutateAsync({
        table_name: table.table_name,
        enabled: !table.enabled,
        show_in_visual: true,
        display_name: table.table_name,
      });
      toast.success('Configuracion actualizada');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar');
    }
  };

  return (
    <div className="p-6">
      <div className="mb-4">
        <Heading level="h2">Configuracion</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Habilita tablas de forma explicita. Las columnas visibles se controlan por defaults seguros o por configuracion.
        </Text>
      </div>
      {isLoading ? (
        <Text className="text-ui-fg-subtle">Cargando tablas...</Text>
      ) : (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {data?.tables.slice(0, 120).map((table) => (
            <div key={table.table_name} className="flex items-center justify-between rounded border border-ui-border-base p-3">
              <div className="min-w-0">
                <Text size="small" weight="plus" className="truncate">
                  {table.table_name}
                </Text>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  {table.columns.length} columnas
                </Text>
              </div>
              <Switch checked={table.enabled} onCheckedChange={() => toggle(table)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const DataPage = () => {
  return (
    <>
      <Container className="p-0">
        <div className="flex items-center gap-2 px-6 py-4">
          <Heading>Datos</Heading>
          <Badge size="2xsmall" color="grey" rounded="full" title="Plugin version">
            v{PLUGIN_VERSION}
          </Badge>
        </div>
        <Tabs defaultValue="explorer">
          <div className="border-y border-ui-border-base px-6 py-2">
            <Tabs.List>
              <Tabs.Trigger value="explorer">Explorador</Tabs.Trigger>
              <Tabs.Trigger value="visual">Visual</Tabs.Trigger>
              <Tabs.Trigger value="views">Vistas</Tabs.Trigger>
              <Tabs.Trigger value="audit">Auditoria</Tabs.Trigger>
              <Tabs.Trigger value="settings">Configuracion</Tabs.Trigger>
            </Tabs.List>
          </div>
          <Tabs.Content value="explorer">
            <ExplorerTab />
          </Tabs.Content>
          <Tabs.Content value="visual">
            <VisualTab />
          </Tabs.Content>
          <Tabs.Content value="views">
            <ViewsTab />
          </Tabs.Content>
          <Tabs.Content value="audit">
            <AuditTab />
          </Tabs.Content>
          <Tabs.Content value="settings">
            <SettingsTab />
          </Tabs.Content>
        </Tabs>
      </Container>
      <Toaster />
    </>
  );
};

const DataIcon = () => <FolderOpen style={{ color: '#2563EB' }} />;

export const config = defineRouteConfig({
  label: 'Datos',
  icon: DataIcon,
  rank: 38,
});

export const handle = {
  breadcrumb: () => 'Datos',
};

export default DataPage;
