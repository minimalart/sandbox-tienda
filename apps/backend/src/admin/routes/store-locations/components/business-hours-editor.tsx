import { IconButton, Input, Label, Switch, Text } from '@medusajs/ui';
import { Plus, Trash } from '@medusajs/icons';
import { useTranslation } from 'react-i18next';
import { BusinessHours, BusinessHoursSlot } from '../../../hooks/api';

/** Canonical day keys (existing data shape — do not change). */
export const BUSINESS_HOURS_DAYS = [
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
  'domingo',
] as const;

export type BusinessHoursDay = (typeof BUSINESS_HOURS_DAYS)[number];

const DAY_LABEL_KEY: Record<BusinessHoursDay, string> = {
  lunes: 'DAY_SHORT_LUNES',
  martes: 'DAY_SHORT_MARTES',
  miercoles: 'DAY_SHORT_MIERCOLES',
  jueves: 'DAY_SHORT_JUEVES',
  viernes: 'DAY_SHORT_VIERNES',
  sabado: 'DAY_SHORT_SABADO',
  domingo: 'DAY_SHORT_DOMINGO',
};

const WEEKDAYS: BusinessHoursDay[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];

const DEFAULT_SLOT: BusinessHoursSlot = { open: '09:00', close: '18:00' };

const MAX_SLOTS = 2;

/** Default: Mon–Fri 09:00–18:00 open, Sat/Sun closed. is24Hours stays false (no UI in V1). */
export const defaultBusinessHours = (): BusinessHours => {
  const hours: BusinessHours = {};
  for (const day of BUSINESS_HOURS_DAYS) {
    hours[day] = {
      closed: !WEEKDAYS.includes(day),
      is24Hours: false,
      slots: [{ ...DEFAULT_SLOT }],
    };
  }
  return hours;
};

/**
 * Normalizes stored business_hours into a complete editable record:
 * every day present, at least one slot per day, is24Hours preserved.
 */
export const normalizeBusinessHours = (value: BusinessHours | null | undefined): BusinessHours => {
  const defaults = defaultBusinessHours();
  if (!value) {
    return defaults;
  }
  const normalized: BusinessHours = {};
  for (const day of BUSINESS_HOURS_DAYS) {
    const entry = value[day];
    const fallback = defaults[day]!;
    if (!entry) {
      normalized[day] = fallback;
      continue;
    }
    const slots = Array.isArray(entry.slots) && entry.slots.length > 0
      ? entry.slots.slice(0, MAX_SLOTS).map((s) => ({ open: s.open ?? '', close: s.close ?? '' }))
      : [{ ...DEFAULT_SLOT }];
    normalized[day] = {
      closed: !!entry.closed,
      is24Hours: !!entry.is24Hours,
      slots,
      maxPerDay: entry.maxPerDay ?? null,
    };
  }
  return normalized;
};

interface BusinessHoursEditorProps {
  value: BusinessHours;
  onChange: (value: BusinessHours) => void;
  /** When true, renders a per-day "max deliveries/day" cap input (delivery use). */
  withDailyLimit?: boolean;
}

/**
 * Visual business-hours editor (one row per day):
 * open/close time inputs, a "+" button for a second slot (with a red trash
 * button to remove it) and an open/closed toggle on the right. When closed,
 * the time inputs are hidden. is24Hours has no UI in V1 (kept as-is).
 */
export const BusinessHoursEditor = ({
  value,
  onChange,
  withDailyLimit = false,
}: BusinessHoursEditorProps) => {
  const { t } = useTranslation('storeLocations');

  const updateDay = (day: BusinessHoursDay, patch: Partial<BusinessHours[string]>) => {
    const current = value[day] ?? defaultBusinessHours()[day]!;
    onChange({ ...value, [day]: { ...current, ...patch } });
  };

  const updateSlot = (
    day: BusinessHoursDay,
    index: number,
    field: keyof BusinessHoursSlot,
    fieldValue: string
  ) => {
    const current = value[day] ?? defaultBusinessHours()[day]!;
    const slots = current.slots.map((slot, i) =>
      i === index ? { ...slot, [field]: fieldValue } : slot
    );
    updateDay(day, { slots });
  };

  const addSlot = (day: BusinessHoursDay) => {
    const current = value[day] ?? defaultBusinessHours()[day]!;
    if (current.slots.length >= MAX_SLOTS) {
      return;
    }
    updateDay(day, { slots: [...current.slots, { open: '14:00', close: '18:00' }] });
  };

  const removeSlot = (day: BusinessHoursDay, index: number) => {
    const current = value[day] ?? defaultBusinessHours()[day]!;
    if (current.slots.length <= 1) {
      return;
    }
    updateDay(day, { slots: current.slots.filter((_, i) => i !== index) });
  };

  return (
    <div className="flex flex-col divide-y divide-ui-border-base rounded-lg border border-ui-border-base">
      {BUSINESS_HOURS_DAYS.map((day) => {
        const entry = value[day] ?? defaultBusinessHours()[day]!;
        const isOpen = !entry.closed;

        return (
          <div key={day} className="flex items-start gap-3 px-3 py-2">
            <Label className="w-10 shrink-0 pt-1.5 font-medium">{t(DAY_LABEL_KEY[day])}</Label>

            <div className="flex min-w-0 flex-1 flex-col gap-2">
              {isOpen ? (
                entry.slots.map((slot, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      type="time"
                      size="small"
                      aria-label={t('HOURS_OPEN_LABEL')}
                      value={slot.open}
                      onChange={(e) => updateSlot(day, index, 'open', e.target.value)}
                    />
                    <Text size="small" className="text-ui-fg-muted">
                      –
                    </Text>
                    <Input
                      type="time"
                      size="small"
                      aria-label={t('HOURS_CLOSE_LABEL')}
                      value={slot.close}
                      onChange={(e) => updateSlot(day, index, 'close', e.target.value)}
                    />
                    {index === 0 && entry.slots.length < MAX_SLOTS ? (
                      <IconButton
                        type="button"
                        size="small"
                        variant="transparent"
                        aria-label={t('HOURS_ADD_SLOT')}
                        onClick={() => addSlot(day)}
                      >
                        <Plus />
                      </IconButton>
                    ) : null}
                    {index > 0 ? (
                      <IconButton
                        type="button"
                        size="small"
                        variant="transparent"
                        aria-label={t('HOURS_REMOVE_SLOT')}
                        className="text-ui-fg-error hover:text-ui-fg-error"
                        onClick={() => removeSlot(day, index)}
                      >
                        <Trash />
                      </IconButton>
                    ) : null}
                  </div>
                ))
              ) : (
                <Text size="small" className="pt-1.5 text-ui-fg-muted">
                  {t('HOURS_CLOSED')}
                </Text>
              )}

              {withDailyLimit && isOpen ? (
                <div className="flex items-center gap-2">
                  <Text size="xsmall" className="text-ui-fg-muted">
                    {t('DELIVERY_MAX_PER_DAY_LABEL')}
                  </Text>
                  <Input
                    type="number"
                    size="small"
                    min={0}
                    className="w-20"
                    placeholder="—"
                    aria-label={t('DELIVERY_MAX_PER_DAY_LABEL')}
                    value={entry.maxPerDay != null ? String(entry.maxPerDay) : ''}
                    onChange={(e) => {
                      const raw = e.target.value.trim();
                      const n = raw === '' ? null : Math.max(0, Number.parseInt(raw, 10));
                      updateDay(day, { maxPerDay: n != null && Number.isFinite(n) ? n : null });
                    }}
                  />
                </div>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-2 pt-1">
              <Text
                size="small"
                className={isOpen ? 'text-ui-tag-green-text' : 'text-ui-fg-muted'}
              >
                {isOpen ? t('HOURS_OPEN') : t('HOURS_CLOSED')}
              </Text>
              <Switch
                checked={isOpen}
                onCheckedChange={(checked) => updateDay(day, { closed: !checked })}
                aria-label={`${t(DAY_LABEL_KEY[day])} — ${isOpen ? t('HOURS_OPEN') : t('HOURS_CLOSED')}`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
