import { defineRouteConfig } from '@medusajs/admin-sdk';
import { ArrowPath, Envelope } from '@medusajs/icons';
import {
  Button,
  Container,
  createDataTableColumnHelper,
  DataTable,
  type DataTablePaginationState,
  Heading,
  StatusBadge,
  Text,
  toast,
  Toaster,
  useDataTable,
} from '@medusajs/ui';
import { useMemo, useState } from 'react';
import { ExtensionVersion } from '../../components/common/extension-version';
import { SiteScopeBar } from '../../components/common/site-scope-bar';
import {
  type NewsletterSubscription,
  type NewsletterSyncStatus,
  useNewsletterSubscriptions,
  useRetryNewsletterSubscription,
} from '../../hooks/api';

const PAGE_SIZE = 20;

/**
 * Los cuatro estados con el color que le corresponde a cada uno, y ninguno en
 * verde por defecto.
 *
 * `skipped` va en naranja y no en rojo a propósito: no es un error de Brevo, es
 * una tienda sin credenciales. Pintarlo igual que `failed` mandaría al operador a
 * apretar "Reintentar" contra algo que sólo se arregla en Ajustes — y el botón se
 * lo permitiría, porque reintentar es idempotente, así que fallaría en silencio
 * tantas veces como quisiera.
 */
const STATUS_META: Record<
  NewsletterSyncStatus,
  { label: string; color: 'green' | 'red' | 'orange' | 'grey' }
> = {
  synced: { label: 'En Brevo', color: 'green' },
  failed: { label: 'Falló', color: 'red' },
  skipped: { label: 'Sin configurar', color: 'orange' },
  pending: { label: 'Sin sincronizar', color: 'grey' },
};

const columnHelper = createDataTableColumnHelper<NewsletterSubscription>();

const RetryButton = ({ subscription }: { subscription: NewsletterSubscription }) => {
  const { mutate, isPending } = useRetryNewsletterSubscription({
    onSuccess: ({ newsletter_subscription }) => {
      if (newsletter_subscription.sync_status === 'synced') {
        toast.success('Contacto sincronizado con Brevo.');
      } else {
        toast.error(
          newsletter_subscription.sync_error ?? 'No se pudo sincronizar con Brevo.',
        );
      }
    },
    onError: (error) => toast.error(error.message),
  });

  if (subscription.sync_status === 'synced') return null;

  return (
    <Button
      size="small"
      variant="secondary"
      isLoading={isPending}
      onClick={(event) => {
        event.stopPropagation();
        mutate(subscription.id);
      }}
    >
      <ArrowPath />
      Reintentar
    </Button>
  );
};

/**
 * Suscriptores del newsletter.
 *
 * ─── PARA QUÉ EXISTE ESTA PANTALLA ──────────────────────────────────────────
 *
 * Guardar las altas en una tabla que nadie mira no arregla el problema que la
 * originó: durante meses el formulario dijo "¡Te suscribiste correctamente!" sin
 * mandar nada a ningún lado, y NADIE se enteró porque no había dónde enterarse.
 * El cartel de arriba es la mitad importante de esta página — la tabla es la otra.
 */
const NewsletterSubscriptions = () => {
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });

  const { data, isPending } = useNewsletterSubscriptions({
    limit: pagination.pageSize,
    offset: pagination.pageIndex * pagination.pageSize,
  });

  const subscriptions = data?.newsletter_subscriptions ?? [];
  const count = data?.count ?? 0;
  const pendingCount = data?.pending_count ?? 0;

  const columns = useMemo(
    () => [
      columnHelper.accessor('email', {
        header: 'Email',
        cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
      }),
      columnHelper.accessor('sync_status', {
        header: 'Brevo',
        cell: ({ getValue }) => {
          const meta = STATUS_META[getValue()] ?? STATUS_META.pending;
          return <StatusBadge color={meta.color}>{meta.label}</StatusBadge>;
        },
      }),
      columnHelper.accessor('sync_error', {
        header: 'Detalle',
        cell: ({ getValue }) => {
          const error = getValue();
          if (!error) return <span className="text-ui-fg-muted">—</span>;
          // El mensaje de Brevo viene con su `code`, que es lo accionable. Se
          // muestra recortado y entero en el title: es texto de diagnóstico, no
          // una columna que tenga que caber.
          return (
            <span className="text-ui-fg-subtle line-clamp-1" title={error}>
              {error}
            </span>
          );
        },
      }),
      columnHelper.accessor('created_at', {
        header: 'Alta',
        cell: ({ getValue }) => (
          <span className="text-ui-fg-subtle">
            {new Date(getValue()).toLocaleDateString('es-AR')}
          </span>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex justify-end">
            <RetryButton subscription={row.original} />
          </div>
        ),
      }),
    ],
    [],
  );

  const table = useDataTable({
    columns,
    data: subscriptions,
    getRowId: (row) => row.id,
    rowCount: count,
    isLoading: isPending,
    pagination: { state: pagination, onPaginationChange: setPagination },
  });

  return (
    <>
      <Container className="p-0">
        <DataTable instance={table}>
          <DataTable.Toolbar className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-x-2">
              <Heading>Suscriptores</Heading>
              <ExtensionVersion extension="newsletter" />
            </div>
          </DataTable.Toolbar>

          <SiteScopeBar screen="newsletter-subscriptions" />

          {pendingCount > 0 && (
            <div className="border-b bg-ui-tag-orange-bg px-6 py-3">
              <Text size="small" className="text-ui-tag-orange-text">
                {pendingCount === 1
                  ? 'Hay 1 alta que no llegó a Brevo.'
                  : `Hay ${pendingCount} altas que no llegaron a Brevo.`}{' '}
                Si dicen “Sin configurar”, cargá la API key y el ID de lista en
                Ajustes → Newsletter (Brevo) para esta tienda; el reintento no puede
                arreglarlo solo.
              </Text>
            </div>
          )}

          {count > 0 || isPending ? (
            <>
              <DataTable.Table />
              <DataTable.Pagination />
            </>
          ) : (
            <div className="flex items-center justify-center border-t p-6 text-center">
              <Text className="text-ui-fg-subtle">
                Todavía no hay altas al newsletter en esta tienda.
              </Text>
            </div>
          )}
        </DataTable>
      </Container>
      <Toaster />
    </>
  );
};

export const config = defineRouteConfig({
  label: 'Newsletter',
  icon: Envelope,
  // 42: pegado a Plantillas de email (41), su vecino conceptual. 46 es
  // Recomendaciones y 50 Typesense, así que no pisa nada.
  rank: 42,
});

export const handle = {
  breadcrumb: () => 'Newsletter',
};

export default NewsletterSubscriptions;
