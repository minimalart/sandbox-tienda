import { defineRouteConfig } from '@medusajs/admin-sdk';
import { useState } from 'react';
import { Container, Heading, Table, Badge, Button, Text } from '@medusajs/ui';
import { ExtensionVersion } from '../../../components/common/extension-version';
import { SiteScopeBar } from '../../../components/common/site-scope-bar';
import { useMovements, type Movement } from '../../../hooks/api/loyalty';

const TYPE_LABEL: Record<string, string> = {
  earn: 'Acumulación',
  redeem: 'Canje',
  adjust: 'Ajuste',
  reverse: 'Reversión',
  expire: 'Vencimiento',
};
const STATUS_COLOR: Record<string, 'green' | 'grey' | 'orange' | 'red'> = {
  available: 'green',
  pending: 'orange',
  expired: 'grey',
  reversed: 'red',
};

const PAGE = 50;

const LoyaltyMovementsPage = () => {
  const [offset, setOffset] = useState(0);
  const { data, isLoading } = useMovements({ limit: PAGE, offset });
  const movements = data?.movements ?? [];
  const count = data?.count ?? 0;

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h1">Movimientos</Heading>
        <ExtensionVersion extension="loyalty" />
      </div>
      <SiteScopeBar screen="loyalty/movimientos" />
      <div className="px-6 py-4">
        {isLoading ? (
          <Text className="text-ui-fg-subtle">Cargando…</Text>
        ) : movements.length === 0 ? (
          <Text className="text-ui-fg-subtle">No hay movimientos.</Text>
        ) : (
          <>
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Fecha</Table.HeaderCell>
                  <Table.HeaderCell>Tipo</Table.HeaderCell>
                  <Table.HeaderCell>Monto</Table.HeaderCell>
                  <Table.HeaderCell>Estado</Table.HeaderCell>
                  <Table.HeaderCell>Referencia</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {movements.map((m: Movement) => (
                  <Table.Row key={m.id}>
                    <Table.Cell>{new Date(m.created_at).toLocaleString('es-AR')}</Table.Cell>
                    <Table.Cell>{TYPE_LABEL[m.type] ?? m.type}</Table.Cell>
                    <Table.Cell className={m.amount < 0 ? 'text-rose-600' : 'text-emerald-600'}>
                      {m.amount > 0 ? `+${m.amount}` : m.amount}
                    </Table.Cell>
                    <Table.Cell>
                      <Badge color={STATUS_COLOR[m.status] ?? 'grey'} size="2xsmall">
                        {m.status}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell className="text-xs text-ui-fg-subtle">
                      {m.reference ?? '—'}
                      {m.reference_id ? ` · ${m.reference_id}` : ''}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
            <div className="mt-4 flex items-center justify-between">
              <Text size="small" className="text-ui-fg-subtle">
                {offset + 1}–{Math.min(offset + PAGE, count)} de {count}
              </Text>
              <div className="flex gap-2">
                <Button size="small" variant="secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
                  Anterior
                </Button>
                <Button size="small" variant="secondary" disabled={offset + PAGE >= count} onClick={() => setOffset(offset + PAGE)}>
                  Siguiente
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Container>
  );
};

export const config = defineRouteConfig({ label: 'Movimientos' });
export const handle = { breadcrumb: () => 'Movimientos' };
export default LoyaltyMovementsPage;
