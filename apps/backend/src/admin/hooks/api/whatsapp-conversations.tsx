import { FetchError } from '@medusajs/js-sdk';
import {
  QueryKey,
  useMutation,
  UseMutationOptions,
  useQuery,
  UseQueryOptions,
  useQueryClient,
} from '@tanstack/react-query';
import { sdk } from '../../lib/client';

export interface WhatsappConversationRow {
  id: string;
  phone: string;
  status: string;
  escalated_at: string | null;
  escalation_reason: string | null;
  customer_id: string | null;
  email: string | null;
  updated_at: string | null;
}

export interface WhatsappConversationsResponse {
  conversations: WhatsappConversationRow[];
}

export const whatsappConversationsQueryKey = {
  all: ['whatsapp-conversations'] as const,
};

/** Conversaciones de WhatsApp recientes (con su estado bot/atención-humana). */
export const useWhatsappConversations = (
  options?: UseQueryOptions<
    WhatsappConversationsResponse,
    FetchError,
    WhatsappConversationsResponse,
    QueryKey
  >,
) =>
  useQuery({
    queryKey: whatsappConversationsQueryKey.all,
    queryFn: async () =>
      sdk.client.fetch<WhatsappConversationsResponse>('/admin/whatsapp-conversations', {
        method: 'GET',
      }),
    ...options,
  });

/** Cambia el modo de una conversación: 'pause' (atiende el operador) / 'resume' (bot). */
export const useSetWhatsappMode = (
  options?: UseMutationOptions<
    { ok: boolean; phone: string; action: string },
    FetchError,
    { phone: string; action: 'pause' | 'resume' }
  >,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { phone: string; action: 'pause' | 'resume' }) =>
      sdk.client.fetch<{ ok: boolean; phone: string; action: string }>(
        '/admin/whatsapp-conversations',
        { method: 'POST', body },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: whatsappConversationsQueryKey.all });
    },
    ...options,
  });
};
