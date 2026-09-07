import { Button, FocusModal, StatusBadge, Text } from '@medusajs/ui';
import { useTranslation } from 'react-i18next';
import { useAndreaniTracking } from '../../../hooks/api/andreani';
import type { AndreaniFulfillmentItem } from '../../../hooks/api/andreani';
import { registerAndreaniTranslations } from '../../../translations/andreani';

interface Props {
  fulfillment: AndreaniFulfillmentItem;
  onClose: () => void;
}

type StatusColor = 'green' | 'blue' | 'orange' | 'red' | 'grey';

function statusColor(status: string): StatusColor {
  switch (status.toLowerCase()) {
    case 'delivered':
    case 'entregado':
      return 'green';
    case 'in_transit':
    case 'en_camino':
    case 'en tránsito':
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

function formatDateTime(dateString: string): string {
  try {
    return new Date(dateString).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

export function TrackingModal({ fulfillment, onClose }: Props) {
  const { t, i18n } = useTranslation('andreani');
  registerAndreaniTranslations(i18n);

  const { data: tracking, isLoading, isError } = useAndreaniTracking(
    fulfillment.tracking_number || null
  );

  return (
    <FocusModal open onOpenChange={(open) => !open && onClose()}>
      <FocusModal.Content className="max-w-2xl">
        <FocusModal.Header>
          <FocusModal.Title>
            {t('TRACKING_TITLE', { code: fulfillment.tracking_number })}
          </FocusModal.Title>
        </FocusModal.Header>

        <FocusModal.Body className="flex flex-col gap-6 overflow-y-auto px-6 py-4">
          {/* Resumen del envío */}
          <div className="grid grid-cols-2 gap-4 rounded-lg border border-ui-border-base p-4">
            <div>
              <Text size="xsmall" className="text-ui-fg-muted">
                {t('MODAL_ORDER')}
              </Text>
              <Text weight="plus">{fulfillment.order_display_id ?? fulfillment.order_id ?? '—'}</Text>
            </div>
            <div>
              <Text size="xsmall" className="text-ui-fg-muted">
                {t('MODAL_SERVICE')}
              </Text>
              <Text>{fulfillment.service_type || '—'}</Text>
            </div>
            <div>
              <Text size="xsmall" className="text-ui-fg-muted">
                {t('MODAL_CONTRACT')}
              </Text>
              <Text>{fulfillment.contract || '—'}</Text>
            </div>
            <div>
              <Text size="xsmall" className="text-ui-fg-muted">
                {t('MODAL_MEDUSA_STATUS')}
              </Text>
              <StatusBadge color={statusColor(fulfillment.status)}>
                {fulfillment.status}
              </StatusBadge>
            </div>
          </div>

          {/* Estado actual de tracking */}
          {isLoading && (
            <Text className="text-ui-fg-subtle">{t('LOADING_TRACKING')}</Text>
          )}

          {isError && (
            <div className="rounded-lg border border-ui-border-error bg-ui-bg-field p-4">
              <Text className="text-ui-fg-error">
                {t('TRACKING_ERROR')}
              </Text>
            </div>
          )}

          {tracking && (
            <>
              {/* Estado actual */}
              <div className="flex items-center gap-3">
                <Text weight="plus">{t('CURRENT_STATUS')}</Text>
                <StatusBadge color={statusColor(tracking.current_status)}>
                  {tracking.current_status_description}
                </StatusBadge>
              </div>

              {tracking.estimated_delivery_date && (
                <div>
                  <Text size="xsmall" className="text-ui-fg-muted">
                    {t('ESTIMATED_DELIVERY')}
                  </Text>
                  <Text>{formatDateTime(tracking.estimated_delivery_date)}</Text>
                </div>
              )}

              {/* Timeline de eventos */}
              <div>
                <Text weight="plus" className="mb-3">
                  {t('MOVEMENT_HISTORY')}
                </Text>

                {tracking.events.length === 0 ? (
                  <div className="rounded-lg border border-ui-border-base p-4 text-center">
                    <Text className="text-ui-fg-subtle">
                      {t('NO_MOVEMENTS')}
                    </Text>
                  </div>
                ) : (
                  <div className="flex flex-col gap-0">
                    {[...tracking.events]
                      .sort(
                        (a, b) =>
                          new Date(b.timestamp).getTime() -
                          new Date(a.timestamp).getTime()
                      )
                      .map((event, index) => (
                        <div
                          key={index}
                          className="border-l-2 border-ui-border-interactive pl-4 pb-4"
                        >
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <StatusBadge color={statusColor(event.status)}>
                              {event.status}
                            </StatusBadge>
                            <Text size="xsmall" className="text-ui-fg-muted">
                              {formatDateTime(event.timestamp)}
                            </Text>
                          </div>
                          <Text size="small">{event.description}</Text>
                          {event.location && (
                            <Text size="xsmall" className="text-ui-fg-muted mt-0.5">
                              {event.location}
                            </Text>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <Text size="xsmall" className="text-ui-fg-muted">
                {t('LAST_UPDATE', { date: formatDateTime(tracking.last_updated) })}
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
                    `https://www.andreani.com/seguimiento?codigo=${fulfillment.tracking_number}`,
                    '_blank'
                  )
                }
              >
                {t('VIEW_ON_ANDREANI')}
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
