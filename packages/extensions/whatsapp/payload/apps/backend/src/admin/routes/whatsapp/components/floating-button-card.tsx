import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Label,
  Switch,
  Text,
  Textarea,
  toast,
} from '@medusajs/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CardSiteContext } from '../../../components/common/card-site-context';
import {
  useKapsoFloatingButton,
  useUpdateKapsoFloatingButton,
} from '../../../hooks/api/kapso';
import { registerWhatsappTranslations } from '../../../translations/whatsapp';

/**
 * Card del botón flotante de WhatsApp del storefront.
 *
 * El toggle guarda al instante (mismo patrón que Preferencias → Tienda); el
 * teléfono, el mensaje y el texto accesible se guardan con el botón "Guardar"
 * porque se escriben de a varias teclas. Sin teléfono válido el botón NO se
 * muestra en la tienda, y lo avisamos con un badge.
 *
 * **ES POR TIENDA, y hasta ahora no se decía.** Cada tienda atiende por su propio
 * número: la ruta de admin ya escribía la fila de la tienda activa y la pública ya
 * leía la de la tienda que pregunta, pero la card no mostraba NINGÚN selector. El
 * operador editaba el botón de la tienda que estuviera activa sin enterarse de cuál
 * era, y el único síntoma posible aparece del otro lado —un cliente abriendo el
 * WhatsApp de otro negocio—, donde ya no hay forma de detectarlo.
 *
 * El contexto va en la CARD y no en la página porque la página tiene otras tres
 * cards con su propio alcance: una franja arriba de todo prometería un aislamiento
 * que no es el mismo para las cuatro.
 */
export const FloatingButtonCard = () => {
  const { t, i18n } = useTranslation('whatsapp');
  registerWhatsappTranslations(i18n);

  const { data, isPending } = useKapsoFloatingButton();
  const [enabled, setEnabled] = useState(false);
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [label, setLabel] = useState('');
  const [dirty, setDirty] = useState(false);

  // El servidor es la fuente de verdad: sincronizamos el form cuando llega (o
  // vuelve) la config, salvo que el operador tenga cambios sin guardar.
  useEffect(() => {
    const config = data?.floating_button;
    if (!config || dirty) return;
    setEnabled(config.enabled);
    setPhone(config.phone);
    setMessage(config.message);
    setLabel(config.label);
  }, [data, dirty]);

  const { mutateAsync: save, isPending: saving } = useUpdateKapsoFloatingButton({
    onSuccess: () => toast.success(t('FAB_TOAST_SAVED')),
    onError: (error) => toast.error(t('FAB_TOAST_FAILED', { message: error.message })),
  });

  const onToggle = async (value: boolean) => {
    setEnabled(value);
    try {
      await save({ enabled: value });
    } catch {
      setEnabled(!value); // revertimos el optimismo si el guardado falló
    }
  };

  const onSaveDetails = async () => {
    await save({ phone, message, label });
    setDirty(false);
  };

  const live = !!data?.live;
  const missingPhone = enabled && !data?.floating_button.phone;
  const busy = isPending || saving;

  return (
    // Sin `mb-4`: el `SingleColumnLayout` de la página ya separa las cards, y un
    // margen propio se SUMA a ese gap en vez de reemplazarlo. Sólo se puede sacar
    // porque el padre aporta espaciado: era la ÚNICA card con margen propio que
    // quedaba, y su página (`whatsapp/settings`) ya apilaba con gap.
    // `p-0` + header propio: la forma única de las cards de ajustes, ver
    // `store-config/components/branch-settings-card` para por qué no bajan a sección.
    <Container className="p-0">
      <div className="flex items-start justify-between gap-4 px-6 py-4">
        <div>
          <div className="flex items-center gap-2">
            <Heading level="h2">{t('FAB_TITLE')}</Heading>
            <Badge size="2xsmall" color={live ? 'green' : 'grey'}>
              {live ? t('FAB_STATUS_LIVE') : t('FAB_STATUS_HIDDEN')}
            </Badge>
          </div>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            {t('FAB_DESC')}
          </Text>
        </div>
        <Switch
          id="whatsapp-floating-button"
          checked={enabled}
          onCheckedChange={onToggle}
          disabled={busy}
        />
      </div>

      {/* El hook va por `sdk.client.fetch`, que lleva `x-site-id` en `globalHeaders`
          (`lib/client.ts`), y la query key lleva la tienda: el selector de acá cambia
          de verdad la fila que se edita. `dirty` hace que cambiar de tienda pregunte
          antes de llevarse los cambios sin guardar. */}
      <CardSiteContext scope="site" dirty={dirty} />

      <div className="flex flex-col gap-6 px-6 pb-6">
        {missingPhone && (
          <Text size="small" className="text-ui-fg-error">
            {t('FAB_MISSING_PHONE')}
          </Text>
        )}

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="whatsapp-fab-phone" size="small" weight="plus">
              {t('FAB_PHONE_LABEL')}
            </Label>
            <Input
              id="whatsapp-fab-phone"
              value={phone}
              placeholder={t('FAB_PHONE_PLACEHOLDER')}
              inputMode="tel"
              onChange={(event) => {
                setPhone(event.target.value);
                setDirty(true);
              }}
              disabled={busy}
            />
            <Text size="xsmall" className="text-ui-fg-subtle">
              {t('FAB_PHONE_HELP')}
            </Text>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="whatsapp-fab-message" size="small" weight="plus">
              {t('FAB_MESSAGE_LABEL')}
            </Label>
            <Textarea
              id="whatsapp-fab-message"
              value={message}
              rows={2}
              placeholder={t('FAB_MESSAGE_PLACEHOLDER')}
              onChange={(event) => {
                setMessage(event.target.value);
                setDirty(true);
              }}
              disabled={busy}
            />
            <Text size="xsmall" className="text-ui-fg-subtle">
              {t('FAB_MESSAGE_HELP')}
            </Text>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="whatsapp-fab-label" size="small" weight="plus">
              {t('FAB_LABEL_LABEL')}
            </Label>
            <Input
              id="whatsapp-fab-label"
              value={label}
              onChange={(event) => {
                setLabel(event.target.value);
                setDirty(true);
              }}
              disabled={busy}
            />
            <Text size="xsmall" className="text-ui-fg-subtle">
              {t('FAB_LABEL_HELP')}
            </Text>
          </div>

          <div className="flex items-center justify-end">
            <Button
              variant="primary"
              size="small"
              onClick={onSaveDetails}
              disabled={busy || !dirty}
              isLoading={saving}
            >
              {t('BTN_SAVE')}
            </Button>
          </div>
        </div>

        <Text size="xsmall" className="text-ui-fg-muted">
          {t('FAB_PLACEMENT_NOTE')}
        </Text>
      </div>
    </Container>
  );
};
