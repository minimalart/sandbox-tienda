import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Button, Container, Heading, Input, Label, Select, Switch, Text, Textarea, toast } from '@medusajs/ui';
import { useEffect, useState, type FormEvent } from 'react';
import {
  ExtensionSettingsCard,
  HelpDrawer,
  SingleColumnLayout,
} from '@minimalart/mercatto-plugin-runtime/admin';
import {
  useGiftCardAction,
  useGiftCardDesigns,
  useGiftCardPermissions,
  useGiftCardSettings,
} from '../../../hooks/api/gift-cards';
import { type Design, errorMessage } from '../helpers';

/**
 * Configuración de Gift Card Experience: era la pestaña `settings` de la
 * pantalla principal y pasó a ser sub-página del sidebar, porque la pantalla
 * principal es un listado de entregas y en este admin los ajustes de una lista
 * cuelgan del menú (Blog, WhatsApp, GA4, Compras recurrentes).
 *
 * El chequeo de permiso se repite acá y no se hereda de la pantalla padre: el
 * sidebar de Medusa no conoce el RBAC, así que este item se le muestra a
 * cualquiera con acceso al admin. Como pestaña alcanzaba con no renderizar el
 * tab; como ruta propia hay que cerrarla en la propia página. El backend ya
 * exige `gift_cards.settings` en `api/admin/gift-card-experience/middlewares.ts`
 * — esto sólo evita mostrar un formulario que va a fallar al guardar.
 */
const GiftCardSettingsPage = () => {
  const access = useGiftCardPermissions();
  const permissions = access.data?.permissions ?? [];
  const allowed = permissions.includes('gift_cards.settings');

  const settings = useGiftCardSettings(allowed);
  const designs = useGiftCardDesigns(allowed);
  const action = useGiftCardAction();
  const [enabled, setEnabled] = useState(false);
  const [fallback, setFallback] = useState(true);
  useEffect(() => { if (settings.data?.settings) { setEnabled(Boolean(settings.data.settings.enabled)); setFallback(Boolean(settings.data.settings.fallback_to_buyer)); } }, [settings.data?.settings]);

  if (access.isLoading) return <Container><Text>Verificando permisos…</Text></Container>;
  if (!allowed) return <Container><Heading level='h1'>Configuración</Heading><Text className='text-ui-fg-subtle'>No tenés el permiso <code>gift_cards.settings</code>.</Text></Container>;
  if (!settings.data?.settings) return <Container><Text>Cargando configuración…</Text></Container>;

  const current = settings.data.settings;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const retries = String(form.get('retry_delays') ?? '').split(',').map((value) => Number(value.trim()));
    if (retries.length !== 5 || retries.some((value) => !Number.isInteger(value) || value < 1)) { toast.error('Los reintentos deben contener exactamente cinco minutos enteros positivos.'); return; }
    const nullableNumber = (name: string) => String(form.get(name) ?? '').trim() ? Number(form.get(name)) : null;
    const nullableText = (name: string) => String(form.get(name) ?? '').trim() || null;
    action.mutate({ path: '/admin/gift-card-experience/settings', body: {
      enabled, fallback_to_buyer: fallback, timezone: String(form.get('timezone')), morning_time: String(form.get('morning_time')), afternoon_time: String(form.get('afternoon_time')), evening_time: String(form.get('evening_time')),
      schedule_horizon_days: Number(form.get('schedule_horizon_days')), default_expiry_days: nullableNumber('default_expiry_days'), default_design_id: String(form.get('default_design_id')), retry_delays_minutes: retries,
      balance_reminder_days: nullableNumber('balance_reminder_days'), expiring_notice_days: nullableNumber('expiring_notice_days'), legal_text: nullableText('legal_text'), terms_url: nullableText('terms_url'), merchandising_url: nullableText('merchandising_url'),
    } }, { onSuccess: () => toast.success('Configuración guardada'), onError: (error) => toast.error(errorMessage(error)) });
  };
  const retryValues = Array.isArray(current.retry_delays_minutes?.delays) ? current.retry_delays_minutes.delays.join(', ') : '1, 5, 30, 120, 720';
  return <SingleColumnLayout><Container>
    <div className='flex items-center justify-between'><Heading level='h1'>Configuración</Heading><HelpDrawer slug='gift-cards' /></div>
    <form className='mt-4 grid max-w-3xl gap-5' onSubmit={submit}>
    <div className='flex items-center justify-between rounded-lg border p-4'><div><Text weight='plus'>Extensión operativa</Text><Text size='small' className='text-ui-fg-muted'>Controla emisión propia, jobs y experiencia.</Text></div><Switch checked={enabled} onCheckedChange={setEnabled} /></div>
    <div className='grid gap-4 md:grid-cols-2'><div><Label htmlFor='settings-timezone'>Zona horaria</Label><Input id='settings-timezone' name='timezone' defaultValue={current.timezone} /></div><div><Label htmlFor='settings-design'>Diseño predeterminado</Label><Select name='default_design_id' defaultValue={current.default_design_id}><Select.Trigger id='settings-design'><Select.Value /></Select.Trigger><Select.Content>{(designs.data?.designs ?? []).map((design: Design) => <Select.Item key={design.public_id} value={design.public_id}>{design.name}</Select.Item>)}</Select.Content></Select></div></div>
    {/* `as const` y no `string[][]`: destructurar un array suelto da `string | undefined`
        en cada elemento —el tuple siempre tiene dos, pero el tipo no lo dice— y `name`
        terminaba indexando `current` con un posible `undefined`. Es el mismo TS2538 que
        arrastra `catalogador/config/page.tsx:34`; acá no se replica. */}
    <div className='grid gap-4 md:grid-cols-3'>{([['morning_time', 'Mañana'], ['afternoon_time', 'Tarde'], ['evening_time', 'Noche']] as const).map(([name, label]) => <div key={name}><Label htmlFor={`settings-${name}`}>{label}</Label><Input id={`settings-${name}`} name={name} type='time' defaultValue={current[name]} /></div>)}</div>
    <div className='grid gap-4 md:grid-cols-2'><div><Label htmlFor='settings-horizon'>Programación máxima (días)</Label><Input id='settings-horizon' name='schedule_horizon_days' type='number' min={1} max={365} defaultValue={current.schedule_horizon_days} /></div><div><Label htmlFor='settings-expiry'>Vigencia predeterminada (días)</Label><Input id='settings-expiry' name='default_expiry_days' type='number' min={1} max={3650} defaultValue={current.default_expiry_days ?? ''} placeholder='Sin vencimiento' /></div></div>
    <div><Label htmlFor='settings-retries'>Reintentos en minutos</Label><Input id='settings-retries' name='retry_delays' defaultValue={retryValues} /><Text size='xsmall' className='text-ui-fg-muted'>Exactamente cinco valores separados por coma.</Text></div>
    <div className='grid gap-4 md:grid-cols-2'><div><Label htmlFor='settings-reminder'>Recordar saldo después de (días)</Label><Input id='settings-reminder' name='balance_reminder_days' type='number' min={1} max={3650} defaultValue={current.balance_reminder_days ?? ''} placeholder='Desactivado' /></div><div><Label htmlFor='settings-expiring'>Avisar vencimiento con anticipación (días)</Label><Input id='settings-expiring' name='expiring_notice_days' type='number' min={1} max={365} defaultValue={current.expiring_notice_days ?? ''} placeholder='Desactivado' /></div></div>
    <div className='flex items-center justify-between rounded-lg border p-4'><div><Text weight='plus'>Avisar al comprador si falla la entrega</Text><Text size='small' className='text-ui-fg-muted'>Se envía una única notificación al pasar a dead letter.</Text></div><Switch checked={fallback} onCheckedChange={setFallback} /></div>
    <div><Label htmlFor='settings-legal'>Texto legal</Label><Textarea id='settings-legal' name='legal_text' maxLength={5000} defaultValue={current.legal_text ?? ''} /></div>
    <div className='grid gap-4 md:grid-cols-2'><div><Label htmlFor='settings-terms'>URL de términos</Label><Input id='settings-terms' name='terms_url' defaultValue={current.terms_url ?? ''} placeholder='https://…' /></div><div><Label htmlFor='settings-merchandising'>Destino de merchandising</Label><Input id='settings-merchandising' name='merchandising_url' defaultValue={current.merchandising_url ?? ''} placeholder='/collections/regalos' /></div></div>
    <Button type='submit' className='w-fit' isLoading={action.isPending}>Guardar configuración</Button>
  </form></Container>
    {/*
      Variables de despliegue: DB cifrada > env > default. Vive dentro de esta
      pantalla y no en la cabecera porque la pantalla ya está detrás del permiso
      `gift_cards.settings` — el secreto de SendGrid no lo ve cualquiera.

      `description` de UNA oración. Que lo guardado acá pise el entorno vale para las
      ~27 cards del admin y no es lo que hay que saber de ÉSTA: el drawer explica que
      este interruptor se combina con "Extensión operativa" de arriba con AND —hacen
      falta los dos— y que la emisión igual exige una orden COBRADA.
    */}
    <ExtensionSettingsCard
      namespace='extension:gift-cards'
      title='Entorno y credenciales'
      description='Interruptor general de la extensión y clave del webhook de SendGrid.'
    />
  </SingleColumnLayout>;
};

export const config = defineRouteConfig({
  label: 'Configuración',
});

export const handle = {
  breadcrumb: () => 'Configuración',
};

export default GiftCardSettingsPage;
