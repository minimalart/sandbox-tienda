import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Toaster } from '@medusajs/ui';
import { useTranslation } from 'react-i18next';
import { FulfillmentList } from '../components/fulfillment-list';
import { registerCorreoArgentinoTranslations } from '../../../translations/correo-argentino';

const CorreoShipmentsPage = () => {
  const { i18n } = useTranslation('correoArgentino');
  registerCorreoArgentinoTranslations(i18n);

  return (
    <>
      <FulfillmentList />
      <Toaster />
    </>
  );
};

export const config = defineRouteConfig({ label: 'Envíos', rank: 0 });

export const handle = {
  breadcrumb: () => 'Envíos',
};

export default CorreoShipmentsPage;
