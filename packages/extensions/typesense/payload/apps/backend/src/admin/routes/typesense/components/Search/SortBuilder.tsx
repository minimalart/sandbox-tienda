import { Plus, XMark } from '@medusajs/icons';
import { Badge, Button, IconButton, Label, Select, Text } from '@medusajs/ui';
import type { FC } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface SortEntry {
  field: string;
  direction: 'asc' | 'desc';
}

interface DraftSort {
  field: string;
  direction: 'asc' | 'desc';
}

interface SortBuilderProps {
  sorts: SortEntry[];
  availableFields: string[];
  onSortsChange: (sorts: SortEntry[]) => void;
}

const SortBuilder: FC<SortBuilderProps> = ({ sorts, availableFields, onSortsChange }) => {
  const { t } = useTranslation('typesense');
  const [draftSort, setDraftSort] = useState<DraftSort | null>(null);

  const startNewSort = () => setDraftSort({ field: '', direction: 'asc' });
  const updateDraftField = (field: string) =>
    setDraftSort((prev) => (prev ? { ...prev, field } : null));
  const updateDraftDirection = (direction: 'asc' | 'desc') =>
    setDraftSort((prev) => (prev ? { ...prev, direction } : null));

  const saveDraftSort = () => {
    if (draftSort?.field) {
      onSortsChange([...sorts, { field: draftSort.field, direction: draftSort.direction }]);
      setDraftSort(null);
    }
  };

  const cancelDraftSort = () => setDraftSort(null);
  const removeSort = (index: number) => onSortsChange(sorts.filter((_, i) => i !== index));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{t('SORT_BY_LABEL')}</Label>
        {!draftSort ? (
          <Button variant="transparent" size="small" onClick={startNewSort}>
            <Plus className="mr-1 h-4 w-4" />
            {t('ADD_SORT_BUTTON')}
          </Button>
        ) : null}
      </div>

      {sorts.map((sort) => (
        <div
          key={`${sort.field}-${sort.direction}`}
          className="flex min-h-[2.5rem] items-center gap-2 rounded border bg-ui-bg-subtle p-2"
        >
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <Badge size="small" className="bg-ui-tag-neutral-bg text-ui-tag-neutral-text">
              <span className="max-w-[200px] truncate sm:max-w-none">{sort.field}</span>
            </Badge>
            <Badge size="small" className="bg-ui-tag-neutral-bg text-ui-tag-neutral-text">
              {sort.direction === 'asc' ? t('ASCENDING') : t('DESCENDING')}
            </Badge>
          </div>
          <IconButton
            variant="transparent"
            size="small"
            onClick={() => removeSort(sorts.indexOf(sort))}
          >
            <XMark className="h-4 w-4" />
          </IconButton>
        </div>
      ))}

      {draftSort ? (
        <div className="flex items-center gap-2 rounded border-2 border-dashed border-ui-border-base p-2">
          <div className="min-w-0 flex-1">
            <Select value={draftSort.field || undefined} onValueChange={updateDraftField}>
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
            <Select value={draftSort.direction} onValueChange={updateDraftDirection}>
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="asc">{t('ASCENDING')}</Select.Item>
                <Select.Item value="desc">{t('DESCENDING')}</Select.Item>
              </Select.Content>
            </Select>
          </div>

          <div className="flex flex-shrink-0 gap-1">
            <IconButton
              variant="transparent"
              size="small"
              onClick={saveDraftSort}
              disabled={!draftSort.field}
              title={t('SAVE_SORT_BUTTON')}
            >
              <Plus className="h-4 w-4" />
            </IconButton>
            <IconButton
              variant="transparent"
              size="small"
              onClick={cancelDraftSort}
              className="text-ui-fg-error hover:text-ui-fg-error"
              title={t('CANCEL_SORT_BUTTON')}
            >
              <XMark className="h-4 w-4" />
            </IconButton>
          </div>
        </div>
      ) : null}

      {sorts.length === 0 && !draftSort ? (
        <Text size="small" className="text-ui-fg-subtle">
          {t('NO_SORT_APPLIED')}
        </Text>
      ) : null}
    </div>
  );
};

export default SortBuilder;
