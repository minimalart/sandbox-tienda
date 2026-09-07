import { defineRouteConfig } from '@medusajs/admin-sdk';
import { useEffect, useRef, useState } from 'react';
import { Container, Heading, Text } from '@medusajs/ui';
import { Trans, useTranslation } from 'react-i18next';
import { useKapsoInboxEmbed } from '../../../hooks/api/kapso';
import { registerWhatsappTranslations, whatsappLabel } from '../../../translations/whatsapp';

const InboxPage = () => {
  const { t, i18n } = useTranslation('whatsapp');
  registerWhatsappTranslations(i18n);
  const { data, isPending } = useKapsoInboxEmbed();
  const embedUrl = data?.embed_url;

  // Llenar hasta el fondo del viewport: medimos el top real del contenedor y
  // fijamos la altura restante, así el iframe aprovecha todo el alto sin dejar
  // espacio en blanco y sin generar scroll de la PÁGINA (el chat scrollea adentro).
  const fillRef = useRef<HTMLDivElement>(null);
  const [fillHeight, setFillHeight] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (!embedUrl) return;
    const update = () => {
      const el = fillRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      setFillHeight(Math.max(360, Math.floor(window.innerHeight - top - 16)));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [embedUrl]);

  if (isPending) {
    return (
      <Container className="flex items-center justify-center h-[70vh]">
        <Text className="text-ui-fg-subtle">{t('INBOX_LOADING')}</Text>
      </Container>
    );
  }

  // Estos cuatro pasos se QUEDAN, aunque el drawer de WhatsApp los repita en su
  // sección "La bandeja embebida". No es texto siempre visible: cuelga de
  // `!embedUrl`, o sea del único estado en el que la pantalla no tiene nada más
  // que mostrar. Mudarlos al drawer dejaría un cartel de "no configurado" con la
  // solución escondida detrás de un botón, y encima en una página que en ese
  // estado no renderiza ni un header donde colgar ese botón. La regla del drawer
  // es "si es cierto SIEMPRE, se muda"; esto es cierto sólo cuando está roto.
  if (!embedUrl) {
    return (
      <Container>
        <Heading level="h2">{t('INBOX_TITLE')}</Heading>
        <Text className="text-ui-fg-subtle mt-2">{t('INBOX_NOT_CONFIGURED')}</Text>
        <ol className="text-ui-fg-subtle mt-3 list-decimal pl-5 txt-small flex flex-col gap-1">
          <li>
            <Trans t={t} i18nKey="INBOX_STEP_EMBED" components={{ b: <strong />, c: <code /> }} />
          </li>
          <li>
            <Trans t={t} i18nKey="INBOX_STEP_ORIGINS" components={{ b: <strong />, c: <code /> }} />
          </li>
          <li>
            <Trans t={t} i18nKey="INBOX_STEP_ENV" components={{ b: <strong />, c: <code /> }} />
          </li>
          <li>{t('INBOX_STEP_RESTART')}</li>
        </ol>
      </Container>
    );
  }

  return (
    <div
      ref={fillRef}
      style={{
        height: fillHeight ? `${fillHeight}px` : 'calc(100dvh - 140px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Container className="p-0 overflow-hidden" style={{ flex: 1, minHeight: 0 }}>
        <iframe
          src={embedUrl}
          title="Kapso WhatsApp Inbox"
          style={{ width: '100%', height: '100%', border: 0 }}
          allow="clipboard-write; microphone; camera"
        />
      </Container>
    </div>
  );
};

// Medusa NO pasa el `label` de rutas de extensión por t() — es un string crudo,
// evaluado una sola vez al importar el módulo. `whatsappLabel` resuelve el idioma
// desde lo que Medusa ya persistió (cookie/localStorage `lng`). El breadcrumb es
// una función que el router re-evalúa, así que reacciona al cambio de idioma.
export const config = defineRouteConfig({
  label: whatsappLabel('INBOX_TITLE'),
  rank: 0,
});

export const handle = {
  breadcrumb: () => whatsappLabel('INBOX_TITLE'),
};

export default InboxPage;
