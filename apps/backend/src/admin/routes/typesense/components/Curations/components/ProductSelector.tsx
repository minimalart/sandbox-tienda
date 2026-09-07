import { MagnifyingGlass, XMark } from '@medusajs/icons';
import { Badge, Button, IconButton, Input, Text } from '@medusajs/ui';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Product, ProductSelectorProps } from '../../../../../../modules/typesense/types';
import { useProducts } from '../../../../../hooks/api/variants';

const ProductSelector = ({ selectedProducts, onProductsChange }: ProductSelectorProps) => {
  const { t } = useTranslation('typesense');
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const {
    products: productsPayload,
    isPending: productsLoading,
    error,
  } = useProducts(
    {
      limit: 50,
      q: searchTerm || undefined,
      fields: 'id,title,description,thumbnail',
    },
    {
      enabled: isOpen,
    }
  );

  const products = useMemo(() => {
    if (Array.isArray(productsPayload)) {
      return (productsPayload as Product[]) || [];
    }
    return (productsPayload?.products as Product[]) || [];
  }, [productsPayload]);

  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) {
      return products;
    }

    return products.filter((product) => {
      const titleMatch = product.title?.toLowerCase().includes(searchTerm.toLowerCase());
      const descMatch = product.description?.toLowerCase().includes(searchTerm.toLowerCase());
      return Boolean(titleMatch || descMatch);
    });
  }, [products, searchTerm]);

  const availableProducts = useMemo(() => {
    return filteredProducts.filter(
      (product) => !selectedProducts.some((selected) => selected.id === product.id)
    );
  }, [filteredProducts, selectedProducts]);

  const handleProductSelect = (product: Product) => {
    onProductsChange([...selectedProducts, product]);
    setSearchTerm('');
    setIsOpen(false);
  };

  const handleProductRemove = (productId: string) => {
    onProductsChange(selectedProducts.filter((product) => product.id !== productId));
  };

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen]);

  if (productsLoading) {
    return <Text className="text-ui-fg-muted">{t('CURATIONS_PRODUCT_SELECTOR_LOADING')}</Text>;
  }

  if (error) {
    return (
      <Text className="text-ui-fg-error">
        {t('CURATIONS_PRODUCT_SELECTOR_ERROR', { error: error.message })}
      </Text>
    );
  }

  return (
    <div className="space-y-3">
      {selectedProducts.length > 0 ? (
        <div className="space-y-2">
          <Text size="small" weight="plus" className="text-ui-fg-subtle">
            {t('CURATIONS_PRODUCT_SELECTOR_SELECTED', { count: selectedProducts.length })}
          </Text>
          <div className="flex flex-wrap gap-2">
            {selectedProducts.map((product) => (
              <Badge key={product.id} className="flex items-center gap-2 pr-1">
                <span className="max-w-[200px] truncate">{product.title}</span>
                <IconButton
                  size="2xsmall"
                  variant="transparent"
                  onClick={() => handleProductRemove(product.id)}
                >
                  <XMark />
                </IconButton>
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              placeholder={t('CURATIONS_PRODUCT_SELECTOR_SEARCH_PLACEHOLDER')}
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                if (!isOpen) {
                  setIsOpen(true);
                }
              }}
              onFocus={() => setIsOpen(true)}
            />
            <MagnifyingGlass className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ui-fg-muted" />
          </div>
          <Button type="button" variant="secondary" size="small" onClick={() => setIsOpen(!isOpen)}>
            {t('CURATIONS_PRODUCT_SELECTOR_BROWSE')}
          </Button>
        </div>

        {isOpen ? (
          <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-ui-border-base bg-ui-bg-base shadow-lg">
            {availableProducts.length === 0 ? (
              <div className="p-3 text-center">
                <Text className="text-ui-fg-muted">
                  {searchTerm.trim()
                    ? t('CURATIONS_PRODUCT_SELECTOR_NO_RESULTS', { searchTerm })
                    : t('CURATIONS_PRODUCT_SELECTOR_ALL_SELECTED')}
                </Text>
              </div>
            ) : (
              <div className="py-1">
                {availableProducts.slice(0, 20).map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    className="flex w-full items-start gap-3 px-3 py-2 text-left transition-colors hover:bg-ui-bg-subtle"
                    onClick={() => handleProductSelect(product)}
                  >
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.title}
                        className="h-10 w-10 flex-shrink-0 rounded object-cover"
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <Text size="small" weight="plus" className="truncate">
                        {product.title}
                      </Text>
                      {product.description ? (
                        <Text size="xsmall" className="truncate text-ui-fg-muted">
                          {product.description}
                        </Text>
                      ) : null}
                    </div>
                  </button>
                ))}
                {availableProducts.length > 20 ? (
                  <div className="border-t border-ui-border-base px-3 py-2 text-center">
                    <Text size="xsmall" className="text-ui-fg-muted">
                      {t('CURATIONS_PRODUCT_SELECTOR_SHOWING_RESULTS', {
                        count: availableProducts.length,
                      })}
                    </Text>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {isOpen ? <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} /> : null}
    </div>
  );
};

export default ProductSelector;
