/**
 * Widget read-only en el detalle de Order: muestra el snapshot fiscal usado en
 * la compra (Factura A). Sale de order.metadata.billing_snapshot — inmutable.
 *
 * Zona: order.details.after
 */
import { defineWidgetConfig } from '@medusajs/admin-sdk';
import type { DetailWidgetProps } from '@medusajs/framework/types';
import { Container, Heading, Text } from '@medusajs/ui';
import { useTranslation } from 'react-i18next';
import { registerWidgetsTranslations } from '../translations/widgets';

type BillingSnapshot = {
  legal_name?: string;
  document_type?: string;
  document_number?: string;
  tax_condition?: string;
  billing_email?: string;
  billing_phone?: string | null;
  address_line_1?: string;
  address_line_2?: string | null;
  city?: string;
  province?: string;
  postal_code?: string;
  country_code?: string;
};

type AdminOrder = {
  id: string;
  metadata?: {
    invoice_type?: string;
    billing_snapshot?: BillingSnapshot | null;
  } | null;
};

const Row = ({ label, value }: { label: string; value?: string | null }) =>
  value ? (
    <div className="flex justify-between gap-4 py-1">
      <Text size="small" className="text-ui-fg-muted">
        {label}
      </Text>
      <Text size="small" className="text-right">
        {value}
      </Text>
    </div>
  ) : null;

const OrderBillingSnapshotWidget = ({
  data: order,
}: DetailWidgetProps<AdminOrder>) => {
  const { t, i18n } = useTranslation('widgets');
  registerWidgetsTranslations(i18n);

  const snapshot = order.metadata?.billing_snapshot;
  // Solo mostrar el bloque cuando hubo Factura A.
  if (order.metadata?.invoice_type !== 'invoice_a' || !snapshot) {
    return null;
  }

  const domicilio = [snapshot.address_line_1, snapshot.address_line_2]
    .filter(Boolean)
    .join(', ');

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h2">{t('BILLING_SNAPSHOT_HEADING')}</Heading>
      </div>
      <div className="px-6 py-4">
        <Row label={t('BILLING_INVOICE_TYPE')} value="Factura A" />
        <Row label={t('BILLING_LEGAL_NAME')} value={snapshot.legal_name} />
        <Row
          label={snapshot.document_type || 'CUIT'}
          value={snapshot.document_number}
        />
        <Row label={t('BILLING_TAX_CONDITION')} value={snapshot.tax_condition} />
        <Row label={t('BILLING_EMAIL')} value={snapshot.billing_email} />
        <Row label={t('BILLING_PHONE')} value={snapshot.billing_phone} />
        <Row label={t('BILLING_ADDRESS')} value={domicilio} />
        <Row label={t('BILLING_CITY')} value={snapshot.city} />
        <Row label={t('BILLING_PROVINCE')} value={snapshot.province} />
        <Row label={t('BILLING_POSTAL_CODE')} value={snapshot.postal_code} />
        <Row
          label={t('BILLING_COUNTRY')}
          value={snapshot.country_code?.toUpperCase()}
        />
      </div>
    </Container>
  );
};

export const config = defineWidgetConfig({
  zone: 'order.details.after',
});

export default OrderBillingSnapshotWidget;
