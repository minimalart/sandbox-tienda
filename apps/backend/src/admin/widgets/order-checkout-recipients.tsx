import { defineWidgetConfig } from '@medusajs/admin-sdk';
import { Container, Heading, Text, Button } from '@medusajs/ui';
import { useEffect, useState } from 'react';
import { sdk } from '../lib/client';

const OrderCheckoutRecipients = ({ data: order }: { data: { id: string; items?: any[] } }) => {
  const [checkout, setCheckout] = useState<any>(null);
  const [error, setError] = useState('');
  const [revealed, setRevealed] = useState(false);
  const load = async (documents = false) => {
    setError('');
    try {
      const data = await sdk.client.fetch<{ checkout: any }>(`/admin/orders/${order.id}/checkout${documents ? '?documents=1' : ''}`);
      setCheckout(data.checkout); setRevealed(documents);
    } catch (e) { setError((e as Error).message); }
  };
  useEffect(() => { void load(); }, [order.id]);
  if (!checkout && !error) return null;
  return <Container><Heading level="h2">Destinatarios de productos</Heading>
    {error && <Text role="alert" className="text-ui-fg-error">{error}</Text>}
    {checkout?.units?.map((unit: any, index: number) => {
      const person = checkout.people.find((p: any) => p.id === unit.person_id);
      const item = order.items?.find((i: any) => i.id === unit.order_line_id);
      return <div key={unit.id} className="mt-3 border-t border-ui-border-base pt-3"><Text weight="plus">{item?.product_title ?? item?.title ?? unit.order_line_id} · Unidad {index + 1}</Text><Text size="small">{person?.first_name} {person?.last_name} · DNI {person?.document}</Text></div>;
    })}
    {checkout?.can_view_documents && <Button className="mt-4" variant="secondary" onClick={() => load(!revealed)}>{revealed ? 'Ocultar documentos' : 'Consultar documentos completos'}</Button>}
  </Container>;
};
export const config = defineWidgetConfig({ zone: 'order.details.after' });
export default OrderCheckoutRecipients;
