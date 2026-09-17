import { useTranslation } from 'react-i18next';
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
import { ExtensionVersion } from '../../../components/common/extension-version';
import { SiteScopeBar } from '../../../components/common/site-scope-bar';
import {
  type NewsletterSubscription,
  type NewsletterSyncStatus,
  useNewsletterSubscriptions,
  useRetryNewsletterSubscription,
} from '../../../hooks/api/newsletter-subscriptions';

const PAGE_SIZE = 20;
const copy = {
  es: { synced: 'En Brevo', failed: 'Falló', skipped: 'Sin configurar', pending: 'Sin sincronizar', success: 'Contacto sincronizado con Brevo.', error: 'No se pudo sincronizar con Brevo.', retry: 'Reintentar', detail: 'Detalle', created: 'Alta', title: 'Suscriptores', empty: 'Todavía no hay altas al newsletter en esta tienda.', pendingHelp: 'altas pendientes de sincronización. Si dicen “Sin configurar”, cargá la API key y el ID de lista en Marketing & Privacy → Credenciales → Newsletter (Brevo) para esta tienda.' },
  en: { synced: 'In Brevo', failed: 'Failed', skipped: 'Not configured', pending: 'Not synced', success: 'Contact synced with Brevo.', error: 'Unable to sync with Brevo.', retry: 'Retry', detail: 'Detail', created: 'Subscribed', title: 'Subscribers', empty: 'This store has no newsletter subscribers yet.', pendingHelp: 'subscriptions awaiting synchronization. For “Not configured”, set the API key and list ID in Marketing & Privacy → Credentials → Newsletter (Brevo) for this store.' },
};
function useCopy() { const { i18n } = useTranslation(); const lang = i18n.language.startsWith('es') ? 'es' : 'en'; return { c: copy[lang], lang }; }


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
  const { c } = useCopy();
  const { mutate, isPending } = useRetryNewsletterSubscription({
    onSuccess: ({ newsletter_subscription }) => {
      if (newsletter_subscription.sync_status === 'synced') {
        toast.success(c.success);
      } else {
        toast.error(
          newsletter_subscription.sync_error ?? c.error,
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
      {c.retry}
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
  const { c, lang } = useCopy();
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
          return <StatusBadge color={meta.color}>{c[getValue()] ?? c.pending}</StatusBadge>;
        },
      }),
      columnHelper.accessor('sync_error', {
        header: c.detail,
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
        header: c.created,
        cell: ({ getValue }) => (
          <span className="text-ui-fg-subtle">
            {new Date(getValue()).toLocaleDateString(lang)}
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
    [c, lang],
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
              <Heading>{c.title}</Heading>
              <ExtensionVersion extension="newsletter" />
            </div>
          </DataTable.Toolbar>

          <SiteScopeBar screen="newsletter-subscriptions" />

          {pendingCount > 0 && (
            <div className="border-b bg-ui-tag-orange-bg px-6 py-3">
              <Text size="small" className="text-ui-tag-orange-text">
                {pendingCount} {c.pendingHelp}
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
                {c.empty}
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
  rank: 2,
});

export const handle = {
  breadcrumb: () => 'Newsletter',
};

export default NewsletterSubscriptions;
