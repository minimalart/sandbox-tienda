import { Badge, Button, Drawer, Text, toast } from '@medusajs/ui';
import { useTranslation } from 'react-i18next';
import { useErpSalePreview } from '../../../hooks/api';
import { formatDateTime } from './shared';

/**
 * El documento de venta que se le mandó al ERP, para poder respondérselo a
 * quien lo pida (el caso que la trajo: "desde Zeus nos piden el JSON del pedido
 * para verificar los parámetros").
 *
 * Lo que se muestra es tan importante como de DÓNDE sale. Un documento
 * reconstruido con la configuración de hoy puede no ser el que recibió el ERP,
 * y presentarlo como si lo fuera es peor que no mostrar nada: manda a discutir
 * sobre parámetros que quizá nunca viajaron. Por eso el badge de origen y las
 * advertencias van ARRIBA del JSON, no escondidas abajo.
 */
export const SalePreviewDrawer = ({
  eventId,
  onClose,
}: {
  eventId: string | null;
  onClose: () => void;
}) => {
  const { t } = useTranslation('erp');
  const { data, isPending, error } = useErpSalePreview(eventId);

  const json = data ? JSON.stringify(data.request, null, 2) : '';

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
    <Drawer open={Boolean(eventId)} onOpenChange={(open) => !open && onClose()}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>{t('PREVIEW_TITLE')}</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-4 overflow-y-auto">
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
                {data.external_ref ? (
                  <Text size="small" className="text-ui-fg-subtle">
                    {t('COL_EXTERNAL_REF')}: {data.external_ref}
                  </Text>
                ) : null}
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

              <div className="flex justify-end">
                <Button size="small" variant="secondary" onClick={copy}>
                  {t('PREVIEW_COPY')}
                </Button>
              </div>

              <pre className="overflow-x-auto rounded-lg bg-ui-bg-subtle p-3 text-xs text-ui-fg-subtle">
                {json}
              </pre>
            </>
          ) : null}
        </Drawer.Body>
      </Drawer.Content>
    </Drawer>
  );
};
