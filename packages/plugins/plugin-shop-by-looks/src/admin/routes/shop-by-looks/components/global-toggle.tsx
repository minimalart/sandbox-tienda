import { FetchError } from '@medusajs/js-sdk';
import { Switch, Text, toast } from '@medusajs/ui';
import { QueryKey, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { sdk } from '../../../lib/client';
import { registerShopByLooksTranslations } from '../../../translations/shop-by-looks';

/**
 * Interruptor general de Shop by Look (store-config: `shop_by_look_enabled`).
 * Si está apagado, el endpoint público no devuelve ningún look.
 *
 * Los hooks `useStoreSettings`/`useUpdateStoreSettings` viven en el host
 * (`apps/backend/src/admin/hooks/api/store-config.tsx`) y no se importan desde
 * el plugin. Este componente hace `fetch` directo a los endpoints admin
 * (`GET/POST /admin/store-config/settings`) —los MISMOS que consumen los hooks
 * del host— para no acoplar el bundle del plugin al árbol del host.
 *
 * Si el host no monta la ruta (por ejemplo, si `store-config` no está
 * registrado), la mutación devuelve error y se muestra por toast — mismo
 * fallback que el hook del host.
 */

type StoreSettings = {
  multi_branch_enabled?: boolean;
  require_branch_coverage?: boolean;
  branch_gate_prompt_enabled?: boolean;
  barcode_scanner_enabled?: boolean;
  shop_by_look_enabled?: boolean;
  pdf_catalog_enabled?: boolean;
  cookie_banner_enabled?: boolean;
};

type AdminStoreSettingsResponse = { settings: StoreSettings };

const STORE_SETTINGS_QUERY_KEY: QueryKey = ['plugin-shop-by-looks', 'store-settings'];

export const GlobalToggle = () => {
  const { t, i18n } = useTranslation('shop-by-looks');
  registerShopByLooksTranslations(i18n);

  const queryClient = useQueryClient();

  const { data, isPending } = useQuery<AdminStoreSettingsResponse, FetchError>({
    queryKey: STORE_SETTINGS_QUERY_KEY,
    queryFn: () =>
      sdk.client.fetch<AdminStoreSettingsResponse>('/admin/store-config/settings', {
        method: 'GET',
      }),
  });
  const enabled = data?.settings?.shop_by_look_enabled ?? false;

  const { mutateAsync, isPending: saving } = useMutation<
    AdminStoreSettingsResponse,
    FetchError,
    Partial<StoreSettings>
  >({
    mutationFn: (payload) =>
      sdk.client.fetch<AdminStoreSettingsResponse>('/admin/store-config/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STORE_SETTINGS_QUERY_KEY });
    },
    onError: (e) => toast.error(e.message),
  });

  const onToggle = async (v: boolean) => {
    await mutateAsync({ shop_by_look_enabled: v });
  };

  return (
    <div className="flex items-center gap-2" title={t('GLOBAL_TOGGLE_HELP')}>
      <Text size="small" className="text-ui-fg-subtle">
        {t('GLOBAL_TOGGLE_LABEL')}
      </Text>
      <Switch
        checked={enabled}
        onCheckedChange={onToggle}
        disabled={isPending || saving}
      />
    </div>
  );
};
