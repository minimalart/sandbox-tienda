import { Container, Heading, Label, Switch, Text, toast } from '@medusajs/ui';
import { useEffect, useState } from 'react';
import { useStoreSettings, useUpdateStoreSettings } from '../../../hooks/api';

/**
 * "Tienda" toggles on the Preferencias screen: preferencias que afectan al
 * storefront. Hoy: el banner de aceptación de cookies. Cuando está activo, la
 * tienda muestra el banner de consentimiento de cookies; apagado (default), no
 * se muestra.
 */
export const StorefrontSettingsCard = () => {
  const { data, isPending } = useStoreSettings();
  const [cookieBanner, setCookieBanner] = useState(false);

  useEffect(() => {
    if (!data?.settings) return;
    setCookieBanner(data.settings.cookie_banner_enabled);
  }, [data]);

  const { mutateAsync: save, isPending: saving } = useUpdateStoreSettings({
    onSuccess: () => toast.success('Preferencias de la tienda guardadas'),
    onError: (e) => toast.error(`No se pudo guardar: ${e.message}`),
  });

  const onToggleCookieBanner = async (v: boolean) => {
    setCookieBanner(v);
    await save({ cookie_banner_enabled: v });
  };

  return (
    // Sin `mb-4`: el espaciado vertical lo pone el wrapper de la pestaña.
    // `p-0` + header propio: la forma única de las cards de esta pantalla, ver
    // `branch-settings-card` para por qué no bajan a sección.
    <Container className="p-0">
      <div className="px-6 py-4">
        <Heading level="h2">Tienda</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Preferencias que afectan a lo que ve el cliente en la tienda.
        </Text>
      </div>

      <div className="flex flex-col gap-4 px-6 pb-6">
        <div className="flex items-center justify-between">
          <div className="pr-4">
            <Label htmlFor="set-cookie-banner">Banner de cookies</Label>
            <Text size="small" className="text-ui-fg-subtle">
              Muestra un banner para aceptar el uso de cookies. Se recuerda la
              elección del visitante para no volver a mostrarlo.
            </Text>
          </div>
          <Switch
            id="set-cookie-banner"
            checked={cookieBanner}
            onCheckedChange={onToggleCookieBanner}
            disabled={isPending || saving}
          />
        </div>
      </div>
    </Container>
  );
};
