import { Button, Drawer, Heading, Input, Label, Switch, Text, toast, usePrompt } from '@medusajs/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ga4Builtin, useUpdateGa4Builtin } from '../../../hooks/api/ga4-mappings';
import { registerGa4EventsTranslations } from '../../../translations/ga4-events';
import { EventRationale } from './event-rationale';

interface BuiltinEditDrawerProps {
  builtin: Ga4Builtin;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Drawer de edición de un evento ecommerce built-in. Solo permite activar/
 * desactivar y renombrar el evento GA4 — el payload (ítems, valor) lo arma el
 * código automáticamente, así que no hay editor de parámetros.
 */
export const BuiltinEditDrawer = ({ builtin, open, onOpenChange }: BuiltinEditDrawerProps) => {
  const { t, i18n } = useTranslation('ga4Events');
  registerGa4EventsTranslations(i18n);
  const prompt = usePrompt();

  const [ga4EventName, setGa4EventName] = useState(builtin.ga4_event_name);
  const [isActive, setIsActive] = useState(builtin.is_active);

  useEffect(() => {
    if (open) {
      setGa4EventName(builtin.ga4_event_name);
      setIsActive(builtin.is_active);
    }
  }, [open, builtin]);

  // El success toast depende de qué patch se mandó: renombrar/activar vs.
  // ocultar (soft-delete), así el mismo hook sirve para ambas acciones.
  const { mutateAsync: updateBuiltin, isPending } = useUpdateGa4Builtin(builtin.builtin_key, {
    onSuccess: (_data, variables) => {
      toast.success(variables.hidden ? t('HIDE_BUILTIN_SUCCESS') : t('UPDATE_SUCCESS'));
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(t('UPDATE_ERROR', { msg: error.message }));
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ga4EventName.trim()) {
      toast.error(t('VALIDATION_REQUIRED'));
      return;
    }
    await updateBuiltin({ is_active: isActive, ga4_event_name: ga4EventName.trim() });
  };

  const handleDelete = async () => {
    const confirmed = await prompt({
      title: t('HIDE_BUILTIN_PROMPT_TITLE'),
      description: t('HIDE_BUILTIN_PROMPT_DESC'),
      confirmText: t('DELETE_PROMPT_CONFIRM'),
      cancelText: t('DELETE_PROMPT_CANCEL'),
    });

    if (confirmed) {
      await updateBuiltin({ hidden: true });
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content>
        <Drawer.Header>
          <Heading>{t(`BUILTIN.${builtin.builtin_key}.TITLE`, { defaultValue: builtin.builtin_key })}</Heading>
        </Drawer.Header>
        <Drawer.Body className="overflow-y-auto p-4">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1 rounded-lg bg-ui-bg-subtle px-3 py-2">
              <code className="txt-compact-small text-ui-fg-muted">{builtin.trigger_event}</code>
              <Text size="small" className="text-ui-fg-subtle">
                {t(`BUILTIN.${builtin.builtin_key}.DESC`, { defaultValue: '' })}
              </Text>
            </div>
            <EventRationale whyKey={builtin.builtin_key} />
            <div className="flex flex-col gap-2">
              <Label htmlFor="builtin-ga4-event-name">{t('FIELD_GA4_EVENT_LABEL')}</Label>
              <Input
                id="builtin-ga4-event-name"
                value={ga4EventName}
                onChange={(e) => setGa4EventName(e.target.value)}
                required
              />
              <Text size="small" className="text-ui-fg-subtle">
                {t('BUILTIN_NOTE')}
              </Text>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="builtin-is-active">{t('FIELD_ACTIVE_LABEL')}</Label>
                <Text size="small" className="text-ui-fg-subtle">
                  {t('FIELD_ACTIVE_HELP')}
                </Text>
              </div>
              <Switch id="builtin-is-active" checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </form>
        </Drawer.Body>
        <Drawer.Footer className="flex items-center justify-between">
          {/* Los eventos automáticos no se pueden borrar de verdad (son parte
              del código), pero sí se pueden ocultar: dejan de listarse y de
              dispararse, y se pueden restaurar después. */}
          <Button variant="danger" onClick={handleDelete} isLoading={isPending}>
            {t('ACTION_DELETE')}
          </Button>
          <div className="flex items-center gap-2">
            <Drawer.Close asChild>
              <Button variant="secondary">{t('CANCEL')}</Button>
            </Drawer.Close>
            <Button onClick={handleSubmit} isLoading={isPending}>
              {t('EDIT_SUBMIT')}
            </Button>
          </div>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};
