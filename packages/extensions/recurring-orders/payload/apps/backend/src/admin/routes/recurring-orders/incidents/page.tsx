import { Button, Container, Heading, Select, StatusBadge, Text, toast, Toaster } from '@medusajs/ui';
import { useState } from 'react';
import { SiteScopeBar } from '../../../components/common/site-scope-bar';
import {
  useResolveSubscriptionAlert,
  useSubscriptionAlerts,
} from '../../../hooks/api/recurring-orders';
import { SubscriptionSectionNav } from '../section-nav';

const SubscriptionIncidentsPage = () => {
  const [status, setStatus] = useState('open');
  const { data, isPending } = useSubscriptionAlerts({ status });
  const resolve = useResolveSubscriptionAlert();
  const rows = data?.alerts ?? [];
  const onResolve = async (id: string) => {
    try { await resolve.mutateAsync(id); toast.success('Incidente resuelto'); }
    catch (error) { toast.error((error as Error).message); }
  };
  return (
    <>
      <Container className="p-0">
        <SubscriptionSectionNav />
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div><Heading>Incidentes</Heading><Text size="small" className="text-ui-fg-subtle">Stock, pagos, webhooks, pedidos y conciliación.</Text></div>
          <div className="w-40"><Select value={status} onValueChange={setStatus}><Select.Trigger><Select.Value /></Select.Trigger><Select.Content><Select.Item value="open">Abiertos</Select.Item><Select.Item value="resolved">Resueltos</Select.Item></Select.Content></Select></div>
        </div>
        <SiteScopeBar screen="recurring-orders.incidents" />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm"><thead><tr className="border-b text-ui-fg-subtle"><th className="px-6 py-3">Incidente</th><th>Tipo</th><th>Severidad</th><th>Referencia</th><th>Detectado</th><th className="pr-6 text-right">Acción</th></tr></thead><tbody>
            {rows.map((row) => <tr key={row.id} className="border-b last:border-0"><td className="px-6 py-4"><div className="font-medium">{row.title}</div><Text size="xsmall" className="max-w-md text-ui-fg-subtle">{row.message ?? 'Sin detalle'}</Text></td><td>{row.type}</td><td><StatusBadge color={row.severity === 'critical' ? 'red' : 'orange'}>{row.severity === 'critical' ? 'Crítico' : 'Advertencia'}</StatusBadge></td><td className="font-mono text-xs">{row.renewal_cycle_id ?? row.recurring_order_id ?? row.variant_id ?? '—'}</td><td>{new Date(row.detected_at).toLocaleString('es-AR')}</td><td className="pr-6 text-right">{row.status === 'open' && <Button size="small" variant="secondary" isLoading={resolve.isPending} onClick={() => void onResolve(row.id)}>Marcar resuelto</Button>}</td></tr>)}
            {!isPending && !rows.length && <tr><td colSpan={6} className="px-6 py-10 text-center text-ui-fg-subtle">No hay incidentes {status === 'open' ? 'abiertos' : 'resueltos'}.</td></tr>}
          </tbody></table>
        </div>
      </Container>
      <Toaster />
    </>
  );
};

export default SubscriptionIncidentsPage;

export const handle = { breadcrumb: () => 'Incidentes' };
