import { defineWidgetConfig } from '@medusajs/admin-sdk';
import type { DetailWidgetProps } from '@medusajs/framework/types';
import type { AdminCustomer } from '@medusajs/types';
import { Container, Heading, Text, Badge } from '@medusajs/ui';
import { ExtensionVersion } from '../components/common/extension-version';
import { useCustomerLoyalty } from '../hooks/api/loyalty';

const TYPE_LABEL: Record<string, string> = {
  earn: 'Acumulación',
  redeem: 'Canje',
  adjust: 'Ajuste',
  reverse: 'Reversión',
  expire: 'Vencimiento',
};

const CustomerLoyaltyWidget = ({ data: customer }: DetailWidgetProps<AdminCustomer>) => {
  const { data, isLoading } = useCustomerLoyalty(customer.id);

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Fidelización</Heading>
        <ExtensionVersion extension="loyalty-engine" />
      </div>

      {isLoading || !data ? (
        <div className="px-6 py-4">
          <Text className="text-ui-fg-subtle" size="small">Cargando…</Text>
        </div>
      ) : (
        <div className="flex flex-col gap-4 px-6 py-4">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <Text className="text-ui-fg-subtle" size="small">Saldo de puntos</Text>
              <Text className="font-semibold" size="large">{(data.balance ?? 0).toLocaleString('es-AR')}</Text>
            </div>
            <div>
              <Text className="text-ui-fg-subtle" size="small">Nivel</Text>
              <div className="mt-0.5">
                {data.tier?.name ? (
                  <Badge color="green" size="small">{data.tier.name}</Badge>
                ) : (
                  <Text size="small" className="text-ui-fg-muted">—</Text>
                )}
              </div>
            </div>
            {data.progress?.next && (
              <div>
                <Text className="text-ui-fg-subtle" size="small">Próximo nivel</Text>
                <Text size="small">
                  {data.progress.next.name} · faltan {data.progress.toNext}
                </Text>
              </div>
            )}
          </div>

          {data.grants.filter((g) => g.status === 'available').length > 0 && (
            <div>
              <Text className="mb-1 text-ui-fg-subtle" size="small">Beneficios disponibles</Text>
              <ul className="flex flex-col gap-1">
                {data.grants
                  .filter((g) => g.status === 'available')
                  .map((g) => (
                    <li key={g.id} className="text-sm text-ui-fg-base">
                      {g.reward?.name ?? 'Beneficio'}
                      {g.benefit_type === 'promotion' && g.benefit_ref ? ` · ${g.benefit_ref}` : ''}
                    </li>
                  ))}
              </ul>
            </div>
          )}

          <div>
            <Text className="mb-1 text-ui-fg-subtle" size="small">Últimos movimientos</Text>
            {data.transactions.length === 0 ? (
              <Text size="small" className="text-ui-fg-muted">Sin movimientos.</Text>
            ) : (
              <ul className="flex flex-col gap-1">
                {data.transactions.slice(0, 6).map((t) => (
                  <li key={t.id} className="flex justify-between text-sm">
                    <span className="text-ui-fg-subtle">
                      {new Date(t.created_at).toLocaleDateString('es-AR')} · {TYPE_LABEL[t.type] ?? t.type}
                    </span>
                    <span className={t.amount < 0 ? 'text-rose-600' : 'text-emerald-600'}>
                      {t.amount > 0 ? `+${t.amount}` : t.amount}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Container>
  );
};

export const config = defineWidgetConfig({
  zone: 'customer.details.after',
});

export default CustomerLoyaltyWidget;
