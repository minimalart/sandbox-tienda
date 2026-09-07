import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Container, Heading, Table, Badge, Text } from '@medusajs/ui';
import { ExtensionVersion } from '../../../components/common/extension-version';
import { SiteScopeBar } from '../../../components/common/site-scope-bar';
import { useGrants, type RewardGrant } from '../../../hooks/api/loyalty';

const STATUS: Record<RewardGrant['status'], { label: string; color: 'green' | 'grey' | 'orange' | 'red' }> = {
  pending: { label: 'Pendiente', color: 'orange' },
  available: { label: 'Disponible', color: 'green' },
  used: { label: 'Utilizado', color: 'grey' },
  expired: { label: 'Expirado', color: 'red' },
  cancelled: { label: 'Cancelado', color: 'red' },
};

const LoyaltyGrantsPage = () => {
  const { data, isLoading } = useGrants();
  const grants = data?.grants ?? [];

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h1">Canjes</Heading>
        <ExtensionVersion extension="loyalty" />
      </div>
      <SiteScopeBar screen="loyalty/grants" />
      <div className="px-6 py-4">
        {isLoading ? (
          <Text className="text-ui-fg-subtle">Cargando…</Text>
        ) : grants.length === 0 ? (
          <Text className="text-ui-fg-subtle">Todavía no hay canjes.</Text>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Recompensa</Table.HeaderCell>
                <Table.HeaderCell>Cliente</Table.HeaderCell>
                <Table.HeaderCell>Beneficio</Table.HeaderCell>
                <Table.HeaderCell>Puntos</Table.HeaderCell>
                <Table.HeaderCell>Estado</Table.HeaderCell>
                <Table.HeaderCell>Fecha</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {grants.map((g) => (
                <Table.Row key={g.id}>
                  <Table.Cell>{g.reward?.name ?? '—'}</Table.Cell>
                  <Table.Cell className="font-mono text-xs">{g.customer_id}</Table.Cell>
                  <Table.Cell>
                    {g.benefit_type === 'promotion' ? `Cupón ${g.benefit_ref ?? ''}` : g.benefit_type === 'store_credit' ? 'Store credit' : '—'}
                  </Table.Cell>
                  <Table.Cell>{g.points_spent}</Table.Cell>
                  <Table.Cell>
                    <Badge color={STATUS[g.status]?.color ?? 'grey'} size="2xsmall">
                      {STATUS[g.status]?.label ?? g.status}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>{new Date(g.created_at).toLocaleDateString('es-AR')}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </div>
    </Container>
  );
};

export const config = defineRouteConfig({
  label: 'Canjes',
});

export const handle = {
  breadcrumb: () => 'Canjes',
};

export default LoyaltyGrantsPage;
