import { defineRouteConfig } from '@medusajs/admin-sdk';
import i18next from 'i18next';
import { useTranslation } from 'react-i18next';
import type { LoaderFunctionArgs, UIMatch } from 'react-router-dom';

import { registerTypesenseTranslations } from '../../../translations/typesense';
import Curations from '../components/Curations/Curations';

type CurationsPageLoaderData = {
  breadcrumbLabel: string;
};

const CurationsPage = () => {
  const { i18n } = useTranslation('typesense');
  registerTypesenseTranslations(i18n);

  return <Curations />;
};

export const config = defineRouteConfig({
  label: 'Curaciones',
});

export async function loader(_args: LoaderFunctionArgs): Promise<CurationsPageLoaderData> {
  const breadcrumbLabel = i18next.t('CURATIONS_BREADCRUMB', { ns: 'typesense' });
  return { breadcrumbLabel };
}

export const handle = {
  breadcrumb: ({ data }: UIMatch<CurationsPageLoaderData>) => data?.breadcrumbLabel ?? 'Curations',
};

export default CurationsPage;
