import { useEffect, useState } from 'react';
import { Button, Input, Label, Select, Switch, Text, Textarea, toast } from '@medusajs/ui';
import { sdk } from '../../../lib/client';
import { resolveCheckoutPolicy, type CheckoutPolicy, type CheckoutSectionKey, type CheckoutStepKey } from '../../../../modules/demo-store/checkout/policy';

const steps: { key: CheckoutStepKey; name: string; help: string }[] = [
  { key: 'contact', name: 'Contacto del comprador', help: 'El email y los datos operativos faltantes se solicitan siempre.' },
  { key: 'address', name: 'Dirección de entrega', help: 'Se omite cuando no corresponde. Los envíos a domicilio requieren una dirección válida.' },
  { key: 'delivery', name: 'Entrega o retiro', help: 'Solo se resuelve automáticamente si hay una única opción compatible con toda la compra.' },
  { key: 'billing', name: 'Facturación', help: 'Los requisitos fiscales, de empresa y del proveedor siguen siendo obligatorios.' },
  { key: 'benefits', name: 'Beneficios', help: 'Muestra los beneficios aplicables (envío gratis, descuentos activos). Ocultá este paso si querés un checkout más corto.' },
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
  const setSection = (key: CheckoutSectionKey, field: 'title' | 'subtitle', value: string) => setPolicy(p => {
    const sections = { ...(p.sections ?? {}) };
    const current = { ...(sections[key] ?? {}) };
    if (value) current[field] = value; else delete current[field];
    if (Object.keys(current).length) sections[key] = current; else delete sections[key];
    return { ...p, sections };
  });
  const setAddressField = (field: string, value: string) => setPolicy(p => {
    const address = { ...(p.defaults.shipping_address ?? {}) } as Record<string, string>;
    if (value) address[field] = value; else delete address[field];
    return { ...p, defaults: { ...p.defaults, shipping_address: Object.keys(address).length ? (address as CheckoutPolicy['defaults']['shipping_address']) : undefined } };
  });
  const setShippingOption = (value: string) => setPolicy(p => ({ ...p, defaults: { ...p.defaults, shipping_option_id: value.trim() || undefined } }));
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
    {steps.map(step => <div key={step.key} className="flex flex-col gap-3 border-b border-ui-border-base pb-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1"><Label htmlFor={`checkout-${step.key}`}>{step.name}</Label><Text size="small" className="text-ui-fg-subtle">{step.help}</Text><Text size="xsmall" className="mt-1">{policy.steps[step.key] ? 'Visible por configuración' : step.key === 'review' ? 'Integrada al resumen final' : 'Se mostrará si faltan datos'}</Text></div>
        <Switch id={`checkout-${step.key}`} aria-label={`${step.name}: mostrar como paso independiente`} checked={policy.steps[step.key]} onCheckedChange={checked => setPolicy(p => ({ ...p, steps: { ...p.steps, [step.key]: checked } }))} />
      </div>
      <div className="space-y-2"><Label htmlFor={`checkout-${step.key}-title`}>Título</Label><Input id={`checkout-${step.key}-title`} maxLength={100} placeholder={step.name} value={policy.sections?.[step.key]?.title ?? ''} onChange={e => setSection(step.key, 'title', e.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor={`checkout-${step.key}-subtitle`}>Subtítulo</Label><Textarea id={`checkout-${step.key}-subtitle`} maxLength={500} placeholder={step.help} value={policy.sections?.[step.key]?.subtitle ?? ''} onChange={e => setSection(step.key, 'subtitle', e.target.value)} /></div>
      {step.key === 'address' && policy.steps.address === false && <div className="flex flex-col gap-2 rounded-md bg-ui-bg-subtle p-3">
        <Text weight="plus" size="small">Dirección por defecto</Text>
        <Text size="xsmall" className="text-ui-fg-subtle">Obligatoria cuando el paso está oculto. Se aplica automáticamente al carrito al iniciar el checkout. Nombre y teléfono se toman del cliente que hace la compra.</Text>
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2 space-y-1"><Label htmlFor="default-company" size="xsmall">Empresa / institución</Label><Input id="default-company" maxLength={200} value={policy.defaults.shipping_address?.company ?? ''} onChange={e => setAddressField('company', e.target.value)} /></div>
          <div className="col-span-2 space-y-1"><Label htmlFor="default-address_1" size="xsmall">Calle y número *</Label><Input id="default-address_1" maxLength={200} value={policy.defaults.shipping_address?.address_1 ?? ''} onChange={e => setAddressField('address_1', e.target.value)} /></div>
          <div className="col-span-2 space-y-1"><Label htmlFor="default-address_2" size="xsmall">Piso / depto</Label><Input id="default-address_2" maxLength={200} value={policy.defaults.shipping_address?.address_2 ?? ''} onChange={e => setAddressField('address_2', e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="default-city" size="xsmall">Ciudad *</Label><Input id="default-city" maxLength={100} value={policy.defaults.shipping_address?.city ?? ''} onChange={e => setAddressField('city', e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="default-province" size="xsmall">Provincia</Label><Input id="default-province" maxLength={100} value={policy.defaults.shipping_address?.province ?? ''} onChange={e => setAddressField('province', e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="default-postal" size="xsmall">Código postal</Label><Input id="default-postal" maxLength={20} value={policy.defaults.shipping_address?.postal_code ?? ''} onChange={e => setAddressField('postal_code', e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="default-country" size="xsmall">País (ISO-2) *</Label><Input id="default-country" maxLength={2} placeholder="ar" value={policy.defaults.shipping_address?.country_code ?? ''} onChange={e => setAddressField('country_code', e.target.value.toLowerCase())} /></div>
        </div>
      </div>}
      {step.key === 'delivery' && policy.steps.delivery === false && <div className="flex flex-col gap-2 rounded-md bg-ui-bg-subtle p-3">
        <Text weight="plus" size="small">Método de envío por defecto</Text>
        <Text size="xsmall" className="text-ui-fg-subtle">Obligatorio cuando el paso está oculto. El shipping option debe pertenecer a un canal de esta tienda.</Text>
        <div className="space-y-1"><Label htmlFor="default-shipping-option" size="xsmall">Shipping option ID *</Label><Input id="default-shipping-option" placeholder="so_..." value={policy.defaults.shipping_option_id ?? ''} onChange={e => setShippingOption(e.target.value)} /></div>
      </div>}
    </div>)}
    <Text size="small" className="text-ui-fg-subtle">Si falta información necesaria para completar la compra, se solicitará igualmente. Validación y finalización: siempre obligatorias en servidor.</Text>
    <div className="flex flex-col gap-3 border-b border-ui-border-base pb-4">
      <div className="flex items-center justify-between gap-4"><Label htmlFor="checkout-suggestions">Sugerencias de productos</Label><Switch id="checkout-suggestions" aria-label="Sugerencias de productos: mostrar el carrusel arriba del checkout" checked={policy.suggestions.enabled} onCheckedChange={v => setPolicy(p => ({ ...p, suggestions: { ...p.suggestions, enabled: v } }))} /></div>
      <Text size="small" className="text-ui-fg-subtle">{policy.suggestions.enabled ? 'Muestra el carrusel "¿Te quedaste con ganas de agregar algo más?" arriba del checkout, con quick view para agregar sin salir.' : 'El checkout arranca directo en los pasos de la compra, sin carrusel de sugerencias.'}</Text>
    </div>
    <div className="flex items-center justify-between gap-4"><Label htmlFor="checkout-recipients">Destinatarios de productos</Label><Switch id="checkout-recipients" checked={policy.recipients.enabled} onCheckedChange={v => recipient('enabled', v)} /></div>
    <Text size="small" className="text-ui-fg-subtle">{policy.recipients.enabled ? 'Cada unidad alcanzada requiere DNI, nombre y apellido. Una persona puede asignarse a varias unidades.' : 'Capacidad desactivada. No se solicitan datos de destinatarios.'}</Text>
    <div className="space-y-2"><Label htmlFor="checkout-recipients-title">Título</Label><Input id="checkout-recipients-title" maxLength={100} placeholder="Destinatarios de productos" value={policy.sections?.recipients?.title ?? ''} onChange={e => setSection('recipients', 'title', e.target.value)} /></div>
    <div className="space-y-2"><Label htmlFor="checkout-recipients-subtitle">Subtítulo</Label><Textarea id="checkout-recipients-subtitle" maxLength={500} placeholder="Indicá quién recibirá cada unidad de tu compra." value={policy.sections?.recipients?.subtitle ?? ''} onChange={e => setSection('recipients', 'subtitle', e.target.value)} /></div>
    <div className="space-y-2"><Label>Productos alcanzados</Label><Select value={policy.recipients.scope} onValueChange={v => recipient('scope', v as 'all' | 'selected')}><Select.Trigger aria-label="Productos alcanzados"><Select.Value /></Select.Trigger><Select.Content><Select.Item value="all">Todos los productos</Select.Item><Select.Item value="selected">Productos seleccionados</Select.Item></Select.Content></Select></div>
    {policy.recipients.scope === 'selected' && <div className="space-y-2"><Label htmlFor="checkout-products">IDs de productos de esta tienda</Label><Textarea id="checkout-products" placeholder="prod_… (uno por línea)" value={productIds} onChange={e => setProductIds(e.target.value)} /><Text size="small" className="text-ui-fg-subtle">Se comprueba que cada producto pertenezca al catálogo de esta tienda.</Text></div>}
    <div className="space-y-2"><Label htmlFor="checkout-retention">Conservar datos de carritos abandonados (días)</Label><Input id="checkout-retention" type="number" min={1} max={90} value={policy.recipients.retention_days} onChange={e => recipient('retention_days', Number(e.target.value))} /><Text size="small" className="text-ui-fg-subtle">Al vencer, se elimina la información del checkout abandonado. Los pedidos conservan su histórico.</Text></div>
    <Text size="small">Documento: DNI argentino. La identidad del destinatario no reemplaza los datos del comprador ni de facturación.</Text>
    {error && <div role="alert" className="text-ui-fg-error"><Text>{error}</Text><Button variant="secondary" onClick={load}>Volver a cargar</Button></div>}
    <Button onClick={save} isLoading={saving} disabled={!version || saving}>Guardar checkout</Button>
  </div>;
}
