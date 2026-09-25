import { Badge, Button, Drawer, Heading, Text, toast } from '@medusajs/ui';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { type ErpOutboxEvent, useErpSalePreview } from '../../../hooks/api';
import { splitOutboxError } from './outbox-error';
import { ErpStatusBadge, formatDateTime, statusLabelKey } from './shared';

/**
 * Todo lo que hay que saber de una fila del outbox, en un solo lugar: estado,
 * qué respondió el ERP y el documento que se le mandó.
 *
 * Antes eran dos cosas: el error truncado en la tabla (con el resto en un
 * tooltip) y un drawer aparte sólo para el JSON. El texto largo en la celda
 * desbordaba la tabla a lo ancho y la columna fija de la fecha tapaba la de la
 * orden, así que la pantalla dejaba de decir DE QUÉ orden era cada error.
 *
 * Sobre el documento: lo que se muestra es tan importante como de DÓNDE sale.
 * Uno reconstruido con la configuración de hoy puede no ser el que recibió el
 * ERP, y presentarlo como si lo fuera manda a discutir sobre parámetros que
 * quizá nunca viajaron. Por eso el badge de origen y las advertencias van
 * ARRIBA del JSON.
 */
export const OutboxEventDrawer = ({
  event,
  onClose,
}: {
  event: ErpOutboxEvent | null;
  onClose: () => void;
}) => {
  const { t } = useTranslation('erp');
  const isSale = event?.event_type === 'sale_created';
  // El documento sólo existe para ventas: un poll de comprobante no manda nada.
  const { data, isPending, error } = useErpSalePreview(isSale && event ? event.id : null);

  const json = data ? JSON.stringify(data.request, null, 2) : '';
  const failure = splitOutboxError(event?.last_error);
  const displayId = event?.payload?.display_id;
  const externalRef = event?.external_ref ?? event?.payload?.external_ref ?? null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      toast.success(t('PREVIEW_COPIED'));
    } catch {
      // El portapapeles puede estar denegado por permisos o por contexto no
      // seguro. El JSON ya está en pantalla: se dice cómo seguir a mano en vez
      // de dejar un botón que no hace nada.
      toast.error(t('PREVIEW_COPY_ERROR'));
    }
  };

  return (
    <Drawer open={Boolean(event)} onOpenChange={(open) => !open && onClose()}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>
            {displayId ? `#${displayId}` : event?.aggregate_id} ·{' '}
            {isSale ? t('EVENT_SALE') : t('EVENT_INVOICE')}
          </Drawer.Title>
        </Drawer.Header>
        {event ? (
          <Drawer.Body className="flex flex-col gap-6 overflow-y-auto">
            <dl className="grid grid-cols-[max-content_1fr] items-center gap-x-6 gap-y-2">
              <Field label={t('COL_STATUS')}>
                <ErpStatusBadge status={event.status} label={t(statusLabelKey(event.status))} />
              </Field>
              <Field label={t('COL_ATTEMPTS')}>{event.attempts}</Field>
              <Field label={t('COL_CREATED')}>{formatDateTime(event.created_at)}</Field>
              {event.next_retry_at && (event.status === 'pending' || event.status === 'failed') ? (
                <Field label={t('COL_NEXT_RETRY')}>{formatDateTime(event.next_retry_at)}</Field>
              ) : null}
              {externalRef ? <Field label={t('COL_EXTERNAL_REF')}>{externalRef}</Field> : null}
              <Field label={t('COL_ORDER')}>
                <span className="font-mono">{event.aggregate_id}</span>
              </Field>
            </dl>

            {event.event_type === 'invoice_fetch' &&
            (event.status === 'pending' || event.status === 'processing') ? (
              // "Todavía no facturó" es un REINTENTO, no un error (ver
              // `ErpOutboxSettings.invoice_fetch`): va en neutro.
              <Text size="small" className="rounded-lg bg-ui-bg-subtle p-3 text-ui-fg-subtle">
                {t('ORDER_INVOICE_WAITING', { attempts: event.attempts })}
              </Text>
            ) : failure.summary || failure.erpMessage ? (
              <div className="flex flex-col gap-2 rounded-lg border border-ui-border-error bg-ui-bg-subtle p-3">
                {failure.erpMessage ? (
                  <>
                    <Text size="xsmall" weight="plus" className="text-ui-fg-subtle">
                      {t('DETAIL_ERP_SAID')}
                    </Text>
                    <Text size="small" weight="plus" className="text-ui-fg-error">
                      {failure.erpMessage}
                    </Text>
                  </>
                ) : null}
                {failure.summary ? (
                  <Text size="small" className="text-ui-fg-subtle">
                    {failure.summary}
                  </Text>
                ) : null}
              </div>
            ) : null}

            {isSale ? (
              <section className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <Heading level="h3">{t('PREVIEW_TITLE')}</Heading>
                  {data ? (
                    <Button size="small" variant="secondary" onClick={copy}>
                      {t('PREVIEW_COPY')}
                    </Button>
                  ) : null}
                </div>
                {isPending ? (
                  <Text size="small" className="text-ui-fg-subtle">
                    {t('PREVIEW_LOADING')}
                  </Text>
                ) : error ? (
                  <Text size="small" className="text-ui-fg-error">
                    {t('PREVIEW_ERROR', { msg: error.message })}
                  </Text>
                ) : data ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge size="2xsmall" color={data.source === 'stored' ? 'green' : 'orange'}>
                        {data.source === 'stored'
                          ? t('PREVIEW_SOURCE_STORED')
                          : t('PREVIEW_SOURCE_RECONSTRUCTED')}
                      </Badge>
                      {data.sent_at ? (
                        <Text size="small" className="text-ui-fg-subtle">
                          {t('PREVIEW_SENT_AT')}: {formatDateTime(data.sent_at)}
                        </Text>
                      ) : null}
                    </div>
                    {data.warnings.length ? (
                      <div className="flex flex-col gap-1.5 rounded-lg bg-ui-bg-subtle p-3">
                        {data.warnings.map((warning) => (
                          <Text key={warning} size="small" className="text-ui-fg-subtle">
                            {warning}
                          </Text>
                        ))}
                      </div>
                    ) : null}
                    <pre className="overflow-x-auto rounded-lg bg-ui-bg-subtle p-3 text-xs text-ui-fg-subtle">
                      {json}
                    </pre>
                  </>
                ) : null}
              </section>
            ) : null}
          </Drawer.Body>
        ) : null}
      </Drawer.Content>
    </Drawer>
  );
};

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <>
    <dt>
      <Text size="small" className="text-ui-fg-subtle">
        {label}
      </Text>
    </dt>
    {/* `dd` pelado y no `Text`: `Text` es un <p> y el badge de estado no puede ir adentro. */}
    <dd className="txt-compact-small text-ui-fg-base">{children}</dd>
  </>
);
