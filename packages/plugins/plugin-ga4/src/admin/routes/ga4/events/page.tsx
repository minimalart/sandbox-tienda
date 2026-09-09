import { defineRouteConfig } from '@medusajs/admin-sdk';
import {
  Badge,
  Button,
  Container,
  createDataTableColumnHelper,
  createDataTableFilterHelper,
  DataTable,
  type DataTableFilteringState,
  type DataTablePaginationState,
  Heading,
  StatusBadge,
  Text,
  Toaster,
  Tooltip,
  useDataTable,
} from '@medusajs/ui';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Ga4Builtin,
  Ga4ManagedSource,
  Ga4Mapping,
  useGa4Builtins,
  useGa4Mappings,
  useSupportedEvents,
} from '../../../hooks/api/ga4-mappings';
import { eventI18nKey, registerGa4EventsTranslations } from '../../../translations/ga4-events';
import {
  BuiltinEditDrawer,
  EventActionsMenu,
  ManagedInfoDrawer,
  MappingCreateDrawer,
  MappingEditDrawer,
} from '../components';
// Nota: en el host había un `<ExtensionVersion />` que mostraba la versión de
// la extensión. Vive en `apps/backend/src/admin/components/common/` y no lo
// exportamos desde el plugin; se reemplaza por un `<Badge>` estático con la
// versión declarada en `mercatto-plugin.json`.

const PAGE_SIZE = 20;

type RowKind = 'generic' | 'builtin' | 'readonly';

// Etapa del recorrido del cliente. Ordena y agrupa la lista para que se lea
// como un journey (embudo → adquisición → B2B) y no como una lista plana.
type Stage = 'funnel' | 'acquisition' | 'b2b';
const STAGE_ORDER: Record<Stage, number> = { funnel: 0, acquisition: 1, b2b: 2 };

// Color del badge por tipo de fila (qué es cada evento de un vistazo).
const KIND_BADGE_COLOR: Record<RowKind, 'blue' | 'green' | 'grey'> = {
  builtin: 'blue', // Automático: payload calculado por el código
  generic: 'green', // Personalizable: lo editás vos (evento + params)
  readonly: 'grey', // Storefront: lo dispara el navegador, solo lectura
};

// Estado unificado de la fila, usado por el filtro "Estado" de la tabla.
// 'removed' solo aplica a builtins ocultos (soft-delete).
type EventStatus = 'active' | 'inactive' | 'removed';

// Fila unificada de la tabla: un mapeo editable (generic), un evento ecommerce
// built-in configurable (builtin) o un evento del storefront de solo lectura.
interface EventRow {
  id: string;
  kind: RowKind;
  stage: Stage;
  status: EventStatus;
  title: string;
  medusa_event: string;
  description: string;
  ga4_event_name: string;
  is_active: boolean;
  hidden: boolean;
  source?: Ga4ManagedSource;
  mapping?: Ga4Mapping;
  builtin?: Ga4Builtin;
}

const columnHelper = createDataTableColumnHelper<EventRow>();
const filterHelper = createDataTableFilterHelper<EventRow>();

const Ga4Events = () => {
  const { t, i18n } = useTranslation('ga4Events');
  registerGa4EventsTranslations(i18n);
  const [editingMapping, setEditingMapping] = useState<Ga4Mapping | null>(null);
  const [editingBuiltin, setEditingBuiltin] = useState<Ga4Builtin | null>(null);
  const [infoRow, setInfoRow] = useState<EventRow | null>(null);
  const [search, setSearch] = useState('');
  const [filtering, setFiltering] = useState<DataTableFilteringState>({});
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });

  // Filtro nativo de la tabla: "Estado" (radio). Sin filtro se ocultan los
  // eliminados; para verlos se agrega el filtro y se elige "Eliminado".
  const filters = useMemo(
    () => [
      filterHelper.accessor('status', {
        type: 'multiselect',
        label: t('FILTER_STATUS'),
        options: [
          { label: t('FILTER_STATUS_ACTIVE'), value: 'active' },
          { label: t('FILTER_STATUS_INACTIVE'), value: 'inactive' },
          { label: t('FILTER_STATUS_REMOVED'), value: 'removed' },
        ],
      }),
    ],
    [t]
  );

  // Dataset chico → traemos todo y paginamos/buscamos client-side para fusionar
  // built-ins ecommerce + mapeos genéricos + eventos read-only en una sola lista.
  const { data, isPending } = useGa4Mappings({ limit: 200 });
  const { data: eventsData } = useSupportedEvents();
  const { data: builtinsData } = useGa4Builtins();

  const allRows = useMemo<EventRow[]>(() => {
    // Categoría de cada evento del catálogo, para deducir la etapa de un mapeo.
    const categoryByEvent = new Map(
      (eventsData?.events ?? []).map((e) => [e.medusa_event, e.category])
    );

    // Built-ins ecommerce (editables: activar/desactivar + renombrar). Son el
    // embudo de compra → etapa funnel.
    const builtins: EventRow[] = (builtinsData?.builtins ?? []).map((b) => ({
      id: `builtin:${b.builtin_key}`,
      kind: 'builtin' as const,
      stage: 'funnel' as const,
      title: t(`BUILTIN.${b.builtin_key}.TITLE`, { defaultValue: b.builtin_key }),
      medusa_event: b.trigger_event,
      description: t(`BUILTIN.${b.builtin_key}.DESC`, { defaultValue: '' }),
      ga4_event_name: b.ga4_event_name,
      is_active: b.is_active,
      hidden: b.hidden,
      status: b.hidden ? 'removed' : b.is_active ? 'active' : 'inactive',
      builtin: b,
    }));

    // Mapeos genéricos de ciclo de vida (DB, editables + params). La etapa sale
    // de la categoría del catálogo: B2B → b2b, el resto → adquisición.
    const mappings: EventRow[] = (data?.ga4_mappings ?? []).map((mapping) => ({
      id: mapping.id,
      kind: 'generic' as const,
      stage: categoryByEvent.get(mapping.medusa_event) === 'b2b' ? 'b2b' : 'acquisition',
      title: t(`EVENTS.${eventI18nKey(mapping.medusa_event)}.TITLE`, {
        defaultValue: mapping.medusa_event,
      }),
      medusa_event: mapping.medusa_event,
      description: t(`EVENTS.${eventI18nKey(mapping.medusa_event)}.DESC`, { defaultValue: '' }),
      ga4_event_name: mapping.ga4_event_name,
      is_active: mapping.is_active,
      hidden: false,
      status: mapping.is_active ? 'active' : 'inactive',
      mapping,
    }));

    // Read-only: eventos del storefront que no se gestionan desde el backend.
    // begin_checkout es parte del embudo → etapa funnel.
    const managed: EventRow[] = (eventsData?.managed ?? []).map((m) => ({
      id: `managed:${m.ga4_event}`,
      kind: 'readonly' as const,
      stage: 'funnel' as const,
      title: t(`MANAGED.${m.ga4_event}.TITLE`, { defaultValue: m.ga4_event }),
      medusa_event: '',
      description: t(`MANAGED.${m.ga4_event}.DESC`, { defaultValue: '' }),
      ga4_event_name: m.ga4_event,
      is_active: true,
      hidden: false,
      status: 'active',
      source: m.source,
    }));

    // Orden por etapa del recorrido: embudo → adquisición → B2B.
    return [...builtins, ...mappings, ...managed].sort(
      (a, b) => STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage]
    );
  }, [builtinsData, eventsData, data, t]);

  const filtered = useMemo(() => {
    // El filtro "Estado" es multiselect: guarda un array de values en
    // filtering.status.
    const statusValues = (filtering.status as EventStatus[] | undefined) ?? [];

    // Sin filtro: se ocultan los eliminados (soft-delete de builtins). Con filtro:
    // se muestran solo las filas cuyos estados estén seleccionados.
    const visible = statusValues.length
      ? allRows.filter((r) => statusValues.includes(r.status))
      : allRows.filter((r) => r.status !== 'removed');

    const q = search.trim().toLowerCase();
    if (!q) return visible;
    return visible.filter((r) =>
      [r.title, r.medusa_event, r.ga4_event_name].some((v) => v.toLowerCase().includes(q))
    );
  }, [allRows, search, filtering]);

  const offset = pagination.pageIndex * pagination.pageSize;
  const paged = filtered.slice(offset, offset + pagination.pageSize);

  // ¿Hay algún estado seleccionado? Habilita el botón "Limpiar" de la barra de
  // filtros (esta versión de @medusajs/ui NO renderiza su propio "Clear all" y
  // no permite deseleccionar del todo, así que lo resolvemos nosotros).
  const hasActiveStatusFilter =
    Array.isArray(filtering.status) && filtering.status.length > 0;

  // Abre el drawer correcto según el tipo de fila. Se dispara desde el título
  // (los setters de estado son estables, no hacen falta en deps).
  const openRow = (row: EventRow) => {
    if (row.kind === 'generic' && row.mapping) setEditingMapping(row.mapping);
    else if (row.kind === 'builtin' && row.builtin) setEditingBuiltin(row.builtin);
    else if (row.kind === 'readonly') setInfoRow(row);
  };

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'title',
        header: t('COLUMN_TITLE'),
        // El título es el punto de entrada clickeable de la fila. No usamos el
        // onRowClick de useDataTable: acá cada fila abre un drawer distinto según
        // su `kind`, y el botón deja eso explícito. (El diagnóstico viejo de que
        // onRowClick no se disparaba ya no aplica: el render sí lee
        // `instance.onRowClick`. Lo que sí engaña es su tipo — entrega la Row de
        // TanStack, no el registro; por eso acá va `row.original`.)
        cell: ({ row }) => (
          <button
            type="button"
            className="flex flex-col items-start text-left"
            onClick={() => openRow(row.original)}
          >
            <span className="font-medium text-ui-fg-interactive">{row.original.title}</span>
            <span className="text-ui-fg-muted txt-compact-small">
              {t(`STAGE.${row.original.stage}`)}
            </span>
          </button>
        ),
      }),
      columnHelper.display({
        id: 'type',
        header: t('COLUMN_TYPE'),
        // Tooltip con qué significa cada tipo — reemplaza la leyenda fija que
        // antes iba al pie de la tabla.
        cell: ({ row }) => (
          <Tooltip content={t(`TYPE_HINT.${row.original.kind}`)}>
            <Badge size="2xsmall" color={KIND_BADGE_COLOR[row.original.kind]}>
              {t(`TYPE.${row.original.kind}`)}
            </Badge>
          </Tooltip>
        ),
      }),
      columnHelper.display({
        id: 'medusa_event',
        header: t('COLUMN_MEDUSA_EVENT'),
        cell: ({ row }) =>
          row.original.medusa_event ? (
            <code className="text-ui-fg-subtle txt-compact-small">{row.original.medusa_event}</code>
          ) : (
            <span className="text-ui-fg-muted">—</span>
          ),
      }),
      columnHelper.display({
        id: 'ga4_event',
        header: t('COLUMN_GA4_EVENT'),
        cell: ({ row }) => (
          <code className="text-ui-fg-subtle txt-compact-small">{row.original.ga4_event_name}</code>
        ),
      }),
      columnHelper.display({
        id: 'status',
        header: t('COLUMN_STATUS'),
        cell: ({ row }) => {
          if (row.original.kind === 'readonly') {
            return (
              <div className="flex items-center gap-2">
                <StatusBadge color="green">{t('STATUS_TRACKED')}</StatusBadge>
                {row.original.source && (
                  <Text size="small" className="text-ui-fg-muted">
                    {t(`SOURCE.${row.original.source}`)}
                  </Text>
                )}
              </div>
            );
          }
          if (row.original.kind === 'builtin' && row.original.hidden) {
            return <StatusBadge color="red">{t('STATUS_REMOVED')}</StatusBadge>;
          }
          return (
            <StatusBadge color={row.original.is_active ? 'green' : 'grey'}>
              {row.original.is_active ? t('STATUS_ACTIVE') : t('STATUS_INACTIVE')}
            </StatusBadge>
          );
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: t('COLUMN_ACTIONS'),
        // Menú ⋮ unificado para las 3 filas — solo dispara los setters de la
        // página, no monta drawers propios (evita el doble drawer).
        cell: ({ row }) => (
          <EventActionsMenu
            kind={row.original.kind}
            mapping={row.original.mapping}
            builtin={row.original.builtin}
            onEdit={setEditingMapping}
            onEditBuiltin={setEditingBuiltin}
            onView={() => setInfoRow(row.original)}
          />
        ),
      }),
    ],
    [t]
  );

  const table = useDataTable({
    columns,
    data: paged,
    getRowId: (row) => row.id,
    rowCount: filtered.length,
    isLoading: isPending,
    filters,
    filtering: {
      state: filtering,
      onFilteringChange: (state) => {
        setFiltering(state);
        setPagination((prev) => ({ ...prev, pageIndex: 0 }));
      },
    },
    pagination: {
      state: pagination,
      onPaginationChange: setPagination,
    },
    search: {
      state: search,
      onSearchChange: (value) => {
        setSearch(value);
        setPagination((prev) => ({ ...prev, pageIndex: 0 }));
      },
    },
  });

  return (
    <>
      <Container className="p-0">
        <DataTable instance={table}>
          {/* El Toolbar ya renderiza la barra de filtros (con su botón "+" y los
              chips) automáticamente a partir de `filters`. No agregar FilterMenu
              ni FilterBar acá o se triplica el botón. */}
          <DataTable.Toolbar
            className="flex items-center justify-between"
            filterBarContent={
              hasActiveStatusFilter ? (
                <Button variant="transparent" size="small" onClick={() => setFiltering({})}>
                  {t('FILTER_CLEAR_ALL')}
                </Button>
              ) : undefined
            }
          >
            <div className="flex items-center gap-x-2">
              <Heading>{t('TITLE')}</Heading>
              <Badge size="2xsmall">v1.0.0</Badge>
            </div>
            <div className="flex items-center gap-2">
              <DataTable.Search placeholder={t('SEARCH_PLACEHOLDER')} />
              <MappingCreateDrawer />
            </div>
          </DataTable.Toolbar>
          {filtered.length > 0 || isPending ? (
            <>
              <DataTable.Table />
              <DataTable.Pagination />
            </>
          ) : (
            <div className="flex items-center justify-center border-t p-6 text-center">
              <Text className="text-ui-fg-subtle">{t('EMPTY_STATE')}</Text>
            </div>
          )}
        </DataTable>
      </Container>
      {editingMapping && (
        <MappingEditDrawer
          mapping={editingMapping}
          open={!!editingMapping}
          onOpenChange={(open) => {
            if (!open) setEditingMapping(null);
          }}
        />
      )}
      {editingBuiltin && (
        <BuiltinEditDrawer
          builtin={editingBuiltin}
          open={!!editingBuiltin}
          onOpenChange={(open) => {
            if (!open) setEditingBuiltin(null);
          }}
        />
      )}
      {infoRow && (
        <ManagedInfoDrawer
          open={!!infoRow}
          onOpenChange={(open) => {
            if (!open) setInfoRow(null);
          }}
          title={infoRow.title}
          ga4Event={infoRow.ga4_event_name}
          description={infoRow.description}
          source={infoRow.source}
        />
      )}
      <Toaster />
    </>
  );
};

export const config = defineRouteConfig({
  label: 'Eventos',
  rank: 0,
});

export const handle = {
  breadcrumb: () => 'Eventos',
};

export default Ga4Events;
