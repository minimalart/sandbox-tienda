import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Container, Heading } from '@medusajs/ui';
import { ExtensionSettingsCard } from '../../components/app-settings/extension-settings-card';
const MercadoPagoSettings = () => (
  <>
    <Container>
      <Heading>Mercado Pago</Heading>
    </Container>
    <ExtensionSettingsCard namespace="extension:mercadopago" />
  </>
);
export const config = defineRouteConfig({ label: 'Mercado Pago', rank: 71 });
export const handle = { breadcrumb: () => 'Mercado Pago' };
export default MercadoPagoSettings;
