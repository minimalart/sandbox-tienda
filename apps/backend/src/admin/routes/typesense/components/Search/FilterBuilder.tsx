import { Plus, XMark } from '@medusajs/icons';
import { Badge, Button, IconButton, Input, Label, Select, Text } from '@medusajs/ui';
import type { FC } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Filter {
  field: string;
  expression: string;
}

interface DraftFilter {
  field: string;
  expression: string;
  fieldType?: string;
}

interface FieldInfo {
  name: string;
  type: string;
  facet?: boolean;
  sort?: boolean;
  optional?: boolean;
}

interface FilterBuilderProps {
  filters: Filter[];
  availableFields: string[];
  fieldInfos: FieldInfo[];
  onFiltersChange: (filters: Filter[]) => void;
}

const FilterBuilder: FC<FilterBuilderProps> = ({
  filters,
  availableFields,
  fieldInfos,
  onFiltersChange,
}) => {
  const { t } = useTranslation('typesense');
  const [draftFilter, setDraftFilter] = useState<DraftFilter | null>(null);

  const getFieldTypeInfo = (fieldName: string) =>
    fieldInfos.find((field) => field.name === fieldName)?.type || 'unknown';

  const startNewFilter = () => setDraftFilter({ field: '', expression: '', fieldType: undefined });

  const updateDraftField = (field: string) => {
    setDraftFilter((prev) =>
      prev ? { ...prev, field, fieldType: getFieldTypeInfo(field) } : null
    );
  };

  const updateDraftExpression = (expression: string) => {
    setDraftFilter((prev) => (prev ? { ...prev, expression } : null));
  };

  const saveDraftFilter = () => {
    if (draftFilter?.field && draftFilter.expression) {
      onFiltersChange([
        ...filters,
        { field: draftFilter.field, expression: draftFilter.expression },
      ]);
      setDraftFilter(null);
    }
  };

  const cancelDraftFilter = () => setDraftFilter(null);

  const removeFilter = (index: number) => {
    onFiltersChange(filters.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{t('FILTER_BY_LABEL')}</Label>
        {!draftFilter ? (
          <Button variant="transparent" size="small" onClick={startNewFilter}>
            <Plus className="mr-1" />
            {t('ADD_FILTER_BUTTON')}
          </Button>
        ) : null}
      </div>

      {filters.map((filter, index) => {
        const fieldType = getFieldTypeInfo(filter.field);
        return (
          <div
            key={`${filter.field}-${index}`}
            className="flex min-h-[2.5rem] items-center gap-2 rounded border bg-ui-bg-subtle p-2"
          >
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <Badge className="bg-ui-tag-neutral-bg text-ui-tag-neutral-text" size="small">
                <span className="max-w-[200px] truncate sm:max-w-none">{filter.field}</span>
              </Badge>
              <Badge className="bg-ui-tag-neutral-bg text-ui-tag-neutral-text" size="small">
                {fieldType}
              </Badge>
              <Badge className="bg-ui-tag-neutral-bg text-ui-tag-neutral-text" size="small">
                <span className="max-w-[150px] truncate sm:max-w-none">{filter.expression}</span>
              </Badge>
            </div>
            <IconButton
              variant="transparent"
              size="small"
              onClick={() => removeFilter(index)}
              className="text-ui-fg-error hover:text-ui-fg-error"
            >
              <XMark className="h-4 w-4" />
            </IconButton>
          </div>
        );
      })}

      {draftFilter ? (
        <div className="flex items-center gap-2 rounded border-2 border-dashed border-ui-border-base p-2">
          <div className="min-w-0 flex-1">
            <Select value={draftFilter.field || undefined} onValueChange={updateDraftField}>
              <Select.Trigger className="overflow-hidden">
                <Select.Value placeholder={t('SELECT_FIELD_PLACEHOLDER')} />
              </Select.Trigger>
              <Select.Content className="max-h-60">
                {availableFields.map((field) => (
                  <Select.Item key={field} value={field} title={field}>
                    <span className="truncate">{field}</span>
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>

          <div className="flex-shrink-0">
            <Badge size="small" className="text-xs">
              {draftFilter.fieldType || 'unknown'}
            </Badge>
          </div>

          <div className="min-w-0 flex-1">
            <Input
              placeholder={draftFilter.field ? ':>0 or :=value' : t('SELECT_FIELD_PLACEHOLDER')}
              value={draftFilter.expression}
              disabled={!draftFilter.field}
              onChange={(e) => updateDraftExpression(e.target.value)}
            />
          </div>

          <div className="flex flex-shrink-0 gap-1">
            <IconButton
              variant="transparent"
              size="small"
              onClick={saveDraftFilter}
              disabled={!draftFilter.field || !draftFilter.expression}
              title={t('SAVE_FILTER_BUTTON')}
            >
              <Plus className="h-4 w-4" />
            </IconButton>
            <IconButton
              variant="transparent"
              size="small"
              onClick={cancelDraftFilter}
              className="text-ui-fg-error hover:text-ui-fg-error"
              title={t('CANCEL_FILTER_BUTTON')}
            >
              <XMark className="h-4 w-4" />
            </IconButton>
          </div>
        </div>
      ) : null}

      {filters.length === 0 && !draftFilter ? (
        <Text size="small" className="text-ui-fg-subtle">
          {t('NO_FILTERS_APPLIED')}
        </Text>
      ) : null}
    </div>
  );
};

export default FilterBuilder;
