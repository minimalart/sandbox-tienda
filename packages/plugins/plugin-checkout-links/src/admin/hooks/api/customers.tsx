import { FetchError } from '@medusajs/js-sdk';
import { QueryKey, useQuery, UseQueryOptions } from '@tanstack/react-query';
import { sdk } from '../../lib/client';

/**
 * Plugin-local `useCustomers` — vendored del host
 * (`apps/backend/src/admin/hooks/api/customers.tsx`) porque el form del plugin
 * lo usa para el buscador de clientes de la pestaña "Cliente" del FocusModal.
 *
 * Se copia la firma mínima que el form consume (`{ customers, isFetching }`);
 * no re-exporta el `queryKeysFactory` compartido del host, que acá no aporta.
 */

const CUSTOMER_QUERY_KEY = 'plugin-checkout-links-customer' as const;

export const useCustomers = (
  query?: Record<string, any>,
  options?: Omit<
    UseQueryOptions<any, FetchError, any, QueryKey>,
    'queryFn' | 'queryKey'
  >,
) => {
  const { data, ...rest } = useQuery({
    queryFn: () => sdk.admin.customer.list(query),
    queryKey: [CUSTOMER_QUERY_KEY, 'list', { query }],
    ...options,
  });

  return { ...data, ...rest };
};
