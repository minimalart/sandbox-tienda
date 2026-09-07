import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import type {
  PresetResponse,
  PresetsResponse,
  SearchPreset,
  SearchPresetValue,
} from '../../../../modules/typesense/types';
import { sdk } from '../../../lib/client';

export const usePresets = () => {
  const queryClient = useQueryClient();
  const [success, setSuccess] = useState<string | null>(null);

  const presetsQueryFn = async (): Promise<SearchPreset[]> => {
    try {
      const result = (await sdk.client.fetch('/admin/typesense/presets', {
        method: 'GET',
      })) as PresetsResponse;

      if (result.success && result.data) {
        return result.data;
      }

      if (!result.success && result.message) {
        console.warn('Typesense presets warning:', result.message);
      }

      return [];
    } catch (error) {
      console.error('usePresets query error:', error);
      throw error;
    }
  };

  const {
    data: presets = [],
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['typesense', 'presets'],
    queryFn: presetsQueryFn,
    staleTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
  });

  const upsertPresetMutation = useMutation({
    mutationFn: async ({
      name,
      value,
      isEdit,
    }: {
      name: string;
      value: SearchPresetValue;
      isEdit?: boolean;
    }) => {
      const result = (await sdk.client.fetch(`/admin/typesense/presets/${name}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: value,
      })) as PresetResponse;

      if (!result.success) {
        throw new Error(result.message || 'Failed to save preset');
      }

      return { data: result.data, isEdit };
    },
    onSuccess: (res) => {
      setSuccess(res.isEdit ? 'Preset actualizado correctamente' : 'Preset creado correctamente');
      queryClient.invalidateQueries({ queryKey: ['typesense', 'presets'] });
    },
    onError: (err) => {
      console.error('Failed to upsert preset', err);
    },
  });

  const upsertPreset = useCallback(
    async (name: string, value: SearchPresetValue, isEdit = false) => {
      setSuccess(null);
      return upsertPresetMutation.mutateAsync({ name, value, isEdit });
    },
    [upsertPresetMutation]
  );

  const deletePresetMutation = useMutation({
    mutationFn: async (name: string) =>
      sdk.client.fetch(`/admin/typesense/presets/${name}`, { method: 'DELETE' }),
    onSuccess: () => {
      setSuccess('Preset eliminado correctamente');
      queryClient.invalidateQueries({ queryKey: ['typesense', 'presets'] });
    },
    onError: (err) => {
      console.error('Failed to delete preset', err);
    },
  });

  const deletePreset = useCallback(
    async (name: string) => {
      setSuccess(null);
      return deletePresetMutation.mutateAsync(name);
    },
    [deletePresetMutation]
  );

  const clearMessages = useCallback(() => {
    setSuccess(null);
  }, []);

  return {
    presets,
    loading: loading || upsertPresetMutation.isPending || deletePresetMutation.isPending,
    error:
      error?.message ||
      upsertPresetMutation.error?.message ||
      deletePresetMutation.error?.message ||
      null,
    success,
    upsertPreset,
    deletePreset,
    clearMessages,
    refetch,
  };
};
