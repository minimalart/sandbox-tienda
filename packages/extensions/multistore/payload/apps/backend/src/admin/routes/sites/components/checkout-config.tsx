import { useEffect, useState } from 'react';
import { Button, Input, Label, Select, Switch, Text, Textarea, toast } from '@medusajs/ui';
import { sdk } from '../../../lib/client';
import { resolveCheckoutPolicy, type CheckoutPolicy, type CheckoutStepKey } from '../../../../modules/demo-store/checkout/policy';

const steps: { key: CheckoutStepKey; name: string; help: string }[] = [
  { key: 'contact', name: 'Contacto del comprador', help: 'El email y los datos operativos faltantes se solicitan siempre.' },
  { key: 'address', name: 'Dirección de entrega', help: 'Se omite cuando no corresponde. Los envíos a domicilio requieren una dirección válida.' },
  { key: 'delivery', name: 'Entrega o retiro', help: 'Solo se resuelve automáticamente si hay una única opción compatible con toda la compra.' },
  { key: 'billing', name: 'Facturación', help: 'Los requisitos fiscales, de empresa y del proveedor siguen siendo obligatorios.' },
  { key: 'payment', name: 'Pago', help: 'Se conserva la interacción requerida por la pasarela, incluida la autenticación o redirección.' },
  { key: 'review', name: 'Revisión independiente', help: 'Al integrarla, el resumen editable y la confirmación explícita permanecen visibles.' },
];

export function CheckoutConfig({ siteId, open }: { siteId: string; open: boolean }) {
  const [policy, setPolicy] = useState<CheckoutPolicy>(resolveCheckoutPolicy());
  const [version, setVersion] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [productIds, setProductIds] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try {
      const data = await sdk.client.fetch<{ policy: CheckoutPolicy; version: string }>(`/admin/sites/${siteId}/checkout`, { headers: { 'x-site-id': siteId } });
      setPolicy(data.policy); setVersion(data.version); setProductIds(data.policy.recipients.product_ids.join('\n'));
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (open) void load(); }, [siteId, open]);
  const recipient = <K extends keyof CheckoutPolicy['recipients']>(key: K, value: CheckoutPolicy['recipients'][K]) => setPolicy(p => ({ ...p, recipients: { ...p.recipients, [key]: value } }));
  const save = async () => {
    setSaving(true); setError('');
    try {
      const data = await sdk.client.fetch<{ policy: CheckoutPolicy; version: string }>(`/admin/sites/${siteId}/checkout`, { method: 'POST', headers: { 'x-site-id': siteId }, body: { expected_version: version, policy: { ...policy, recipients: { ...policy.recipients, product_ids: [...new Set(productIds.split(/[\n,]/).map(s => s.trim()).filter(Boolean))] } } } });
      setPolicy(data.policy); setVersion(data.version); toast.success('Configuración de checkout guardada');
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };
  if (loading) return <Text>Cargando configuración de checkout…</Text>;
  return <div className="flex flex-col gap-5">
    <div><Text weight="plus">Pasos de la compra</Text><Text size="small" className="text-ui-fg-subtle">Configuración exclusiva de esta tienda. Los cambios se aplican a nuevos checkouts.</Text></div>
    {steps.map(step => <div key={step.key} className="flex items-start justify-between gap-4 border-b border-ui-border-base pb-4">
      <div className="flex-1"><Label htmlFor={`checkout-${step.key}`}>{step.name}</Label><Text size="small" className="text-ui-fg-subtle">{step.help}</Text><Text size="xsmall" className="mt-1">{policy.steps[step.key] ? 'Visible por configuración' : step.key === 'review' ? 'Integrada al resumen final' : 'Se mostrará si faltan datos'}</Text></div>
      <Switch id={`checkout-${step.key}`} aria-label={`${step.name}: mostrar como paso independiente`} checked={policy.steps[step.key]} onCheckedChange={checked => setPolicy(p => ({ ...p, steps: { ...p.steps, [step.key]: checked } }))} />
    </div>)}
    <Text size="small" className="text-ui-fg-subtle">Si falta información necesaria para completar la compra, se solicitará igualmente. Validación y finalización: siempre obligatorias en servidor.</Text>
    <div className="flex items-center justify-between gap-4"><Label htmlFor="checkout-recipients">Destinatarios de productos</Label><Switch id="checkout-recipients" checked={policy.recipients.enabled} onCheckedChange={v => recipient('enabled', v)} /></div>
    <Text size="small" className="text-ui-fg-subtle">{policy.recipients.enabled ? 'Cada unidad alcanzada requiere DNI, nombre y apellido. Una persona puede asignarse a varias unidades.' : 'Capacidad desactivada. No se solicitan datos de destinatarios.'}</Text>
    <div className="space-y-2"><Label htmlFor="checkout-title">Título visible</Label><Input id="checkout-title" maxLength={100} value={policy.recipients.title} onChange={e => recipient('title', e.target.value)} /></div>
    <div className="space-y-2"><Label htmlFor="checkout-help">Texto de ayuda</Label><Textarea id="checkout-help" maxLength={500} value={policy.recipients.help} onChange={e => recipient('help', e.target.value)} /></div>
    <div className="space-y-2"><Label>Productos alcanzados</Label><Select value={policy.recipients.scope} onValueChange={v => recipient('scope', v as 'all' | 'selected')}><Select.Trigger aria-label="Productos alcanzados"><Select.Value /></Select.Trigger><Select.Content><Select.Item value="all">Todos los productos</Select.Item><Select.Item value="selected">Productos seleccionados</Select.Item></Select.Content></Select></div>
    {policy.recipients.scope === 'selected' && <div className="space-y-2"><Label htmlFor="checkout-products">IDs de productos de esta tienda</Label><Textarea id="checkout-products" placeholder="prod_… (uno por línea)" value={productIds} onChange={e => setProductIds(e.target.value)} /><Text size="small" className="text-ui-fg-subtle">Se comprueba que cada producto pertenezca al catálogo de esta tienda.</Text></div>}
    <div className="space-y-2"><Label htmlFor="checkout-retention">Conservar datos de carritos abandonados (días)</Label><Input id="checkout-retention" type="number" min={1} max={90} value={policy.recipients.retention_days} onChange={e => recipient('retention_days', Number(e.target.value))} /><Text size="small" className="text-ui-fg-subtle">Al vencer, se elimina la información del checkout abandonado. Los pedidos conservan su histórico.</Text></div>
    <Text size="small">Documento: DNI argentino. La identidad del destinatario no reemplaza los datos del comprador ni de facturación.</Text>
    {error && <div role="alert" className="text-ui-fg-error"><Text>{error}</Text><Button variant="secondary" onClick={load}>Volver a cargar</Button></div>}
    <Button onClick={save} isLoading={saving} disabled={!version || saving}>Guardar checkout</Button>
  </div>;
}
