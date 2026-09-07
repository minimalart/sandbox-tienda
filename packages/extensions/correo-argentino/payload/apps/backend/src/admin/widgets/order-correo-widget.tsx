/**
 * Widget de Correo Argentino en el detalle de orden.
 *
 * Zona: `order.details.after`
 *
 * Hace su PROPIO fetch y no confía en `DetailWidgetProps.data`: Medusa no
 * garantiza los `fulfillments` hidratados en ese prop (mismo motivo que documenta
 * `order-andreani-widget.tsx:6-8`). Del prop se usa únicamente el `id`.
 *
 * Los rótulos se bajan con `fetch(..., { credentials: 'include' })` + blob, no con
 * un `<a href>`: la descarga pasa por el backend porque es él el que adjunta la
 * API-Key de Correo, y la respuesta es binaria.
 *
 * Lo que se muestra de cada ticket, y por qué:
 *  - **`billed_weight_g` vs `product_weight_g` cuando difieren**: es el peso
 *    volumétrico ganándole al real, o sea exactamente lo que Correo va a facturar
 *    por encima de lo que pesa el paquete. Es el dato con el que se discute una
 *    factura.
 *  - **`recovered_from_duplicate`**: el alta volvió "TN duplicado" y se adoptó el
 *    envío que ya existía en Correo. No se creó un envío nuevo, y eso cambia qué
 *    esperar del tracking.
 *  - **`self_generated_tracking_number`**: el TN lo generamos nosotros, así que un
 *    "no existe" de Correo significa algo distinto que con un TN suyo.
 */

import { defineWidgetConfig } from '@medusajs/admin-sdk';
import type { DetailWidgetProps } from '@medusajs/framework/types';
import {
  Badge,
  Button,
  Container,
  Heading,
  StatusBadge,
  Text,
  toast,
  Tooltip,
} from '@medusajs/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TrackingModal } from '../routes/correo-argentino/components/tracking-modal';
import { LabelBatchModal } from '../routes/correo-argentino/components/label-batch-modal';
import {
  useCorreoLabelBatch,
  useGenerateCorreoTicket,
  useOrderCorreoFulfillments,
  useOrderCorreoTickets,
  useOrderHasCorreoShipping,
  type CorreoFulfillmentItem,
  type CorreoLabelBatch,
  type CorreoTicket,
} from '../hooks/api/correo-argentino';
import {
  correoFulfillmentStatusColor,
  correoPublicTrackingUrl,
  describeBilledWeight,
  formatGrams,
} from '../lib/correo';
import { registerCorreoArgentinoTranslations } from '../translations/correo-argentino';

type AdminOrder = { id: string };

function formatDateTime(value: string): string {
  try {
    return new Date(value).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

const OrderCorreoWidget = ({ data: order }: DetailWidgetProps<AdminOrder>) => {
  const { t, i18n } = useTranslation('correoArgentino');
  registerCorreoArgentinoTranslations(i18n);

  const [trackingFulfillment, setTrackingFulfillment] =
    useState<CorreoFulfillmentItem | null>(null);
  const [labelBatch, setLabelBatch] = useState<CorreoLabelBatch | null>(null);

  const { data: fulfillments = [], isLoading } = useOrderCorreoFulfillments(
    order.id
  );
  const { data: tickets = [] } = useOrderCorreoTickets(order.id);
  const { data: isCorreoOrder = false } = useOrderHasCorreoShipping(order.id);
  const generateTicket = useGenerateCorreoTicket(order.id);
  const labelBatchMutation = useCorreoLabelBatch();

  /**
   * Pide el rótulo y abre el detalle por ítem.
   *
   * Incluso para UN rótulo se usa el modal en vez de abrir el PDF a ciegas: una
   * falla de Correo llega con HTTP 200 y motivo textual, y ese motivo es lo único
   * que le dice al operador qué hacer.
   */
  const requestLabel = (trackingNumber: string) => {
    if (!trackingNumber) return;
    labelBatchMutation.mutate(
      { tracking_numbers: [trackingNumber] },
      {
        onSuccess: (batch) => setLabelBatch(batch),
        onError: (error) =>
          toast.error(t('LABEL_ERROR', { message: (error as Error).message })),
      }
    );
  };

  const handleGenerate = () => {
    generateTicket.mutate(undefined, {
      onSuccess: (result) => {
        const tracking = result.ticket?.tracking_number || '—';
        // `created: false` = la orden ya tenía envío y el workflow devolvió el
        // existente sin tocar Correo. Decir "creado" ahí sería mentir sobre algo
        // facturable.
        if (result.created) {
          toast.success(t('WIDGET_GENERATE_OK', { tracking }));
        } else {
          toast.info(t('WIDGET_GENERATE_EXISTING', { tracking }));
        }
      },
      onError: (error) =>
        toast.error(t('WIDGET_GENERATE_ERR', { message: (error as Error).message })),
    });
  };

  // Si la orden no es de Correo y no tiene envíos ni tickets, el widget no existe.
  if (
    !isLoading &&
    !isCorreoOrder &&
    fulfillments.length === 0 &&
    tickets.length === 0
  ) {
    return null;
  }

  return (
    <>
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading level="h2">{t('WIDGET_HEADING')}</Heading>
          {isCorreoOrder && (
            <Button
              variant="secondary"
              size="small"
              isLoading={generateTicket.isPending}
              onClick={handleGenerate}
            >
              {t('WIDGET_GENERATE')}
            </Button>
          )}
        </div>

        {/* ── Tickets de order.metadata.correo_tickets ── */}
        {tickets.length > 0 && (
          <div className="flex flex-col gap-3 px-6 py-4">
            {tickets.map((ticket, index) => (
              <TicketCard
                key={`${ticket.tracking_number}-${ticket.sequence ?? index}`}
                ticket={ticket}
                index={index}
                isDownloading={labelBatchMutation.isPending}
                onDownloadLabel={() => requestLabel(ticket.tracking_number)}
              />
            ))}
          </div>
        )}

        {/* ── Fulfillments nativos ── */}
        {isLoading ? (
          <div className="px-6 py-4">
            <Text size="small" className="text-ui-fg-muted">
              {t('WIDGET_LOADING')}
            </Text>
          </div>
        ) : (
          fulfillments.length > 0 && (
            <div className="flex flex-col gap-4 px-6 py-4">
              {fulfillments.map((fulfillment) => (
                <div
                  key={fulfillment.id}
                  className="flex flex-col gap-3 rounded-lg border border-ui-border-base p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Text weight="plus">
                        {fulfillment.tracking_number || t('NO_TRACKING')}
                      </Text>
                      <Text size="xsmall" className="text-ui-fg-muted">
                        {fulfillment.service_type || '—'}
                        {fulfillment.agency_id
                          ? ` · ${t('WIDGET_AGENCY')} ${fulfillment.agency_id}`
                          : ''}
                      </Text>
                    </div>
                    <StatusBadge
                      color={correoFulfillmentStatusColor(fulfillment.status)}
                    >
                      {fulfillment.status}
                    </StatusBadge>
                  </div>

                  {fulfillment.tracking_number && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => setTrackingFulfillment(fulfillment)}
                      >
                        {t('VIEW_TRACKING')}
                      </Button>
                      <Button
                        variant="secondary"
                        size="small"
                        isLoading={labelBatchMutation.isPending}
                        onClick={() => requestLabel(fulfillment.tracking_number)}
                      >
                        {t('WIDGET_DOWNLOAD_LABEL')}
                      </Button>
                      <Button
                        variant="transparent"
                        size="small"
                        onClick={() =>
                          window.open(
                            correoPublicTrackingUrl(fulfillment.tracking_number),
                            '_blank'
                          )
                        }
                      >
                        correoargentino.com.ar
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </Container>

      {trackingFulfillment && (
        <TrackingModal
          fulfillment={trackingFulfillment}
          onClose={() => setTrackingFulfillment(null)}
        />
      )}

      {labelBatch && (
        <LabelBatchModal batch={labelBatch} onClose={() => setLabelBatch(null)} />
      )}
    </>
  );
};

interface TicketCardProps {
  ticket: CorreoTicket;
  index: number;
  isDownloading: boolean;
  onDownloadLabel: () => void;
}

function TicketCard({
  ticket,
  index,
  isDownloading,
  onDownloadLabel,
}: TicketCardProps) {
  const { t } = useTranslation('correoArgentino');
  const weight = describeBilledWeight(ticket.parcel);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-ui-border-base p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Text weight="plus">{ticket.tracking_number || t('NO_TRACKING')}</Text>
          <Text size="xsmall" className="text-ui-fg-muted">
            {ticket.service_type}
            {ticket.agency_id ? ` · ${t('WIDGET_AGENCY')} ${ticket.agency_id}` : ''}
            {ticket.generated_at
              ? ` · ${t('WIDGET_GENERATED_AT', {
                  date: formatDateTime(ticket.generated_at),
                })}`
              : ''}
          </Text>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1">
          <Badge color="blue" size="small">
            {t('WIDGET_TICKET_BADGE', { n: index + 1 })}
          </Badge>
          {ticket.self_generated_tracking_number && (
            <Badge color="grey" size="2xsmall">
              {t('WIDGET_SELF_TN')}
            </Badge>
          )}
        </div>
      </div>

      {/* El alta se adoptó de un envío que ya existía en Correo: no se creó nada
          nuevo. Callarlo dejaría al operador creyendo que hubo un alta. */}
      {ticket.recovered_from_duplicate && (
        <Tooltip content={t('WIDGET_RECOVERED_HINT')}>
          <div className="w-fit">
            <Badge color="orange" size="2xsmall">
              {t('WIDGET_RECOVERED')}
            </Badge>
          </div>
        </Tooltip>
      )}

      {/* ── Bulto consolidado ── */}
      {ticket.parcel && (
        <div className="flex flex-col gap-2 rounded-md bg-ui-bg-subtle p-3">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <Text size="xsmall" className="text-ui-fg-muted">
              {t('WIDGET_PARCEL')}
            </Text>
            <Text size="small">
              {t('WIDGET_PARCEL_DIMENSIONS', {
                height: ticket.parcel.height,
                width: ticket.parcel.width,
                depth: ticket.parcel.depth,
              })}
            </Text>
            <Text size="xsmall" className="text-ui-fg-muted">
              {t('WIDGET_PARCEL_ITEMS', { count: ticket.parcel.item_count })}
            </Text>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <div>
              <Text size="xsmall" className="text-ui-fg-muted">
                {t('WIDGET_WEIGHT_REAL')}
              </Text>
              <Text size="small">{formatGrams(weight.product_g)}</Text>
            </div>
            <div>
              <Text size="xsmall" className="text-ui-fg-muted">
                {t('WIDGET_WEIGHT_BILLED')}
              </Text>
              <Text
                size="small"
                weight={weight.volumetric_wins ? 'plus' : 'regular'}
                className={weight.volumetric_wins ? 'text-ui-fg-error' : undefined}
              >
                {formatGrams(weight.billed_g)}
              </Text>
            </div>
            <div>
              <Text size="xsmall" className="text-ui-fg-muted">
                {t('WIDGET_WEIGHT_VOLUMETRIC')}
              </Text>
              <Text size="small">{formatGrams(weight.volumetric_g)}</Text>
            </div>
            <div>
              <Text size="xsmall" className="text-ui-fg-muted">
                {t('WIDGET_DECLARED_VALUE')}
              </Text>
              <Text size="small">{ticket.parcel.declared_value}</Text>
            </div>
          </div>

          {/* Solo cuando difieren: es el sobrecosto real del aforo, no una
              curiosidad. Si el peso real manda, este bloque no aporta nada. */}
          {weight.volumetric_wins && (
            <Text size="xsmall" className="text-ui-fg-error">
              {t('WIDGET_WEIGHT_VOLUMETRIC_WINS', {
                billed: formatGrams(weight.billed_g),
                real: formatGrams(weight.product_g),
              })}{' '}
              {t('WIDGET_WEIGHT_SURCHARGE', {
                amount: formatGrams(weight.surcharge_g),
              })}
            </Text>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {ticket.tracking_number && (
          <>
            <Button
              variant="secondary"
              size="small"
              isLoading={isDownloading}
              onClick={onDownloadLabel}
            >
              {t('WIDGET_DOWNLOAD_LABEL')}
            </Button>
            <Button
              variant="transparent"
              size="small"
              onClick={() =>
                window.open(
                  // `tracking_url` lo persiste el workflow; el helper es el
                  // fallback para tickets viejos que no lo tengan.
                  ticket.tracking_url ||
                    correoPublicTrackingUrl(ticket.tracking_number),
                  '_blank'
                )
              }
            >
              correoargentino.com.ar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export const config = defineWidgetConfig({
  zone: 'order.details.after',
});

export default OrderCorreoWidget;
