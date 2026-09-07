import { XMarkMini } from '@medusajs/icons';
import { Badge, Button, Label, Select } from '@medusajs/ui';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';

interface MultiSelectFieldProps {
  label: string;
  options: string[];
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
  placeholder?: string;
}

const MultiSelectField: FC<MultiSelectFieldProps> = ({
  label,
  options,
  selectedValues,
  onSelectionChange,
  placeholder,
}) => {
  const { t } = useTranslation('typesense');
  const defaultPlaceholder = placeholder || t('SELECT_FIELDS_PLACEHOLDER');

  const handleRemoveOption = (option: string) => {
    onSelectionChange(selectedValues.filter((value) => value !== option));
  };

  const handleSelectChange = (value: string) => {
    if (value && !selectedValues.includes(value)) {
      onSelectionChange([...selectedValues, value]);
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>

      {selectedValues.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {selectedValues.map((value) => (
            <Badge key={value} className="flex items-center gap-1">
              {value}
              <Button
                variant="transparent"
                type="button"
                className="ml-1 p-0"
                onClick={() => handleRemoveOption(value)}
              >
                <XMarkMini />
              </Button>
            </Badge>
          ))}
        </div>
      ) : null}

      <Select onValueChange={handleSelectChange} value="">
        <Select.Trigger>
          <Select.Value placeholder={defaultPlaceholder} />
        </Select.Trigger>
        <Select.Content className="max-h-60">
          {options.length === 0 ? (
            <div className="p-2 text-sm text-ui-fg-subtle">{t('NO_OPTIONS_AVAILABLE')}</div>
          ) : (
            options
              .filter((option) => !selectedValues.includes(option))
              .map((option) => (
                <Select.Item key={option} value={option}>
                  {option}
                </Select.Item>
              ))
          )}
        </Select.Content>
      </Select>
    </div>
  );
};

export default MultiSelectField;
