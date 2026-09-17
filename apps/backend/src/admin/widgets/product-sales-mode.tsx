import { defineWidgetConfig } from '@medusajs/admin-sdk';
import type { AdminProduct } from '@medusajs/types';
import { Container, Heading, Text, Select, Badge } from '@medusajs/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { sdk } from '../lib/client';

/**
 * Modo de venta del producto POR TIENDA (PRD Bundles V2 §11).
 *
 * Va como widget del producto y no dentro del editor de bundles: es
 * disponibilidad comercial del producto en una tienda. El mismo producto puede
 * ser "solo en bundles" en una tienda y venderse suelto en otra, y ninguna de
 * las dos cosas pertenece a un bundle en particular.
 *
 * En proyectos sin multitienda no hay nada que elegir y el widget lo dice en vez
 * de mostrar un selector que no haría nada (§57).
 */

type SalesMode = 'standalone' | 'bundle_only' | 'standalone_and_bundle';
const DEFAULT_MODE: SalesMode = 'standalone_and_bundle';
const MODES: SalesMode[] = ['standalone_and_bundle', 'bundle_only', 'standalone'];

type Site = { id: string; name: string; slug: string };

const ProductSalesModeWidget = ({ data }: { data: AdminProduct }) => {
  const { t } = useTranslation('productSalesMode');
  const client = useQueryClient();
  const [saving, setSaving] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const { data: sites, isLoading } = useQuery({
    queryKey: ['product-sales-mode-sites'],
    queryFn: () => sdk.client.fetch<{ demo_stores?: Site[] }>('/admin/sites?limit=100'),
  });

  const storeList = sites?.demo_stores ?? [];

  const { data: modes } = useQuery({
    queryKey: ['product-sales-modes', data.id, storeList.map((s) => s.id).join(',')],
    enabled: storeList.length > 0,
    queryFn: async () => {
      const entries = await Promise.all(
        storeList.map(async (site) => {
          const res = await sdk.client.fetch<{
            product_sales_modes?: Array<{ sales_mode: SalesMode }>;
          }>(
            `/admin/product-sales-modes?site_id=${encodeURIComponent(site.id)}&product_id=${encodeURIComponent(data.id)}`,
          );
          return [site.id, res.product_sales_modes?.[0]?.sales_mode ?? DEFAULT_MODE] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<string, SalesMode>;
    },
  });

  const save = async (siteId: string, mode: SalesMode) => {
    setSaving(siteId);
    setFeedback(null);
    try {
      await sdk.client.fetch('/admin/product-sales-modes', {
        method: 'POST',
        body: { site_id: siteId, product_id: data.id, sales_mode: mode },
      });
      await client.invalidateQueries({ queryKey: ['product-sales-modes', data.id] });
      setFeedback({ tone: 'ok', text: t('SAVED') });
    } catch {
      setFeedback({ tone: 'error', text: t('ERROR') });
    } finally {
      setSaving(null);
    }
  };

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">{t('TITLE')}</Heading>
        {feedback && (
          <Badge size="2xsmall" color={feedback.tone === 'ok' ? 'green' : 'red'}>
            {feedback.text}
          </Badge>
        )}
      </div>

      <div className="space-y-4 px-6 py-4">
        <Text size="small" className="text-ui-fg-subtle">
          {t('HELP')}
        </Text>

        {isLoading && (
          <Text size="small" className="text-ui-fg-muted">
            {t('LOADING')}
          </Text>
        )}

        {!isLoading && storeList.length === 0 && (
          <Text size="small" className="text-ui-fg-muted">
            {t('SINGLE_TENANT')}
          </Text>
        )}

        {storeList.map((site) => {
          const current = modes?.[site.id] ?? DEFAULT_MODE;
          return (
            <div key={site.id} className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <Text size="small" weight="plus" className="truncate">
                  {site.name}
                </Text>
                <Text size="xsmall" className="text-ui-fg-muted">
                  {t(`MODE_${current.toUpperCase()}_HELP`)}
                </Text>
              </div>
              <div className="w-56 shrink-0">
                <Select
                  value={current}
                  disabled={saving === site.id}
                  onValueChange={(value) => save(site.id, value as SalesMode)}
                >
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    {MODES.map((mode) => (
                      <Select.Item key={mode} value={mode}>
                        {t(`MODE_${mode.toUpperCase()}`)}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>
            </div>
          );
        })}
      </div>
    </Container>
  );
};

export default ProductSalesModeWidget;
export const config = defineWidgetConfig({ zone: 'product.details.side.after' });
