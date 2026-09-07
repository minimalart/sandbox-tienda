import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Toaster } from '@medusajs/ui';
import { useTranslation } from 'react-i18next';
import { ConfigStatus } from '../components/config-status';
import { ExtensionSettingsCard } from '../../../components/app-settings/extension-settings-card';
import { registerCorreoArgentinoTranslations } from '../../../translations/correo-argentino';
import { SingleColumnLayout } from '../../../components/layouts/single-column';

/**
 * Las 42 variables de Correo, repartidas por los mismos `group` de los descriptores.
 * Mismo criterio que Andreani: una card por bloque de decisión, no una lista de 42
 * campos. Ver el docblock de `routes/andreani/configuracion/page.tsx` por qué
 * `hideEnvOnly` y `hideSiteContext` van en todas menos la primera.
 */
const GROUPS: { title: string; groups: string[]; description: string }[] = [
  {
    title: 'Cuenta y conexión',
    groups: ['Cuenta y acuerdo', 'Conexión'],
    // UNA oración. Lo que decía de más —que el acuerdo es lo que se factura y que
    // una tienda que hereda el de la instancia le carga los envíos al titular
    // equivocado— está en el drawer, sección "El número de acuerdo es lo más
    // delicado de esta pantalla", donde además se dice que el cobro es
    // irrecuperable. El botón está en el header de `ConfigStatus`, arriba.
    description: 'API key, número de acuerdo y hosts de las dos APIs de Correo.',
  },
  {
    title: 'MiCorreo (cotización)',
    groups: ['MiCorreo (cotización)'],
    description: 'Credenciales del portal que devuelve las tarifas al checkout.',
  },
  {
    title: 'Remitente y origen',
    groups: ['Remitente', 'Origen'],
    description: 'Quién figura como remitente y desde qué domicilio se despacha.',
  },
  {
    title: 'Producto, bulto y operación',
    groups: ['Producto y límites', 'Fallback de dimensiones', 'Operación'],
    description:
      'Tipo de servicio, los límites físicos del contrato y las medidas de respaldo ' +
      'para productos sin dimensiones cargadas.',
  },
];

/**
 * Configuración de Correo Argentino: estado de la integración.
 *
 * NO es un CRUD como la de Andreani (que administra cajas). Correo consolida todo
 * en UN bulto porque su API descarta todo `parcels[]` salvo el primero, así que no
 * hay cajas que administrar.
 *
 * Es de lectura salvo por UNA acción: el botón de prueba de conexión, que pega
 * contra las dos APIs de Correo y **solo corre cuando alguien lo aprieta**. El
 * detalle de qué se muestra, con qué endpoint y por qué la sonda es opt-in está
 * en el docblock de `components/config-status.tsx`.
 */
const CorreoConfigPage = () => {
  const { i18n } = useTranslation('correoArgentino');
  registerCorreoArgentinoTranslations(i18n);

  return (
    <SingleColumnLayout>
      <ConfigStatus />
      {GROUPS.map((section, index) => (
        <ExtensionSettingsCard
          key={section.title}
          namespace="extension:correo-argentino"
          title={section.title}
          groups={section.groups}
          description={section.description}
          hideEnvOnly={index > 0}
          hideSiteContext={index > 0}
        />
      ))}
      <Toaster />
    </SingleColumnLayout>
  );
};

export const config = defineRouteConfig({ label: 'Configuración', rank: 1 });

export const handle = {
  breadcrumb: () => 'Configuración',
};

export default CorreoConfigPage;
