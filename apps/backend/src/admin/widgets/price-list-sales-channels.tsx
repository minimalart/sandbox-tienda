/**
 * Admin widget — Price List › Sales Channels
 *
 * Injection zone: `price_list.details.after`
 *
 * Lets operators assign one or more sales channels to a price list.
 * When a channel is assigned, the pricing engine matches
 * `price_list_rule.attribute = 'sales_channel_id'` and applies the list's
 * prices for requests coming from that channel.
 *
 * The widget fetches the current rule state on mount and shows a checkbox
 * list of all available sales channels. Saving upserts the rule; removing
 * all selections deletes it.
 *
 * Related ticket: EDUCABOT-9
 */

import { defineWidgetConfig } from '@medusajs/admin-sdk';
import type { DetailWidgetProps } from '@medusajs/framework/types';
import { Button, Checkbox, Container, Heading, Text, toast } from '@medusajs/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useAdminSalesChannels,
  useDeletePriceListSalesChannelRule,
  usePriceListSalesChannelRule,
  useUpdatePriceListSalesChannelRule,
} from '../hooks/api/price-list-sales-channels';
import { registerPricingTranslations } from '../translations/pricing';

type AdminPriceList = { id: string };

const PriceListSalesChannelsWidget = ({ data }: DetailWidgetProps<AdminPriceList>) => {
  const { t, i18n } = useTranslation('pricing');
  registerPricingTranslations(i18n);

  const priceListId = data.id;

  // Current rule from the backend
  const { data: ruleData, isLoading: isLoadingRule } = usePriceListSalesChannelRule(priceListId);
  // All available sales channels
  const { data: channelsData, isLoading: isLoadingChannels } = useAdminSalesChannels();

  const updateRule = useUpdatePriceListSalesChannelRule(priceListId);
  const deleteRule = useDeletePriceListSalesChannelRule(priceListId);

  // Local selection state, initialised from the current rule once loaded.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!isLoadingRule && !initialized) {
      const currentIds = ruleData?.rule?.sales_channel_ids ?? [];
      setSelectedIds(new Set(currentIds));
      setInitialized(true);
    }
  }, [isLoadingRule, ruleData, initialized]);

  const channels = channelsData?.sales_channels ?? [];
  const isLoading = isLoadingRule || isLoadingChannels;

  const toggleChannel = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSave = async () => {
    const ids = Array.from(selectedIds);

    if (ids.length === 0) {
      // No selection — remove the rule entirely.
      try {
        await deleteRule.mutateAsync();
        toast.success(t('PLR_SALES_CHANNELS_REMOVED'));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        toast.error(t('PLR_SALES_CHANNELS_REMOVE_ERROR', { message }));
      }
      return;
    }

    try {
      await updateRule.mutateAsync(ids);
      toast.success(t('PLR_SALES_CHANNELS_SAVED'));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(t('PLR_SALES_CHANNELS_SAVE_ERROR', { message }));
    }
  };

  const isSaving = updateRule.isPending || deleteRule.isPending;

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h2">{t('PLR_SALES_CHANNELS_TITLE')}</Heading>
        <Text className="text-ui-fg-subtle mt-1 text-sm">
          {t('PLR_SALES_CHANNELS_HELP')}
        </Text>
      </div>

      <div className="px-6 py-4">
        {isLoading && (
          <Text className="text-ui-fg-subtle text-sm">{t('PLR_SALES_CHANNELS_LOADING')}</Text>
        )}

        {!isLoading && channels.length === 0 && (
          <Text className="text-ui-fg-subtle text-sm">{t('PLR_SALES_CHANNELS_NO_CHANNELS')}</Text>
        )}

        {!isLoading && channels.length > 0 && (
          <div className="flex flex-col gap-2">
            {channels.map((channel) => (
              <label
                key={channel.id}
                className="flex cursor-pointer items-center gap-2"
              >
                <Checkbox
                  checked={selectedIds.has(channel.id)}
                  onCheckedChange={() => toggleChannel(channel.id)}
                  disabled={isSaving}
                />
                <span className="text-sm">{channel.name}</span>
                {channel.is_disabled && (
                  <span className="text-ui-fg-subtle text-xs">(disabled)</span>
                )}
              </label>
            ))}
          </div>
        )}

        {selectedIds.size === 0 && initialized && !isLoading && (
          <Text className="text-ui-fg-subtle mt-2 text-xs">
            {t('PLR_SALES_CHANNELS_EMPTY')}
          </Text>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 px-6 py-4">
        <Button
          size="small"
          variant="primary"
          onClick={handleSave}
          disabled={isLoading || isSaving}
          isLoading={isSaving}
        >
          {t('PLR_SALES_CHANNELS_SAVE')}
        </Button>
      </div>
    </Container>
  );
};

export const config = defineWidgetConfig({
  zone: 'price_list.details.after',
});

export default PriceListSalesChannelsWidget;
