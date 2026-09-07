import { Button, Text, toast } from '@medusajs/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { sdk } from '../../../../lib/client';

export const useVimeoCredentialStatus = (enabled: boolean) =>
  useQuery({
    queryKey: ['vimeo-status'],
    enabled,
    queryFn: () => sdk.client.fetch<{ connected: boolean }>('/admin/vimeo/status'),
  });
export const VimeoCredentials = () => {
  const status = useVimeoCredentialStatus(true);
  const connect = useMutation({
    mutationFn: () =>
      sdk.client.fetch<{ url: string }>('/admin/vimeo/oauth/start', {
        query: { redirect_to: '/app/settings/site-credentials#videos' },
      }),
    onSuccess: (data) => {
      const url = new URL(data.url);
      if (
        url.protocol !== 'https:' ||
        !['vimeo.com', 'www.vimeo.com', 'api.vimeo.com'].includes(url.hostname)
      ) {
        toast.error('La URL de conexión no es válida.');
        return;
      }
      window.location.assign(url.href);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="flex flex-col gap-3">
      <Text size="small">
        {status.isPending
          ? 'Consultando Vimeo…'
          : status.isError
            ? 'No se pudo consultar la conexión con Vimeo.'
            : status.data?.connected
              ? 'Tu cuenta de Vimeo está conectada.'
              : 'Conectá tu cuenta después de configurar la aplicación de Vimeo.'}
      </Text>
      <div className="flex gap-2">
        <Button size="small" isLoading={connect.isPending} onClick={() => connect.mutate()}>
          {status.data?.connected ? 'Reconectar Vimeo' : 'Conectar Vimeo'}
        </Button>
        <Button
          variant="secondary"
          size="small"
          disabled={status.isFetching}
          onClick={() => void status.refetch()}
        >
          Verificar conexión
        </Button>
      </div>
    </div>
  );
};
