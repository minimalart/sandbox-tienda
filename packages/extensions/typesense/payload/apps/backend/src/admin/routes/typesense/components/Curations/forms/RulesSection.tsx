import { Checkbox, Input, Label, Text } from '@medusajs/ui';
import { useTranslation } from 'react-i18next';

import type { CurationFormHook } from '../../../hooks/useCurationForm';

const RulesSection = ({ formHook }: { formHook: CurationFormHook }) => {
  const { t } = useTranslation('typesense');
  const { register, formState, updateFormState } = formHook;

  return (
    <div className="rounded-lg border border-ui-border-base p-4">
      <Text size="large" weight="plus" className="mb-4">
        {t('CURATIONS_RULES_TITLE')}
      </Text>

      <div className="flex flex-col gap-y-4">
        <div className="flex flex-col gap-y-2">
          <div className="flex items-center gap-x-2">
            <Checkbox
              id="use-query-rule"
              checked={formState.useQueryRule}
              onCheckedChange={(checked) => updateFormState('useQueryRule', checked === true)}
            />
            <Label htmlFor="use-query-rule">{t('CURATIONS_RULES_CURATE_BY_QUERY')}</Label>
          </div>

          {formState.useQueryRule ? (
            <div className="ml-6 mt-2">
              <Input
                id="query"
                placeholder={t('CURATIONS_RULES_QUERY_PLACEHOLDER')}
                {...register('query')}
              />
              <Text size="xsmall" className="mt-1 text-ui-fg-subtle">
                {t('CURATIONS_RULES_QUERY_HELP')}
              </Text>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-y-2">
          <div className="flex items-center gap-x-2">
            <Checkbox
              id="use-filter-rule"
              checked={formState.useFilterRule}
              onCheckedChange={(checked) => updateFormState('useFilterRule', checked === true)}
            />
            <Label htmlFor="use-filter-rule">{t('CURATIONS_RULES_CURATE_BY_FILTER')}</Label>
          </div>

          {formState.useFilterRule ? (
            <div className="ml-6 mt-2">
              <Input
                id="filter_by"
                placeholder={t('CURATIONS_RULES_FILTER_PLACEHOLDER')}
                {...register('filter_by')}
              />
              <Text size="xsmall" className="mt-1 text-ui-fg-subtle">
                {t('CURATIONS_RULES_FILTER_HELP')}
              </Text>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-y-2">
          <div className="flex items-center gap-x-2">
            <Checkbox
              id="use-tags-rule"
              checked={formState.useTagsRule}
              onCheckedChange={(checked) => updateFormState('useTagsRule', checked === true)}
            />
            <Label htmlFor="use-tags-rule">{t('CURATIONS_RULES_CURATE_BY_TAGS')}</Label>
          </div>

          {formState.useTagsRule ? (
            <div className="ml-6 mt-2">
              <Input
                id="tags"
                placeholder={t('CURATIONS_RULES_TAGS_PLACEHOLDER')}
                {...register('tags')}
              />
              <Text size="xsmall" className="mt-1 text-ui-fg-subtle">
                {t('CURATIONS_RULES_TAGS_HELP')}
              </Text>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default RulesSection;
