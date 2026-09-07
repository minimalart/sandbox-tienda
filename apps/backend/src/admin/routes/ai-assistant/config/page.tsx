import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Button, Container, Heading } from '@medusajs/ui';
import { useRef } from 'react';
import { ExtensionSettingsCard } from '../../../components/app-settings/extension-settings-card';
import { ExtensionVersion } from '../../../components/common/extension-version';
import { HelpDrawer } from '../../../components/common/help-drawer';
import { ConnectClients } from '../components/mcp-keys';
import { McpServers, type McpServersHandle } from '../components/mcp-servers';
import { SingleColumnLayout } from '../../../components/layouts/single-column';

/**
 * El namespace pasó de 2 ajustes a 15, y quince campos en una card sola no se
 * leen. Se reparten por los mismos `group` que declaran los descriptores, en el
 * orden en que se configuran de verdad: primero la cuenta del proveedor (sin eso
 * no anda nada), después lo que se toca seguido, y al final lo del servidor MCP,
 * que la mayoría de las instalaciones no usa.
 *
 * `hideEnvOnly` en todas menos la última: ese bloque es del NAMESPACE, no del
 * grupo, así que sin esto la lista de "sólo por entorno" saldría repetida cuatro
 * veces. Se deja en la última porque ahí es donde alguien que bajó buscando "por
 * qué no puedo cambiar el cron" la va a encontrar.
 *
 * `hideSiteContext` en todas menos la primera: mismo motivo, pero con la barra de
 * tienda activa en vez del bloque de entorno — es del BACKOFFICE, no de la
 * sección, y se repetiría cuatro veces si no se apaga en tres de ellas.
 */
const SECTIONS: { title: string; groups: string[]; description: string; envOnly?: boolean }[] = [
  {
    title: 'Proveedor de IA',
    groups: ['Proveedor de IA'],
    // Las cuatro `description` quedaron en UNA oración. Lo que decían de más —que
    // la key la comparte media instalación y el Catalogador/SEO todavía la leen del
    // entorno, que esta pantalla es la capa de INSTANCIA y Preferencias → IA la
    // pisa por tienda, que el horario del cron sólo cambia al reiniciar, y que lo
    // normal es no tocar el servidor MCP— está en el drawer, con una sección por
    // tema y con el síntoma de cada falla, que es lo que acá no entraba.
    description: 'La cuenta de OpenRouter con la que corre todo lo de IA del backend.',
  },
  {
    title: 'Chat y embeddings',
    groups: ['Chat del asistente', 'Embeddings'],
    description: 'Modelos y parámetros por defecto de la instancia.',
  },
  {
    title: 'Propuestas proactivas',
    groups: ['Propuestas proactivas'],
    description: 'Cuánto y cómo analiza el job que deja propuestas para revisar cada mañana.',
  },
  {
    title: 'Servidor MCP',
    groups: ['Servidor MCP'],
    description: 'Acceso al endpoint /mcp que este backend expone.',
    envOnly: true,
  },
];

const ConfigPage = () => {
  const mcpRef = useRef<McpServersHandle>(null);
  return (
    <SingleColumnLayout>
      <Container className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4">
          <div className="flex items-center gap-x-2">
            <Heading level="h1">Configuración</Heading>
            <ExtensionVersion extension="ai-assistant" />
          </div>
          <div className="flex items-center gap-x-2">
            {/* El drawer va PRIMERO en el grupo de acciones y no último: es la única
                que no hace nada destructivo ni abre un flujo, así que pegada a
                "Agregar servidor" competiría por el mismo click. */}
            <HelpDrawer slug="ai-assistant" />
            <ConnectClients />
            <Button size="small" onClick={() => mcpRef.current?.openNew()}>
              Agregar servidor
            </Button>
          </div>
        </div>
        <div className="px-6 pb-6">
          <McpServers ref={mcpRef} />
        </div>
      </Container>

      {SECTIONS.map((section, index) => (
        <ExtensionSettingsCard
          key={section.title}
          namespace="extension:ai-assistant"
          title={section.title}
          groups={section.groups}
          description={section.description}
          hideEnvOnly={!section.envOnly}
          hideSiteContext={index > 0}
        />
      ))}
    </SingleColumnLayout>
  );
};

export const config = defineRouteConfig({ label: 'Configuración', rank: 4 });

export default ConfigPage;
