/**
 * Widget de facturación ERP en el detalle de orden.
 *
 * Zona: `order.details.after`
 *
 * Hace su PROPIO fetch y del prop usa solamente el `id`: Medusa no garantiza
 * los `fulfillments` hidratados en `DetailWidgetProps.data` (mismo motivo que
 * documentan `order-correo-widget.tsx` y `order-andreani-widget.tsx`).
 *
 * Para qué sirve, en orden de importancia:
 *
 * 1. **Decirle al operador DESDE DÓNDE despachar.** Con el trigger por
 *    fulfillment, crear el fulfillment desde otra ubicación da un 400. Sin este
 *    cartel, ese 400 aparece sin contexto justo cuando la persona ya tiene la
 *    mercadería armada.
 * 2. Permitir el override del depósito facturador cuando la consolidación
 *    terminó en otro lado, sin tocar la config global de la tienda.
 * 3. Mostrar el estado real: si la venta se notificó, si el ERP ya facturó, y el
 *    comprobante cuando llega.
 *
 * El PDF se baja con `fetch(..., { credentials: 'include' })` + blob y NO con un
 * `<a href>`: la descarga pasa por el backend porque es él el que tiene el JWT
 * del ERP, y la respuesta es binaria.
 *
 * Con el trigger `payment_captured` el widget se muestra igual pero sin el
 * bloque de depósito: ahí no hay depósito que confirmar y ofrecerlo sería
 * sugerir un control que no hace nada.
 */

import { defineWidgetConfig } from '@medusajs/admin-sdk';
import type { DetailWidgetProps } from '@medusajs/framework/types';
import { Button, Container, Heading, Select, StatusBadge, Text, toast } from '@medusajs/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useErpOrderStatus, useSetErpOrderBillingDeposito } from '../hooks/api/erp';
import { ErpStatusBadge, statusLabelKey } from '../routes/erp/components/shared';
import { registerErpTranslations } from '../translations/erp';

type AdminOrder = { id: string };

/** Sin depósito elegido: el `Select` de Medusa no acepta `value=""`. */
const USE_CONFIG_DEFAULT = '__config_default__';

const OrderErpWidget = ({ data }: DetailWidgetProps<AdminOrder>) => {
  const { i18n, t } = useTranslation('erp');
  registerErpTranslations(i18n);

  const orderId = data?.id;
  const { data: status, isLoading } = useErpOrderStatus(orderId, {
    enabled: Boolean(orderId),
    // El poll del comprobante puede tardar: refrescar mientras hay algo en
    // vuelo evita que el operador tenga que recargar la página a ciegas.
    refetchInterval: 30_000,
  });

  const [pendingDeposito, setPendingDeposito] = useState<string | null>(null);
  const { mutate: setDeposito, isPending: isSaving } = useSetErpOrderBillingDeposito(orderId, {
    onSuccess: () => {
      setPendingDeposito(null);
      toast.success(t('ORDER_BILLING_DEPOSITO_SAVED'));
    },
    onError: (error) => toast.error(error.message),
  });

  const [downloading, setDownloading] = useState(false);

  // Nada configurado o notificación apagada: el widget no aporta nada y ocupar
  // espacio en el detalle de la orden tiene costo.
  if (!orderId || (!isLoading && !status?.enabled)) return null;

  const billing = status?.billing ?? null;
  const isFulfillmentTrigger = status?.trigger === 'fulfillment_created';

  const downloadInvoice = async (invoiceId: string): Promise<void> => {
    setDownloading(true);
    try {
      const res = await fetch(`/admin/erp/invoices/${invoiceId}/download`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const detail = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(detail?.message ?? res.statusText);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      // Sin el revoke queda el blob colgado en memoria por toda la sesión del
      // admin; el timeout le da tiempo a la pestaña nueva a leerlo.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">{t('ORDER_WIDGET_TITLE')}</Heading>
        {status?.sale_event ? (
          // Mismos colores y etiquetas que la tabla de ERP → Ventas: el mismo
          // estado no puede leerse distinto en dos pantallas.
          <ErpStatusBadge
            status={status.sale_event.status}
            label={t(statusLabelKey(status.sale_event.status))}
          />
        ) : (
          <StatusBadge color="grey">{t('ORDER_NOT_NOTIFIED')}</StatusBadge>
        )}
      </div>

      {isFulfillmentTrigger && (
        <div className="flex flex-col gap-3 px-6 py-4">
          <Text size="small" weight="plus">
            {t('ORDER_BILLING_SECTION')}
          </Text>

          {billing?.resolved ? (
            <Text size="small" className="text-ui-fg-subtle">
              {t('ORDER_BILLING_SHIP_FROM', {
                deposito: billing.deposito,
                location: billing.stock_location_name ?? billing.stock_location_id,
              })}
            </Text>
          ) : (
            <Text size="small" className="text-ui-fg-error">
              {billing?.reason === 'not_mapped'
                ? t('ORDER_BILLING_NOT_MAPPED', { deposito: billing?.deposito ?? '' })
                : t('ORDER_BILLING_NOT_CONFIGURED')}
            </Text>
          )}

          {billing?.confirmation ? (
            <Text size="xsmall" className="text-ui-fg-muted">
              {t('ORDER_BILLING_CONFIRMED', {
                deposito: billing.confirmation.deposito,
                at: new Date(billing.confirmation.confirmed_at).toLocaleString(),
              })}
            </Text>
          ) : (
            <Text size="xsmall" className="text-ui-fg-muted">
              {t('ORDER_BILLING_NOT_CONFIRMED')}
            </Text>
          )}

          {/*
            El override sólo tiene sentido ANTES de notificar: después, el
            comprobante ya salió con el depósito anterior y el backend rechaza el
            cambio. Mostrar un control que va a dar error es peor que no
            mostrarlo.
          */}
          {billing && billing.options.length > 0 && !status?.sale_event?.sent_at && (
            <div className="flex items-end gap-2">
              <div className="flex flex-1 flex-col gap-1">
                <Text size="xsmall" className="text-ui-fg-subtle">
                  {t('ORDER_BILLING_OVERRIDE')}
                </Text>
                <Select
                  value={pendingDeposito ?? billing.override ?? USE_CONFIG_DEFAULT}
                  onValueChange={setPendingDeposito}
                  disabled={isSaving}
                >
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value={USE_CONFIG_DEFAULT}>
                      {t('ORDER_BILLING_USE_DEFAULT')}
                    </Select.Item>
                    {billing.options.map((option) => (
                      <Select.Item key={option.deposito} value={option.deposito}>
                        {option.stock_location_name
                          ? `${option.deposito} — ${option.stock_location_name}`
                          : option.deposito}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>
              <Button
                size="small"
                variant="secondary"
                isLoading={isSaving}
                disabled={pendingDeposito === null}
                onClick={() =>
                  setDeposito(
                    pendingDeposito === USE_CONFIG_DEFAULT ? null : (pendingDeposito as string)
                  )
                }
              >
                {t('ORDER_BILLING_SAVE')}
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2 px-6 py-4">
        <Text size="small" weight="plus">
          {t('ORDER_INVOICE_SECTION')}
        </Text>

        {status?.invoice ? (
          <>
            <Text size="small">
              {[status.invoice.tipo_comp, status.invoice.letra, status.invoice.numero_comp]
                .filter(Boolean)
                .join(' ')}
              {status.invoice.fecha ? ` · ${status.invoice.fecha}` : ''}
            </Text>
            {status.invoice.has_pdf ? (
              <Button
                size="small"
                variant="secondary"
                isLoading={downloading}
                onClick={() => downloadInvoice(status.invoice!.id)}
              >
                {t('ORDER_INVOICE_DOWNLOAD')}
              </Button>
            ) : (
              <Text size="xsmall" className="text-ui-fg-muted">
                {t('ORDER_INVOICE_NO_PDF')}
              </Text>
            )}
          </>
        ) : status?.capabilities?.invoice_fetch === false ? (
          <Text size="xsmall" className="text-ui-fg-muted">
            {t('ORDER_INVOICE_UNSUPPORTED')}
          </Text>
        ) : status?.invoice_event ? (
          <Text size="xsmall" className="text-ui-fg-subtle">
            {t('ORDER_INVOICE_WAITING', { attempts: status.invoice_event.attempts })}
          </Text>
        ) : (
          <Text size="xsmall" className="text-ui-fg-muted">
            {t('ORDER_INVOICE_PENDING_SALE')}
          </Text>
        )}
      </div>
    </Container>
  );
};

export const config = defineWidgetConfig({
  zone: 'order.details.after',
});

export default OrderErpWidget;
