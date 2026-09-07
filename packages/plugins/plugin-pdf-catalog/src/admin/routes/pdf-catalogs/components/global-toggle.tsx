import { Switch, Text, toast } from '@medusajs/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sdk } from '../../../lib/client';

type StoreSettings = { pdf_catalog_enabled?: boolean } & Record<string, unknown>;
type StoreSettingsResponse = { settings: StoreSettings };

const STORE_SETTINGS_KEY = ['admin-store-settings'] as const;

const useStoreSettings = () =>
  useQuery<StoreSettingsResponse>({
    queryKey: STORE_SETTINGS_KEY,
    queryFn: () =>
      sdk.client.fetch<StoreSettingsResponse>('/admin/store-config/settings', {
        method: 'GET',
      }),
  });

const useUpdateStoreSettings = (options?: {
  onError?: (e: Error) => void;
}) => {
  const queryClient = useQueryClient();
  return useMutation<StoreSettingsResponse, Error, Partial<StoreSettings>>({
    mutationFn: (data) =>
      sdk.client.fetch<StoreSettingsResponse>('/admin/store-config/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STORE_SETTINGS_KEY });
    },
    onError: options?.onError,
  });
};

/**
 * Interruptor general de Catálogos PDF (store-config: pdf_catalog_enabled).
 *
 * Depende del módulo `store-config` del host. Si el host no lo tiene, la query
 * fallará silenciosamente y el switch queda apagado — misma semántica que el
 * endpoint `/store/pdf-catalog/active` cuando no encuentra el módulo.
 */
export const GlobalToggle = () => {
  const { data, isPending } = useStoreSettings();
  const enabled = data?.settings?.pdf_catalog_enabled ?? false;

  const { mutateAsync, isPending: saving } = useUpdateStoreSettings({
    onError: (e) => toast.error(e.message),
  });

  return (
    <div
      className="flex items-center gap-2"
      title="Interruptor general. Si está apagado, no se muestra ningún catálogo en la tienda."
    >
      <Text size="small" className="text-ui-fg-subtle">
        Catálogos PDF activados
      </Text>
      <Switch
        checked={enabled}
        onCheckedChange={(v) => mutateAsync({ pdf_catalog_enabled: v })}
        disabled={isPending || saving}
      />
    </div>
  );
};
