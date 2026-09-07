import { Input, Label, Text } from '@medusajs/ui';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Ga4EventCategory, Ga4SupportedEvent } from '../../../hooks/api/ga4-mappings';
import { eventI18nKey } from '../../../translations/ga4-events';
import { EventCombobox, type ComboboxOption } from './event-combobox';
import { EventRationale } from './event-rationale';

interface MappingEventFieldsProps {
  events: Ga4SupportedEvent[];
  categories: Ga4EventCategory[];
  medusaEvent: string;
  onMedusaEventChange: (value: string) => void;
  ga4EventName: string;
  onGa4EventNameChange: (value: string) => void;
}

/**
 * Campos del evento en el orden pedido: Título (vía el select y el bloque de
 * info), Evento de Medusa (técnico), Descripción y por último Evento de GA4.
 * El select agrupa los eventos por categoría — "Recomendados" primero. Todos
 * los textos visibles (títulos, descripciones, categorías) salen de i18n.
 */
export const MappingEventFields = ({
  events,
  categories,
  medusaEvent,
  onMedusaEventChange,
  ga4EventName,
  onGa4EventNameChange,
}: MappingEventFieldsProps) => {
  const { t } = useTranslation('ga4Events');

  const selectedEvent = useMemo(
    () => events.find((e) => e.medusa_event === medusaEvent),
    [events, medusaEvent]
  );

  const eventTitle = (medusa_event: string) =>
    t(`EVENTS.${eventI18nKey(medusa_event)}.TITLE`, { defaultValue: medusa_event });

  // Opciones agrupadas por categoría, en el orden de `categories`, con el
  // título amigable como label y el nombre técnico como value.
  const options = useMemo<ComboboxOption[]>(() => {
    const opts: ComboboxOption[] = [];
    for (const cat of categories) {
      for (const event of events.filter((e) => e.category === cat)) {
        opts.push({
          value: event.medusa_event,
          label: eventTitle(event.medusa_event),
          group: t(`CATEGORIES.${cat}`),
        });
      }
    }
    return opts;
  }, [events, categories, t]);

  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor="medusa_event">{t('FIELD_MEDUSA_EVENT_LABEL')}</Label>
        <EventCombobox
          id="medusa_event"
          value={medusaEvent}
          onChange={onMedusaEventChange}
          options={options}
          placeholder={t('FIELD_MEDUSA_EVENT_PLACEHOLDER')}
          searchPlaceholder={t('FIELD_MEDUSA_EVENT_SEARCH')}
          emptyLabel={t('SEARCH_NO_RESULTS')}
        />
      </div>

      {selectedEvent && (
        <div className="flex flex-col gap-1 rounded-lg bg-ui-bg-subtle px-3 py-2">
          <Text size="small" weight="plus">
            {eventTitle(selectedEvent.medusa_event)}
          </Text>
          <code className="txt-compact-small text-ui-fg-muted">{selectedEvent.medusa_event}</code>
          <Text size="small" className="text-ui-fg-subtle">
            {t(`EVENTS.${eventI18nKey(selectedEvent.medusa_event)}.DESC`, { defaultValue: '' })}
          </Text>
        </div>
      )}

      {selectedEvent && <EventRationale whyKey={eventI18nKey(selectedEvent.medusa_event)} />}

      <div className="flex flex-col gap-2">
        <Label htmlFor="ga4_event_name">{t('FIELD_GA4_EVENT_LABEL')}</Label>
        <Input
          id="ga4_event_name"
          placeholder={t('FIELD_GA4_EVENT_PLACEHOLDER')}
          value={ga4EventName}
          onChange={(e) => onGa4EventNameChange(e.target.value)}
          required
        />
        <Text size="small" className="text-ui-fg-subtle">
          {t('FIELD_GA4_EVENT_HELP')}
        </Text>
      </div>
    </>
  );
};
