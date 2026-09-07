import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Gift } from '@medusajs/icons';
import { Badge, Button, Container, Drawer, Heading, Input, Label, Select, StatusBadge, Text, toast } from '@medusajs/ui';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  type GiftCardPermission,
  useGiftCardAction,
  useGiftCardAnalytics,
  useGiftCardDeliveries,
  useGiftCardDelivery,
  useGiftCardDesigns,
  useGiftCardPermissions,
} from '../../hooks/api/gift-cards';
import { type Design, errorMessage } from './helpers';

type Tab = 'deliveries' | 'designs' | 'analytics';
type Delivery = Record<string, any>;

const money = (value: number, currency = 'ARS') => new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: currency.toUpperCase(), maximumFractionDigits: 0,
}).format(Number(value) || 0);
const dateTime = (value?: string | Date | null) => value ? new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
const statusColor = (status?: string): 'green' | 'red' | 'orange' | 'grey' => ['sent', 'delivered', 'issued'].includes(status ?? '') ? 'green' : ['failed', 'dead_letter'].includes(status ?? '') ? 'red' : ['pending', 'processing', 'scheduled', 'awaiting_payment'].includes(status ?? '') ? 'orange' : 'grey';
// El admin corre contra el origen del backend, que no sirve los assets del
// storefront (p. ej. /images/gift-card-default.svg): un fallback self-contained
// evita 404 en la vista previa sin depender de rutas ajenas.
const FALLBACK_PREVIEW = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1580 1000"><rect width="1580" height="1000" rx="72" fill="#e4e4e7"/><text x="790" y="530" fill="#71717a" font-family="Arial,sans-serif" font-size="64" font-weight="700" text-anchor="middle">Sin imagen</text></svg>')}`;
const safeImageUrl = (value?: string | null) => {
  if (!value) return FALLBACK_PREVIEW;
  if (/^\/(?!\/)/.test(value) && !value.includes('\\')) return value;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.toString() : FALLBACK_PREVIEW; }
  catch { return FALLBACK_PREVIEW; }
};

function DeliveryDrawer({ id, canOperate, onClose }: { id?: string; canOperate: boolean; onClose: () => void }) {
  const detail = useGiftCardDelivery(id, Boolean(id));
  const action = useGiftCardAction();
  const delivery = detail.data?.delivery as Delivery | undefined;
  const [email, setEmail] = useState('');
  const [secureLink, setSecureLink] = useState('');
  useEffect(() => { setEmail(delivery?.recipient_email ?? ''); setSecureLink(''); }, [delivery?.id, delivery?.recipient_email]);
  const mutate = (path: string, body?: Record<string, unknown>) => action.mutate({ path, body }, {
    onSuccess: () => toast.success('Operación completada'), onError: (error) => toast.error(errorMessage(error)),
  });
  const obtainLink = () => id && action.mutate({ path: `/admin/gift-card-experience/deliveries/${id}/secure-link` }, {
    onSuccess: async (result) => {
      setSecureLink(String(result.url));
      try { await navigator.clipboard.writeText(String(result.url)); toast.success('Enlace auditado y copiado'); }
      catch { toast.info('Enlace generado. Podés copiarlo desde el campo.'); }
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  return <Drawer open={Boolean(id)} onOpenChange={(open) => !open && onClose()}>
    <Drawer.Content>
      <Drawer.Header><Drawer.Title>Detalle de entrega</Drawer.Title></Drawer.Header>
      <Drawer.Body className='flex flex-col gap-6 overflow-y-auto'>
        {detail.isLoading && <Text>Cargando…</Text>}
        {delivery && <>
          <div className='grid grid-cols-2 gap-3 rounded-lg border p-4 text-sm'>
            <div><Text size='xsmall' className='text-ui-fg-muted'>Orden</Text><Text>#{delivery.order_display_id ?? delivery.order_id}</Text></div>
            <div><Text size='xsmall' className='text-ui-fg-muted'>Unidad</Text><Text>{Number(delivery.unit_index) + 1}</Text></div>
            <div><Text size='xsmall' className='text-ui-fg-muted'>Valor</Text><Text>{money(delivery.face_value, delivery.currency_code)}</Text></div>
            <div><Text size='xsmall' className='text-ui-fg-muted'>Pagado</Text><Text>{money(delivery.paid_amount, delivery.currency_code)}</Text></div>
            <div><Text size='xsmall' className='text-ui-fg-muted'>Emisión</Text><StatusBadge color={statusColor(delivery.issuance_status)}>{delivery.issuance_status}</StatusBadge></div>
            <div><Text size='xsmall' className='text-ui-fg-muted'>Entrega</Text><StatusBadge color={statusColor(delivery.delivery_status)}>{delivery.delivery_status}</StatusBadge></div>
            <div><Text size='xsmall' className='text-ui-fg-muted'>Programada</Text><Text>{dateTime(delivery.scheduled_at)}</Text></div>
            <div><Text size='xsmall' className='text-ui-fg-muted'>Vencimiento</Text><Text>{dateTime(delivery.expires_at)}</Text></div>
            <div><Text size='xsmall' className='text-ui-fg-muted'>Primer uso</Text><Text>{dateTime(delivery.first_used_at)}</Text></div>
            <div><Text size='xsmall' className='text-ui-fg-muted'>Saldo agotado</Text><Text>{dateTime(delivery.exhausted_at)}</Text></div>
          </div>
          <div className='space-y-2'>
            <Heading level='h3'>Destinatario</Heading>
            <Text>{delivery.recipient_name || 'Sin nombre'} · {delivery.recipient_email || delivery.buyer_email}</Text>
            {delivery.sender_name && <Text size='small'>De: {delivery.anonymous ? 'Anónimo' : delivery.sender_name}</Text>}
            {delivery.message && <Text size='small' className='rounded-lg bg-ui-bg-subtle p-3'>{delivery.message}</Text>}
          </div>
          {canOperate && delivery.delivery_mode === 'recipient' && !['sent', 'delivered', 'canceled'].includes(delivery.delivery_status) && <form className='space-y-2' onSubmit={(event) => { event.preventDefault(); mutate(`/admin/gift-card-experience/deliveries/${id}`, { recipient_email: email }); }}>
            <Label htmlFor='delivery-recipient-email'>Cambiar email antes del envío</Label>
            <div className='flex gap-2'><Input id='delivery-recipient-email' type='email' required value={email} onChange={(event) => setEmail(event.target.value)} /><Button type='submit' variant='secondary' isLoading={action.isPending}>Guardar</Button></div>
          </form>}
          {canOperate && <div className='flex flex-wrap gap-2'>
            {['failed', 'dead_letter', 'sent'].includes(delivery.delivery_status) && <Button variant='secondary' onClick={() => mutate(`/admin/gift-card-experience/deliveries/${id}/retry`)}>Reenviar</Button>}
            {delivery.delivery_status === 'scheduled' && <Button variant='danger' onClick={() => mutate(`/admin/gift-card-experience/deliveries/${id}/cancel`)}>Cancelar notificación</Button>}
            {delivery.token_available !== false && <Button variant='secondary' onClick={obtainLink}>Obtener enlace seguro</Button>}
          </div>}
          {secureLink && <div className='space-y-2'><Label htmlFor='secure-link'>Enlace sensible generado</Label><Input id='secure-link' readOnly value={secureLink} onFocus={(event) => event.currentTarget.select()} /><Text size='xsmall' className='text-ui-fg-muted'>La obtención quedó registrada en el historial administrativo.</Text></div>}
          <div><Heading level='h3'>Intentos de entrega</Heading><div className='mt-2 space-y-2'>{(detail.data?.attempts ?? []).map((attempt) => <div className='rounded-lg border p-3' key={attempt.id}><div className='flex justify-between'><Text weight='plus'>Intento {attempt.attempt_no}</Text><StatusBadge color={statusColor(attempt.status)}>{attempt.status}</StatusBadge></div><Text size='xsmall'>{dateTime(attempt.attempted_at)} · {attempt.channel}</Text>{attempt.error && <Text size='xsmall' className='text-ui-fg-error'>{attempt.error}</Text>}</div>)}{!detail.data?.attempts?.length && <Text size='small' className='text-ui-fg-muted'>Sin intentos registrados.</Text>}</div></div>
          <div><Heading level='h3'>Historial</Heading><div className='mt-2 space-y-2'>{(detail.data?.events ?? []).map((event) => <div className='flex items-start justify-between gap-3 border-b py-2' key={event.id}><div><Text weight='plus'>{String(event.event).replaceAll('_', ' ')}</Text><Text size='xsmall' className='text-ui-fg-muted'>{event.actor_id ? `Admin: ${event.actor_id}` : 'Sistema'}</Text></div><Text size='xsmall'>{dateTime(event.occurred_at ?? event.created_at)}</Text></div>)}</div></div>
        </>}
      </Drawer.Body>
      <Drawer.Footer><Drawer.Close asChild><Button variant='secondary'>Cerrar</Button></Drawer.Close></Drawer.Footer>
    </Drawer.Content>
  </Drawer>;
}

function DesignDrawer({ design, onClose }: { design: Design | 'new' | null; onClose: () => void }) {
  const action = useGiftCardAction();
  const current = design === 'new' ? undefined : design ?? undefined;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const mobile = String(form.get('mobile_image_url') ?? '').trim();
    const body: Record<string, unknown> = {
      name: String(form.get('name') ?? '').trim(), occasion: String(form.get('occasion')),
      desktop_image_url: String(form.get('desktop_image_url') ?? '').trim(), text_color: String(form.get('text_color')),
      content_position: String(form.get('content_position')), sort_order: Number(form.get('sort_order')), active: form.get('active') === 'on',
      ...(mobile ? { mobile_image_url: mobile } : { mobile_image_url: null }),
      ...(!current ? { public_id: String(form.get('public_id') ?? '').trim() } : {}),
    };
    action.mutate({ path: current ? `/admin/gift-card-experience/designs/${current.id}` : '/admin/gift-card-experience/designs', body }, {
      onSuccess: () => { toast.success(current ? 'Diseño actualizado' : 'Diseño creado'); onClose(); },
      onError: (error) => toast.error(errorMessage(error)),
    });
  };
  return <Drawer open={Boolean(design)} onOpenChange={(open) => !open && onClose()}>
    <Drawer.Content>
      <Drawer.Header><Drawer.Title>{current ? 'Editar diseño' : 'Nuevo diseño'}</Drawer.Title></Drawer.Header>
      <form className='contents' key={current?.id ?? 'new'} onSubmit={submit}>
        <Drawer.Body className='flex flex-col gap-4 overflow-y-auto'>
          {!current && <div><Label htmlFor='design-public-id'>ID público</Label><Input id='design-public-id' name='public_id' required pattern='[a-z0-9][a-z0-9-]{1,119}' placeholder='birthday-01' /></div>}
          <div><Label htmlFor='design-name'>Nombre</Label><Input id='design-name' name='name' required maxLength={120} defaultValue={current?.name} /></div>
          <div><Label htmlFor='design-occasion'>Ocasión</Label><Select name='occasion' defaultValue={current?.occasion ?? 'general'}><Select.Trigger id='design-occasion'><Select.Value /></Select.Trigger><Select.Content>{['general', 'birthday', 'thanks', 'congratulations', 'holidays', 'brand'].map((item) => <Select.Item key={item} value={item}>{item}</Select.Item>)}</Select.Content></Select></div>
          <div><Label htmlFor='design-desktop'>Imagen desktop</Label><Input id='design-desktop' name='desktop_image_url' required defaultValue={current?.desktop_image_url} placeholder='/uploads/gift-cards/design.webp' /></div>
          <div><Label htmlFor='design-mobile'>Imagen mobile</Label><Input id='design-mobile' name='mobile_image_url' defaultValue={current?.mobile_image_url ?? ''} placeholder='Opcional; usa desktop si queda vacío' /></div>
          <div className='grid grid-cols-2 gap-3'><div><Label htmlFor='design-color'>Color de texto</Label><Input id='design-color' name='text_color' required pattern='#[0-9A-Fa-f]{6}' defaultValue={current?.text_color ?? '#FFFFFF'} /></div><div><Label htmlFor='design-order'>Orden</Label><Input id='design-order' name='sort_order' type='number' min={0} max={10000} defaultValue={current?.sort_order ?? 0} /></div></div>
          <div><Label htmlFor='design-position'>Posición del contenido</Label><Select name='content_position' defaultValue={current?.content_position ?? 'center'}><Select.Trigger id='design-position'><Select.Value /></Select.Trigger><Select.Content>{['top_left', 'top_center', 'top_right', 'center_left', 'center', 'center_right', 'bottom_left', 'bottom_center', 'bottom_right'].map((item) => <Select.Item key={item} value={item}>{item.replaceAll('_', ' ')}</Select.Item>)}</Select.Content></Select></div>
          <label className='flex items-center gap-3'><input type='checkbox' name='active' defaultChecked={current?.active ?? true} /><Text>Diseño activo</Text></label>
        </Drawer.Body>
        <Drawer.Footer><Button type='button' variant='secondary' onClick={onClose}>Cancelar</Button><Button type='submit' isLoading={action.isPending}>Guardar</Button></Drawer.Footer>
      </form>
    </Drawer.Content>
  </Drawer>;
}

function DeliveriesTab({ canOperate }: { canOperate: boolean }) {
  const [filters, setFilters] = useState({ delivery_status: '', issuance_status: '', order_id: '' });
  const [selectedId, setSelectedId] = useState<string>();
  const deliveries = useGiftCardDeliveries(filters);
  return <Container>
    <div className='flex items-center justify-between'><div><Heading level='h2'>Entregas</Heading><Text className='text-ui-fg-subtle'>{deliveries.data?.count ?? 0} unidades registradas</Text></div></div>
    <div className='mt-4 grid gap-3 md:grid-cols-3'>
      <Select value={filters.delivery_status || '__all__'} onValueChange={(value) => setFilters((current) => ({ ...current, delivery_status: value === '__all__' ? '' : value }))}><Select.Trigger><Select.Value placeholder='Estado de entrega' /></Select.Trigger><Select.Content><Select.Item value='__all__'>Todas las entregas</Select.Item>{['scheduled', 'pending', 'processing', 'sent', 'delivered', 'failed', 'dead_letter', 'canceled'].map((item) => <Select.Item key={item} value={item}>{item}</Select.Item>)}</Select.Content></Select>
      <Select value={filters.issuance_status || '__all__'} onValueChange={(value) => setFilters((current) => ({ ...current, issuance_status: value === '__all__' ? '' : value }))}><Select.Trigger><Select.Value placeholder='Estado de emisión' /></Select.Trigger><Select.Content><Select.Item value='__all__'>Todas las emisiones</Select.Item>{['awaiting_payment', 'processing', 'issued', 'failed', 'canceled'].map((item) => <Select.Item key={item} value={item}>{item}</Select.Item>)}</Select.Content></Select>
      <Input aria-label='Filtrar por ID de orden' value={filters.order_id} onChange={(event) => setFilters((current) => ({ ...current, order_id: event.target.value.trim() }))} placeholder='ID exacto de orden' />
    </div>
    <div className='mt-4 overflow-x-auto'><table className='w-full text-left text-sm'><thead><tr className='border-b'><th className='py-3'>Destinatario</th><th>Orden</th><th>Importe</th><th>Entrega</th><th>Emisión</th><th>Fecha</th></tr></thead><tbody>{(deliveries.data?.deliveries ?? []).map((delivery: Delivery) => <tr className='cursor-pointer border-b last:border-0 hover:bg-ui-bg-subtle' key={delivery.id} onClick={() => setSelectedId(delivery.id)}><td className='py-3'>{delivery.recipient_email ?? delivery.buyer_email}</td><td>#{delivery.order_display_id ?? delivery.order_id}</td><td>{money(delivery.face_value, delivery.currency_code)}</td><td><StatusBadge color={statusColor(delivery.delivery_status)}>{delivery.delivery_status}</StatusBadge></td><td><Badge>{delivery.issuance_status}</Badge></td><td>{dateTime(delivery.scheduled_at ?? delivery.created_at)}</td></tr>)}</tbody></table>{!deliveries.isLoading && !deliveries.data?.deliveries?.length && <Text className='py-8 text-center text-ui-fg-muted'>No hay entregas para estos filtros.</Text>}</div>
    <DeliveryDrawer id={selectedId} canOperate={canOperate} onClose={() => setSelectedId(undefined)} />
  </Container>;
}

function DesignsTab({ canEdit }: { canEdit: boolean }) {
  const designs = useGiftCardDesigns();
  const action = useGiftCardAction();
  const [editor, setEditor] = useState<Design | 'new' | null>(null);
  const archive = (design: Design) => action.mutate({ path: `/admin/gift-card-experience/designs/${design.id}`, method: 'DELETE' }, { onSuccess: () => toast.success('Diseño archivado'), onError: (error) => toast.error(errorMessage(error)) });
  return <Container>
    <div className='flex items-center justify-between gap-3'><div><Heading level='h2'>Diseños</Heading><Text className='text-ui-fg-subtle'>Las compras conservan una copia congelada del diseño.</Text></div>{canEdit && <Button onClick={() => setEditor('new')}>Nuevo diseño</Button>}</div>
    <div className='mt-4 grid gap-4 md:grid-cols-3'>{(designs.data?.designs ?? []).map((design: Design) => <article className='overflow-hidden rounded-lg border' key={design.id}><img alt={`Vista previa de ${design.name}`} className='aspect-[1.58/1] w-full object-cover' src={safeImageUrl(design.desktop_image_url)} onError={(event) => { const img = event.currentTarget; if (img.src !== FALLBACK_PREVIEW) img.src = FALLBACK_PREVIEW; }} /><div className='space-y-3 p-3'><div className='flex items-center justify-between'><div><Text weight='plus'>{design.name}</Text><Text size='xsmall' className='text-ui-fg-muted'>{design.public_id} · {design.occasion}</Text></div><StatusBadge color={design.active ? 'green' : 'grey'}>{design.active ? 'Activo' : 'Archivado'}</StatusBadge></div>{canEdit && <div className='flex gap-2'><Button size='small' variant='secondary' onClick={() => setEditor(design)}>Editar</Button>{design.active && <Button size='small' variant='danger' onClick={() => archive(design)}>Archivar</Button>}</div>}</div></article>)}</div>
    <DesignDrawer design={editor} onClose={() => setEditor(null)} />
  </Container>;
}

function AnalyticsTab() {
  const analytics = useGiftCardAnalytics(); const data = analytics.data?.analytics;
  const cards = [['Vendidas', data?.sold_count], ['Reclamadas', data?.claimed_count], ['Entregadas', data?.delivered_count], ['Primer uso', data?.first_use_count], ['Saldo agotado', data?.exhausted_count], ['Días al claim', (Number(data?.average_seconds_to_claim ?? 0) / 86_400).toFixed(1)], ['Días al primer uso', (Number(data?.average_seconds_to_first_use ?? 0) / 86_400).toFixed(1)]];
  return <Container><Heading level='h2'>Analytics</Heading><Text className='text-ui-fg-subtle'>Eventos operativos sin códigos ni PII.</Text><div className='mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>{cards.map(([label, value]) => <div className='rounded-lg border p-4' key={String(label)}><Text size='xsmall' className='text-ui-fg-muted'>{label}</Text><Text size='large' weight='plus'>{value ?? 0}</Text></div>)}</div>
    <Heading className='mt-8' level='h3'>Importes por moneda</Heading><div className='mt-3 grid gap-3 md:grid-cols-2'>{(data?.per_currency ?? []).map((row: any) => <div className='rounded-lg border p-4' key={row.currency_code}><Text weight='plus'>{String(row.currency_code).toUpperCase()}</Text><Text size='small'>Ticket promedio: {money(row.average_paid_amount, row.currency_code)}</Text><Text size='small'>Valor emitido: {money(row.face_value_total, row.currency_code)}</Text><Text size='small'>Pagado: {money(row.paid_total, row.currency_code)}</Text><Text size='small'>Bonificación de campañas: {money(row.campaign_bonus_total, row.currency_code)}</Text><Text size='small'>Saldo atribuido no utilizado: {money(row.unused_attributed_balance ?? row.unclaimed_face_value, row.currency_code)}</Text></div>)}</div>
    <Heading className='mt-8' level='h3'>Conversión por diseño</Heading><div className='mt-3 overflow-x-auto'><table className='w-full text-left text-sm'><thead><tr className='border-b'><th className='py-2'>Diseño</th><th>Compras</th><th>Claims</th><th>Conversión</th></tr></thead><tbody>{(data?.by_design ?? []).map((row: any) => <tr className='border-b' key={row.design_id}><td className='py-2'>{row.design_id}</td><td>{row.sold_count}</td><td>{row.claimed_count}</td><td>{Number(row.claim_rate ?? 0).toFixed(1)}%</td></tr>)}</tbody></table></div>
  </Container>;
}

/**
 * Pantalla principal de Gift Card Experience: entregas, diseños y métricas.
 *
 * La pestaña "Configuración" se mudó a `/gift-card-experience/settings`: la
 * pantalla principal es un listado de entregas y en este admin los ajustes de
 * una lista cuelgan del sidebar, no de una pestaña más (Blog, WhatsApp, GA4,
 * Compras recurrentes). El resto de las pestañas se queda acá: `populateMenus`
 * del dashboard deja el item padre navegable y le anida los hijos por jerarquía
 * de path, así que no hace falta convertir esto en un redirect ni explotar
 * Entregas / Diseños / Analytics en tres rutas — eso ya sería reescribir la
 * pantalla, no mover la configuración.
 */
const GiftCardExperiencePage = () => {
  const navigate = useNavigate(); const access = useGiftCardPermissions();
  const permissions = access.data?.permissions ?? [];
  const has = (permission: GiftCardPermission) => permissions.includes(permission);
  const tabs = useMemo(() => ([
    ...(has('gift_cards.read') ? [{ id: 'deliveries' as const, label: 'Entregas' }, { id: 'designs' as const, label: 'Diseños' }] : []),
    ...(has('gift_cards.metrics') ? [{ id: 'analytics' as const, label: 'Analytics' }] : []),
  ]), [permissions.join('|')]);
  const [tab, setTab] = useState<Tab>('deliveries');
  useEffect(() => { if (tabs.length && !tabs.some((item) => item.id === tab)) setTab(tabs[0].id); }, [tabs, tab]);
  if (access.isLoading) return <Container><Text>Verificando permisos…</Text></Container>;
  return <div className='flex flex-col gap-y-4'>
    <Container><div className='flex flex-wrap items-center justify-between gap-3'><div><Heading level='h1'>Gift Card Experience</Heading><Text className='text-ui-fg-subtle'>Diseño, entrega y métricas. El valor monetario permanece en el plugin oficial.</Text></div><Button variant='secondary' onClick={() => navigate('/gift-cards')}>Tarjetas oficiales</Button></div><div className='mt-5 flex flex-wrap gap-2'>{tabs.map((item) => <Button key={item.id} onClick={() => setTab(item.id)} variant={tab === item.id ? 'primary' : 'secondary'}>{item.label}</Button>)}</div></Container>
    {tab === 'deliveries' && has('gift_cards.read') && <DeliveriesTab canOperate={has('gift_cards.deliveries')} />}
    {tab === 'designs' && has('gift_cards.read') && <DesignsTab canEdit={has('gift_cards.designs')} />}
    {tab === 'analytics' && has('gift_cards.metrics') && <AnalyticsTab />}
  </div>;
};

export default GiftCardExperiencePage;
export const config = defineRouteConfig({ label: 'Gift Card Experience', icon: Gift });

// Breadcrumb en la cabecera. Antes no hacía falta porque la ruta era una sola;
// ahora que hay una hija, sin esto la migaja del padre queda vacía.
export const handle = {
  breadcrumb: () => 'Gift Card Experience',
};
