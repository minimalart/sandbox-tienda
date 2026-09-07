import { defineRouteConfig } from '@medusajs/admin-sdk';
import { CogSixTooth } from '@medusajs/icons';
import {
  Button,
  Container,
  Heading,
  StatusBadge,
  Table,
  Text,
  Toaster,
  toast,
} from '@medusajs/ui';
import {
  ExtensionVersion,
  HelpDrawer,
  ExtensionSettingsCard,
  SingleColumnLayout,
  SiteScopeBar,
} from '@minimalart/mercatto-plugin-runtime/admin';
import {
  usePaymentBenefitsDashboard,
  usePaymentMethodCatalog,
  useSyncProvider,
} from '../../../hooks/api/payment-benefits';

export const config = defineRouteConfig({
  label: 'Configuración',
  icon: CogSixTooth,
});

export const handle = {
  breadcrumb: () => 'Configuración',
};

const Metric = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: 'danger';
}) => (
  <div className="flex flex-col gap-1 rounded-lg border border-ui-border-base p-4">
    <Text size="small" className="text-ui-fg-subtle">{label}</Text>
    <Text
      className={tone === 'danger' && Number(value) > 0 ? 'text-ui-fg-error' : ''}
      size="xlarge"
      weight="plus"
    >
      {value}
    </Text>
  </div>
);

const SettingsPage = () => {
  const { data: dash, isPending } = usePaymentBenefitsDashboard();
  const { data: catalog } = usePaymentMethodCatalog();
  const syncMut = useSyncProvider();
  const methods = catalog?.payment_methods ?? [];

  const handleSync = async () => {
    try {
      const { result } = await syncMut.mutateAsync('mercadopago');
      if (result.status === 'ok') {
        toast.success(`Sincronización OK: ${result.items_synced} ítems.`);
      } else {
        toast.error(`Error de sincronización: ${result.message ?? 'desconocido'}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al sincronizar');
    }
  };

  return (
    <SingleColumnLayout>
      <Container className="p-0">
        <div className="flex items-center justify-between border-b border-ui-border-base px-6 py-4">
          <div className="flex items-center gap-2">
            <Heading level="h2">Beneficios de Pago</Heading>
            <ExtensionVersion extension="payment-benefits" />
          </div>
          <div className="flex items-center gap-2">
            <HelpDrawer slug="payment-benefits" />
            <Button size="small" onClick={handleSync} isLoading={syncMut.isPending}>
              Sincronizar Mercado Pago
            </Button>
          </div>
        </div>

        <SiteScopeBar screen="payment-benefits" />

        {/* Métricas (antes "Dashboard") */}
        <div className="grid grid-cols-2 gap-4 border-b border-ui-border-base p-6 md:grid-cols-4">
          <Metric label="Total" value={isPending ? '—' : (dash?.total ?? 0)} />
          <Metric label="Activos" value={isPending ? '—' : (dash?.active ?? 0)} />
          <Metric label="Próximos a vencer" value={isPending ? '—' : (dash?.expiring_soon ?? 0)} />
          <Metric label="Errores de sync" value={isPending ? '—' : (dash?.sync_errors ?? 0)} tone="danger" />
        </div>

        <div className="border-b border-ui-border-base px-6 py-4">
          <Text size="small" className="text-ui-fg-subtle">
            Última sincronización:{' '}
            {dash?.last_sync
              ? `${dash.last_sync.provider_code} · ${dash.last_sync.status} · ${
                  dash.last_sync.finished_at
                    ? new Date(dash.last_sync.finished_at).toLocaleString('es-AR')
                    : '—'
                }`
              : 'sin registros'}
          </Text>
        </div>

        {/* Proveedores */}
        <div className="border-b border-ui-border-base px-6 py-4">
          <Heading level="h3" className="mb-2">Proveedores</Heading>
          <div className="flex flex-col gap-2">
            {(dash?.providers ?? []).map((p) => (
              <div key={p.code} className="flex items-center gap-3">
                <Text weight="plus">{p.code}</Text>
                <StatusBadge color={p.supports_sync ? 'green' : 'grey'}>
                  {p.supports_sync ? 'sync automático' : 'manual'}
                </StatusBadge>
              </div>
            ))}
          </div>
        </div>

        {/* Catálogo sincronizado */}
        <div className="px-6 py-4">
          <Heading level="h3" className="mb-2">Catálogo de medios de pago (sincronizado)</Heading>
          {methods.length === 0 ? (
            <Text size="small" className="text-ui-fg-subtle">
              Sin datos. Sincronizá Mercado Pago con el botón de arriba.
            </Text>
          ) : (
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Medio</Table.HeaderCell>
                  <Table.HeaderCell>Tipo</Table.HeaderCell>
                  <Table.HeaderCell>Cuotas s/interés</Table.HeaderCell>
                  <Table.HeaderCell>Estado</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {methods.map((m) => (
                  <Table.Row key={m.id}>
                    <Table.Cell>
                      <div className="flex items-center gap-2">
                        {m.thumbnail_url && (
                          <img src={m.thumbnail_url} alt={m.name} className="h-5 w-auto" />
                        )}
                        <span>{m.name}</span>
                      </div>
                    </Table.Cell>
                    <Table.Cell>{m.payment_type_id ?? '—'}</Table.Cell>
                    <Table.Cell>{m.max_interest_free_installments ?? '—'}</Table.Cell>
                    <Table.Cell>{m.status ?? '—'}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          )}
        </div>
        <Toaster />
      </Container>

      <ExtensionSettingsCard
        namespace="extension:payment-benefits"
        title="Credenciales del sync"
        description="El sync reutiliza el access token de MercadoPago del checkout. No se configura desde acá."
      />
    </SingleColumnLayout>
  );
};

export default SettingsPage;
