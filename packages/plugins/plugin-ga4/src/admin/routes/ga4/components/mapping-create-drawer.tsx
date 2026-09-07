import { Button, Drawer, Heading, Label, Switch, Text, toast } from '@medusajs/ui';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCreateGa4Mapping, useSupportedEvents } from '../../../hooks/api/ga4-mappings';
import { registerGa4EventsTranslations } from '../../../translations/ga4-events';
import { AdvancedParams } from './advanced-params';
import { MappingEventFields } from './mapping-event-fields';
import { emptyParamRow, fromParamRows, type ParamRow } from './param-mappings-editor';

export const MappingCreateDrawer = () => {
  const { t, i18n } = useTranslation('ga4Events');
  registerGa4EventsTranslations(i18n);
  const [open, setOpen] = useState(false);
  const [medusaEvent, setMedusaEvent] = useState('');
  const [ga4EventName, setGa4EventName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [paramRows, setParamRows] = useState<ParamRow[]>([emptyParamRow()]);

  const { data: eventsData } = useSupportedEvents({ enabled: open });
  const events = eventsData?.events ?? [];
  const categories = eventsData?.categories ?? [];

  const selectedEvent = useMemo(
    () => events.find((e) => e.medusa_event === medusaEvent),
    [events, medusaEvent]
  );

  const { mutateAsync: createMapping, isPending } = useCreateGa4Mapping({
    onSuccess: () => {
      toast.success(t('CREATE_SUCCESS'));
      setOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(t('CREATE_ERROR', { msg: error.message }));
    },
  });

  const resetForm = () => {
    setMedusaEvent('');
    setGa4EventName('');
    setIsActive(true);
    setParamRows([emptyParamRow()]);
  };

  const handleEventChange = (value: string) => {
    setMedusaEvent(value);
    // Default the GA4 event name to the suggestion only when the field is empty.
    if (!ga4EventName) {
      const suggestion = events.find((e) => e.medusa_event === value)?.suggested_ga4;
      if (suggestion) setGa4EventName(suggestion);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medusaEvent || !ga4EventName) {
      toast.error(t('VALIDATION_REQUIRED'));
      return;
    }
    await createMapping({
      medusa_event: medusaEvent,
      ga4_event_name: ga4EventName,
      is_active: isActive,
      param_mappings: fromParamRows(paramRows),
    });
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>
        <Button variant="secondary" size="small">
          {t('CREATE_BUTTON')}
        </Button>
      </Drawer.Trigger>
      <Drawer.Content>
        <Drawer.Header>
          <Heading>{t('CREATE_TITLE')}</Heading>
        </Drawer.Header>
        <Drawer.Body className="overflow-y-auto p-4">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <MappingEventFields
              events={events}
              categories={categories}
              medusaEvent={medusaEvent}
              onMedusaEventChange={handleEventChange}
              ga4EventName={ga4EventName}
              onGa4EventNameChange={setGa4EventName}
            />
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="is_active">{t('FIELD_ACTIVE_LABEL')}</Label>
                <Text size="small" className="text-ui-fg-subtle">
                  {t('FIELD_ACTIVE_HELP')}
                </Text>
              </div>
              <Switch id="is_active" checked={isActive} onCheckedChange={setIsActive} />
            </div>
            <AdvancedParams
              rows={paramRows}
              onChange={setParamRows}
              suggestedParams={selectedEvent?.params}
            />
          </form>
        </Drawer.Body>
        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button variant="secondary">{t('CANCEL')}</Button>
          </Drawer.Close>
          <Button onClick={handleSubmit} isLoading={isPending}>
            {t('CREATE_SUBMIT')}
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};
