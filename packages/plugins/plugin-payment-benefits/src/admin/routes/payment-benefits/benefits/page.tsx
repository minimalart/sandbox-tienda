import { defineRouteConfig } from '@medusajs/admin-sdk';
import { CreditCard, EllipsisHorizontal, EyeSlash, Eye, PencilSquare, Trash } from '@medusajs/icons';
import {
  Button,
  Container,
  createDataTableColumnHelper,
  DataTable,
  DropdownMenu,
  Heading,
  IconButton,
  StatusBadge,
  Text,
  Toaster,
  toast,
  useDataTable,
  usePrompt,
  type DataTablePaginationState,
} from '@medusajs/ui';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  usePaymentBenefits,
  useDeletePaymentBenefit,
  useUpdatePaymentBenefit,
  type PaymentBenefit,
  type BenefitStatus,
} from '../../../hooks/api/payment-benefits';
import { ExtensionVersion, SiteScopeBar } from '@minimalart/mercatto-plugin-runtime/admin';

const PAGE_SIZE = 20;
const columnHelper = createDataTableColumnHelper<PaymentBenefit>();

const TYPE_LABEL: Record<string, string> = {
  installments: 'Cuotas',
  percentage_discount: '% Descuento',
  fixed_discount: 'Descuento fijo',
  refund: 'Reintegro',
  cashback: 'Cashback',
  custom: 'Personalizado',
};

const STATUS_COLOR: Record<BenefitStatus, 'green' | 'grey' | 'orange' | 'red'> = {
  active: 'green',
  scheduled: 'orange',
  draft: 'grey',
  expired: 'grey',
  disabled: 'grey',
  sync_error: 'red',
};

const STATUS_LABEL: Record<BenefitStatus, string> = {
  active: 'Activo',
  scheduled: 'Programado',
  draft: 'Borrador',
  expired: 'Vencido',
  disabled: 'Deshabilitado',
  sync_error: 'Error de sincronización',
};

/** Fila de acciones que hace las mutaciones sobre un beneficio puntual. */
const RowActions = ({ benefit }: { benefit: PaymentBenefit }) => {
  const navigate = useNavigate();
  const prompt = usePrompt();
  const updateMut = useUpdatePaymentBenefit(benefit.id);
  const deleteMut = useDeletePaymentBenefit();

  const handleDelete = async () => {
    const confirmed = await prompt({
      title: 'Eliminar beneficio',
      description: `¿Eliminar "${benefit.title}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
    });
    if (!confirmed) return;
    await deleteMut.mutateAsync(benefit.id);
    toast.success('Beneficio eliminado');
  };

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenu.Trigger asChild>
          <IconButton variant="transparent" size="small">
            <EllipsisHorizontal />
          </IconButton>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.Item onClick={() => navigate(`/payment-benefits/benefits/${benefit.id}`)}>
            <PencilSquare className="mr-2" />
            {benefit.read_only ? 'Ver / ajustar' : 'Editar'}
          </DropdownMenu.Item>
          <DropdownMenu.Item onClick={() => updateMut.mutate({ hidden: !benefit.hidden })}>
            {benefit.hidden ? <Eye className="mr-2" /> : <EyeSlash className="mr-2" />}
            {benefit.hidden ? 'Mostrar' : 'Ocultar'}
          </DropdownMenu.Item>
          {!benefit.read_only && (
            <>
              <DropdownMenu.Separator />
              <DropdownMenu.Item onClick={handleDelete}>
                <Trash className="mr-2" />
                Eliminar
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu>
    </div>
  );
};

const BenefitsPage = () => {
  const navigate = useNavigate();
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });

  const offset = pagination.pageIndex * pagination.pageSize;
  const { data, isPending } = usePaymentBenefits({
    limit: String(pagination.pageSize),
    offset: String(offset),
  });

  const columns = useMemo(
    () => [
      columnHelper.accessor('title', {
        header: 'Título',
        cell: ({ row, getValue }) => (
          <div className="flex flex-col">
            <span className="font-medium">{getValue()}</span>
            <Text size="xsmall" className="text-ui-fg-muted">{row.original.provider_code}</Text>
          </div>
        ),
      }),
      columnHelper.accessor('benefit_type', {
        header: 'Tipo',
        cell: ({ getValue }) => (
          <Text size="small" className="text-ui-fg-subtle">{TYPE_LABEL[getValue()] ?? getValue()}</Text>
        ),
      }),
      columnHelper.accessor('status', {
        header: 'Estado',
        cell: ({ row }) => {
          const s = row.original.hidden ? 'disabled' : row.original.status;
          return (
            <StatusBadge color={STATUS_COLOR[s as BenefitStatus] ?? 'grey'}>
              {row.original.hidden
                ? 'Oculto'
                : STATUS_LABEL[row.original.status as BenefitStatus] ?? row.original.status}
            </StatusBadge>
          );
        },
      }),
      columnHelper.accessor('priority', {
        header: 'Prioridad',
        cell: ({ getValue }) => <Text size="small">{getValue()}</Text>,
      }),
      columnHelper.accessor('source', {
        header: 'Origen',
        cell: ({ getValue }) => <Text size="small" className="text-ui-fg-subtle">{getValue()}</Text>,
      }),
      columnHelper.accessor('valid_to', {
        header: 'Vence',
        cell: ({ getValue }) => {
          const v = getValue();
          return <Text size="small" className="text-ui-fg-subtle">{v ? new Date(v).toLocaleDateString('es-AR') : '—'}</Text>;
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: ({ row }) => <RowActions benefit={row.original} />,
      }),
    ],
    [],
  );

  const benefits = data?.payment_benefits ?? [];
  const count = data?.count ?? 0;

  const table = useDataTable({
    columns,
    data: benefits,
    getRowId: (row) => row.id,
    rowCount: count,
    isLoading: isPending,
    pagination: { state: pagination, onPaginationChange: setPagination },
    onRowClick: (_e, row) => navigate(`/payment-benefits/benefits/${row.id}`),
  });

  return (
    <>
        <Container className="p-0">
          <DataTable instance={table}>
            <DataTable.Toolbar className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-x-2">
                <Heading>Beneficios</Heading>
                <ExtensionVersion extension="payment-benefits" />
              </div>
              <Button size="small" variant="secondary" onClick={() => navigate('/payment-benefits/benefits/new')}>
                Crear beneficio
              </Button>
            </DataTable.Toolbar>

            <SiteScopeBar screen="payment-benefits" />

            {count > 0 || isPending ? (
              <>
                <DataTable.Table />
                <DataTable.Pagination />
              </>
            ) : (
              <div className="flex items-center justify-center border-t p-6 text-center">
                <Text className="text-ui-fg-subtle">
                  Todavía no hay beneficios. Creá uno manual o sincronizá Mercado Pago desde el Dashboard.
                </Text>
              </div>
            )}
          </DataTable>
          <Toaster />
        </Container>
    </>
  );
};

const BenefitsIcon = () => <CreditCard />;

// Ítem de menú hijo "Beneficios" bajo el padre "Beneficios de Pago" (que redirige
// acá): mismo patrón que Asistente IA › Chat o Blog › Artículos.
export const config = defineRouteConfig({
  label: 'Beneficios',
  icon: BenefitsIcon,
});

export const handle = {
  breadcrumb: () => 'Beneficios',
};

export default BenefitsPage;
