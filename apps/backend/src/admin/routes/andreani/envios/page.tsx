import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Toaster } from '@medusajs/ui';
import { useTranslation } from 'react-i18next';
import { FulfillmentList } from '../components/fulfillment-list';
import { registerAndreaniTranslations } from '../../../translations/andreani';

const AndreaniShipmentsPage = () => {
  const { i18n } = useTranslation('andreani');
  registerAndreaniTranslations(i18n);

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

export default AndreaniShipmentsPage;
