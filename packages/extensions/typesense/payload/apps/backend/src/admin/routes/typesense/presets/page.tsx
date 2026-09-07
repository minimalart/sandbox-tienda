import { defineRouteConfig } from '@medusajs/admin-sdk';
import i18next from 'i18next';
import type { LoaderFunctionArgs, UIMatch } from 'react-router-dom';
import { useLoaderData } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { registerTypesenseTranslations } from '../../../translations/typesense';
import Presets from '../components/Presets/Presets';

type PresetsPageLoaderData = {
  breadcrumbLabel: string;
};

const PresetsPage = () => {
  const { i18n } = useTranslation('typesense');
  registerTypesenseTranslations(i18n);
  useLoaderData();

  return <Presets />;
};

export const config = defineRouteConfig({
  label: 'Presets',
});

export async function loader(_: LoaderFunctionArgs): Promise<PresetsPageLoaderData> {
  const breadcrumbLabel = i18next.t('PRESETS_BREADCRUMB', { ns: 'typesense' });
  return { breadcrumbLabel };
}

export const handle = {
  breadcrumb: ({ data }: UIMatch<PresetsPageLoaderData>) =>
    data?.breadcrumbLabel ?? 'Presets',
};

export default PresetsPage;
