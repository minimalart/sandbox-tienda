import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import type { SearchParams as TypesenseSearchParams } from 'typesense/lib/Typesense/Documents';

import {
  STOREFRONT_TYPESENSE_QUERY_BY_FIELDS,
  STOREFRONT_TYPESENSE_TYPO_PARAMS,
  TYPESENSE_ADMIN_DEFAULT_PER_PAGE,
  normalizeTypesenseQuery,
} from '../../../../modules/typesense/search-defaults';
import { useSearchData } from '../hooks/useSearchData';

export interface SearchState {
  q: string;
  query_by: string[];
  filter_by: Array<{ field: string; expression: string }>;
  facet_by: string[];
  sort_by: Array<{ field: string; direction: 'asc' | 'desc' }>;
  page: number;
  per_page: number;
}

interface SearchContextType {
  searchState: SearchState;
  searchResults: any;
  loading: boolean;
  error: string | null;
  selectedCollection: string;
  availableFields: string[];
  fieldInfos: any[];

  updateSearchParam: (key: keyof SearchState, value: any) => void;
  addFilter: (field: string, value: string) => void;
  removeFilter: (index: number) => void;
  clearAllFilters: () => void;
  addFacetFilter: (field: string, value: string) => void;
  resetSearch: () => void;
  triggerSearch: () => void;
}

const defaultSearchState: SearchState = {
  q: '*',
  query_by: [...STOREFRONT_TYPESENSE_QUERY_BY_FIELDS],
  filter_by: [],
  facet_by: [],
  sort_by: [
    {
      field: '_text_match',
      direction: 'desc',
    },
  ],
  page: 1,
  per_page: TYPESENSE_ADMIN_DEFAULT_PER_PAGE,
};

const SearchContext = createContext<SearchContextType | null>(null);

const debounce = (func: (...args: any[]) => void, wait: number) => {
  let timeout: ReturnType<typeof setTimeout>;
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

export const SearchProvider = ({ children }: { children: ReactNode }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchState, setSearchState] = useState<SearchState>(defaultSearchState);
  const [selectedCollection, setSelectedCollection] = useState<string>('');

  const {
    searchResults,
    loading,
    error,
    availableFields,
    fieldInfos,
    performSearch,
    fetchCollections,
    fetchCollectionFields,
    defaultCollection,
  } = useSearchData();

  useEffect(() => {
    const urlState: Partial<SearchState> = {};

    const q = searchParams.get('q');
    if (q) urlState.q = normalizeTypesenseQuery(q);

    const query_by = searchParams.get('query_by');
    if (query_by) urlState.query_by = query_by.split(',');

    const filter_by = searchParams.get('filter_by');
    if (filter_by) {
      urlState.filter_by = filter_by.split(' && ').map((filter) => {
        const match = filter.match(/^(.+?)(:.+)$/);
        if (match) {
          const [, field, expression] = match;
          return { field, expression };
        }

        return { field: filter, expression: '' };
      });
    }

    const facet_by = searchParams.get('facet_by');
    if (facet_by) urlState.facet_by = facet_by.split(',');

    const sort_by = searchParams.get('sort_by');
    if (sort_by) {
      urlState.sort_by = sort_by.split(',').map((sort) => {
        const [field, direction] = sort.split(':');
        return { field, direction: direction as 'asc' | 'desc' };
      });
    }

    const page = searchParams.get('page');
    if (page) urlState.page = parseInt(page, 10);

    const per_page = searchParams.get('per_page');
    if (per_page) urlState.per_page = parseInt(per_page, 10);

    if (Object.keys(urlState).length > 0) {
      setSearchState((prev) => ({ ...prev, ...urlState }));
    }
  }, [searchParams]);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  useEffect(() => {
    if (defaultCollection && !selectedCollection) {
      setSelectedCollection(defaultCollection);
    }
  }, [defaultCollection, selectedCollection]);

  useEffect(() => {
    if (selectedCollection) {
      fetchCollectionFields(selectedCollection);
    }
  }, [selectedCollection, fetchCollectionFields]);

  const buildTypesenseParams = useCallback(
    (state: SearchState): TypesenseSearchParams<Record<string, unknown>> => {
      const params: TypesenseSearchParams<Record<string, unknown>> = {
        q: normalizeTypesenseQuery(state.q),
        query_by: state.query_by.join(','),
        page: state.page,
        per_page: state.per_page,
        ...STOREFRONT_TYPESENSE_TYPO_PARAMS,
      };

      if (state.filter_by.length > 0) {
        const filterStrings = state.filter_by.map(
          (filter) => `${filter.field}${filter.expression}`
        );
        if (filterStrings.length > 0) {
          params.filter_by = filterStrings.join(' && ');
        }
      }

      if (state.facet_by.length > 0) {
        params.facet_by = state.facet_by.join(',');
      }

      if (state.sort_by.length > 0) {
        params.sort_by = state.sort_by.map((s) => `${s.field}:${s.direction}`).join(',');
      }

      return params;
    },
    []
  );

  const debouncedSearchRef = useRef(
    debounce(async (state: SearchState, collection: string) => {
      if (collection) {
        const typesenseParams = buildTypesenseParams(state);
        await performSearch(typesenseParams, collection);
      }
    }, 500)
  );

  useEffect(() => {
    const newParams = new URLSearchParams();
    const normalizedQuery = normalizeTypesenseQuery(searchState.q);
    if (normalizedQuery !== '*') newParams.set('q', normalizedQuery);
    if (searchState.query_by.length > 0) newParams.set('query_by', searchState.query_by.join(','));
    if (searchState.filter_by.length > 0) {
      const filterStrings = searchState.filter_by.map(
        (filter) => `${filter.field}${filter.expression}`
      );
      newParams.set('filter_by', filterStrings.join(' && '));
    }
    if (searchState.facet_by.length > 0) newParams.set('facet_by', searchState.facet_by.join(','));
    if (searchState.sort_by.length > 0) {
      newParams.set(
        'sort_by',
        searchState.sort_by.map((s) => `${s.field}:${s.direction}`).join(',')
      );
    }
    if (searchState.page > 1) newParams.set('page', searchState.page.toString());
    if (searchState.per_page !== TYPESENSE_ADMIN_DEFAULT_PER_PAGE) {
      newParams.set('per_page', searchState.per_page.toString());
    }

    setSearchParams(newParams, { replace: true });
  }, [searchState, setSearchParams]);

  useEffect(() => {
    if (selectedCollection) {
      debouncedSearchRef.current(searchState, selectedCollection);
    }
  }, [searchState, selectedCollection]);

  const updateSearchParam = useCallback((key: keyof SearchState, value: any) => {
    setSearchState((prev) => ({
      ...prev,
      [key]: key === 'q' ? normalizeTypesenseQuery(String(value ?? '')) : value,
      ...(key !== 'page' ? { page: 1 } : {}),
    }));
  }, []);

  const addFilter = useCallback((field: string, value: string) => {
    const filterObject = { field, expression: `:${value}` };
    setSearchState((prev) => ({
      ...prev,
      filter_by: [...prev.filter_by, filterObject],
      page: 1,
    }));
  }, []);

  const removeFilter = useCallback((index: number) => {
    setSearchState((prev) => ({
      ...prev,
      filter_by: prev.filter_by.filter((_, i) => i !== index),
      page: 1,
    }));
  }, []);

  const clearAllFilters = useCallback(() => {
    setSearchState((prev) => ({
      ...prev,
      filter_by: [],
      page: 1,
    }));
  }, []);

  const addFacetFilter = useCallback((field: string, value: string) => {
    const filterObject = { field, expression: `:${value}` };

    setSearchState((prev) => {
      const exists = prev.filter_by.some((f) => f.field === field && f.expression === `:${value}`);
      if (exists) return prev;
      return {
        ...prev,
        filter_by: [...prev.filter_by, filterObject],
        page: 1,
      };
    });
  }, []);

  const resetSearch = useCallback(() => {
    setSearchState(defaultSearchState);
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);

  const triggerSearch = useCallback(async () => {
    if (selectedCollection) {
      const typesenseParams = buildTypesenseParams(searchState);
      await performSearch(typesenseParams, selectedCollection);
    }
  }, [selectedCollection, searchState, buildTypesenseParams, performSearch]);

  const contextValue: SearchContextType = useMemo(
    () => ({
      searchState,
      searchResults,
      loading,
      error,
      selectedCollection,
      availableFields,
      fieldInfos,
      updateSearchParam,
      addFilter,
      removeFilter,
      clearAllFilters,
      addFacetFilter,
      resetSearch,
      triggerSearch,
    }),
    [
      searchState,
      searchResults,
      loading,
      error,
      selectedCollection,
      availableFields,
      fieldInfos,
      updateSearchParam,
      addFilter,
      removeFilter,
      clearAllFilters,
      addFacetFilter,
      resetSearch,
      triggerSearch,
    ]
  );

  return <SearchContext.Provider value={contextValue}>{children}</SearchContext.Provider>;
};

export const useSearchContext = (): SearchContextType => {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearchContext must be used within a SearchProvider');
  }
  return context;
};
