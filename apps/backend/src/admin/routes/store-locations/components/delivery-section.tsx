import { Heading, Input, Label, Switch, Text } from '@medusajs/ui';
import { useTranslation } from 'react-i18next';
import { BranchDeliveryData, BusinessHours } from '../../../hooks/api';
import {
  BusinessHoursEditor,
  defaultBusinessHours,
  normalizeBusinessHours,
} from './business-hours-editor';

export const DEFAULT_TZ = 'America/Argentina/Buenos_Aires';

/** Controlled delivery state held by the parent store-location form. */
export interface DeliveryFormState {
  active: boolean;
  timezone: string;
  lead_time_hours: string;
  schedules: BusinessHours;
}

export const emptyDelivery = (): DeliveryFormState => ({
  active: true,
  timezone: DEFAULT_TZ,
  lead_time_hours: '',
  schedules: defaultBusinessHours(),
});

export const fromDelivery = (d: BranchDeliveryData | null | undefined): DeliveryFormState => {
  if (!d) return emptyDelivery();
  return {
    active: d.active,
    timezone: d.timezone ?? DEFAULT_TZ,
    lead_time_hours: d.lead_time_hours != null ? String(d.lead_time_hours) : '',
    schedules: normalizeBusinessHours(d.schedules),
  };
};

interface DeliverySectionProps {
  value: DeliveryFormState;
  onChange: (value: DeliveryFormState) => void;
}

/**
 * Per-branch delivery settings (controlled): active + timezone + lead time +
 * per-day delivery windows with an optional daily cap. Informational — does not
 * replace Medusa shipping options. Persisted by the parent form's single save.
 */
export const DeliverySection = ({ value, onChange }: DeliverySectionProps) => {
  const { t } = useTranslation('storeLocations');
  const set = <K extends keyof DeliveryFormState>(key: K, v: DeliveryFormState[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Heading level="h3">{t('SECTION_DELIVERY')}</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          {t('DELIVERY_HELP')}
        </Text>
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="del-active">{t('DELIVERY_ACTIVE_LABEL')}</Label>
        <Switch id="del-active" checked={value.active} onCheckedChange={(v) => set('active', v)} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="del-tz">{t('DELIVERY_TIMEZONE_LABEL')}</Label>
          <Input
            id="del-tz"
            value={value.timezone}
            placeholder={DEFAULT_TZ}
            onChange={(e) => set('timezone', e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="del-lead">{t('DELIVERY_LEAD_TIME_LABEL')}</Label>
          <Input
            id="del-lead"
            type="number"
            min={0}
            placeholder={t('DELIVERY_LEAD_TIME_PLACEHOLDER')}
            value={value.lead_time_hours}
            onChange={(e) => set('lead_time_hours', e.target.value)}
          />
          <Text size="small" className="text-ui-fg-subtle">
            {t('DELIVERY_LEAD_TIME_HELP')}
          </Text>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t('DELIVERY_SCHEDULES_LABEL')}</Label>
        <Text size="small" className="text-ui-fg-subtle">
          {t('DELIVERY_MAX_PER_DAY_HELP')}
        </Text>
        <BusinessHoursEditor
          value={value.schedules}
          onChange={(schedules) => set('schedules', schedules)}
          withDailyLimit
        />
      </div>
    </div>
  );
};
