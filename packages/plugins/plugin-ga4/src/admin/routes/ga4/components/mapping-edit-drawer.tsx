import { Button, Drawer, Heading, Label, Switch, Text, toast, usePrompt } from '@medusajs/ui';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Ga4Mapping,
  useDeleteGa4Mapping,
  useGa4Mapping,
  useSupportedEvents,
  useUpdateGa4Mapping,
} from '../../../hooks/api/ga4-mappings';
import { registerGa4EventsTranslations } from '../../../translations/ga4-events';
import { AdvancedParams } from './advanced-params';
import { MappingEventFields } from './mapping-event-fields';
import { emptyParamRow, fromParamRows, type ParamRow, toParamRows } from './param-mappings-editor';

interface MappingEditDrawerProps {
  mapping: Ga4Mapping;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const MappingEditDrawer = ({ mapping, open, onOpenChange }: MappingEditDrawerProps) => {
  const { t, i18n } = useTranslation('ga4Events');
  registerGa4EventsTranslations(i18n);
  const prompt = usePrompt();

  // Pull a fresh detail from the backend on open (falling back to the row object)
  // so the form always populates with the full mapping even if the list payload
  // was partial or stale.
  const { data: detail } = useGa4Mapping(mapping.id, undefined, { enabled: open });
  const source = detail?.ga4_mapping ?? mapping;

  const { data: eventsData } = useSupportedEvents({ enabled: open });
  const events = eventsData?.events ?? [];
  const categories = eventsData?.categories ?? [];

  const [medusaEvent, setMedusaEvent] = useState(mapping.medusa_event);
  const [ga4EventName, setGa4EventName] = useState(mapping.ga4_event_name);
  const [isActive, setIsActive] = useState(mapping.is_active);
  const [paramRows, setParamRows] = useState<ParamRow[]>(toParamRows(mapping.param_mappings));

  const selectedEvent = useMemo(
    () => events.find((e) => e.medusa_event === medusaEvent),
    [events, medusaEvent]
  );

  const { mutateAsync: updateMapping, isPending } = useUpdateGa4Mapping(mapping.id, {
    onSuccess: () => {
      toast.success(t('UPDATE_SUCCESS'));
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(t('UPDATE_ERROR', { msg: error.message }));
    },
  });

  const { mutateAsync: deleteMapping, isPending: isDeleting } = useDeleteGa4Mapping(mapping.id, {
    onSuccess: () => {
      toast.success(t('DELETE_SUCCESS'));
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(t('DELETE_ERROR', { msg: error.message }));
    },
  });

  const handleDelete = async () => {
    const confirmed = await prompt({
      title: t('DELETE_PROMPT_TITLE'),
      description: t('DELETE_PROMPT_DESCRIPTION', { event: mapping.medusa_event }),
      confirmText: t('DELETE_PROMPT_CONFIRM'),
      cancelText: t('DELETE_PROMPT_CANCEL'),
    });

    if (confirmed) {
      await deleteMapping();
    }
  };

  useEffect(() => {
    if (open) {
      setMedusaEvent(source.medusa_event ?? '');
      setGa4EventName(source.ga4_event_name ?? '');
      setIsActive(source.is_active ?? true);
      const rows = toParamRows(source.param_mappings);
      setParamRows(rows.length > 0 ? rows : [emptyParamRow()]);
    }
  }, [open, source]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medusaEvent || !ga4EventName) {
      toast.error(t('VALIDATION_REQUIRED'));
      return;
    }
    await updateMapping({
      medusa_event: medusaEvent,
      ga4_event_name: ga4EventName,
      is_active: isActive,
      param_mappings: fromParamRows(paramRows),
    });
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content>
        <Drawer.Header>
          <Heading>{t('EDIT_TITLE')}</Heading>
        </Drawer.Header>
        <Drawer.Body className="overflow-y-auto p-4">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <MappingEventFields
              events={events}
              categories={categories}
              medusaEvent={medusaEvent}
              onMedusaEventChange={setMedusaEvent}
              ga4EventName={ga4EventName}
              onGa4EventNameChange={setGa4EventName}
            />
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="edit-is-active">{t('FIELD_ACTIVE_LABEL')}</Label>
                <Text size="small" className="text-ui-fg-subtle">
                  {t('FIELD_ACTIVE_HELP')}
                </Text>
              </div>
              <Switch id="edit-is-active" checked={isActive} onCheckedChange={setIsActive} />
            </div>
            <AdvancedParams
              rows={paramRows}
              onChange={setParamRows}
              suggestedParams={selectedEvent?.params}
            />
          </form>
        </Drawer.Body>
        <Drawer.Footer className="flex items-center justify-between">
          <Button variant="danger" onClick={handleDelete} isLoading={isDeleting}>
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
