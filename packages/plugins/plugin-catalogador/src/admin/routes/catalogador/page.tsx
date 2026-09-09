import { defineRouteConfig } from '@medusajs/admin-sdk';
import { SparklesSolid, Trash } from '@medusajs/icons';
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
import { ExecutionActionsMenu } from '../../components/catalogador/execution-actions-menu';
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
  // La papelera es un MODO de esta misma pantalla, no otra ruta: el operador viene
  // a "limpiar el listado" y tiene que poder ir y volver sin perder el contexto.
  const [trash, setTrash] = useState(false);
  const [pagination, setPagination] = useState<DataTablePaginationState>({ pageIndex: 0, pageSize: PAGE_SIZE });

  const offset = pagination.pageIndex * pagination.pageSize;
  const { data, isPending } = useExecutions({
    limit: pagination.pageSize,
    offset,
    q: search || undefined,
    deleted: trash ? 'only' : undefined,
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
      // En la papelera la fecha que importa es la del borrado, no la de creación:
      // es por la que se ordena y la que contesta "¿esto lo tiré yo hoy?".
      ...(trash
        ? [
            columnHelper.display({
              id: 'deleted_at',
              header: 'Eliminada',
              cell: ({ row }) => {
                const at = row.original.deleted_at;
                return (
                  <span className="text-ui-fg-subtle">
                    {at ? new Date(at).toLocaleDateString() : '—'}
                  </span>
                );
              },
            }),
          ]
        : []),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          // `stopPropagation` porque la fila entera navega al detalle: sin esto,
          // abrir el menú te saca de la pantalla.
          <div onClick={(e) => e.stopPropagation()}>
            <ExecutionActionsMenu execution={row.original} trash={trash} />
          </div>
        ),
      }),
    ],
    [trash]
  );

  const table = useDataTable({
    columns,
    data: executions,
    getRowId: (row) => row.id,
    rowCount: count,
    isLoading: isPending,
    pagination: { state: pagination, onPaginationChange: setPagination },
    search: { state: search, onSearchChange: setSearch },
    // En la papelera la fila no navega: `GET /executions/:id` resuelve con el
    // repositorio de MikroORM, que filtra las borradas, así que abrir el detalle de
    // una corrida de la papelera daría un 404 sin explicación. Se restaura primero.
    onRowClick: trash
      ? undefined
      : (_e, row) => {
          // El tipo de `onRowClick` dice `TData` pero `@medusajs/ui` entrega el `Row`
          // de TanStack (`{ id, index, original, … }`). `row.id` andaba de casualidad
          // —`getRowId` mapea al id de la corrida—, así que sacar ese `getRowId`
          // rompería la navegación con el compilador en verde.
          const item = (row as CatalogingExecution & { original?: CatalogingExecution }).original ?? row;
          navigate(`/catalogador/${item.id}`);
        },
  });

  return (
    <Container className="divide-y p-0">
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex flex-col items-start justify-between gap-2 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Heading>{trash ? 'Catalogador · Papelera' : 'Catalogador'}</Heading>
              {/* TODO Fase B: <ExtensionVersion extension="catalogador" /> */}
            </div>
            {trash ? (
              <Text size="small" className="text-ui-fg-subtle">
                Corridas eliminadas del listado. Restaurar las devuelve intactas — no
                se tocó ningún producto del catálogo.
              </Text>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <DataTable.Search placeholder={trash ? 'Buscar en la papelera' : 'Buscar ejecuciones'} />
            <Button
              variant="secondary"
              size="small"
              onClick={() => {
                setTrash((v) => !v);
                // Volver a la página 1: la papelera y el listado tienen conteos
                // distintos, y quedarse en la página 4 de una lista de 2 páginas
                // muestra una tabla vacía que parece un bug.
                setPagination((p) => ({ ...p, pageIndex: 0 }));
              }}
            >
              {trash ? (
                'Volver al listado'
              ) : (
                <>
                  <Trash className="text-ui-fg-subtle" />
                  Papelera
                </>
              )}
            </Button>
            {trash ? null : (
              <Button variant="primary" size="small" onClick={() => navigate('/catalogador/new')}>
                Nueva ejecución
              </Button>
            )}
          </div>
        </DataTable.Toolbar>
        {count === 0 && !isPending ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12">
            <Text className="text-ui-fg-subtle">
              {trash
                ? 'La papelera está vacía.'
                : 'Todavía no hay ejecuciones. Creá una para empezar a mejorar tu catálogo.'}
            </Text>
            {trash ? null : (
              <Button variant="secondary" size="small" onClick={() => navigate('/catalogador/new')}>
                Nueva ejecución
              </Button>
            )}
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
