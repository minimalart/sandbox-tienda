/**
 * Modal de seguimiento de un envío de Correo Argentino.
 *
 * Dos diferencias con el de Andreani, las dos por el contrato de Correo:
 *
 *  1. **`has_history: false` no es un error.** Significa que el envío existe pero
 *     Correo todavía no registró movimientos. Mostrarlo como error haría que el
 *     operador reintente algo que no está roto.
 *  2. **Se muestran los códigos SIN MAPEAR.** La tabla de `statusId` de Correo no
 *     está publicada: los pares `statusId` + texto que el normalizador no supo
 *     clasificar son exactamente el insumo para completarla, así que la UI los
 *     expone en vez de esconderlos.
 */

import { Badge, Button, FocusModal, StatusBadge, Text } from '@medusajs/ui';
import { useTranslation } from 'react-i18next';
import {
  useCorreoTracking,
  type CorreoFulfillmentItem,
  type CorreoTrackingEvent,
} from '../../../hooks/api/correo-argentino';
import {
  correoBucketColor,
  correoFulfillmentStatusColor,
  correoPublicTrackingUrl,
} from '../../../lib/correo';
import { registerCorreoArgentinoTranslations } from '../../../translations/correo-argentino';

interface Props {
  fulfillment: CorreoFulfillmentItem;
  onClose: () => void;
}

function formatDateTime(value: string | null): string {
  if (!value) return '—';
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

export function TrackingModal({ fulfillment, onClose }: Props) {
  const { t, i18n } = useTranslation('correoArgentino');
  registerCorreoArgentinoTranslations(i18n);

  const {
    data: tracking,
    isLoading,
    isError,
  } = useCorreoTracking(fulfillment.tracking_number || null);

  const bucketLabel = (event: CorreoTrackingEvent): string =>
    t(`BUCKET_${event.bucket.toUpperCase()}`, {
      defaultValue: event.raw_status ?? event.bucket,
    });

  const deliveryLabel =
    fulfillment.delivery_type === 'agency'
      ? t('DELIVERY_AGENCY')
      : fulfillment.delivery_type === 'homeDelivery'
        ? t('DELIVERY_HOME')
        : fulfillment.delivery_type || '—';

  return (
    <FocusModal open onOpenChange={(open) => !open && onClose()}>
      <FocusModal.Content className="max-w-2xl">
        <FocusModal.Header>
          <FocusModal.Title>
            {t('TRACKING_TITLE', { code: fulfillment.tracking_number })}
          </FocusModal.Title>
        </FocusModal.Header>

        <FocusModal.Body className="flex flex-col gap-6 overflow-y-auto px-6 py-4">
          {/* Resumen del envío (datos locales, sin pegarle a Correo) */}
          <div className="grid grid-cols-2 gap-4 rounded-lg border border-ui-border-base p-4">
            <div>
              <Text size="xsmall" className="text-ui-fg-muted">
                {t('MODAL_ORDER')}
              </Text>
              <Text weight="plus">
                {fulfillment.order_display_id ?? fulfillment.order_id ?? '—'}
              </Text>
            </div>
            <div>
              <Text size="xsmall" className="text-ui-fg-muted">
                {t('MODAL_SERVICE')}
              </Text>
              <Text>{fulfillment.service_type || '—'}</Text>
            </div>
            <div>
              <Text size="xsmall" className="text-ui-fg-muted">
                {t('MODAL_DELIVERY')}
              </Text>
              <Text>{deliveryLabel}</Text>
            </div>
            <div>
              <Text size="xsmall" className="text-ui-fg-muted">
                {t('MODAL_MEDUSA_STATUS')}
              </Text>
              <StatusBadge color={correoFulfillmentStatusColor(fulfillment.status)}>
                {fulfillment.status}
              </StatusBadge>
            </div>
            {fulfillment.agency_id && (
              <div>
                <Text size="xsmall" className="text-ui-fg-muted">
                  {t('MODAL_AGENCY')}
                </Text>
                <Text>{fulfillment.agency_id}</Text>
              </div>
            )}
            {fulfillment.agreement && (
              <div>
                <Text size="xsmall" className="text-ui-fg-muted">
                  {t('MODAL_AGREEMENT')}
                </Text>
                <Text>{fulfillment.agreement}</Text>
              </div>
            )}
          </div>

          {isLoading && (
            <Text className="text-ui-fg-subtle">{t('LOADING_TRACKING')}</Text>
          )}

          {isError && (
            <div className="rounded-lg border border-ui-border-error bg-ui-bg-field p-4">
              <Text className="text-ui-fg-error">{t('TRACKING_ERROR')}</Text>
            </div>
          )}

          {tracking && (
            <>
              {/* Estado actual. `has_history: false` es informativo, NO un error. */}
              {tracking.has_history ? (
                <div className="flex flex-wrap items-center gap-3">
                  <Text weight="plus">{t('CURRENT_STATUS')}</Text>
                  {tracking.latest && (
                    <StatusBadge color={correoBucketColor(tracking.latest.bucket)}>
                      {bucketLabel(tracking.latest)}
                    </StatusBadge>
                  )}
                  {tracking.product_type && (
                    <Badge size="2xsmall" color="grey">
                      {tracking.product_type}
                    </Badge>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle p-4">
                  <Text size="small" className="text-ui-fg-subtle">
                    {t('NO_HISTORY')}
                  </Text>
                </div>
              )}

              {/* Timeline */}
              <div>
                <Text weight="plus" className="mb-3">
                  {t('MOVEMENT_HISTORY')}
                </Text>

                {tracking.events.length === 0 ? (
                  <div className="rounded-lg border border-ui-border-base p-4 text-center">
                    <Text className="text-ui-fg-subtle">{t('NO_MOVEMENTS')}</Text>
                  </div>
                ) : (
                  <div className="flex flex-col gap-0">
                    {/* El backend los devuelve ascendente; acá se muestra lo más
                        nuevo arriba, que es lo que el operador mira primero. */}
                    {[...tracking.events].reverse().map((event, index) => (
                      <div
                        key={`${event.raw_status_id ?? 'evt'}-${event.occurred_at ?? index}`}
                        className="border-l-2 border-ui-border-interactive pb-4 pl-4"
                      >
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <StatusBadge color={correoBucketColor(event.bucket)}>
                            {bucketLabel(event)}
                          </StatusBadge>
                          <Text size="xsmall" className="text-ui-fg-muted">
                            {formatDateTime(event.occurred_at)}
                          </Text>
                        </div>
                        <Text size="small">{event.raw_status ?? '—'}</Text>
                        {(event.facility || event.facility_code) && (
                          <Text size="xsmall" className="mt-0.5 text-ui-fg-muted">
                            {event.facility ?? event.facility_code}
                          </Text>
                        )}
                        {event.sign && (
                          <Text size="xsmall" className="mt-0.5 text-ui-fg-muted">
                            {event.sign}
                          </Text>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Códigos sin mapear: el insumo para completar la tabla de
                  `statusId` que Correo no publica. */}
              {tracking.unmapped_events.length > 0 && (
                <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle p-4">
                  <Text weight="plus" size="small">
                    {t('UNMAPPED_TITLE', {
                      count: tracking.unmapped_events.length,
                    })}
                  </Text>
                  <Text size="xsmall" className="mb-2 text-ui-fg-muted">
                    {t('UNMAPPED_NOTE')}
                  </Text>
                  <ul className="flex flex-col gap-1">
                    {tracking.unmapped_events.map((event, index) => (
                      <li key={`${event.raw_status_id ?? 'x'}-${index}`}>
                        <Text size="xsmall" className="font-mono">
                          {event.raw_status_id ?? '—'} · {event.raw_status ?? '—'}
                        </Text>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <Text size="xsmall" className="text-ui-fg-muted">
                {t('LAST_UPDATE', {
                  date: formatDateTime(tracking.last_updated),
                })}
              </Text>
            </>
          )}
        </FocusModal.Body>

        <FocusModal.Footer>
          <div className="flex gap-2">
            {fulfillment.tracking_number && (
              <Button
                variant="secondary"
                size="small"
                onClick={() =>
                  window.open(
                    correoPublicTrackingUrl(fulfillment.tracking_number),
                    '_blank'
                  )
                }
              >
                {t('VIEW_ON_CORREO')}
              </Button>
            )}
            <Button variant="secondary" onClick={onClose}>
              {t('CLOSE')}
            </Button>
          </div>
        </FocusModal.Footer>
      </FocusModal.Content>
    </FocusModal>
  );
}
