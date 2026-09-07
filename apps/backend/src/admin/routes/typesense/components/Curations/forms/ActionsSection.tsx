import { Checkbox, Input, Label, Text } from '@medusajs/ui';
import { useTranslation } from 'react-i18next';

import type { CurationFormHook } from '../../../hooks/useCurationForm';
import ProductSelector from '../components/ProductSelector';

const ActionsSection = ({ formHook }: { formHook: CurationFormHook }) => {
  const { t } = useTranslation('typesense');

  return (
    <div className="mb-4 rounded-lg border border-ui-border-base p-4">
      <Text size="large" weight="plus" className="mb-4">
        {t('CURATIONS_ACTIONS_TITLE')}
      </Text>

      <div className="flex flex-col gap-y-4">
        <div className="flex flex-col gap-y-2">
          <div className="flex items-center gap-x-2">
            <Checkbox
              id="use-filter-documents"
              checked={formHook.formState.useFilterDocuments}
              onCheckedChange={(checked) =>
                formHook.updateFormState('useFilterDocuments', checked === true)
              }
            />
            <Label htmlFor="use-filter-documents">{t('CURATIONS_ACTIONS_FILTER_DOCUMENTS')}</Label>
          </div>

          {formHook.formState.useFilterDocuments ? (
            <div className="ml-6 mt-2">
              <Input
                id="filter_documents"
                placeholder={t('CURATIONS_ACTIONS_FILTER_DOCUMENTS_PLACEHOLDER')}
                {...formHook.register('filter_documents')}
              />
              <Text size="xsmall" className="mt-1 text-ui-fg-subtle">
                {t('CURATIONS_ACTIONS_FILTER_DOCUMENTS_HELP')}
              </Text>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-y-2">
          <div className="flex items-center gap-x-2">
            <Checkbox
              id="use-sort-documents"
              checked={formHook.formState.useSortDocuments}
              onCheckedChange={(checked) =>
                formHook.updateFormState('useSortDocuments', checked === true)
              }
            />
            <Label htmlFor="use-sort-documents">{t('CURATIONS_ACTIONS_SORT_DOCUMENTS')}</Label>
          </div>

          {formHook.formState.useSortDocuments ? (
            <div className="ml-6 mt-2">
              <Input
                id="sort_by"
                placeholder={t('CURATIONS_ACTIONS_SORT_DOCUMENTS_PLACEHOLDER')}
                {...formHook.register('sort_by')}
              />
              <Text size="xsmall" className="mt-1 text-ui-fg-subtle">
                {t('CURATIONS_ACTIONS_SORT_DOCUMENTS_HELP')}
              </Text>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-y-2">
          <div className="flex items-center gap-x-2">
            <Checkbox
              id="use-replace-query"
              checked={formHook.formState.useReplaceQuery}
              onCheckedChange={(checked) =>
                formHook.updateFormState('useReplaceQuery', checked === true)
              }
            />
            <Label htmlFor="use-replace-query">{t('CURATIONS_ACTIONS_REPLACE_QUERY')}</Label>
          </div>

          {formHook.formState.useReplaceQuery ? (
            <div className="ml-6 mt-2">
              <Input
                id="replace_query"
                placeholder={t('CURATIONS_ACTIONS_REPLACE_QUERY_PLACEHOLDER')}
                {...formHook.register('replace_query')}
              />
              <Text size="xsmall" className="mt-1 text-ui-fg-subtle">
                {t('CURATIONS_ACTIONS_REPLACE_QUERY_HELP')}
              </Text>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-x-2">
          <Checkbox
            id="use-remove-matched-tokens"
            checked={formHook.formState.useRemoveMatchedTokens}
            onCheckedChange={(checked) =>
              formHook.updateFormState('useRemoveMatchedTokens', checked === true)
            }
          />
          <Label htmlFor="use-remove-matched-tokens">
            {t('CURATIONS_ACTIONS_REMOVE_MATCHED_TOKENS')}
          </Label>
        </div>

        <div className="flex items-center gap-x-2">
          <Checkbox
            id="use-apply-filters"
            checked={formHook.formState.useApplyFilters}
            onCheckedChange={(checked) =>
              formHook.updateFormState('useApplyFilters', checked === true)
            }
          />
          <Label htmlFor="use-apply-filters">{t('CURATIONS_ACTIONS_APPLY_FILTERS')}</Label>
        </div>

        <div className="flex flex-col gap-y-2">
          <div className="flex items-center gap-x-2">
            <Checkbox
              id="use-custom-metadata"
              checked={formHook.formState.useCustomMetadata}
              onCheckedChange={(checked) =>
                formHook.updateFormState('useCustomMetadata', checked === true)
              }
            />
            <Label htmlFor="use-custom-metadata">{t('CURATIONS_ACTIONS_CUSTOM_METADATA')}</Label>
          </div>

          {formHook.formState.useCustomMetadata ? (
            <div className="ml-6 mt-2">
              <Input
                id="custom_metadata"
                placeholder={t('CURATIONS_ACTIONS_CUSTOM_METADATA_PLACEHOLDER')}
                {...formHook.register('custom_metadata')}
              />
              <Text size="xsmall" className="mt-1 text-ui-fg-subtle">
                {t('CURATIONS_ACTIONS_CUSTOM_METADATA_HELP')}
              </Text>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-x-2">
          <Checkbox
            id="use-stop-processing"
            checked={formHook.formState.useStopProcessing}
            onCheckedChange={(checked) =>
              formHook.updateFormState('useStopProcessing', checked === true)
            }
          />
          <Label htmlFor="use-stop-processing">{t('CURATIONS_ACTIONS_STOP_PROCESSING')}</Label>
        </div>

        <div className="flex flex-col gap-y-2">
          <div className="flex items-center gap-x-2">
            <Checkbox
              id="use-pin-documents"
              checked={formHook.formState.usePinDocuments}
              onCheckedChange={(checked) => {
                formHook.updateFormState('usePinDocuments', checked === true);
                if (!checked) {
                  formHook.setSelectedProducts([]);
                  formHook.setValue('includes', []);
                }
              }}
            />
            <Label htmlFor="use-pin-documents">{t('CURATIONS_ACTIONS_PIN_DOCUMENTS')}</Label>
          </div>

          {formHook.formState.usePinDocuments ? (
            <div className="ml-6 mt-2">
              <ProductSelector
                selectedProducts={formHook.selectedProducts}
                onProductsChange={(products) => {
                  formHook.setSelectedProducts(products);
                  formHook.setValue(
                    'includes',
                    products.map((product) => product.id)
                  );
                }}
              />
              {formHook.selectedProducts.length > 0 ? (
                <Text size="xsmall" className="mt-1 text-ui-fg-subtle">
                  {t('CURATIONS_ACTIONS_PIN_DOCUMENTS_SELECTED', {
                    count: formHook.selectedProducts.length,
                  })}
                </Text>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-y-2">
          <div className="flex items-center gap-x-2">
            <Checkbox
              id="use-hide-documents"
              checked={formHook.formState.useHideDocuments}
              onCheckedChange={(checked) => {
                formHook.updateFormState('useHideDocuments', checked === true);
                if (!checked) {
                  formHook.setExcludedProducts([]);
                  formHook.setValue('excludes', []);
                }
              }}
            />
            <Label htmlFor="use-hide-documents">{t('CURATIONS_ACTIONS_HIDE_DOCUMENTS')}</Label>
          </div>

          {formHook.formState.useHideDocuments ? (
            <div className="ml-6 mt-2">
              <ProductSelector
                selectedProducts={formHook.excludedProducts}
                onProductsChange={(products) => {
                  formHook.setExcludedProducts(products);
                  formHook.setValue(
                    'excludes',
                    products.map((product) => product.id)
                  );
                }}
              />
              {formHook.excludedProducts.length > 0 ? (
                <Text size="xsmall" className="mt-1 text-ui-fg-subtle">
                  {t('CURATIONS_ACTIONS_HIDE_DOCUMENTS_SELECTED', {
                    count: formHook.excludedProducts.length,
                  })}
                </Text>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default ActionsSection;
