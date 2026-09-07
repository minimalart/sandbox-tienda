import { defineRouteConfig } from '@medusajs/admin-sdk';
import i18next from 'i18next';
import type { LoaderFunctionArgs, UIMatch } from 'react-router-dom';
import { useLoaderData } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { registerTypesenseTranslations } from '../../../translations/typesense';
import Synonyms from '../components/Synonyms/Synonyms';

type SynonymsPageLoaderData = {
  breadcrumbLabel: string;
};

const SynonymsPage = () => {
  const { i18n } = useTranslation('typesense');
  registerTypesenseTranslations(i18n);
  useLoaderData();

  return <Synonyms />;
};

export const config = defineRouteConfig({
  label: 'Sinónimos',
});

export async function loader(_: LoaderFunctionArgs): Promise<SynonymsPageLoaderData> {
  const breadcrumbLabel = i18next.t('SYNONYMS_BREADCRUMB', { ns: 'typesense' });
  return { breadcrumbLabel };
}

export const handle = {
  breadcrumb: ({ data }: UIMatch<SynonymsPageLoaderData>) => data?.breadcrumbLabel ?? 'Synonyms',
};

export default SynonymsPage;
