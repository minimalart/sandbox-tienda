/**
 * Resultado POR ORDEN de la creación masiva de envíos.
 *
 * La ruta `tickets/bulk` procesa las órdenes de a una y devuelve HTTP 200 con el
 * detalle de cada una, así que "el lote salió bien" no existe como respuesta: hay
 * N resultados. Crear un envío en Correo es facturable, así que el operador tiene
 * que ver exactamente cuáles se crearon, cuáles ya existían (idempotencia) y
 * cuáles fallaron y por qué.
 *
 * Los rótulos NO se bajan automáticamente: es una segunda llamada explícita con
 * los tracking numbers que salieron.
 */

import { Badge, Button, FocusModal, StatusBadge, Table, Text } from '@medusajs/ui';
import { useTranslation } from 'react-i18next';
import type { CorreoBulkTicketsSummary } from '../../../hooks/api/correo-argentino';
import { registerCorreoArgentinoTranslations } from '../../../translations/correo-argentino';

interface Props {
  summary: CorreoBulkTicketsSummary;
  isDownloadingLabels: boolean;
  onDownloadLabels: (trackingNumbers: string[]) => void;
  onClose: () => void;
}

export function BulkTicketsModal({
  summary,
  isDownloadingLabels,
  onDownloadLabels,
  onClose,
}: Props) {
  const { t, i18n } = useTranslation('correoArgentino');
  registerCorreoArgentinoTranslations(i18n);

  const trackingNumbers = summary.succeeded
    .map((entry) => entry.tracking_number)
    .filter(Boolean);

  return (
    <FocusModal open onOpenChange={(open) => !open && onClose()}>
      <FocusModal.Content className="max-w-3xl">
        <FocusModal.Header>
          <FocusModal.Title>{t('BULK_TICKETS_TITLE')}</FocusModal.Title>
        </FocusModal.Header>

        <FocusModal.Body className="flex flex-col gap-4 overflow-y-auto px-6 py-4">
          <Text weight="plus">
            {t('BULK_TICKETS_SUMMARY', {
              ok: summary.succeeded_count,
              failed: summary.failed_count,
            })}
          </Text>

          {/* Nunca truncar en silencio: si el operador pidió 62 y el cap son 50,
              12 órdenes quedaron SIN procesar y tiene que saberlo. */}
          {summary.truncated && (
            <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3">
              <Text size="small">
                {t('BULK_TICKETS_TRUNCATED', {
                  requested: summary.requested,
                  cap: summary.cap,
                })}
              </Text>
            </div>
          )}

          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>{t('BULK_TICKETS_COL_ORDER')}</Table.HeaderCell>
                <Table.HeaderCell>{t('BULK_TICKETS_COL_RESULT')}</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {summary.succeeded.map((entry) => (
                <Table.Row key={entry.order_id}>
                  <Table.Cell>
                    <Text size="small" weight="plus">
                      {entry.display_id != null
                        ? `#${entry.display_id}`
                        : entry.order_id}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge color="green">{t('LABELS_OK')}</StatusBadge>
                      <Text size="xsmall" className="font-mono">
                        {entry.tracking_number}
                      </Text>
                      {/* `created: false` = la orden ya tenía envío. Distinguirlo
                          importa: es la diferencia entre un envío nuevo
                          facturable y una operación que no tocó Correo. */}
                      <Badge size="2xsmall" color={entry.created ? 'blue' : 'grey'}>
                        {entry.created
                          ? t('BULK_TICKETS_NEW')
                          : t('BULK_TICKETS_EXISTING')}
                      </Badge>
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}

              {summary.failed.map((entry) => (
                <Table.Row key={entry.order_id}>
                  <Table.Cell>
                    <Text size="small" weight="plus">
                      {entry.order_id}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <StatusBadge color="red">{t('LABELS_FAILED')}</StatusBadge>
                        {/* El `code` es lo que le dice al operador si reintentar
                            sirve (503 de Correo) o si hay que arreglar un dato. */}
                        <Badge size="2xsmall" color="red">
                          {entry.code}
                        </Badge>
                      </div>
                      <Text size="xsmall" className="text-ui-fg-error">
                        {entry.error}
                      </Text>
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </FocusModal.Body>

        <FocusModal.Footer>
          <div className="flex gap-2">
            {trackingNumbers.length > 0 && (
              <Button
                variant="secondary"
                size="small"
                isLoading={isDownloadingLabels}
                onClick={() => onDownloadLabels(trackingNumbers)}
              >
                {t('BULK_TICKETS_DOWNLOAD_LABELS')}
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
