import { Badge, Text } from '@medusajs/ui';
import type { ProductCard as ProductCardData } from '../../../../hooks/api/recommendations';

/**
 * Card de producto del selector y del listado de relaciones. Muestra los datos que
 * pide el PRD §16.2: imagen, nombre, SKU, precio, estado y stock.
 */

const formatPrice = (card: ProductCardData): string => {
  if (card.price === null) return 'Sin precio';
  const currency = (card.currency_code ?? '').toUpperCase();
  return `$${card.price.toLocaleString('es-AR', { maximumFractionDigits: 0 })}${currency ? ` ${currency}` : ''}`;
};

const stockLabel = (card: ProductCardData): { text: string; color: 'green' | 'orange' | 'red' } => {
  // `manage_inventory === false` es stock ilimitado, no cero: mostrarlo como "Sin
  // stock" haría que el merchant evite relacionar productos perfectamente vendibles.
  if (card.unlimited_stock) return { text: 'Sin control de stock', color: 'green' };
  if (card.stock <= 0) return { text: 'Sin stock', color: 'red' };
  if (card.stock < 5) return { text: `${card.stock} u.`, color: 'orange' };
  return { text: `${card.stock} u.`, color: 'green' };
};

export function ProductCard({
  card,
  right,
  onClick,
}: {
  card: ProductCardData;
  right?: React.ReactNode;
  onClick?: () => void;
}) {
  const stock = stockLabel(card);
  const isDraft = card.status !== 'published';

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border border-ui-border-base p-2 ${
        onClick ? 'cursor-pointer hover:bg-ui-bg-base-hover' : ''
      }`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {card.thumbnail ? (
        <img
          src={card.thumbnail}
          alt=""
          className="h-10 w-10 flex-shrink-0 rounded object-cover"
          loading="lazy"
        />
      ) : (
        <div className="h-10 w-10 flex-shrink-0 rounded bg-ui-bg-component" />
      )}

      <div className="min-w-0 flex-1">
        <Text size="small" weight="plus" className="truncate">
          {card.title ?? card.id}
        </Text>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {card.sku ? (
            <Text size="xsmall" className="text-ui-fg-subtle">
              {card.sku}
            </Text>
          ) : null}
          <Text size="xsmall" className="text-ui-fg-subtle">
            {formatPrice(card)}
          </Text>
          <Badge size="2xsmall" color={stock.color}>
            {stock.text}
          </Badge>
          {isDraft ? (
            <Badge size="2xsmall" color="grey">
              {card.status ?? 'sin estado'}
            </Badge>
          ) : null}
        </div>
      </div>

      {right}
    </div>
  );
}

/** Placeholder para una relación cuyo producto ya no existe. */
export function MissingProductCard({ productId }: { productId: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-ui-border-error border-dashed p-2">
      <div className="h-10 w-10 flex-shrink-0 rounded bg-ui-bg-component" />
      <div className="min-w-0 flex-1">
        <Text size="small" weight="plus" className="text-ui-fg-error">
          Producto eliminado
        </Text>
        <Text size="xsmall" className="truncate text-ui-fg-subtle">
          {productId}
        </Text>
      </div>
    </div>
  );
}
