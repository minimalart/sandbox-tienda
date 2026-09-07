import { Heading, Input, Label, Text } from '@medusajs/ui';
import { useTranslation } from 'react-i18next';

import type { CurationFormProps } from '../../../../../../modules/typesense/types';
import ActionsSection from './ActionsSection';
import OptionsSection from './OptionsSection';
import RulesSection from './RulesSection';

const CurationForm = ({ editingId, formHook }: CurationFormProps) => {
  const { t } = useTranslation('typesense');

  return (
    <>
      <div>
        <Heading className="capitalize">
          {editingId ? t('EDIT_CURATION_MODAL_TITLE') : t('CREATE_CURATION_MODAL_TITLE')}
        </Heading>
        <Text className="text-ui-fg-subtle">
          {editingId ? t('EDIT_CURATION_DESCRIPTION') : t('CREATE_CURATION_MODAL_SUBTITLE')}
        </Text>
      </div>

      <div className="flex flex-col gap-y-4">
        <div className="flex flex-col gap-y-2">
          <Label htmlFor="curation-id">{t('CURATION_ID_LABEL')}</Label>
          <Input
            id="curation-id"
            placeholder={t('CURATION_ID_PLACEHOLDER')}
            {...formHook.register('id', {
              required: t('CURATION_ID_REQUIRED'),
              pattern: {
                value: /^[a-zA-Z0-9_-]+$/,
                message: t('CURATION_ID_PATTERN_ERROR'),
              },
            })}
            disabled={Boolean(editingId)}
            className={formHook.errors.id ? 'border-ui-border-error' : ''}
          />
          {formHook.errors.id ? (
            <Text size="xsmall" className="text-ui-fg-error">
              {formHook.errors.id.message}
            </Text>
          ) : null}
          <Text size="xsmall" className="text-ui-fg-subtle">
            {editingId ? t('CURATION_ID_HELP_TEXT_EDIT') : t('CURATION_ID_HELP_TEXT')}
          </Text>
        </div>

        <RulesSection formHook={formHook} />

        {formHook.rulesError ? (
          <Text size="small" className="text-ui-fg-error">
            {formHook.rulesError}
          </Text>
        ) : null}

        <ActionsSection formHook={formHook} />

        <OptionsSection
          useEffectiveFrom={formHook.useEffectiveFrom}
          setUseEffectiveFrom={formHook.setUseEffectiveFrom}
          useEffectiveTo={formHook.useEffectiveTo}
          setUseEffectiveTo={formHook.setUseEffectiveTo}
          register={formHook.register}
          control={formHook.control}
        />
      </div>
    </>
  );
};

export default CurationForm;
