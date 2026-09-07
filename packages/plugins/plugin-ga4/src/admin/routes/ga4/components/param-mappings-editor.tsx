import { Button, IconButton, Input, Label, Text } from '@medusajs/ui';
import { Plus, Trash } from '@medusajs/icons';
import { useTranslation } from 'react-i18next';
import type { Ga4ParamMapping } from '../../../hooks/api/ga4-mappings';

export interface ParamRow {
  ga4_param: string;
  source_path: string;
  static_value: string;
}

export const emptyParamRow = (): ParamRow => ({
  ga4_param: '',
  source_path: '',
  static_value: '',
});

export const toParamRows = (params?: Ga4ParamMapping[]): ParamRow[] =>
  (params ?? []).map((p) => ({
    ga4_param: p.ga4_param ?? '',
    source_path: p.source_path ?? '',
    static_value: p.static_value ?? '',
  }));

/**
 * Drops fully-empty rows and serializes back to the API shape, omitting
 * empty optional fields so the backend stores only what the user filled in.
 */
export const fromParamRows = (rows: ParamRow[]): Ga4ParamMapping[] =>
  rows
    .filter((r) => r.ga4_param.trim() || r.source_path.trim() || r.static_value.trim())
    .map((r) => ({
      ga4_param: r.ga4_param.trim(),
      source_path: r.source_path.trim() || undefined,
      static_value: r.static_value.trim() || undefined,
    }));

interface ParamMappingsEditorProps {
  rows: ParamRow[];
  onChange: (rows: ParamRow[]) => void;
  suggestedParams?: string[];
}

export const ParamMappingsEditor = ({
  rows,
  onChange,
  suggestedParams,
}: ParamMappingsEditorProps) => {
  const { t } = useTranslation('ga4Events');

  const updateRow = (index: number, patch: Partial<ParamRow>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const removeRow = (index: number) => {
    onChange(rows.filter((_, i) => i !== index));
  };

  const addRow = () => {
    onChange([...rows, emptyParamRow()]);
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Label>{t('PARAMS_TITLE')}</Label>
        <Text size="small" className="text-ui-fg-subtle">
          {t('PARAMS_HELP')}
        </Text>
        {suggestedParams && suggestedParams.length > 0 && (
          <Text size="small" className="text-ui-fg-muted">
            {t('PARAMS_SUGGESTED', { params: suggestedParams.join(', ') })}
          </Text>
        )}
        <div className="mt-2 rounded-lg bg-ui-bg-subtle px-3 py-2">
          <Text size="small" className="text-ui-fg-muted">
            {t('PARAMS_EXAMPLE')}
          </Text>
        </div>
      </div>

      {rows.map((row, index) => (
        <div key={index} className="flex items-end gap-2">
          <div className="flex flex-1 flex-col gap-1">
            {index === 0 && (
              <Label size="small" className="text-ui-fg-subtle">
                {t('PARAM_GA4_PARAM_LABEL')}
              </Label>
            )}
            <Input
              size="small"
              placeholder={t('PARAM_GA4_PARAM_PLACEHOLDER')}
              value={row.ga4_param}
              onChange={(e) => updateRow(index, { ga4_param: e.target.value })}
            />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            {index === 0 && (
              <Label size="small" className="text-ui-fg-subtle">
                {t('PARAM_SOURCE_PATH_LABEL')}
              </Label>
            )}
            <Input
              size="small"
              placeholder={t('PARAM_SOURCE_PATH_PLACEHOLDER')}
              value={row.source_path}
              onChange={(e) => updateRow(index, { source_path: e.target.value })}
            />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            {index === 0 && (
              <Label size="small" className="text-ui-fg-subtle">
                {t('PARAM_STATIC_VALUE_LABEL')}
              </Label>
            )}
            <Input
              size="small"
              placeholder={t('PARAM_STATIC_VALUE_PLACEHOLDER')}
              value={row.static_value}
              onChange={(e) => updateRow(index, { static_value: e.target.value })}
            />
          </div>
          <IconButton
            type="button"
            variant="transparent"
            onClick={() => removeRow(index)}
            aria-label={t('PARAM_REMOVE')}
          >
            <Trash className="text-ui-fg-error" />
          </IconButton>
        </div>
      ))}

      <div>
        <Button type="button" variant="secondary" size="small" onClick={addRow}>
          <Plus />
          {t('PARAM_ADD')}
        </Button>
      </div>
    </div>
  );
};
