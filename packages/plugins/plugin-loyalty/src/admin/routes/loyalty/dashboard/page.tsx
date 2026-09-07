import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Container, Heading, Text, Table } from '@medusajs/ui';
import { ExtensionVersion } from '../../../components/common/extension-version';
import { SiteScopeBar } from '../../../components/common/site-scope-bar';
import { useLoyaltyDashboard } from '../../../hooks/api/loyalty';

const fmt = (n: number) => (Number(n) || 0).toLocaleString('es-AR');

const Kpi = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl border border-ui-border-base bg-ui-bg-subtle px-4 py-3">
    <p className="text-ui-fg-subtle text-xs">{label}</p>
    <p className="mt-1 text-xl font-semibold text-ui-fg-base">{value}</p>
  </div>
);

const LoyaltyDashboardPage = () => {
  const { data, isLoading } = useLoyaltyDashboard();

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h1">Dashboard</Heading>
        <ExtensionVersion extension="loyalty" />
      </div>
      <SiteScopeBar screen="loyalty/dashboard" />

      {isLoading || !data ? (
        <div className="px-6 py-8">
          <Text className="text-ui-fg-subtle">Cargando…</Text>
        </div>
      ) : (
        <div className="flex flex-col gap-6 px-6 py-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Puntos emitidos" value={fmt(data.issued)} />
            <Kpi label="Puntos canjeados" value={fmt(data.redeemed)} />
            <Kpi label="Puntos vencidos" value={fmt(data.expired)} />
            <Kpi label="Clientes activos" value={fmt(data.active_customers)} />
            <Kpi label="Balance promedio" value={fmt(data.avg_balance)} />
            <Kpi label="Canjes totales" value={fmt(data.total_redemptions)} />
            <Kpi label="Canjes pendientes" value={fmt(data.pending_redemptions)} />
          </div>

          <div>
            <Heading level="h2" className="mb-2 text-base">Top recompensas</Heading>
            {data.top_rewards.length === 0 ? (
              <Text className="text-ui-fg-subtle">Todavía no hay canjes.</Text>
            ) : (
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Recompensa</Table.HeaderCell>
                    <Table.HeaderCell>Canjes</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {data.top_rewards.map((r) => (
                    <Table.Row key={r.name}>
                      <Table.Cell>{r.name}</Table.Cell>
                      <Table.Cell>{r.count}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            )}
          </div>
        </div>
      )}
    </Container>
  );
};

export const config = defineRouteConfig({ label: 'Dashboard' });
export const handle = { breadcrumb: () => 'Dashboard' };
export default LoyaltyDashboardPage;
