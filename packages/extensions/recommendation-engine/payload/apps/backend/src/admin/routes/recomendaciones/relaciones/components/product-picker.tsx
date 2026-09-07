import { Input, Text } from '@medusajs/ui';
import { useEffect, useState } from 'react';
import {
  useRecommendationProductSearch,
  type ProductCard as ProductCardData,
} from '../../../../hooks/api/recommendations';
import { ProductCard } from './product-card';

/**
 * Buscador de productos con debounce.
 *
 * El debounce no es cosmético: sin él, cada tecla dispara una búsqueda de productos
 * más el enriquecido con precio y stock de los resultados.
 */
export function ProductPicker({
  label,
  placeholder,
  excludeIds = [],
  onSelect,
}: {
  label: string;
  placeholder?: string;
  excludeIds?: string[];
  onSelect: (product: ProductCardData) => void;
}) {
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term.trim()), 300);
    return () => clearTimeout(timer);
  }, [term]);

  const { data, isPending } = useRecommendationProductSearch({
    q: debounced || undefined,
    limit: 12,
  });

  const excluded = new Set(excludeIds);
  const results = (data?.products ?? []).filter((product) => !excluded.has(product.id));

  return (
    <div className="flex flex-col gap-2">
      <Text size="small" weight="plus">
        {label}
      </Text>
      <Input
        placeholder={placeholder ?? 'Buscar por nombre, handle o SKU…'}
        value={term}
        onChange={(event) => setTerm(event.target.value)}
      />
      <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
        {isPending ? (
          <Text size="small" className="text-ui-fg-subtle">
            Buscando…
          </Text>
        ) : results.length === 0 ? (
          <Text size="small" className="text-ui-fg-subtle">
            {debounced ? 'Sin resultados.' : 'Escribí para buscar productos.'}
          </Text>
        ) : (
          results.map((product) => (
            <ProductCard key={product.id} card={product} onClick={() => onSelect(product)} />
          ))
        )}
      </div>
    </div>
  );
}
