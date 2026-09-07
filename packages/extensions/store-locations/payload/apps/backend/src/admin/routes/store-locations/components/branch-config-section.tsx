import { Badge, Heading, IconButton, Label, Select, Text } from '@medusajs/ui';
import { XMark } from '@medusajs/icons';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BranchConfig,
  ChannelType,
  useAdminSalesChannels,
  useAdminStockLocations,
} from '../../../hooks/api';

const CHANNEL_TYPES: ChannelType[] = ['b2c', 'b2b', 'in_person'];

const channelTypeLabelKey = (type: ChannelType) => {
  if (type === 'b2b') return 'BRANCH_CHANNEL_TYPE_B2B';
  if (type === 'in_person') return 'BRANCH_CHANNEL_TYPE_IN_PERSON';
  return 'BRANCH_CHANNEL_TYPE_B2C';
};

export interface BranchConfigChannelDraft {
  id: string;
  channel_type: ChannelType;
}

/** Controlled commercial-config state held by the parent store-location form. */
export interface BranchConfigFormState {
  stock_location_id: string;
  channels: BranchConfigChannelDraft[];
}

export const emptyBranchConfig = (): BranchConfigFormState => ({
  stock_location_id: '',
  channels: [],
});

export const fromBranchConfig = (cfg: BranchConfig | null | undefined): BranchConfigFormState => {
  if (!cfg) return emptyBranchConfig();
  return {
    stock_location_id: cfg.stock_location_id ?? '',
    channels: cfg.sales_channels.map((sc) => ({
      id: sc.id,
      channel_type: (sc.channel_type as ChannelType | null) ?? 'b2c',
    })),
  };
};

interface BranchConfigSectionProps {
  value: BranchConfigFormState;
  onChange: (value: BranchConfigFormState) => void;
}

/**
 * Commercial wiring for a branch (controlled): inventory location + the sales
 * channels it sells through (with channel_type). The operational `active` flag
 * lives in the General tab. Persisted by the parent form's single save.
 */
export const BranchConfigSection = ({ value, onChange }: BranchConfigSectionProps) => {
  const { t } = useTranslation('storeLocations');

  const { data: scData } = useAdminSalesChannels();
  const { data: slData } = useAdminStockLocations();

  const salesChannels = (scData?.sales_channels ?? []) as { id: string; name: string }[];
  const stockLocations = (slData?.stock_locations ?? []) as { id: string; name: string }[];

  const channelNameById = useMemo(() => {
    const map = new Map<string, string>();
    salesChannels.forEach((sc) => map.set(sc.id, sc.name));
    return map;
  }, [salesChannels]);

  const availableToAdd = useMemo(
    () => salesChannels.filter((sc) => !value.channels.some((c) => c.id === sc.id)),
    [salesChannels, value.channels],
  );

  const setStock = (stock_location_id: string) => onChange({ ...value, stock_location_id });
  const addChannel = (id: string) =>
    onChange({ ...value, channels: [...value.channels, { id, channel_type: 'b2c' }] });
  const removeChannel = (id: string) =>
    onChange({ ...value, channels: value.channels.filter((c) => c.id !== id) });
  const setChannelType = (id: string, channel_type: ChannelType) =>
    onChange({
      ...value,
      channels: value.channels.map((c) => (c.id === id ? { ...c, channel_type } : c)),
    });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Heading level="h3">{t('SECTION_BRANCH')}</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          {t('BRANCH_HELP')}
        </Text>
      </div>

      {/* Stock location */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="branch-stock">{t('BRANCH_STOCK_LABEL')}</Label>
        <Select
          value={value.stock_location_id || 'none'}
          onValueChange={(v) => setStock(v === 'none' ? '' : v)}
        >
          <Select.Trigger id="branch-stock">
            <Select.Value />
          </Select.Trigger>
          <Select.Content className="z-[60]">
            <Select.Item value="none">{t('BRANCH_STOCK_NONE')}</Select.Item>
            {stockLocations.map((sl) => (
              <Select.Item key={sl.id} value={sl.id}>
                {sl.name}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      </div>

      {/* Sales channels */}
      <div className="flex flex-col gap-2">
        <Label>{t('BRANCH_CHANNELS_LABEL')}</Label>
        <Text size="small" className="text-ui-fg-subtle">
          {t('BRANCH_CHANNELS_HELP')}
        </Text>

        <div className="flex flex-col gap-2">
          {value.channels.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-2 rounded-lg border border-ui-border-base p-2"
            >
              <Badge size="small" className="shrink-0">
                {channelNameById.get(c.id) ?? c.id}
              </Badge>
              <div className="ml-auto w-32">
                <Select
                  size="small"
                  value={c.channel_type}
                  onValueChange={(v) => setChannelType(c.id, v as ChannelType)}
                >
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content className="z-[60]">
                    {CHANNEL_TYPES.map((type) => (
                      <Select.Item key={type} value={type}>
                        {t(channelTypeLabelKey(type))}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>
              <IconButton
                size="small"
                variant="transparent"
                type="button"
                onClick={() => removeChannel(c.id)}
                aria-label={t('BRANCH_REMOVE_CHANNEL')}
              >
                <XMark />
              </IconButton>
            </div>
          ))}
        </div>

        {availableToAdd.length > 0 && (
          <Select value="" onValueChange={addChannel}>
            <Select.Trigger>
              <Select.Value placeholder={t('BRANCH_ADD_CHANNEL')} />
            </Select.Trigger>
            <Select.Content className="z-[60]">
              {availableToAdd.map((sc) => (
                <Select.Item key={sc.id} value={sc.id}>
                  {sc.name}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        )}
      </div>
    </div>
  );
};
