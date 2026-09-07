import { Button, Container, Heading, StatusBadge, Text } from '@medusajs/ui';
import { SiteScopeBar } from '../../../components/common/site-scope-bar';
import { useSubscriptionForecast } from '../../../hooks/api/recurring-orders';
import { SubscriptionSectionNav } from '../section-nav';

const SubscriptionForecastPage = () => {
  const { data, isPending, refetch, isFetching } = useSubscriptionForecast();
  const rows = data?.forecast ?? [];
  return (
    <Container className="p-0">
      <SubscriptionSectionNav />
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <Heading>Demanda futura</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Stock disponible frente a las renovaciones comprometidas a 14 y 30 días.
          </Text>
        </div>
        <Button size="small" variant="secondary" isLoading={isFetching} onClick={() => void refetch()}>
          Actualizar
        </Button>
      </div>
      <SiteScopeBar screen="recurring-orders.forecast" />
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b text-ui-fg-subtle"><th className="px-6 py-3">Variante</th><th>Ubicación</th><th>Disponible</th><th>Necesario 14d</th><th>Necesario 30d</th><th>Déficit</th><th>Suscripciones</th><th className="pr-6">Próxima entrega</th></tr></thead>
          <tbody>
            {rows.map((row) => <tr key={`${row.sales_channel_id}:${row.location_id ?? 'unassigned'}:${row.variant_id}`} className="border-b last:border-0"><td className="px-6 py-4 font-mono text-xs">{row.variant_id}</td><td>{row.location_name ?? row.location_id ?? 'Sin asignar'}</td><td>{row.available}</td><td>{row.required_14d}</td><td>{row.required_30d}</td><td><StatusBadge color={row.deficit_14d > 0 ? 'red' : row.deficit_30d > 0 ? 'orange' : 'green'}>{Math.max(row.deficit_14d, row.deficit_30d) || 'Cubierto'}</StatusBadge></td><td>{row.recurring_order_ids.length}</td><td className="pr-6">{row.next_due_at ? new Date(row.next_due_at).toLocaleDateString('es-AR') : '—'}</td></tr>)}
            {!isPending && !rows.length && <tr><td colSpan={8} className="px-6 py-10 text-center text-ui-fg-subtle">No hay demanda recurrente en los próximos 30 días.</td></tr>}
          </tbody>
        </table>
      </div>
      {data?.generated_at && <Text size="xsmall" className="border-t px-6 py-3 text-ui-fg-subtle">Actualizado {new Date(data.generated_at).toLocaleString('es-AR')}</Text>}
    </Container>
  );
};

export default SubscriptionForecastPage;

export const handle = { breadcrumb: () => 'Demanda futura' };
