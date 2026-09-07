import { useCallback, useEffect, useState } from 'react';
import type { CollectionSchema } from 'typesense/lib/Typesense/Collection';
import type { SearchParams, SearchResponse } from 'typesense/lib/Typesense/Documents';

import { sdk } from '../../../lib/client';
import type {
  CollectionInfoResponse,
  CustomSearchResponse,
  DefaultCollectionResponse,
} from '../../../../modules/typesense/types';

export interface FieldInfo {
  name: string;
  type: string;
  facet?: boolean;
  sort?: boolean;
  optional?: boolean;
}

export const useSearchData = () => {
  const [searchResults, setSearchResults] = useState<SearchResponse<object> | null>(null);
  const [collections, setCollections] = useState<string[]>([]);
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const [fieldInfos, setFieldInfos] = useState<FieldInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [defaultCollection, setDefaultCollection] = useState<string>('');

  useEffect(() => {
    fetchDefaultCollection();
  }, []);

  const searchQueryFn = async (
    searchOptions: SearchParams<Record<string, unknown>>,
    collectionName?: string
  ) => {
    const data = await sdk.client.fetch<CustomSearchResponse>('/admin/typesense/search', {
      method: 'POST',
      body: { searchOptions, collectionName },
    });

    if (!data.success) {
      throw new Error(data.message || 'Typesense search failed');
    }

    return data.data;
  };

  const collectionsQueryFn = async () => {
    const data = await sdk.client.fetch<{
      success: boolean;
      data?: CollectionSchema[];
      message?: string;
    }>('/admin/typesense/collections', {
      method: 'GET',
    });

    if (!data.success) {
      throw new Error(data.message || 'Failed to load collections');
    }

    return data.data || [];
  };

  const collectionInfoQueryFn = async (collectionName: string) => {
    const data = await sdk.client.fetch<CollectionInfoResponse>(
      `/admin/typesense/collections/${collectionName}`,
      {
        method: 'GET',
      }
    );

    if (!data.success) {
      throw new Error(data.message || 'Failed to load collection info');
    }

    return data.data;
  };

  const defaultCollectionQueryFn = async () => {
    const data = await sdk.client.fetch<DefaultCollectionResponse>(
      '/admin/typesense/collections/default',
      {
        method: 'GET',
      }
    );

    if (!data.success) {
      throw new Error(data.message || 'Failed to load default collection');
    }

    return data.data;
  };
  const fetchDefaultCollection = async () => {
    try {
      const data = await defaultCollectionQueryFn();

      if (data?.collectionName) {
        setDefaultCollection(data.collectionName);
        return data.collectionName;
      }

      const message = 'Invalid default collection response from server';
      setError(message);
      return null;
    } catch (err: any) {
      setError(`Failed to load default collection: ${err.message}`);
      console.error('Default collection error', err);
      return null;
    }
  };
  const fetchCollections = useCallback(async () => {
    try {
      const collectionsResponse: CollectionSchema[] = await collectionsQueryFn();
      const collectionNames = collectionsResponse.map((col) => col.name);
      setCollections(collectionNames);
      return collectionNames;
    } catch (err: any) {
      setError(`Failed to load collections: ${err.message}`);
      console.error(err);
      return [];
    }
  }, []);
  const fetchCollectionFields = useCallback(async (collectionName: string) => {
    try {
      const collectionInfo: CollectionSchema = await collectionInfoQueryFn(collectionName);

      const mappedFields: FieldInfo[] | [] = collectionInfo.fields?.map((field: any) => ({
        name: field.name,
        type: field.type,
        facet: field.facet,
        sort: field.sort,
        optional: field.optional,
      }));

      const fieldInfos = mappedFields || [];
      setFieldInfos(fieldInfos);
      setAvailableFields(fieldInfos.map((field) => field.name));
      return fieldInfos.map((field) => field.name);
    } catch (err: any) {
      setError(`Failed to load collection fields: ${err.message}`);
      console.error(err);
      return [];
    }
  }, []);
  const performSearch = useCallback(
    async (searchOptions: SearchParams<Record<string, unknown>>, collectionName?: string) => {
      setLoading(true);
      setError(null);

      try {
        const result: SearchResponse<object> | null = await searchQueryFn(
          searchOptions,
          collectionName
        );
        setSearchResults(result);
        return result;
      } catch (err: any) {
        setError(`Search failed: ${err.message}`);
        console.error(err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const clearResults = useCallback(() => {
    setSearchResults(null);
    setError(null);
  }, []);

  const getCollectionInfo = useCallback(async (collectionName: string) => {
    try {
      return await collectionInfoQueryFn(collectionName);
    } catch (err: any) {
      setError(`Failed to load collection info: ${err.message}`);
      console.error(err);
      return null;
    }
  }, []);

  return {
    searchResults,
    collections,
    availableFields,
    fieldInfos,
    loading,
    error,
    defaultCollection,

    performSearch,
    fetchCollections,
    fetchCollectionFields,
    getCollectionInfo,
    clearResults,
    setError,
    fetchDefaultCollection,
  };
};
