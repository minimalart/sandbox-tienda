import {
  Button,
  Container,
  Heading,
  Input,
  Label,
  Select,
  Switch,
  Text,
  toast,
} from '@medusajs/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSettings, useUpdateAppSettings } from '../../hooks/api/app-settings';
import { useActiveSite } from '../../hooks/use-active-site';
import { SettingsSiteContext } from './settings-site-context';
import descriptor from '../../../modules/app-settings/descriptors/abandoned-cart';

const resources = {
  en: {
    title: 'Abandoned cart settings',
    description:
      'Changes apply without restarting. Each store uses its own settings. Cron schedules use UTC.',
    save: 'Save',
    saved: 'Settings saved',
    error: 'Unable to save settings',
    loadError: 'Unable to load settings',
    retry: 'Retry',
    loading: 'Loading…',
    enabled: 'Recovery enabled',
    cron: 'Schedule (UTC)',
    age: 'Recovery window (hours)',
    batch: 'Carts per page',
    pages: 'Pages per run',
    step: 'Step {{step}}',
    hours: 'Hours since last activity',
    email: 'Email template key',
    whatsapp: 'Approved WhatsApp template name',
    none: 'Disabled',
    custom: 'Use a template',
    templates:
      'Use a published email template key or an approved WhatsApp template name for this store.',
    order: 'Use increasing step times within the recovery window.',
    discard: 'Discard',
    reset: 'Restore inherited settings',
  },
  es: {
    title: 'Configuración de carritos abandonados',
    description:
      'Los cambios se aplican sin reiniciar. Cada tienda usa su configuración. Los cron usan UTC.',
    save: 'Guardar',
    saved: 'Configuración guardada',
    error: 'No se pudo guardar la configuración',
    loadError: 'No se pudo cargar la configuración',
    retry: 'Reintentar',
    loading: 'Cargando…',
    enabled: 'Recuperación activa',
    cron: 'Programación (UTC)',
    age: 'Ventana de recuperación (horas)',
    batch: 'Carritos por página',
    pages: 'Páginas por corrida',
    step: 'Paso {{step}}',
    hours: 'Horas desde la última actividad',
    email: 'Clave de plantilla de email',
    whatsapp: 'Nombre de plantilla aprobada de WhatsApp',
    none: 'Desactivado',
    custom: 'Usar una plantilla',
    templates:
      'Usá la clave de una plantilla de email publicada o el nombre de una plantilla de WhatsApp aprobada para esta tienda.',
    order: 'Los tiempos deben ser crecientes y estar dentro de la ventana de recuperación.',
    discard: 'Descartar',
    reset: 'Restaurar valores heredados',
  },
};

export default function AbandonedCartSettings({
  siteId,
  hideSiteContext = false,
  hideHeader = false,
}: {
  siteId?: string | null;
  hideSiteContext?: boolean;
  hideHeader?: boolean;
}) {
  const { i18n } = useTranslation();
  for (const [language, strings] of Object.entries(resources))
    if (!i18n.hasResourceBundle(language, 'abandonedCartSettings'))
      i18n.addResourceBundle(language, 'abandonedCartSettings', strings);
  const { t } = useTranslation('abandonedCartSettings');
  const { activeId } = useActiveSite();
  // Remount the form on a store change, preserving no draft from another store.
  const scopeId = siteId === undefined ? activeId : siteId;
  return (
    <SettingsForm
      key={scopeId ?? '*'}
      siteId={scopeId}
      t={t}
      hideSiteContext={hideSiteContext}
      hideHeader={hideHeader}
    />
  );
}

function SettingsForm({
  siteId,
  t,
  hideSiteContext,
  hideHeader,
}: {
  siteId: string | null;
  t: (key: string, options?: any) => string;
  hideSiteContext: boolean;
  hideHeader: boolean;
}) {
  const { data, isPending, isError, refetch } = useAppSettings(descriptor.namespace, siteId);
  const { mutateAsync: save, isPending: saving } = useUpdateAppSettings(siteId);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  useEffect(() => {
    setDraft({});
  }, [data]);
  const current = Object.fromEntries(
    (data?.settings ?? []).map((setting) => [setting.key, setting.value])
  );
  const value = (key: string) => {
    const rule = descriptor.settings.find((setting) => setting.key === key);
    return (
      draft[key] ??
      current[key] ??
      (key.includes('_TEMPLATE_') ? 'none' : rule?.type === 'boolean' ? false : rule?.default)
    );
  };
  const change = (key: string, next: unknown) =>
    setDraft((previous) => ({ ...previous, [key]: next }));
  const dirty = Object.keys(draft).length > 0;
  const submit = async (reset = false) => {
    const values = Object.fromEntries(
      descriptor.settings.map((setting) => [setting.key, value(setting.key) ?? setting.default])
    );
    const hours = [1, 2, 3].map((step) => Number(values[`ABANDONED_CART_STEP${step}_HOURS`]));
    if (
      !reset &&
      !(
        hours[0]! < hours[1]! &&
        hours[1]! < hours[2]! &&
        hours[2]! <= Number(values.ABANDONED_CART_MAX_AGE_HOURS)
      )
    ) {
      toast.error(t('order'));
      return;
    }
    try {
      await save(
        reset
          ? {
              namespace: descriptor.namespace,
              unset: descriptor.settings.map((setting) => setting.key),
            }
          : { namespace: descriptor.namespace, values }
      );
      setDraft({});
      toast.success(t('saved'));
    } catch (error) {
      toast.error(t('error'), { description: (error as Error).message });
    }
  };
  const field = (suffix: string, label: string, type = 'number') => {
    const key = `ABANDONED_CART_${suffix}`;
    const rule = descriptor.settings.find((setting) => setting.key === key)!;
    return (
      <div className="flex flex-col gap-y-2">
        <Label htmlFor={key}>{label}</Label>
        <Input
          id={key}
          type={type}
          min={rule.min}
          max={rule.max}
          step={1}
          value={String(value(key) ?? '')}
          onChange={(event) =>
            change(
              key,
              type === 'number'
                ? event.target.value === ''
                  ? ''
                  : Number(event.target.value)
                : event.target.value
            )
          }
        />
      </div>
    );
  };
  const template = (channel: string, step: number) => {
    const key = `ABANDONED_CART_${channel}_TEMPLATE_${step}`;
    const selected = String(value(key) ?? 'none');
    const enabled = selected !== 'none';
    return (
      <div className="flex flex-col gap-y-2">
        <Label htmlFor={key}>{t(channel.toLowerCase())}</Label>
        <Select
          value={enabled ? 'custom' : 'none'}
          onValueChange={(next) =>
            change(
              key,
              next === 'none' ? 'none' : channel === 'EMAIL' ? `cart-abandoned-${step}` : ''
            )
          }
        >
          <Select.Trigger aria-label={t(channel.toLowerCase())}>
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="none">{t('none')}</Select.Item>
            <Select.Item value="custom">{t('custom')}</Select.Item>
          </Select.Content>
        </Select>
        {enabled && (
          <Input
            id={key}
            value={selected}
            maxLength={200}
            onChange={(event) => change(key, event.target.value)}
          />
        )}
      </div>
    );
  };
  return (
    <Container className="p-0">
      {!hideHeader && (
        <div className="px-6 py-4">
          <Heading>{t('title')}</Heading>
          <Text className="text-ui-fg-subtle mt-2">{t('description')}</Text>
        </div>
      )}
      {!hideSiteContext && <SettingsSiteContext descriptors={descriptor.settings} dirty={dirty} />}
      {isPending ? (
        <Text className="p-6">{t('loading')}</Text>
      ) : isError ? (
        <div className="p-6">
          <Text>{t('loadError')}</Text>
          <Button variant="secondary" onClick={() => refetch()}>
            {t('retry')}
          </Button>
        </div>
      ) : (
        <fieldset disabled={saving} className="flex flex-col gap-y-6 px-6 py-4">
          <div className="flex items-center gap-x-3">
            <Switch
              id="recovery-enabled"
              checked={value('ABANDONED_CART_ENABLED') === true}
              onCheckedChange={(enabled) => change('ABANDONED_CART_ENABLED', enabled)}
            />
            <Label htmlFor="recovery-enabled">{t('enabled')}</Label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {field('SCAN_CRON', t('cron'), 'text')}
            {field('MAX_AGE_HOURS', t('age'))}
            {field('BATCH_SIZE', t('batch'))}
            {field('MAX_PAGES', t('pages'))}
          </div>
          <Text className="text-ui-fg-subtle">{t('templates')}</Text>
          {[1, 2, 3].map((step) => (
            <div key={step} className="border-t border-ui-border-base pt-4">
              <Heading level="h2">{t('step', { step })}</Heading>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {field(`STEP${step}_HOURS`, t('hours'))}
                {template('EMAIL', step)}
                {template('WHATSAPP', step)}
              </div>
            </div>
          ))}
        </fieldset>
      )}
      <div className="flex flex-wrap justify-end gap-2 border-t border-ui-border-base px-6 py-3">
        <Button
          variant="secondary"
          disabled={saving || isPending || isError}
          onClick={() => submit(true)}
        >
          {t('reset')}
        </Button>
        <Button variant="secondary" disabled={!dirty || saving} onClick={() => setDraft({})}>
          {t('discard')}
        </Button>
        <Button
          disabled={!dirty || isPending || isError}
          isLoading={saving}
          onClick={() => submit()}
        >
          {t('save')}
        </Button>
      </div>
    </Container>
  );
}
