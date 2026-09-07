import Medusa from '@medusajs/js-sdk';
import { useQuery } from '@tanstack/react-query';
import type { SpaceCatalogProduct, SpaceConfigurator, SpaceConfiguratorInput } from '../../types';

export const sdk = new Medusa({ baseUrl: '/', auth: { type: 'session' } });
export const configuratorKey = ['space-designer-configurators'] as const;

export function useConfigurators(search: string, offset: number, limit: number) {
  return useQuery({
    queryKey: [...configuratorKey, search, offset, limit],
    queryFn: () =>
      sdk.client.fetch<{ configurators: SpaceConfigurator[]; count: number }>(
        '/admin/space-designer/configurators',
        { query: { q: search, offset, limit } }
      ),
  });
}

export function useCatalog(search: string, offset: number, channel: string | null) {
  return useQuery({
    queryKey: ['space-designer-catalog', search, offset, channel],
    queryFn: () =>
      sdk.client.fetch<{ products: SpaceCatalogProduct[]; count: number }>(
        '/admin/space-designer/products',
        {
          query: { q: search, offset, limit: 8, ...(channel ? { sales_channel_id: channel } : {}) },
        }
      ),
  });
}

export function useSalesChannels() {
  return useQuery({
    queryKey: ['space-designer-sales-channels'],
    queryFn: () => sdk.admin.salesChannel.list({ limit: 200, fields: 'id,name' }),
  });
}

export function saveConfigurator(id: string | undefined, input: SpaceConfiguratorInput) {
  return sdk.client.fetch<{ configurator: SpaceConfigurator }>(
    `/admin/space-designer/configurators${id ? `/${id}` : ''}`,
    { method: 'POST', body: input }
  );
}

export function deleteConfigurator(id: string) {
  return sdk.client.fetch(`/admin/space-designer/configurators/${id}`, { method: 'DELETE' });
}

export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'No se pudo completar la operación.';
