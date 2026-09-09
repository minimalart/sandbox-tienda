import { Input, Label, Select, Text } from '@medusajs/ui';
import { useTranslation } from 'react-i18next';
import type { DemoSourceType } from '../../../hooks/api/demo-stores';

type Props = {
  sourceType: DemoSourceType;
  sourceUrl: string;
  targetCount: string;
  onSourceTypeChange: (value: DemoSourceType) => void;
  onSourceUrlChange: (value: string) => void;
  onTargetCountChange: (value: string) => void;
  channels?: { id: string; name: string }[];
  channelId?: string;
  onChannelChange?: (value: string) => void;
  channelsLoading?: boolean;
};

/** El mismo origen de catálogo en el alta y en la edición de una tienda. */
export function CatalogSourceFields(props: Props) {
  const { t } = useTranslation('demo-stores');
  const internal = props.sourceType === 'sales_channel';
  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex flex-col gap-y-2">
        <Label>{t('FIELD_SOURCE_TYPE')}</Label>
        <Select
          value={props.sourceType}
          onValueChange={(value) => props.onSourceTypeChange(value as DemoSourceType)}
        >
          <Select.Trigger aria-label={t('FIELD_SOURCE_TYPE')}>
            <Select.Value />
          </Select.Trigger>
          <Select.Content className="z-[80]">
            <Select.Item value="woocommerce">WooCommerce</Select.Item>
            <Select.Item value="vtex">VTEX</Select.Item>
            <Select.Item value="shopify">Shopify</Select.Item>
            {props.channels && (
              <Select.Item value="sales_channel">{t('SOURCE_SALES_CHANNEL')}</Select.Item>
            )}
          </Select.Content>
        </Select>
      </div>
      {internal ? (
        <div className="flex flex-col gap-y-2">
          <Label>{t('FIELD_SOURCE_CHANNEL')}</Label>
          <Select value={props.channelId} onValueChange={props.onChannelChange}>
            <Select.Trigger aria-label={t('FIELD_SOURCE_CHANNEL')}>
              <Select.Value placeholder={t('FIELD_SOURCE_CHANNEL_PLACEHOLDER')} />
            </Select.Trigger>
            <Select.Content className="z-[80]">
              {props.channels?.map((channel) => (
                <Select.Item key={channel.id} value={channel.id}>
                  {channel.name}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
          <Text size="small" className="text-ui-fg-subtle">
            {props.channelsLoading
              ? '…'
              : t(
                  props.channels?.length
                    ? 'FIELD_SOURCE_CHANNEL_HELP'
                    : 'FIELD_SOURCE_CHANNEL_EMPTY'
                )}
          </Text>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="catalog-source-url">{t('FIELD_SOURCE_URL')}</Label>
            <Input
              id="catalog-source-url"
              value={props.sourceUrl}
              placeholder="https://mitienda.com"
              onChange={(event) => props.onSourceUrlChange(event.target.value)}
              required
            />
            <Text size="small" className="text-ui-fg-subtle">
              {t('FIELD_SOURCE_URL_HELP')}
            </Text>
          </div>
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="catalog-target-count">{t('FIELD_TARGET_COUNT')}</Label>
            <Input
              id="catalog-target-count"
              type="number"
              min={1}
              value={props.targetCount}
              placeholder={t('FIELD_TARGET_COUNT_PLACEHOLDER')}
              onChange={(event) => props.onTargetCountChange(event.target.value)}
            />
            <Text size="small" className="text-ui-fg-subtle">
              {t('FIELD_TARGET_COUNT_HELP')}
            </Text>
          </div>
        </>
      )}
    </div>
  );
}
