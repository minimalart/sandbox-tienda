import { FetchError } from '@medusajs/js-sdk';
import {
  QueryKey,
  useMutation,
  UseMutationOptions,
  useQuery,
  useQueryClient,
  UseQueryOptions,
} from '@tanstack/react-query';
import { sdk } from '../../lib/client';
import { queryKeysFactory } from '../../lib/query-key-factory';
import { toQueryString } from '../../lib/query-string';

/** `pending` incluido: una fila que quedó así es un intento que nunca cerró. */
export type NewsletterSyncStatus = 'pending' | 'synced' | 'failed' | 'skipped';

export interface NewsletterSubscription {
  id: string;
  email: string;
  site_id: string | null;
  source: string | null;
  sync_status: NewsletterSyncStatus;
  sync_error: string | null;
  synced_at: string | null;
  provider_list_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminNewsletterSubscriptionsResponse {
  newsletter_subscriptions: NewsletterSubscription[];
  count: number;
  /** Cuántas del scope NO llegaron a Brevo. Es el número que dispara la alerta. */
  pending_count: number;
  limit: number;
  offset: number;
}

export interface AdminRetryNewsletterSubscriptionResponse {
  newsletter_subscription: {
    id: string;
    sync_status: NewsletterSyncStatus;
    sync_error: string | null;
  };
}

export const newsletterSubscriptionQueryKey = queryKeysFactory('newsletter-subscription');

export const useNewsletterSubscriptions = (
  query?: Record<string, any>,
  options?: UseQueryOptions<
    AdminNewsletterSubscriptionsResponse,
    FetchError,
    AdminNewsletterSubscriptionsResponse,
    QueryKey
  >,
) => {
  const filterQuery = toQueryString(query);

  return useQuery({
    queryKey: newsletterSubscriptionQueryKey.list(query),
    queryFn: async () =>
      sdk.client.fetch<AdminNewsletterSubscriptionsResponse>(
        `/admin/newsletter-subscriptions${filterQuery ? `?${filterQuery}` : ''}`,
        { method: 'GET' },
      ),
    ...options,
  });
};

/**
 * Reintenta UNA suscripción.
 *
 * Invalida la lista entera y no sólo la fila: el reintento cambia también
 * `pending_count`, que es lo que decide si la pantalla muestra la alerta. Tocar
 * sólo la fila dejaría el cartel rojo puesto después de arreglar la última.
 */
export const useRetryNewsletterSubscription = (
  options?: UseMutationOptions<AdminRetryNewsletterSubscriptionResponse, FetchError, string>,
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch<AdminRetryNewsletterSubscriptionResponse>(
        `/admin/newsletter-subscriptions/${id}/retry`,
        { method: 'POST' },
      ),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: newsletterSubscriptionQueryKey.lists() });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
};
