/**
 * Widget read-only en el detalle de Order: muestra la empresa mayorista y el
 * operador que realizó la compra (desde order.metadata, lo setea el subscriber).
 *
 * Zona: order.details.after
 */
import { defineWidgetConfig } from '@medusajs/admin-sdk';
import type { DetailWidgetProps } from '@medusajs/framework/types';
import { Container, Heading, Text } from '@medusajs/ui';

type AdminOrder = {
  id: string;
  metadata?: {
    context?: string;
    company_id?: string;
    company_name?: string;
    placed_by_email?: string;
    placed_by_customer_id?: string;
  } | null;
};

const Row = ({ label, value }: { label: string; value?: string | null }) =>
  value ? (
    <div className="flex justify-between gap-4 py-1">
      <Text size="small" className="text-ui-fg-muted">{label}</Text>
      <Text size="small" className="text-right">{value}</Text>
    </div>
  ) : null;

const OrderCompanyWidget = ({ data: order }: DetailWidgetProps<AdminOrder>) => {
  const m = order.metadata;
  if (m?.context !== 'b2b' || !m?.company_id) return null;
  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h2">Empresa (mayorista)</Heading>
      </div>
      <div className="px-6 py-4">
        <Row label="Empresa" value={m.company_name ?? m.company_id} />
        <Row label="Operador" value={m.placed_by_email} />
        <Row label="Customer" value={m.placed_by_customer_id} />
      </div>
    </Container>
  );
};

export const config = defineWidgetConfig({ zone: 'order.details.after' });

export default OrderCompanyWidget;
