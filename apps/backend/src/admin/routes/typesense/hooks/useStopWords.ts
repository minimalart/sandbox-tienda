import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import type {
  StopWord,
  StopWordFormData,
  StopWordsResponse,
} from '../../../../modules/typesense/types';
import { sdk } from '../../../lib/client';

export const useStopWords = () => {
  const queryClient = useQueryClient();
  const [success, setSuccess] = useState<string | null>(null);

  const stopWordsQueryFn = async (): Promise<StopWord[]> => {
    try {
      const result = (await sdk.client.fetch('/admin/typesense/stopwords', {
        method: 'GET',
      })) as StopWordsResponse;

      if (result.success && result.data) {
        return result.data;
      }

      if (!result.success && result.message) {
        console.warn('Typesense stopwords returned warning:', result.message);
      }

      return [];
    } catch (error) {
      console.error('useStopWords query error:', error);
      throw error;
    }
  };

  const {
    data: stopWords = [],
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['typesense', 'stopwords'],
    queryFn: stopWordsQueryFn,
    staleTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
  });

  const prepareFormData = useCallback((data: StopWordFormData) => {
    const stopWordsArray = data.stopwords
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s);

    const sanitizedId = data.id?.trim() ?? '';
    const sanitizedLocale = data.locale ? data.locale.trim() : 'es';

    const stopWordData: { stopwords: string[]; locale: string } = {
      stopwords: stopWordsArray,
      locale: sanitizedLocale,
    };

    return { sanitizedId, stopWordData };
  }, []);

  const createStopWordMutation = useMutation({
    mutationFn: async (formData: StopWordFormData) => {
      const { sanitizedId, stopWordData } = prepareFormData(formData);

      return sdk.client.fetch(`/admin/typesense/stopwords/${sanitizedId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: stopWordData,
      });
    },
    onSuccess: () => {
      setSuccess('Lista de stop words creada correctamente');
      queryClient.invalidateQueries({ queryKey: ['typesense', 'stopwords'] });
    },
    onError: (err) => {
      console.error('Failed to create stop word list', err);
    },
  });

  const createStopWord = useCallback(
    async (formData: StopWordFormData) => {
      setSuccess(null);
      return createStopWordMutation.mutateAsync(formData);
    },
    [createStopWordMutation]
  );

  const updateStopWordMutation = useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: StopWordFormData }) => {
      const { stopWordData } = prepareFormData(formData);

      return sdk.client.fetch(`/admin/typesense/stopwords/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: stopWordData,
      });
    },
    onSuccess: () => {
      setSuccess('Lista de stop words actualizada correctamente');
      queryClient.invalidateQueries({ queryKey: ['typesense', 'stopwords'] });
    },
    onError: (err) => {
      console.error('Failed to update stop word list', err);
    },
  });

  const updateStopWord = useCallback(
    async (id: string, formData: StopWordFormData) => {
      setSuccess(null);
      return updateStopWordMutation.mutateAsync({ id, formData });
    },
    [updateStopWordMutation]
  );

  const deleteStopWordMutation = useMutation({
    mutationFn: async (id: string) =>
      sdk.client.fetch(`/admin/typesense/stopwords/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      setSuccess('Lista de stop words eliminada correctamente');
      queryClient.invalidateQueries({ queryKey: ['typesense', 'stopwords'] });
    },
    onError: (err) => {
      console.error('Failed to delete stop word list', err);
    },
  });

  const deleteStopWord = useCallback(
    async (id: string) => {
      setSuccess(null);
      return deleteStopWordMutation.mutateAsync(id);
    },
    [deleteStopWordMutation]
  );

  const clearMessages = useCallback(() => {
    setSuccess(null);
  }, []);

  return {
    stopWords,
    loading:
      loading ||
      createStopWordMutation.isPending ||
      updateStopWordMutation.isPending ||
      deleteStopWordMutation.isPending,
    error:
      error?.message ||
      createStopWordMutation.error?.message ||
      updateStopWordMutation.error?.message ||
      deleteStopWordMutation.error?.message ||
      null,
    success,
    createStopWord,
    updateStopWord,
    deleteStopWord,
    clearMessages,
    refetch,
  };
};
