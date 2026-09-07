import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import type {
  CurationResponse,
  CurationsResponse,
  Override,
  PreparedOverrideData,
} from '../../../../modules/typesense/types';
import { sdk } from '../../../lib/client';

export const useCurationsData = () => {
  const queryClient = useQueryClient();
  const [success, setSuccess] = useState<string | null>(null);

  const curationsQueryFn = async (): Promise<Override[]> => {
    const result = (await sdk.client.fetch('/admin/typesense/curations', {
      method: 'GET',
    })) as CurationsResponse;

    if (!result.success) {
      throw new Error(result.message || 'Failed to load curations');
    }

    return result.data || [];
  };

  const {
    data: overrides = [],
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['typesense', 'curations'],
    queryFn: curationsQueryFn,
    staleTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
  });

  const upsertOverrideMutation = useMutation({
    mutationFn: async ({
      id,
      overrideData,
      isEdit,
    }: {
      id: string;
      overrideData: PreparedOverrideData;
      isEdit?: boolean;
    }) => {
      const result = (await sdk.client.fetch(`/admin/typesense/curations/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: overrideData,
      })) as CurationResponse;

      if (!result.success) {
        throw new Error(result.message || 'Failed to create/update curation');
      }

      return { data: result.data, isEdit };
    },
    onSuccess: (res) => {
      setSuccess(
        res.isEdit ? 'Curación actualizada correctamente' : 'Curación creada correctamente'
      );
      queryClient.invalidateQueries({ queryKey: ['typesense', 'curations'] });
    },
    onError: (err) => {
      console.error('Failed to upsert curation', err);
    },
  });

  const upsertOverride = useCallback(
    async (id: string, overrideData: PreparedOverrideData, isEdit = false) => {
      setSuccess(null);
      return upsertOverrideMutation.mutateAsync({ id, overrideData, isEdit });
    },
    [upsertOverrideMutation]
  );

  const deleteOverrideMutation = useMutation({
    mutationFn: async (id: string) =>
      sdk.client.fetch(`/admin/typesense/curations/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      setSuccess('Curación eliminada correctamente');
      queryClient.invalidateQueries({ queryKey: ['typesense', 'curations'] });
    },
    onError: (err) => {
      console.error('Failed to delete curation', err);
    },
  });

  const deleteOverride = useCallback(
    async (id: string) => {
      setSuccess(null);
      return deleteOverrideMutation.mutateAsync(id);
    },
    [deleteOverrideMutation]
  );

  const getOverride = useCallback(async (id: string) => {
    const result = (await sdk.client.fetch(`/admin/typesense/curations/${id}`, {
      method: 'GET',
    })) as CurationResponse;

    if (!result.success) {
      throw new Error(result.message || 'Failed to load curation');
    }

    return result.data;
  }, []);

  const clearMessages = useCallback(() => {
    setSuccess(null);
  }, []);

  return {
    overrides,
    loading: loading || upsertOverrideMutation.isPending || deleteOverrideMutation.isPending,
    error: error?.message || null,
    success,
    setSuccess,
    refetch,
    upsertOverride,
    deleteOverride,
    getOverride,
    clearMessages,
  };
};
