import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sdk } from '../../lib/client';

export const giftCardKeys = { all: ['gift-card-experience'] as const };

export type GiftCardPermission = 'gift_cards.read' | 'gift_cards.designs' | 'gift_cards.deliveries' | 'gift_cards.settings' | 'gift_cards.metrics';

export function useGiftCardPermissions() {
  return useQuery({
    queryKey: [...giftCardKeys.all, 'permissions'],
    queryFn: () => sdk.client.fetch<{ actor_id: string; permissions: GiftCardPermission[]; source: string }>('/admin/gift-card-experience/permissions'),
    staleTime: 60_000,
  });
}
export function useGiftCardDeliveries(filters: { delivery_status?: string; issuance_status?: string; order_id?: string } = {}, enabled = true) {
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => Boolean(value)) as Array<[string, string]>).toString();
  return useQuery({ queryKey: [...giftCardKeys.all, 'deliveries', filters], enabled, queryFn: () => sdk.client.fetch<{ deliveries: any[]; count: number }>(`/admin/gift-card-experience/deliveries${query ? `?${query}` : ''}`) });
}
export function useGiftCardDelivery(id?: string, enabled = true) {
  return useQuery({ queryKey: [...giftCardKeys.all, 'delivery', id], enabled: enabled && Boolean(id), queryFn: () => sdk.client.fetch<{ delivery: any; attempts: any[]; events: any[] }>(`/admin/gift-card-experience/deliveries/${id}`) });
}
export function useGiftCardDesigns(enabled = true) {
  return useQuery({ queryKey: [...giftCardKeys.all, 'designs'], enabled, queryFn: () => sdk.client.fetch<{ designs: any[] }>('/admin/gift-card-experience/designs') });
}
export function useGiftCardSettings(enabled = true) {
  return useQuery({ queryKey: [...giftCardKeys.all, 'settings'], enabled, queryFn: () => sdk.client.fetch<{ settings: any }>('/admin/gift-card-experience/settings') });
}
export function useGiftCardAnalytics(enabled = true) {
  return useQuery({ queryKey: [...giftCardKeys.all, 'analytics'], enabled, queryFn: () => sdk.client.fetch<{ analytics: any }>('/admin/gift-card-experience/analytics') });
}
export function useGiftCardAction() {
  const query = useQueryClient();
  return useMutation({
    mutationFn: ({ path, body, method = 'POST' }: { path: string; body?: Record<string, unknown>; method?: 'POST' | 'DELETE' }) => sdk.client.fetch<any>(path, { method, ...(body ? { body } : {}) }),
    onSuccess: () => query.invalidateQueries({ queryKey: giftCardKeys.all }),
  });
}
