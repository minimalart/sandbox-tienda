import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Container, Heading, Toaster } from '@medusajs/ui';
import { ExtensionSettingsCard } from '../../../components/app-settings/extension-settings-card';
import { HelpDrawer } from '../../../components/common/help-drawer';
import { BotChannelsCard } from '../components/bot-channels-card';
import { FloatingButtonCard } from '../components/floating-button-card';
import { whatsappLabel } from '../../../translations/whatsapp';
import { SingleColumnLayout } from '../../../components/layouts/single-column';

/**
 * WhatsApp → Ajustes: preferencias de la extensión.
 *
 * El catálogo del bot va PRIMERO porque es lo que define si el asistente sirve
 * para algo: apuntado al canal equivocado contesta "no encontré productos" por
 * más que todo lo demás esté bien.
 *
 * Los ajustes de `extension:whatsapp` son 23 campos, así que se reparten en tres
 * cards por `groups` en vez de una sola lista interminable. El bloque "Sólo por
 * entorno" es del namespace completo, no del grupo: se muestra una única vez, en
 * la última card (`hideEnvOnly` en las otras dos).
 *
 * Mismo criterio para la barra de contexto de tienda (`SettingsSiteContext`,
 * montada dentro de cada `ExtensionSettingsCard`): es del namespace, no del
 * grupo, así que se muestra una sola vez en la PRIMERA card (`hideSiteContext`
 * en las otras dos) para no repetir tres veces el mismo selector de tienda.
 *
 * El header propio existe SÓLO para colgar el botón de ayuda, mismo motivo que en
 * `routes/delivery/settings/page.tsx`: son tres cards y la ayuda es del NAMESPACE,
 * no de una de ellas, así que colgarla de una card la ataría al grupo equivocado.
 *
 * Las tres `description` quedaron en UNA oración. Lo que decían de más —que las
 * credenciales se guardan cifradas y aplican en el mensaje siguiente, que un nombre
 * de plantilla vacío es el interruptor de apagado y el email se manda igual, y qué
 * es un handoff— está en el drawer y en `docs/extensions/whatsapp.md`. Era el mismo
 * párrafo repetido en la card Y en seis `help:` de campo.
 */
const SettingsPage = () => (
  <SingleColumnLayout>
    <Container className="p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading>{whatsappLabel('NAV_SETTINGS')}</Heading>
        <HelpDrawer slug="whatsapp" />
      </div>
    </Container>

    <BotChannelsCard />

    <ExtensionSettingsCard
      namespace="extension:whatsapp"
      groups={['Conexión', 'Credenciales']}
      title="Conexión con Kapso"
      description="Credenciales y endpoints de la cuenta de Kapso."
      hideEnvOnly
    />

    <ExtensionSettingsCard
      namespace="extension:whatsapp"
      groups={['Plantillas', 'Carritos y pedidos']}
      title="Plantillas de mensajes"
      description="Nombres de las plantillas aprobadas por Meta."
      hideEnvOnly
      hideSiteContext
    />

    <ExtensionSettingsCard
      namespace="extension:whatsapp"
      groups={['Bot', 'Handoff']}
      title="Bot y atención"
      description="Cómo arma pedidos el asistente y cómo se reparte la conversación con una persona."
      hideSiteContext
    />

    <FloatingButtonCard />
    <Toaster />
  </SingleColumnLayout>
);

// Label del sidebar resuelto por idioma persistido (ver nota en inbox/page.tsx:
// Medusa no traduce los labels de extensión). Breadcrumb como función, reactivo.
export const config = defineRouteConfig({
  label: whatsappLabel('NAV_SETTINGS'),
  // Ajustes va último: el Asesor se insertó en el 2.
  rank: 3,
});

export const handle = {
  breadcrumb: () => whatsappLabel('NAV_SETTINGS'),
};

export default SettingsPage;
