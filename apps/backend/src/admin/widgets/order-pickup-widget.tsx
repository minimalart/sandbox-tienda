/**
 * Widget de "retiro en tienda" en el detalle de la orden.
 *
 * Muestra la sucursal que eligió el comprador y da el botón que marca el pedido
 * como listo y le avisa por mail (DESDEELSUR-68, punto 3).
 *
 * Se esconde ENTERO en las órdenes que no son de retiro: el dato que decide vive
 * en `order.metadata.store_id` y el nombre de la sucursal en otro módulo, así que
 * lo resuelve el backend (`GET /admin/orders/:id/ready-for-pickup`) y no este
 * componente. Mientras la respuesta no llegó no se dibuja nada — un bloque que
 * aparece y desaparece en cada orden es peor que uno que tarda medio segundo.
 *
 * Zona: order.details.after
 */
import { defineWidgetConfig } from '@medusajs/admin-sdk';
import type { DetailWidgetProps } from '@medusajs/framework/types';
import { Button, Container, Heading, StatusBadge, Text, toast } from '@medusajs/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

type AdminOrder = { id: string };

type PickupStatus = {
  is_store_pickup: boolean;
  store_name: string | null;
  store_address: string | null;
  ready_for_pickup_at: string | null;
};

type MarkResponse = {
  message: string;
  ready_for_pickup_at?: string;
  email_sent?: boolean;
};

const queryKeyFor = (orderId: string) => ['order-ready-for-pickup', orderId];

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

/** Fecha local legible. El backend sella en ISO/UTC. */
function formatMarkedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

const OrderPickupWidget = ({ data: order }: DetailWidgetProps<AdminOrder>) => {
  const queryClient = useQueryClient();

  const { data: status } = useQuery({
    queryKey: queryKeyFor(order.id),
    queryFn: () => fetchJson<PickupStatus>(`/admin/orders/${order.id}/ready-for-pickup`),
  });

  const markReady = useMutation({
    mutationFn: () =>
      fetchJson<MarkResponse>(`/admin/orders/${order.id}/ready-for-pickup`, {
        method: 'POST',
      }),
    onSuccess: (result) => {
      // `email_sent: false` NO es un éxito silencioso: la orden quedó marcada
      // pero el comprador no se enteró, y eso hay que decirlo.
      if (result.email_sent === false) toast.warning(result.message);
      else toast.success(result.message);
      void queryClient.invalidateQueries({ queryKey: queryKeyFor(order.id) });
    },
    onError: (error: Error) => {
      toast.error(error.message);
      // El 409 ("ya estaba marcado") llega por acá. Refrescar deja el widget
      // mostrando el estado real en vez de un botón que ya no hace nada.
      void queryClient.invalidateQueries({ queryKey: queryKeyFor(order.id) });
    },
  });

  if (!status?.is_store_pickup) return null;

  const markedAt = status.ready_for_pickup_at;

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Retiro en tienda</Heading>
        <StatusBadge color={markedAt ? 'green' : 'orange'}>
          {markedAt ? 'Listo para retirar' : 'Pendiente de preparación'}
        </StatusBadge>
      </div>

      <div className="px-6 py-4">
        <div className="flex justify-between gap-4 py-1">
          <Text size="small" className="text-ui-fg-muted">
            Sucursal
          </Text>
          <Text size="small" className="text-right">
            {status.store_name ?? 'No identificada'}
          </Text>
        </div>
        {status.store_address ? (
          <div className="flex justify-between gap-4 py-1">
            <Text size="small" className="text-ui-fg-muted">
              Dirección
            </Text>
            <Text size="small" className="text-right">
              {status.store_address}
            </Text>
          </div>
        ) : null}
        {markedAt ? (
          <div className="flex justify-between gap-4 py-1">
            <Text size="small" className="text-ui-fg-muted">
              Avisado el
            </Text>
            <Text size="small" className="text-right">
              {formatMarkedAt(markedAt)}
            </Text>
          </div>
        ) : null}
      </div>

      <div className="px-6 py-4">
        {markedAt ? (
          <Text size="small" className="text-ui-fg-muted">
            Ya se le avisó al cliente que puede retirarlo. El aviso se manda una sola vez.
          </Text>
        ) : (
          <Button
            variant="primary"
            size="small"
            isLoading={markReady.isPending}
            onClick={() => markReady.mutate()}
          >
            Marcar listo para retirar
          </Button>
        )}
      </div>
    </Container>
  );
};

export const config = defineWidgetConfig({
  zone: 'order.details.after',
});

export default OrderPickupWidget;
