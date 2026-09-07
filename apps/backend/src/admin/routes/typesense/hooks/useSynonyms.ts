import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import type {
  Synonym,
  SynonymFormData,
  SynonymsResponse,
} from '../../../../modules/typesense/types';
import { sdk } from '../../../lib/client';

export const useSynonyms = () => {
  const queryClient = useQueryClient();
  const [success, setSuccess] = useState<string | null>(null);

  const synonymsQueryFn = async (): Promise<Synonym[]> => {
    try {
      const result = (await sdk.client.fetch('/admin/typesense/synonyms', {
        method: 'GET',
      })) as SynonymsResponse;

      if (result.success && result.data) {
        return result.data;
      }

      if (!result.success && result.message) {
        console.warn('Typesense synonyms returned warning:', result.message);
      }

      return [];
    } catch (error) {
      console.error('useSynonyms query error:', error);
      throw error;
    }
  };

  const {
    data: synonyms = [],
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['typesense', 'synonyms'],
    queryFn: synonymsQueryFn,
    staleTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
  });

  const prepareFormData = useCallback((data: SynonymFormData) => {
    const synonymsArray = data.synonyms
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s);

    const sanitizedId = data.id.trim();
    const sanitizedRoot = data.root ? data.root.trim() : undefined;
    const sanitizedLocale =
      data.locale && data.locale !== 'global' ? data.locale.trim() : undefined;

    const synonymData: { synonyms: string[]; root?: string; locale?: string } = {
      synonyms: synonymsArray,
    };

    if (sanitizedRoot) {
      synonymData.root = sanitizedRoot;
    }

    if (sanitizedLocale) {
      synonymData.locale = sanitizedLocale;
    }

    return { sanitizedId, synonymData };
  }, []);

  const createSynonymMutation = useMutation({
    mutationFn: async (formData: SynonymFormData) => {
      const { sanitizedId, synonymData } = prepareFormData(formData);

      return sdk.client.fetch(`/admin/typesense/synonyms/${sanitizedId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: synonymData,
      });
    },
    onSuccess: () => {
      setSuccess('Sinónimo creado correctamente');
      queryClient.invalidateQueries({ queryKey: ['typesense', 'synonyms'] });
    },
    onError: (err) => {
      console.error('Failed to create synonym', err);
    },
  });

  const createSynonym = useCallback(
    async (formData: SynonymFormData) => {
      setSuccess(null);
      return createSynonymMutation.mutateAsync(formData);
    },
    [createSynonymMutation]
  );

  const updateSynonymMutation = useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: SynonymFormData }) => {
      const { synonymData } = prepareFormData(formData);

      return sdk.client.fetch(`/admin/typesense/synonyms/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: synonymData,
      });
    },
    onSuccess: () => {
      setSuccess('Sinónimo actualizado correctamente');
      queryClient.invalidateQueries({ queryKey: ['typesense', 'synonyms'] });
    },
    onError: (err) => {
      console.error('Failed to update synonym', err);
    },
  });

  const updateSynonym = useCallback(
    async (id: string, formData: SynonymFormData) => {
      setSuccess(null);
      return updateSynonymMutation.mutateAsync({ id, formData });
    },
    [updateSynonymMutation]
  );

  const deleteSynonymMutation = useMutation({
    mutationFn: async (id: string) =>
      sdk.client.fetch(`/admin/typesense/synonyms/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      setSuccess('Sinónimo eliminado correctamente');
      queryClient.invalidateQueries({ queryKey: ['typesense', 'synonyms'] });
    },
    onError: (err) => {
      console.error('Failed to delete synonym', err);
    },
  });

  const deleteSynonym = useCallback(
    async (id: string) => {
      setSuccess(null);
      return deleteSynonymMutation.mutateAsync(id);
    },
    [deleteSynonymMutation]
  );

  const clearMessages = useCallback(() => {
    setSuccess(null);
  }, []);

  return {
    synonyms,
    loading:
      loading ||
      createSynonymMutation.isPending ||
      updateSynonymMutation.isPending ||
      deleteSynonymMutation.isPending,
    error:
      error?.message ||
      createSynonymMutation.error?.message ||
      updateSynonymMutation.error?.message ||
      deleteSynonymMutation.error?.message ||
      null,
    success,
    createSynonym,
    updateSynonym,
    deleteSynonym,
    clearMessages,
    refetch,
  };
};
