import { Button, Input, Text, clx } from '@medusajs/ui';
import { Trash, DotsSix } from '@medusajs/icons';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { sdk } from '../../lib/client';

type AdminProductLite = {
  id: string;
  title: string;
  thumbnail?: string | null;
};

type Props = {
  value: string[];
  onChange: (ids: string[]) => void;
};

/**
 * Product association panel for an article: search the catalog, add multiple
 * products, reorder them with drag & drop (dnd-kit) and remove. Emits the
 * ordered list of product ids; persistence is handled by the parent.
 */
export const ProductSelector = ({ value, onChange }: Props) => {
  const { t } = useTranslation('blog');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  // Search results
  const { data: searchData } = useQuery({
    queryKey: ['blog-product-search', debounced],
    queryFn: () =>
      sdk.admin.product.list({
        q: debounced,
        limit: 8,
        fields: 'id,title,thumbnail',
      }),
    enabled: debounced.length > 0,
  });

  // Hydrate currently-selected products (titles/thumbnails) preserving order
  const { data: selectedData } = useQuery({
    queryKey: ['blog-product-selected', value],
    queryFn: () =>
      sdk.admin.product.list({
        id: value,
        limit: value.length,
        fields: 'id,title,thumbnail',
      }),
    enabled: value.length > 0,
  });

  const selectedProducts: AdminProductLite[] = useMemo(() => {
    const byId = new Map<string, AdminProductLite>(
      (selectedData?.products ?? []).map((p) => [
        p.id,
        { id: p.id, title: p.title, thumbnail: p.thumbnail },
      ]),
    );
    return value.map(
      (id) => byId.get(id) ?? { id, title: id, thumbnail: null },
    );
  }, [value, selectedData]);

  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = value.indexOf(active.id as string);
      const newIndex = value.indexOf(over.id as string);
      onChange(arrayMove(value, oldIndex, newIndex));
    }
  };

  const add = (id: string) => {
    if (!value.includes(id)) {
      onChange([...value, id]);
    }
    setSearch('');
    setDebounced('');
  };

  const remove = (id: string) => onChange(value.filter((v) => v !== id));

  const results = (searchData?.products ?? []).filter(
    (p) => !value.includes(p.id),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Input
          placeholder={t('PRODUCTS_SEARCH')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {debounced && results.length > 0 && (
          <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-ui-border-base bg-ui-bg-base shadow-elevation-flyout">
            {results.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => add(p.id)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-ui-bg-base-hover"
              >
                <Thumb src={p.thumbnail} />
                <Text size="small">{p.title}</Text>
              </button>
            ))}
          </div>
        )}
      </div>

      {value.length === 0 ? (
        <Text size="small" className="text-ui-fg-muted">
          {t('PRODUCTS_EMPTY')}
        </Text>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={value} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col gap-2">
              {selectedProducts.map((p) => (
                <SortableRow
                  key={p.id}
                  product={p}
                  onRemove={() => remove(p.id)}
                  removeLabel={t('PRODUCTS_REMOVE')}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
};

function SortableRow({
  product,
  onRemove,
  removeLabel,
}: {
  product: AdminProductLite;
  onRemove: () => void;
  removeLabel: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: product.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={clx(
        'flex items-center gap-2 rounded-lg border border-ui-border-base bg-ui-bg-base px-2 py-1.5',
        { 'opacity-60': isDragging },
      )}
    >
      <button
        type="button"
        className="cursor-grab text-ui-fg-muted"
        {...attributes}
        {...listeners}
      >
        <DotsSix />
      </button>
      <Thumb src={product.thumbnail} />
      <Text size="small" className="flex-1 truncate">
        {product.title}
      </Text>
      <Button
        type="button"
        variant="transparent"
        size="small"
        onClick={onRemove}
        title={removeLabel}
      >
        <Trash className="text-ui-fg-muted" />
      </Button>
    </li>
  );
}

function Thumb({ src }: { src?: string | null }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded bg-ui-bg-component">
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : null}
    </span>
  );
}

export default ProductSelector;
