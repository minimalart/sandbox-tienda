/**
 * Resultado POR ÍTEM de una descarga de rótulos de Correo.
 *
 * Este componente existe por una razón puntual del contrato: `POST /v1/labels` es
 * bulk nativo (una sola llamada trae los N rótulos) **pero devuelve las fallas
 * parciales con HTTP 200** y `result: "OK" | "ERROR: ..."` en cada ítem.
 *
 * Si la UI colapsara eso a un solo "listo/falló", mentiría en las dos
 * direcciones: un "listo" le esconde al operador los 2 rótulos que no salieron de
 * 10, y un "falló" le esconde los 8 que sí. De 10 rótulos con 2 fallas, el
 * operador necesita saber CUÁLES. Por eso acá se lista uno por uno con su motivo.
 */

import { Button, FocusModal, StatusBadge, Table, Text } from '@medusajs/ui';
import { useTranslation } from 'react-i18next';
import {
  downloadCorreoLabel,
  openCorreoLabel,
  type CorreoLabelBatch,
} from '../../../hooks/api/correo-argentino';
import { registerCorreoArgentinoTranslations } from '../../../translations/correo-argentino';

interface Props {
  batch: CorreoLabelBatch;
  onClose: () => void;
}

export function LabelBatchModal({ batch, onClose }: Props) {
  const { t, i18n } = useTranslation('correoArgentino');
  registerCorreoArgentinoTranslations(i18n);

  const { summary, files } = batch;
  const okFiles = files.filter((file) => file.ok && file.bytes);

  const headline = summary.all_ok
    ? t('LABELS_SUMMARY_ALL_OK', { total: summary.total })
    : summary.all_failed
      ? t('LABELS_SUMMARY_ALL_FAILED', { total: summary.total })
      : t('LABELS_SUMMARY_MIXED', {
          ok: summary.ok_count,
          total: summary.total,
          failed: summary.error_count,
        });

  return (
    <FocusModal open onOpenChange={(open) => !open && onClose()}>
      <FocusModal.Content className="max-w-3xl">
        <FocusModal.Header>
          <FocusModal.Title>{t('LABELS_TITLE')}</FocusModal.Title>
        </FocusModal.Header>

        <FocusModal.Body className="flex flex-col gap-4 overflow-y-auto px-6 py-4">
          <div>
            <Text weight="plus">{headline}</Text>
            {/* La nota sobre el HTTP 200 se muestra solo cuando hubo fallas: es
                justo cuando el operador se pregunta por qué "salió bien" y
                faltan rótulos. */}
            {summary.error_count > 0 && (
              <Text size="small" className="text-ui-fg-subtle">
                {t('LABELS_PARTIAL_NOTE')}
              </Text>
            )}
          </div>

          {batch.truncated && (
            <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3">
              <Text size="small">
                {t('LABELS_TRUNCATED', { requested: batch.requested })}
              </Text>
            </div>
          )}

          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>{t('LABELS_COL_TRACKING')}</Table.HeaderCell>
                <Table.HeaderCell>{t('LABELS_COL_RESULT')}</Table.HeaderCell>
                <Table.HeaderCell />
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {files.map((file) => (
                <Table.Row key={file.tracking_number}>
                  <Table.Cell>
                    <Text size="small" className="font-mono">
                      {file.tracking_number || '—'}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex flex-col gap-1">
                      <StatusBadge color={file.ok ? 'green' : 'red'}>
                        {file.ok ? t('LABELS_OK') : t('LABELS_FAILED')}
                      </StatusBadge>
                      {/* El motivo textual viene de Correo tal cual: es lo único
                          que explica por qué ESTE rótulo no salió. */}
                      {!file.ok && file.error && (
                        <Text size="xsmall" className="text-ui-fg-error">
                          {file.error}
                        </Text>
                      )}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    {file.ok && file.bytes && (
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="transparent"
                          size="small"
                          onClick={() => openCorreoLabel(file)}
                        >
                          {t('LABELS_OPEN')}
                        </Button>
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() => downloadCorreoLabel(file)}
                        >
                          {t('LABELS_DOWNLOAD')}
                        </Button>
                      </div>
                    )}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </FocusModal.Body>

        <FocusModal.Footer>
          <div className="flex gap-2">
            {okFiles.length > 0 && (
              <Button
                variant="secondary"
                size="small"
                onClick={() => okFiles.forEach(downloadCorreoLabel)}
              >
                {t('LABELS_DOWNLOAD_OK_ONES', { count: okFiles.length })}
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
