/**
 * Widget de Andreani en el detalle de orden.
 *
 * Zona: order.details.after
 *
 * Muestra los envíos Andreani de ESA orden. No confía en el prop `data`
 * (Medusa no garantiza fulfillments hidratados ahí): hace su propio fetch
 * a la orden nativa vía el SDK y filtra Andreani en cliente.
 */

import { defineWidgetConfig } from '@medusajs/admin-sdk';
import type { DetailWidgetProps } from '@medusajs/framework/types';
import { Badge, Button, Container, Heading, StatusBadge, Text, toast } from '@medusajs/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TrackingModal } from '../routes/andreani/components/tracking-modal';
import { registerWidgetsTranslations } from '../translations/widgets';
import {
  useOrderAndreaniFulfillments,
  useOrderAndreaniTickets,
  useOrderHasAndreaniShipping,
  useGenerateAndreaniTicket,
  type AndreaniFulfillmentItem,
} from '../hooks/api/andreani';

type AdminOrder = { id: string };

type StatusColor = 'green' | 'blue' | 'orange' | 'red' | 'grey';

function statusColor(status: string): StatusColor {
  switch (status.toLowerCase()) {
    case 'delivered':
    case 'entregado':
      return 'green';
    case 'in_transit':
    case 'en_camino':
      return 'blue';
    case 'pending':
    case 'pendiente':
      return 'orange';
    case 'failed':
    case 'cancelled':
    case 'cancelado':
      return 'red';
    default:
      return 'grey';
  }
}

const OrderAndreaniWidget = ({ data: order }: DetailWidgetProps<AdminOrder>) => {
  const { t, i18n } = useTranslation('widgets');
  registerWidgetsTranslations(i18n);
  const [trackingFulfillment, setTrackingFulfillment] =
    useState<AndreaniFulfillmentItem | null>(null);

  const { data: andreaniFulfillments = [], isLoading } =
    useOrderAndreaniFulfillments(order.id);
  const { data: tickets = [] } = useOrderAndreaniTickets(order.id);
  const { data: isAndreaniOrder = false } = useOrderHasAndreaniShipping(order.id);
  const generateTicket = useGenerateAndreaniTicket(order.id);

  // Andreani label URLs require the API auth token, so they can't be opened
  // directly in the browser. Fetch the PDF through the backend proxy (which
  // attaches the token) and open the resulting blob.
  const downloadLabel = async (body: {
    shipment_id?: string;
    label_url?: string;
    tracking_number?: string;
  }) => {
    try {
      const res = await fetch('/admin/andreani/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error?.message || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      toast.error(t('ANDREANI_LABEL_ERR', { message: (err as Error).message }));
    }
  };

  const handleGenerate = () => {
    generateTicket.mutate(undefined, {
      onSuccess: (res) =>
        toast.success(
          t('ANDREANI_GENERATE_OK', {
            tracking: res.ticket?.tracking_number || '—',
          })
        ),
      onError: (err) =>
        toast.error(
          t('ANDREANI_GENERATE_ERR', { message: (err as Error).message })
        ),
    });
  };

  // No renderizar si la orden no es Andreani y no tiene envíos/tickets.
  if (
    !isLoading &&
    !isAndreaniOrder &&
    andreaniFulfillments.length === 0 &&
    tickets.length === 0
  ) {
    return null;
  }

  return (
    <>
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading level="h2">{t('ANDREANI_HEADING')}</Heading>
          {isAndreaniOrder && (
            <Button
              variant="secondary"
              size="small"
              isLoading={generateTicket.isPending}
              onClick={handleGenerate}
            >
              {t('ANDREANI_GENERATE_LABEL')}
            </Button>
          )}
        </div>

        {tickets.length > 0 && (
          <div className="flex flex-col gap-3 px-6 py-4">
            {tickets.map((ticket, idx) => (
              <div
                key={`${ticket.andreani_order_id}-${idx}`}
                className="flex flex-col gap-2 rounded-lg border border-ui-border-base p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Text weight="plus">
                      {ticket.tracking_number || t('ANDREANI_NO_TRACKING')}
                    </Text>
                    <Text size="xsmall" className="text-ui-fg-muted">
                      {ticket.service_type}
                      {ticket.boxes_summary ? ` · ${ticket.boxes_summary}` : ''}
                    </Text>
                  </div>
                  <Badge color="blue" size="small">
                    {t('ANDREANI_TICKET_BADGE', { n: idx + 1 })}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ticket.tracking_number && (
                    <Button
                      variant="transparent"
                      size="small"
                      onClick={() =>
                        window.open(
                          `https://www.andreani.com/seguimiento?codigo=${ticket.tracking_number}`,
                          '_blank'
                        )
                      }
                    >
                      andreani.com
                    </Button>
                  )}
                  {(ticket.andreani_order_id || ticket.grouped_label_url) && (
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() =>
                        downloadLabel({
                          shipment_id: ticket.andreani_order_id,
                          label_url: ticket.grouped_label_url,
                          tracking_number: ticket.tracking_number,
                        })
                      }
                    >
                      {t('ANDREANI_DOWNLOAD_LABEL')}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="px-6 py-4">
            <Text size="small" className="text-ui-fg-muted">
              {t('ANDREANI_LOADING')}
            </Text>
          </div>
        ) : (
          <div className="flex flex-col gap-4 px-6 py-4">
            {andreaniFulfillments.map((f) => (
              <div
                key={f.id}
                className="flex flex-col gap-3 rounded-lg border border-ui-border-base p-4"
              >
                {/* Tracking number + estado */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Text weight="plus">{f.tracking_number || t('ANDREANI_NO_TRACKING')}</Text>
                    <Text size="xsmall" className="text-ui-fg-muted">
                      {f.service_type}
                      {f.contract ? ` · ${t('ANDREANI_CONTRACT_PREFIX')} ${f.contract}` : ''}
                    </Text>
                  </div>
                  <StatusBadge color={statusColor(f.status)}>
                    {f.status}
                  </StatusBadge>
                </div>

                {/* Acciones */}
                <div className="flex flex-wrap gap-2">
                  {f.tracking_number && (
                    <>
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => setTrackingFulfillment(f)}
                      >
                        {t('ANDREANI_VIEW_TRACKING')}
                      </Button>
                      <Button
                        variant="transparent"
                        size="small"
                        onClick={() =>
                          window.open(
                            `https://www.andreani.com/seguimiento?codigo=${f.tracking_number}`,
                            '_blank'
                          )
                        }
                      >
                        andreani.com
                      </Button>
                    </>
                  )}
                  {f.label_url && (
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() =>
                        downloadLabel({
                          label_url: f.label_url,
                          tracking_number: f.tracking_number,
                        })
                      }
                    >
                      {t('ANDREANI_DOWNLOAD_LABEL')}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Container>

      {trackingFulfillment && (
        <TrackingModal
          fulfillment={trackingFulfillment}
          onClose={() => setTrackingFulfillment(null)}
        />
      )}
    </>
  );
};

export const config = defineWidgetConfig({
  zone: 'order.details.after',
});

export default OrderAndreaniWidget;
