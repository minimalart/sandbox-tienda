import { defineRouteConfig } from '@medusajs/admin-sdk';
import i18next from 'i18next';
import type { LoaderFunctionArgs, UIMatch } from 'react-router-dom';
import { useLoaderData } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { registerTypesenseTranslations } from '../../../translations/typesense';
import Search from '../components/Search/Search';
import { SearchProvider } from '../contexts/SearchContext';

type SearchPageLoaderData = {
  breadcrumbLabel: string;
};

const TypesenseSearchPage = () => {
  const { i18n } = useTranslation('typesense');
  registerTypesenseTranslations(i18n);
  useLoaderData();

  return (
    <SearchProvider>
      <Search />
    </SearchProvider>
  );
};

export const config = defineRouteConfig({
  label: 'Búsqueda',
});

export async function loader(_args: LoaderFunctionArgs): Promise<SearchPageLoaderData> {
  const breadcrumbLabel = i18next.t('SEARCH_BREADCRUMB', { ns: 'typesense' });
  return { breadcrumbLabel };
}

export const handle = {
  breadcrumb: ({ data }: UIMatch<SearchPageLoaderData>) => data?.breadcrumbLabel ?? 'Search',
};

export default TypesenseSearchPage;
