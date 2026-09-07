import { defineRouteConfig } from '@medusajs/admin-sdk';
import i18next from 'i18next';
import type { LoaderFunctionArgs, UIMatch } from 'react-router-dom';
import { useLoaderData } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { registerTypesenseTranslations } from '../../../translations/typesense';
import StopWords from '../components/StopWords/StopWords';

type StopWordsPageLoaderData = {
  breadcrumbLabel: string;
};

const StopWordsPage = () => {
  const { i18n } = useTranslation('typesense');
  registerTypesenseTranslations(i18n);
  useLoaderData();

  return <StopWords />;
};

export const config = defineRouteConfig({
  label: 'Palabras Vacías',
});

export async function loader(_args: LoaderFunctionArgs): Promise<StopWordsPageLoaderData> {
  const breadcrumbLabel = i18next.t('STOPWORDS_BREADCRUMB', { ns: 'typesense' });
  return { breadcrumbLabel };
}

export const handle = {
  breadcrumb: ({ data }: UIMatch<StopWordsPageLoaderData>) => data?.breadcrumbLabel ?? 'Stop Words',
};

export default StopWordsPage;
