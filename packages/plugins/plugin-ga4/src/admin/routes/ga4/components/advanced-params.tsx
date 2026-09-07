import { Text } from '@medusajs/ui';
import { TriangleDownMini, TriangleRightMini } from '@medusajs/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ParamMappingsEditor, type ParamRow } from './param-mappings-editor';

interface AdvancedParamsProps {
  rows: ParamRow[];
  onChange: (rows: ParamRow[]) => void;
  suggestedParams?: string[];
}

/**
 * Sección colapsable "Opciones avanzadas" que esconde el editor de mapeo de
 * parámetros. El usuario común no lo ve; quien lo necesite lo despliega.
 */
export const AdvancedParams = ({ rows, onChange, suggestedParams }: AdvancedParamsProps) => {
  const { t } = useTranslation('ga4Events');
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3 border-t pt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-ui-fg-subtle"
      >
        {open ? <TriangleDownMini /> : <TriangleRightMini />}
        <Text size="small" weight="plus">
          {t('ADVANCED_TITLE')}
        </Text>
      </button>
      {open && (
        <ParamMappingsEditor rows={rows} onChange={onChange} suggestedParams={suggestedParams} />
      )}
    </div>
  );
};
