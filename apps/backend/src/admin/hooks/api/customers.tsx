import { FetchError } from '@medusajs/js-sdk';
import { QueryKey, useQuery, UseQueryOptions } from '@tanstack/react-query';
import { queryKeysFactory } from '../../lib/query-key-factory';
import { sdk } from '../../lib/client';

const CUSTOMER_QUERY_KEY = 'customer' as const;
export const customerQueryKeys = queryKeysFactory(CUSTOMER_QUERY_KEY);

export const useCustomers = (
  query?: Record<string, any>,
  options?: Omit<
    UseQueryOptions<any, FetchError, any, QueryKey>,
    'queryFn' | 'queryKey'
  >,
) => {
  const { data, ...rest } = useQuery({
    queryFn: () => sdk.admin.customer.list(query),
    queryKey: customerQueryKeys.list(query),
    ...options,
  });

  return { ...data, ...rest };
};
