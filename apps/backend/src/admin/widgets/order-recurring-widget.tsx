/**
 * Widget read-only en el detalle de Order: si la orden fue generada por una
 * compra recurrente (hay un renewal_cycle con generated_order_id = order.id),
 * muestra la suscripción origen con link al detalle.
 *
 * Zona: order.details.after
 */
import { defineWidgetConfig } from '@medusajs/admin-sdk';
import type { DetailWidgetProps } from '@medusajs/framework/types';
import { Container, Heading, StatusBadge, Text } from '@medusajs/ui';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchJson } from '../lib/http';

type AdminOrder = { id: string };

type CycleRow = {
  id: string;
  recurring_order_id: string;
  scheduled_at: string;
  subscription: {
    email: string | null;
    status: string;
    frequency_interval: string;
    frequency_count: number;
  } | null;
};

const OrderRecurringWidget = ({ data: order }: DetailWidgetProps<AdminOrder>) => {
  const { data } = useQuery({
    queryKey: ['recurring-orders', 'by-order', order.id],
    /**
     * Por el `fetchJson` de `lib/http` y no por un `fetch` propio: la ruta está
     * declarada `scoped` y su handler ya aplica `siteFilter` sobre
     * `RENEWAL_CYCLE_SITE_SCOPE`, pero sin `x-site-id` ese filtro era un no-op y el
     * widget resolvía el ciclo de cualquier tienda.
     *
     * `fetchJson` y no `siteHeaders()` a mano porque la respuesta es JSON — los headers
     * sueltos son para descargas, no para esto.
     *
     * Se conserva el "si falla, no hay ciclo": `fetchJson` TIRA donde el código viejo
     * devolvía `{ cycles: [] }` con un `!res.ok`, y sin el `.catch` un 404 dejaría a
     * react-query reintentando y ensuciando la consola en cada orden sin suscripción,
     * que son casi todas. El widget ya renderiza `null` cuando no hay ciclo, así que la
     * pantalla es la misma.
     *
     * Lo que SÍ cambia para el operador: el ciclo hereda la tienda de su suscripción con
     * `empty: 'unassigned'`, así que en una orden cuya suscripción es de otra tienda el
     * panel "Compra recurrente" deja de aparecer. Es lo correcto —el link llevaba al
     * detalle de una suscripción ajena, que la propia pantalla de destino ya filtra— pero
     * es una desaparición visible, no un mensaje de error.
     */
    queryFn: () =>
      fetchJson<{ cycles: CycleRow[] }>(
        `/admin/recurring-orders/cycles?order_id=${encodeURIComponent(order.id)}&limit=1`,
      ).catch(() => ({ cycles: [] as CycleRow[] })),
  });

  const cycle = data?.cycles?.[0];
  if (!cycle) return null;

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Compra recurrente</Heading>
        <StatusBadge color="blue">Renovación</StatusBadge>
      </div>
      <div className="px-6 py-4">
        <Text size="small">
          Esta orden fue generada por la suscripción{' '}
          <Link
            className="text-ui-fg-interactive hover:underline"
            to={`/recurring-orders/${cycle.recurring_order_id}`}
          >
            {cycle.subscription?.email ?? cycle.recurring_order_id}
          </Link>
          .
        </Text>
        <Text size="xsmall" className="text-ui-fg-subtle">
          Entrega programada del{' '}
          {new Intl.DateTimeFormat('es-AR', { dateStyle: 'short' }).format(
            new Date(cycle.scheduled_at),
          )}
          .
        </Text>
      </div>
    </Container>
  );
};

export const config = defineWidgetConfig({ zone: 'order.details.after' });

export default OrderRecurringWidget;
