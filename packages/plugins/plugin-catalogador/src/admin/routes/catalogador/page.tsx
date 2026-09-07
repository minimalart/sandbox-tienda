import { defineRouteConfig } from '@medusajs/admin-sdk';
import { SparklesSolid } from '@medusajs/icons';
import {
  Button,
  Container,
  createDataTableColumnHelper,
  DataTable,
  type DataTablePaginationState,
  Heading,
  StatusBadge,
  Text,
  useDataTable,
} from '@medusajs/ui';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { type CatalogingExecution, type CatalogingExecutionStatus, useExecutions } from '../../hooks/api';
import { registerCatalogadorTranslations } from '../../translations/catalogador';
// TODO Fase B: <ExtensionVersion extension="catalogador" /> vive en el host
// bajo apps/backend/src/admin/components/common/extension-version. Cuando ese
// componente se extraiga a un paquete compartido, restaurar el badge.

export const handle = { breadcrumb: () => 'Catalogador' };

const PAGE_SIZE = 20;
const columnHelper = createDataTableColumnHelper<CatalogingExecution>();

const STATUS_COLOR: Record<CatalogingExecutionStatus, 'green' | 'orange' | 'red' | 'blue' | 'grey' | 'purple'> = {
  draft: 'grey',
  generating: 'blue',
  pending_review: 'orange',
  partially_reviewed: 'orange',
  ready_to_apply: 'purple',
  applying: 'blue',
  applied: 'green',
  partially_applied: 'orange',
  error: 'red',
  cancelled: 'grey',
  restored: 'purple',
};

const STATUS_LABEL: Record<CatalogingExecutionStatus, string> = {
  draft: 'Borrador',
  generating: 'Generando',
  pending_review: 'Pendiente de revisión',
  partially_reviewed: 'Parcialmente revisada',
  ready_to_apply: 'Lista para aplicar',
  applying: 'Aplicando',
  applied: 'Aplicada',
  partially_applied: 'Aplicada parcialmente',
  error: 'Error',
  cancelled: 'Cancelada',
  restored: 'Restaurada',
};

const Catalogador = () => {
  const { i18n } = useTranslation('catalogador');
  registerCatalogadorTranslations(i18n);
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState<DataTablePaginationState>({ pageIndex: 0, pageSize: PAGE_SIZE });

  const offset = pagination.pageIndex * pagination.pageSize;
  const { data, isPending } = useExecutions({
    limit: pagination.pageSize,
    offset,
    q: search || undefined,
  });

  const executions = data?.executions ?? [];
  const count = data?.count ?? 0;

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: 'Nombre',
        cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
      }),
      columnHelper.accessor('status', {
        header: 'Estado',
        cell: ({ getValue }) => {
          const s = getValue() as CatalogingExecutionStatus;
          return <StatusBadge color={STATUS_COLOR[s] ?? 'grey'}>{STATUS_LABEL[s] ?? s}</StatusBadge>;
        },
      }),
      columnHelper.accessor('selection_count', {
        header: 'Productos',
        cell: ({ getValue }) => <span className="text-ui-fg-subtle">{getValue()}</span>,
      }),
      columnHelper.display({
        id: 'progress',
        header: 'Progreso',
        cell: ({ row }) => {
          const p = row.original.progress;
          if (!p || p.total === 0) return <span className="text-ui-fg-muted">—</span>;
          return (
            <span className="text-ui-fg-subtle">
              {p.processed}/{p.total} ({p.percent}%)
            </span>
          );
        },
      }),
      columnHelper.display({
        id: 'errors',
        header: 'Errores',
        cell: ({ row }) => {
          const failed = row.original.progress?.failed ?? 0;
          return failed > 0 ? (
            <StatusBadge color="red">{failed}</StatusBadge>
          ) : (
            <span className="text-ui-fg-muted">0</span>
          );
        },
      }),
      columnHelper.display({
        id: 'ai_cost',
        header: 'Costo IA',
        cell: ({ row }) => {
          const cost = row.original.ai_cost_usd ?? 0;
          if (!cost) return <span className="text-ui-fg-muted">—</span>;
          return (
            <span className="text-ui-fg-subtle">
              US$ {cost.toFixed(cost < 0.0001 ? 6 : 4)}
              {row.original.ai_usage?.missing_cost ? '+' : ''}
            </span>
          );
        },
      }),
      columnHelper.accessor('created_at', {
        header: 'Fecha',
        cell: ({ getValue }) => (
          <span className="text-ui-fg-subtle">{new Date(getValue()).toLocaleDateString()}</span>
        ),
      }),
    ],
    []
  );

  const table = useDataTable({
    columns,
    data: executions,
    getRowId: (row) => row.id,
    rowCount: count,
    isLoading: isPending,
    pagination: { state: pagination, onPaginationChange: setPagination },
    search: { state: search, onSearchChange: setSearch },
    onRowClick: (_e, row) => navigate(`/catalogador/${row.id}`),
  });

  return (
    <Container className="divide-y p-0">
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex flex-col items-start justify-between gap-2 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Heading>Catalogador</Heading>
              {/* TODO Fase B: <ExtensionVersion extension="catalogador" /> */}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DataTable.Search placeholder="Buscar ejecuciones" />
            <Button variant="primary" size="small" onClick={() => navigate('/catalogador/new')}>
              Nueva ejecución
            </Button>
          </div>
        </DataTable.Toolbar>
        {count === 0 && !isPending ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12">
            <Text className="text-ui-fg-subtle">
              Todavía no hay ejecuciones. Creá una para empezar a mejorar tu catálogo.
            </Text>
            <Button variant="secondary" size="small" onClick={() => navigate('/catalogador/new')}>
              Nueva ejecución
            </Button>
          </div>
        ) : (
          <>
            <DataTable.Table />
            <DataTable.Pagination />
          </>
        )}
      </DataTable>
    </Container>
  );
};

export const config = defineRouteConfig({
  label: 'Catalogador',
  icon: SparklesSolid,
});

export default Catalogador;
