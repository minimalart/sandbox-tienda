import { Checkbox, DatePicker, Label, Text } from '@medusajs/ui';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { OptionsSectionProps } from '../../../../../../modules/typesense/types';
import { dateToLocalInput, localInputToDate } from '../../../../../lib/date';

const OptionsSection = ({
  useEffectiveFrom,
  setUseEffectiveFrom,
  useEffectiveTo,
  setUseEffectiveTo,
  control,
}: OptionsSectionProps) => {
  const { t } = useTranslation('typesense');

  return (
    <div className="mb-4 rounded-lg border border-ui-border-base p-4">
      <Text size="large" weight="plus" className="mb-4">
        {t('CURATIONS_OPTIONS_TITLE')}
      </Text>

      <div className="flex flex-col gap-y-4">
        <div className="flex flex-col gap-y-2">
          <div className="flex items-center gap-x-2">
            <Checkbox
              id="use-effective-from"
              checked={useEffectiveFrom}
              onCheckedChange={(checked) => setUseEffectiveFrom(checked === true)}
            />
            <Label htmlFor="use-effective-from">{t('CURATIONS_OPTIONS_EFFECTIVE_FROM')}</Label>
          </div>

          {useEffectiveFrom ? (
            <div className="ml-6 mt-2">
              <Controller
                control={control}
                name="effective_from"
                render={({ field }) => (
                  <DatePicker
                    granularity="minute"
                    value={localInputToDate(field.value as string | null | undefined)}
                    onChange={(d) => field.onChange(dateToLocalInput(d))}
                  />
                )}
              />
              <Text size="xsmall" className="mt-1 text-ui-fg-subtle">
                {t('CURATIONS_OPTIONS_EFFECTIVE_FROM_HELP')}
              </Text>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-y-2">
          <div className="flex items-center gap-x-2">
            <Checkbox
              id="use-effective-to"
              checked={useEffectiveTo}
              onCheckedChange={(checked) => setUseEffectiveTo(checked === true)}
            />
            <Label htmlFor="use-effective-to">{t('CURATIONS_OPTIONS_EFFECTIVE_TO')}</Label>
          </div>

          {useEffectiveTo ? (
            <div className="ml-6 mt-2">
              <Controller
                control={control}
                name="effective_to"
                render={({ field }) => (
                  <DatePicker
                    granularity="minute"
                    value={localInputToDate(field.value as string | null | undefined)}
                    onChange={(d) => field.onChange(dateToLocalInput(d))}
                  />
                )}
              />
              <Text size="xsmall" className="mt-1 text-ui-fg-subtle">
                {t('CURATIONS_OPTIONS_EFFECTIVE_TO_HELP')}
              </Text>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default OptionsSection;
