import { defineWidgetConfig } from '@medusajs/admin-sdk';
import { AdminProduct, DetailWidgetProps } from '@medusajs/framework/types';
import { Container, Heading, Select, toast } from '@medusajs/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { sdk } from '../lib/client';
import { registerWidgetsTranslations } from '../translations/widgets';

interface Brand {
  id: string;
  name: string;
  handle: string;
}

interface ProductBrandLink {
  id: string;
  product_id: string;
  brand_id: string;
}

const ProductBrandWidget = ({ data }: DetailWidgetProps<AdminProduct>) => {
  const { t, i18n } = useTranslation('widgets');
  registerWidgetsTranslations(i18n);
  const queryClient = useQueryClient();
  const productId = data.id;

  const { data: brandsData } = useQuery({
    queryKey: ['brands'],
    queryFn: () => sdk.client.fetch<{ brands: Brand[] }>('/admin/brands', { method: 'GET' }),
  });

  const { data: linksData, isPending: isLoadingLinks } = useQuery({
    queryKey: ['product-brand-links', productId],
    queryFn: async () => {
      const brands = brandsData?.brands || [];
      for (const brand of brands) {
        const result = await sdk.client.fetch<{ links: ProductBrandLink[] }>(
          `/admin/brands/${brand.id}/products`,
          { method: 'GET' }
        );
        const link = result.links?.find((l) => l.product_id === productId);
        if (link) {
          return { brand, link };
        }
      }
      return null;
    },
    enabled: !!brandsData && !!productId,
  });

  const { mutateAsync: assignBrand, isPending: isAssigning } = useMutation({
    mutationFn: async (brandId: string) => {
      if (linksData?.brand) {
        await sdk.client.fetch(`/admin/brands/${linksData.brand.id}/products`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: { product_ids: [productId] },
        });
      }

      return sdk.client.fetch(`/admin/brands/${brandId}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { product_ids: [productId] },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-brand-links', productId] });
      toast.success(t('BRAND_ASSIGN_SUCCESS'));
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(t('BRAND_ASSIGN_FAILED', { message }));
    },
  });

  const { mutateAsync: removeBrand, isPending: isRemoving } = useMutation({
    mutationFn: (brandId: string) =>
      sdk.client.fetch(`/admin/brands/${brandId}/products`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: { product_ids: [productId] },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-brand-links', productId] });
      toast.success(t('BRAND_REMOVE_SUCCESS'));
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(t('BRAND_REMOVE_FAILED', { message }));
    },
  });

  const brands = brandsData?.brands || [];
  const currentBrand = linksData?.brand;
  const isLoading = isAssigning || isRemoving || isLoadingLinks;

  const handleBrandChange = async (value: string) => {
    if (value === 'none') {
      if (currentBrand) {
        await removeBrand(currentBrand.id);
      }
    } else {
      await assignBrand(value);
    }
  };

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h2">{t('BRAND_HEADING')}</Heading>
      </div>
      <div className="px-6 py-4">
        <Select
          value={currentBrand?.id || 'none'}
          onValueChange={handleBrandChange}
          disabled={isLoading}
        >
          <Select.Trigger>
            <Select.Value
              placeholder={isLoading ? t('BRAND_LOADING') : t('BRAND_SELECT_PLACEHOLDER')}
            />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="none">{t('BRAND_NONE')}</Select.Item>
            {brands.map((brand) => (
              <Select.Item key={brand.id} value={brand.id}>
                {brand.name}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      </div>
    </Container>
  );
};

export const config = defineWidgetConfig({
  zone: 'product.details.after',
});

export default ProductBrandWidget;
