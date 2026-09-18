import { Checkbox, Label, Text } from '@medusajs/ui';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDemoStores } from '../../../hooks/api';

/**
 * Multi-select for Store availability. Reads the existing demo_stores via
 * the shared `useDemoStores` hook — no second listing endpoint.
 *
 * When the project has no `demo_store` module (endpoint 404s / empty), the
 * component renders a single-tenant notice per PRD §63 fallback.
 */
export const StoreMultiSelect = ({
  value,
  onChange,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
}) => {
  const { t } = useTranslation('bundles');
  const { data, isPending, isError } = useDemoStores({ limit: 100 });
  const stores = data?.demo_stores ?? [];
  const selected = useMemo(() => new Set(value), [value]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };

  if (isPending) return <Text className="text-ui-fg-subtle">Cargando tiendas…</Text>;
  if (isError || stores.length === 0) {
    return <Text className="text-ui-fg-subtle">{t('AVAILABILITY_SINGLE_TENANT')}</Text>;
  }

  return (
    <ul className="divide-y rounded-md border">
      {stores.map((store) => (
        <li key={store.id} className="flex items-center gap-3 px-3 py-2">
          <Checkbox
            id={`store-${store.id}`}
            checked={selected.has(store.id)}
            onCheckedChange={() => toggle(store.id)}
          />
          <Label htmlFor={`store-${store.id}`} className="flex-1">
            {store.name}
            {store.is_main && (
              <span className="ml-2 text-xs text-ui-fg-subtle">principal</span>
            )}
          </Label>
        </li>
      ))}
    </ul>
  );
};
