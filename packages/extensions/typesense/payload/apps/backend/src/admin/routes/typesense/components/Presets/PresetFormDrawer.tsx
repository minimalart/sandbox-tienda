import { Button, Drawer, Heading, Input, Label, Switch, Text } from '@medusajs/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { SearchPreset, SearchPresetFieldRow } from '../../../../../modules/typesense/types';

const DEFAULT_FIELDS: SearchPresetFieldRow[] = [
  { field: 'title', weight: 10, enabled: true },
  { field: 'brand.name', weight: 8, enabled: true },
  { field: 'categories.name', weight: 7, enabled: true },
  { field: 'categories.parent_category.name', weight: 5, enabled: true },
  { field: 'tags.value', weight: 4, enabled: true },
  { field: 'variants.sku', weight: 6, enabled: true },
  { field: 'variants.title', weight: 3, enabled: true },
  { field: 'collection.title', weight: 3, enabled: true },
  { field: 'description', weight: 2, enabled: true },
  { field: 'subtitle', weight: 2, enabled: true },
  { field: 'gender.name', weight: 2, enabled: false },
  { field: 'age_group.name', weight: 2, enabled: false },
  { field: 'handle', weight: 1, enabled: false },
];

function parsePresetToFields(preset: SearchPreset): SearchPresetFieldRow[] {
  if (!preset.value.query_by) return DEFAULT_FIELDS;

  const fieldNames = preset.value.query_by.split(',').map((f) => f.trim());
  const weights = preset.value.query_by_weights
    ? preset.value.query_by_weights.split(',').map((w) => parseInt(w.trim(), 10))
    : fieldNames.map(() => 1);

  const activeRows: SearchPresetFieldRow[] = fieldNames.map((field, i) => ({
    field,
    weight: weights[i] ?? 1,
    enabled: true,
  }));

  const inactiveFields = DEFAULT_FIELDS.filter((d) => !fieldNames.includes(d.field)).map((d) => ({
    ...d,
    enabled: false,
  }));

  return [...activeRows, ...inactiveFields];
}

export interface PresetFormDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    name: string,
    fields: SearchPresetFieldRow[],
    sortBy: string,
    numTypos: number,
    prefix: boolean
  ) => void;
  editingPreset?: SearchPreset | null;
  loading?: boolean;
}

const PresetFormDrawer = ({
  isOpen,
  onOpenChange,
  onSubmit,
  editingPreset,
  loading = false,
}: PresetFormDrawerProps) => {
  const { t } = useTranslation('typesense');
  const isEdit = Boolean(editingPreset);

  const [name, setName] = useState('');
  const [fields, setFields] = useState<SearchPresetFieldRow[]>(DEFAULT_FIELDS);
  const [sortBy, setSortBy] = useState('');
  const [numTypos, setNumTypos] = useState(2);
  const [prefix, setPrefix] = useState(true);

  useEffect(() => {
    if (editingPreset) {
      setName(editingPreset.name);
      setFields(parsePresetToFields(editingPreset));
      setSortBy(String(editingPreset.value.sort_by ?? ''));
      setNumTypos(Number(editingPreset.value.num_typos ?? 2));
      setPrefix(editingPreset.value.prefix === true || editingPreset.value.prefix === 'true');
    } else {
      setName('');
      setFields(DEFAULT_FIELDS);
      setSortBy('');
      setNumTypos(2);
      setPrefix(true);
    }
  }, [editingPreset, isOpen]);

  const updateFieldWeight = (index: number, weight: number) => {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, weight } : f)));
  };

  const updateFieldEnabled = (index: number, enabled: boolean) => {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, enabled } : f)));
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSubmit(name.trim(), fields, sortBy, numTypos, prefix);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const activeCount = fields.filter((f) => f.enabled).length;

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange}>
      <Drawer.Content className="max-w-[560px]">
        <Drawer.Header>
          <Drawer.Title>
            {isEdit ? t('PRESET_FORM_EDIT_TITLE') : t('PRESET_FORM_CREATE_TITLE')}
          </Drawer.Title>
        </Drawer.Header>

        <Drawer.Body className="flex max-w-full flex-1 flex-col gap-y-6 overflow-y-auto px-6 py-4">
          {/* Preset Name */}
          <div className="flex flex-col gap-y-2">
            <Label size="small" weight="plus">
              {t('PRESET_NAME_LABEL')}
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('PRESET_NAME_PLACEHOLDER')}
              disabled={isEdit || loading}
            />
            <Text className="text-xs text-ui-fg-subtle">
              {isEdit ? t('PRESET_NAME_EDIT_HELP') : t('PRESET_NAME_HELP_TEXT')}
            </Text>
          </div>

          {/* Field Priorities Table */}
          <div className="flex flex-col gap-y-3">
            <div>
              <Heading level="h3" className="text-sm font-medium">
                {t('FIELDS_SECTION_TITLE')}
              </Heading>
              <Text className="text-xs text-ui-fg-subtle mt-1">{t('FIELDS_SECTION_SUBTITLE')}</Text>
            </div>

            <div className="rounded-lg border border-ui-border-base overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-ui-bg-subtle">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-ui-fg-subtle">
                      {t('FIELD_COLUMN')}
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-ui-fg-subtle w-20">
                      {t('WEIGHT_COLUMN')}
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-ui-fg-subtle w-16">
                      {t('ACTIVE_COLUMN')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((row, index) => (
                    <tr
                      key={row.field}
                      className={`border-t border-ui-border-base transition-colors ${
                        row.enabled ? 'bg-ui-bg-base' : 'bg-ui-bg-subtle opacity-60'
                      }`}
                    >
                      <td className="px-3 py-2">
                        <code className="text-xs font-mono text-ui-fg-base">{row.field}</code>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={1}
                          max={999}
                          value={row.weight}
                          disabled={!row.enabled || loading}
                          onChange={(e) =>
                            updateFieldWeight(index, parseInt(e.target.value, 10) || 1)
                          }
                          className="w-full rounded border border-ui-border-base bg-ui-bg-field px-2 py-1 text-center text-xs text-ui-fg-base focus:outline-none focus:ring-1 focus:ring-ui-border-interactive disabled:cursor-not-allowed disabled:opacity-40"
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Switch
                          checked={row.enabled}
                          onCheckedChange={(checked) => updateFieldEnabled(index, checked)}
                          disabled={loading}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Text className="text-xs text-ui-fg-subtle">
              {activeCount} field{activeCount !== 1 ? 's' : ''} active
            </Text>
          </div>

          {/* Sort By */}
          <div className="flex flex-col gap-y-2">
            <Label size="small" weight="plus">
              {t('SORT_BY_LABEL')}
            </Label>
            <Input
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              placeholder={t('SORT_BY_PLACEHOLDER')}
              disabled={loading}
            />
            <Text className="text-xs text-ui-fg-subtle">{t('SORT_BY_HELP_TEXT')}</Text>
          </div>

          {/* Advanced Options */}
          <div className="flex flex-col gap-y-3">
            <Heading level="h3" className="text-sm font-medium">
              {t('ADVANCED_SECTION_TITLE')}
            </Heading>

            <div className="flex items-center justify-between rounded-lg border border-ui-border-base px-4 py-3">
              <div className="flex flex-col gap-y-1">
                <Label size="small" weight="plus">
                  {t('NUM_TYPOS_LABEL')}
                </Label>
                <Text className="text-xs text-ui-fg-subtle">{t('NUM_TYPOS_HELP_TEXT')}</Text>
              </div>
              <input
                type="number"
                min={0}
                max={2}
                value={numTypos}
                disabled={loading}
                onChange={(e) => setNumTypos(parseInt(e.target.value, 10))}
                className="w-16 rounded border border-ui-border-base bg-ui-bg-field px-2 py-1 text-center text-sm text-ui-fg-base focus:outline-none focus:ring-1 focus:ring-ui-border-interactive"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-ui-border-base px-4 py-3">
              <div className="flex flex-col gap-y-1">
                <Label size="small" weight="plus">
                  {t('PREFIX_LABEL')}
                </Label>
                <Text className="text-xs text-ui-fg-subtle">{t('PREFIX_HELP_TEXT')}</Text>
              </div>
              <Switch checked={prefix} onCheckedChange={setPrefix} disabled={loading} />
            </div>
          </div>
        </Drawer.Body>

        <Drawer.Footer>
          <div className="flex items-center justify-end gap-x-2">
            <Drawer.Close asChild>
              <Button size="small" variant="secondary" onClick={handleCancel} disabled={loading}>
                {t('CANCEL_BUTTON')}
              </Button>
            </Drawer.Close>
            <Button size="small" onClick={handleSubmit} disabled={loading || !name.trim()}>
              {loading ? t('SAVING_TEXT') : isEdit ? t('UPDATE_BUTTON') : t('SAVE_BUTTON')}
            </Button>
          </div>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};

export default PresetFormDrawer;
