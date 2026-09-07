import { Badge, Button, Text } from '@medusajs/ui';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { SearchResponse, SearchResponseHit } from 'typesense/lib/Typesense/Documents';

import { Container } from '../../../../components/container';
import { useSearchContext } from '../../contexts/SearchContext';
import FacetResults from './FacetResults';

type SearchDocument = Record<string, unknown> & {
  id?: string;
  title?: string;
  name?: string;
  price?: number;
  handle?: string;
  categories?: unknown;
  brand?: unknown;
};

const debounce = <F extends (...args: Parameters<F>) => void>(func: F, wait: number) => {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<F>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

const ResultsPanel = () => {
  const { t } = useTranslation('typesense');
  const {
    searchState,
    searchResults: contextResults,
    loading,
    updateSearchParam,
    addFacetFilter,
  } = useSearchContext();

  const searchResults = contextResults as SearchResponse<SearchDocument> | null;

  const handleFacetClick = (field: string, value: string) => {
    addFacetFilter(field, value);
  };

  const debouncedPreviousPage = useCallback(
    debounce((currentPage: number) => {
      updateSearchParam('page', Math.max(1, currentPage - 1));
    }, 300),
    [updateSearchParam]
  );

  const debouncedNextPage = useCallback(
    debounce((currentPage: number) => {
      updateSearchParam('page', currentPage + 1);
    }, 300),
    [updateSearchParam]
  );

  return (
    <div className="mt-2 space-y-6">
      {loading ? (
        <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle p-6 text-center">
          <Text>{t('SEARCHING_TEXT')}</Text>
        </div>
      ) : null}

      {searchResults && !loading ? (
        <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle p-6">
          <div className="mb-4 flex items-center justify-end">
            <Badge>
              {searchResults.found} {t('FOUND_IN_MS')} {searchResults.search_time_ms}ms
            </Badge>
          </div>

          {Array.isArray(searchResults.facet_counts) && searchResults.facet_counts.length > 0 ? (
            <div className="mb-6">
              <FacetResults facets={searchResults.facet_counts} onFacetClick={handleFacetClick} />
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {searchResults.hits?.map((hit: SearchResponseHit<SearchDocument>, index: number) => (
              <div
                key={`${hit.document?.id ?? index}`}
                className="rounded-md border border-ui-border-base bg-ui-bg-field p-3 transition-colors hover:border-ui-border-interactive"
              >
                <div className="flex items-start justify-between gap-2">
                  <Text size="small" className="truncate font-semibold" title={String(
                    (hit.document?.title as string | undefined) ??
                      (hit.document?.name as string | undefined) ??
                      hit.document?.id ??
                      ''
                  )}>
                    {(hit.document?.title as string | undefined) ??
                      (hit.document?.name as string | undefined) ??
                      hit.document?.id ??
                      `${t('ITEM_PREFIX')} ${index + 1}`}
                  </Text>
                  {typeof hit.document?.price === 'number' ? (
                    <Text size="small" className="shrink-0 font-medium text-ui-fg-base">
                      ${hit.document.price}
                    </Text>
                  ) : null}
                </div>

                {hit.document?.handle ? (
                  <Text size="xsmall" className="mt-0.5 truncate text-ui-fg-subtle">
                    {hit.document.handle}
                  </Text>
                ) : null}

                <div className="mt-2 flex flex-wrap items-center gap-1">
                  {hit.document?.categories
                    ? (Array.isArray(hit.document.categories)
                        ? hit.document.categories
                        : [hit.document.categories]
                      )
                        .slice(0, 3)
                        .map((category, catIndex: number) => {
                          const categoryText =
                            typeof category === 'object' && category !== null
                              ? (category.name ??
                                category.title ??
                                category.id ??
                                JSON.stringify(category))
                              : String(category ?? '');
                          return (
                            <Badge key={catIndex} size="2xsmall">
                              {categoryText}
                            </Badge>
                          );
                        })
                    : null}
                  {hit.document?.brand ? (
                    <Badge size="2xsmall" color="blue">
                      {typeof hit.document.brand === 'object'
                        ? (hit.document.brand?.name ??
                          hit.document.brand?.title ??
                          JSON.stringify(hit.document.brand))
                        : String(hit.document.brand)}
                    </Badge>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          {searchResults.found > searchState.per_page ? (
            <Container className="mt-4">
              <div className="flex flex-col items-center justify-between py-3">
                <Text size="small" className="text-ui-fg-subtle">
                  {t('SHOWING_RESULTS')} {(searchState.page - 1) * searchState.per_page + 1}-
                  {Math.min(searchState.page * searchState.per_page, searchResults.found)}{' '}
                  {t('OF_RESULTS')} {searchResults.found} {t('RESULTS_TEXT')}
                </Text>
                <div className="mx-auto mt-3 flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="small"
                    disabled={searchState.page <= 1}
                    onClick={() => debouncedPreviousPage(searchState.page)}
                  >
                    {t('PREVIOUS_BUTTON')}
                  </Button>
                  <Text size="small" className="text-ui-fg-subtle">
                    {/* `OF_TEXT_PAGE`, no `OF_TEXT`: la segunda no existe en ningún
                        namespace, así que i18next hacía fallback al nombre de la clave y
                        el paginador leía "Página 2 OF_TEXT 5". La correcta está definida
                        al lado de `PAGE_TEXT` desde siempre; quedó huérfana en un rename. */}
                    {t('PAGE_TEXT')} {searchState.page} {t('OF_TEXT_PAGE')}{' '}
                    {Math.ceil(searchResults.found / searchState.per_page)}
                  </Text>
                  <Button
                    variant="secondary"
                    size="small"
                    disabled={
                      searchState.page >= Math.ceil(searchResults.found / searchState.per_page)
                    }
                    onClick={() => debouncedNextPage(searchState.page)}
                  >
                    {t('NEXT_BUTTON')}
                  </Button>
                </div>
              </div>
            </Container>
          ) : null}
        </div>
      ) : null}

      {!searchResults && !loading ? (
        <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle p-6 text-center">
          <Text className="text-ui-fg-subtle">{t('NO_RESULTS_MESSAGE')}</Text>
        </div>
      ) : null}
    </div>
  );
};

export default ResultsPanel;
