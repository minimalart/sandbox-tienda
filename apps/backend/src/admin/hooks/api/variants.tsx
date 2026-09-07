import { FetchError } from '@medusajs/js-sdk';
import { QueryKey, useQuery, UseQueryOptions } from '@tanstack/react-query';
import { queryKeysFactory } from '../../lib/query-key-factory';
import { sdk } from '../../lib/client';

const PRODUCT_VARIANT_QUERY_KEY = 'product_variant' as const;
export const productVariantQueryKeys = queryKeysFactory(PRODUCT_VARIANT_QUERY_KEY);

const PRODUCT_QUERY_KEY = 'product' as const;
export const productQueryKeys = queryKeysFactory(PRODUCT_QUERY_KEY);

export const useVariants = (
  query?: Record<string, any>,
  options?: Omit<UseQueryOptions<any, FetchError, any, QueryKey>, 'queryFn' | 'queryKey'>
) => {
  const { data, ...rest } = useQuery({
    queryFn: () => sdk.admin.productVariant.list(query),
    queryKey: productVariantQueryKeys.list(query),
    ...options,
  });

  return { ...data, ...rest };
};

export const useProducts = (
  query?: Record<string, any>,
  options?: Omit<UseQueryOptions<any, FetchError, any, QueryKey>, 'queryFn' | 'queryKey'>
) => {
  const { data, ...rest } = useQuery({
    queryFn: () => sdk.admin.product.list(query),
    queryKey: productQueryKeys.list(query),
    ...options,
  });

  return { ...data, ...rest };
};
