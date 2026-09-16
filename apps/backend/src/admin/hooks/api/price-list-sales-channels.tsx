import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sdk } from '../../lib/client';

/**
 * React Query hooks for the price-list sales-channel rule endpoints.
 *
 * Endpoints:
 *   GET    /admin/price-lists/:id/sales-channel-rule
 *   POST   /admin/price-lists/:id/sales-channel-rule
 *   DELETE /admin/price-lists/:id/sales-channel-rule
 *   GET    /admin/sales-channels
 *
 * Related ticket: EDUCABOT-9
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SalesChannelRule {
  attribute: string;
  operator: string;
  sales_channel_ids: string[];
}

export interface SalesChannelRuleResponse {
  rule: SalesChannelRule | null;
}

export interface SalesChannel {
  id: string;
  name: string;
  is_disabled: boolean;
}

export interface SalesChannelsResponse {
  sales_channels: SalesChannel[];
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

const priceListRuleKey = (priceListId: string) => [
  'price-list-sales-channel-rule',
  priceListId,
];

const salesChannelsKey = () => ['admin-sales-channels'];

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * GET /admin/price-lists/:id/sales-channel-rule
 * Returns { rule } where rule is null when no rule has been set.
 */
export function usePriceListSalesChannelRule(priceListId: string) {
  return useQuery({
    queryKey: priceListRuleKey(priceListId),
    queryFn: () =>
      sdk.client.fetch<SalesChannelRuleResponse>(
        `/admin/price-lists/${priceListId}/sales-channel-rule`,
        { method: 'GET' }
      ),
    enabled: Boolean(priceListId),
  });
}

/**
 * POST /admin/price-lists/:id/sales-channel-rule
 * Upserts the rule with the given channel IDs.
 */
export function useUpdatePriceListSalesChannelRule(priceListId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (salesChannelIds: string[]) =>
      sdk.client.fetch<SalesChannelRuleResponse>(
        `/admin/price-lists/${priceListId}/sales-channel-rule`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: { sales_channel_ids: salesChannelIds },
        }
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: priceListRuleKey(priceListId) });
    },
  });
}

/**
 * DELETE /admin/price-lists/:id/sales-channel-rule
 * Removes the rule entirely. Idempotent — no error if rule does not exist.
 */
export function useDeletePriceListSalesChannelRule(priceListId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      sdk.client.fetch<{ deleted: boolean }>(
        `/admin/price-lists/${priceListId}/sales-channel-rule`,
        { method: 'DELETE' }
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: priceListRuleKey(priceListId) });
    },
  });
}

/**
 * GET /admin/sales-channels
 * Fetches all sales channels for the channel picker in the widget.
 */
export function useAdminSalesChannels() {
  return useQuery({
    queryKey: salesChannelsKey(),
    queryFn: () =>
      sdk.client.fetch<SalesChannelsResponse>('/admin/sales-channels', {
        method: 'GET',
      }),
  });
}
