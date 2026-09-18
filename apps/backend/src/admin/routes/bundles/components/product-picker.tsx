import { Button, Input, Text } from '@medusajs/ui';
import { Trash } from '@medusajs/icons';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { sdk } from '../../../lib/client';

export interface BundleItemDraft {
  product_id: string;
  quantity: number;
  position?: number;
}

interface AdminProductLite {
  id: string;
  title: string;
  thumbnail?: string | null;
}

/**
 * Product picker for the Bundle wizard. Search the catalog, add products,
 * tweak quantity, remove. Order is meaningful (position); simple up/down
 * buttons for reorder — no drag-drop dependency added on top of the ones
 * the admin already ships.
 */
export const ProductPicker = ({
  value,
  onChange,
}: {
  value: BundleItemDraft[];
  onChange: (items: BundleItemDraft[]) => void;
}) => {
  const { t } = useTranslation('bundles');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const { data: searchData, isLoading: isSearching } = useQuery({
    queryKey: ['bundle-product-search', debounced],
    queryFn: () =>
      sdk.admin.product.list({ q: debounced, limit: 8, fields: 'id,title,thumbnail' }),
    enabled: debounced.length > 0,
  });

  const selectedIds = value.map((v) => v.product_id);
  const { data: selectedData } = useQuery({
    queryKey: ['bundle-product-selected', selectedIds],
    queryFn: () =>
      sdk.admin.product.list({
        id: selectedIds,
        limit: selectedIds.length,
        fields: 'id,title,thumbnail',
      }),
    enabled: selectedIds.length > 0,
  });

  const productsById = useMemo(() => {
    const map = new Map<string, AdminProductLite>();
    for (const p of selectedData?.products ?? []) {
      map.set(p.id, { id: p.id, title: p.title, thumbnail: p.thumbnail });
    }
    return map;
  }, [selectedData]);

  const addProduct = (product: AdminProductLite) => {
    if (value.some((v) => v.product_id === product.id)) return;
    onChange([...value, { product_id: product.id, quantity: 1, position: value.length }]);
    setSearch('');
    setDebounced('');
  };

  const updateItem = (index: number, patch: Partial<BundleItemDraft>) => {
    const next = value.map((item, i) => (i === index ? { ...item, ...patch } : item));
    onChange(next);
  };

  const removeItem = (index: number) => {
    const next = value
      .filter((_, i) => i !== index)
      .map((item, i) => ({ ...item, position: i }));
    onChange(next);
  };

  const moveItem = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= value.length) return;
    const next = value.slice();
    [next[index]!, next[target]!] = [next[target]!, next[index]!];
    onChange(next.map((item, i) => ({ ...item, position: i })));
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Input
          placeholder={t('SEARCH_PLACEHOLDER')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {debounced && (
          <ul className="max-h-56 overflow-y-auto rounded-md border">
            {isSearching && (
              <li className="px-3 py-2 text-ui-fg-subtle text-sm">Buscando…</li>
            )}
            {(searchData?.products ?? []).map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-ui-bg-subtle"
                  onClick={() => addProduct({ id: p.id, title: p.title, thumbnail: p.thumbnail })}
                >
                  {p.thumbnail && (
                    <img
                      src={p.thumbnail}
                      alt=""
                      className="h-8 w-8 rounded object-cover"
                    />
                  )}
                  <span>{p.title}</span>
                </button>
              </li>
            ))}
            {!isSearching && (searchData?.products?.length ?? 0) === 0 && (
              <li className="px-3 py-2 text-ui-fg-subtle text-sm">Sin resultados.</li>
            )}
          </ul>
        )}
      </div>

      {value.length === 0 ? (
        <Text className="text-ui-fg-subtle">{t('PRODUCT_EMPTY_STATE')}</Text>
      ) : (
        <ul className="divide-y rounded-md border">
          {value.map((item, index) => {
            const product = productsById.get(item.product_id);
            return (
              <li key={item.product_id} className="flex items-center gap-3 px-3 py-2">
                {product?.thumbnail && (
                  <img src={product.thumbnail} alt="" className="h-8 w-8 rounded object-cover" />
                )}
                <span className="flex-1 truncate">{product?.title ?? item.product_id}</span>
                <label className="flex items-center gap-2">
                  <span className="text-xs text-ui-fg-subtle">{t('FIELD_QUANTITY')}</span>
                  <Input
                    type="number"
                    min={1}
                    className="w-20"
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(index, { quantity: Math.max(1, Number(e.target.value) || 1) })
                    }
                  />
                </label>
                <div className="flex flex-col">
                  <button
                    type="button"
                    className="text-xs disabled:opacity-30"
                    onClick={() => moveItem(index, -1)}
                    disabled={index === 0}
                    aria-label="Mover arriba"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="text-xs disabled:opacity-30"
                    onClick={() => moveItem(index, 1)}
                    disabled={index === value.length - 1}
                    aria-label="Mover abajo"
                  >
                    ↓
                  </button>
                </div>
                <Button
                  size="small"
                  variant="transparent"
                  onClick={() => removeItem(index)}
                  aria-label="Eliminar"
                >
                  <Trash />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
