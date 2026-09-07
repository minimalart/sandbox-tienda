import { Button, Input, Label } from '@medusajs/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useSearchContext } from '../../contexts/SearchContext';
import type { FieldInfo } from '../../hooks/useSearchData';
import FilterBuilder from './FilterBuilder';
import MultiSelectField from './MultiSelectField';
import SortBuilder from './SortBuilder';

const debounce = (func: (...args: any[]) => void, wait: number) => {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

const SearchPanel = () => {
  const { t } = useTranslation('typesense');
  const {
    searchState,
    loading,
    selectedCollection,
    availableFields,
    fieldInfos,
    updateSearchParam,
    resetSearch,
  } = useSearchContext();

  const [localPerPage, setLocalPerPage] = useState(searchState.per_page);

  useEffect(() => {
    setLocalPerPage(searchState.per_page);
  }, [searchState.per_page]);

  const debouncedUpdatePerPage = useCallback(
    debounce((value: number) => {
      updateSearchParam('per_page', value);
    }, 300),
    [updateSearchParam]
  );

  const facetableFields = useMemo(
    () => fieldInfos.filter((field) => field.facet).map((field) => field.name),
    [fieldInfos]
  );
  const sortableFields = useMemo(
    () => fieldInfos.filter((field) => field.sort).map((field) => field.name),
    [fieldInfos]
  );
  const sortFields = useMemo(
    () => ['_text_match', ...sortableFields.filter((field) => field !== '_text_match')],
    [sortableFields]
  );

  return (
    <div className="mt-4 space-y-4">
      <div>
        <Label>{t('COLLECTION_LABEL')}</Label>
        <div className="mt-1 rounded border border-ui-border-base bg-ui-bg-field p-2">
          <span className="font-medium">{selectedCollection || t('LOADING_TEXT')}</span>
        </div>
      </div>

      <MultiSelectField
        label={t('QUERY_BY_FIELDS_LABEL')}
        options={availableFields}
        selectedValues={searchState.query_by}
        onSelectionChange={(values) => updateSearchParam('query_by', values)}
        placeholder={t('QUERY_BY_FIELDS_PLACEHOLDER')}
      />

      <FilterBuilder
        filters={searchState.filter_by as { field: string; expression: string }[]}
        availableFields={availableFields}
        fieldInfos={fieldInfos as FieldInfo[]}
        onFiltersChange={(filters) => updateSearchParam('filter_by', filters)}
      />

      <MultiSelectField
        label={t('FACET_BY_FIELDS_LABEL')}
        options={facetableFields}
        selectedValues={searchState.facet_by}
        onSelectionChange={(values) => updateSearchParam('facet_by', values)}
        placeholder={t('FACET_BY_FIELDS_PLACEHOLDER')}
      />

      <SortBuilder
        sorts={searchState.sort_by}
        availableFields={sortFields}
        onSortsChange={(sorts) => updateSearchParam('sort_by', sorts)}
      />

      <div>
        <Label>{t('PER_PAGE_LABEL')}</Label>
        <Input
          type="number"
          min={1}
          max={250}
          value={localPerPage}
          onChange={(event) => {
            const nextValue = Number(event.target.value) || 10;
            setLocalPerPage(nextValue);
            debouncedUpdatePerPage(nextValue);
          }}
        />
      </div>

      <div className="pt-2">
        <Button variant="secondary" onClick={resetSearch} disabled={loading}>
          {t('CLEAN_SELECTIONS_BUTTON')}
        </Button>
      </div>
    </div>
  );
};

export default SearchPanel;
