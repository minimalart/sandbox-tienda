import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sdk } from '../../lib/client';

const VIDEOS_QUERY_KEY = 'videos';
const VIMEO_STATUS_QUERY_KEY = 'vimeo-status';

// Vimeo Connection

export const useVimeoStatus = () => {
  return useQuery({
    queryKey: [VIMEO_STATUS_QUERY_KEY],
    queryFn: async () => {
      try {
        const response = await fetch('/admin/vimeo/status', {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response.json();
      } catch (error) {
        console.error('[Frontend] Error fetching Vimeo status:', error);
        throw error;
      }
    },
  });
};

export const useVimeoConnect = () => {
  return useMutation({
    mutationFn: async (redirectTo?: string) => {
      const params = redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : '';
      const response = await fetch(`/admin/vimeo/oauth/start${params}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Failed to get OAuth URL: ${response.statusText}`);
      }

      const data = (await response.json()) as { url: string };

      if (!data.url) {
        throw new Error('No URL in response');
      }

      return data;
    },
    onSuccess: (data: { url: string }) => {
      window.location.href = data.url;
    },
    onError: (error) => {
      console.error('Failed to connect to Vimeo:', error);
    },
  });
};

// Videos CRUD

// Estados no-terminales: el video aún se procesa en Vimeo. El backend re-sincroniza
// estos al listar; acá el listado poll-ea mientras haya alguno para que el badge
// pase a "Disponible" solo, sin refresh manual.
const IN_PROGRESS_VIDEO_STATUSES = [
  'uploading',
  'transcoding',
  'processing',
  'transcode_starting',
];

export const useVideos = (params?: { offset?: number; limit?: number }) => {
  const queryParams = new URLSearchParams();
  if (params?.offset) queryParams.set('offset', params.offset.toString());
  if (params?.limit) queryParams.set('limit', params.limit.toString());

  return useQuery({
    queryKey: [VIDEOS_QUERY_KEY, params],
    queryFn: async () => {
      try {
        const response = await sdk.client.fetch(`/admin/videos?${queryParams.toString()}`);

        if (response && typeof response === 'object' && 'videos' in response) {
          return response;
        }

        return await (response as Response).json();
      } catch (error) {
        console.error('[Frontend] Videos fetch error:', error);
        throw error;
      }
    },
    refetchInterval: (query) => {
      const data = query.state.data as
        | { videos?: Array<{ status?: string }> }
        | undefined;
      const anyInProgress = (data?.videos ?? []).some((v) =>
        IN_PROGRESS_VIDEO_STATUSES.includes(v.status ?? '')
      );
      return anyInProgress ? 5000 : false;
    },
  });
};

export const useVideo = (id: string) => {
  return useQuery({
    queryKey: [VIDEOS_QUERY_KEY, id],
    queryFn: async () => {
      try {
        const response = await sdk.client.fetch(`/admin/videos/${id}`);

        if (response && typeof response === 'object' && 'video' in response) {
          return response;
        }

        return await (response as Response).json();
      } catch (error) {
        console.error('[Frontend] Video fetch error:', error);
        throw error;
      }
    },
    enabled: !!id,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
};

export const useCreateVideo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: unknown) => {
      const response = await fetch('/admin/videos', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`Failed to create video: ${response.status} ${response.statusText}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [VIDEOS_QUERY_KEY] });
    },
  });
};

export const useUpdateVideo = (id: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: unknown) => {
      const response = await fetch(`/admin/videos/${id}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`Failed to update video: ${response.status} ${response.statusText}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [VIDEOS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [VIDEOS_QUERY_KEY, id] });
    },
  });
};

export const useDeleteVideo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await sdk.client.fetch(`/admin/videos/${id}`, {
        method: 'DELETE',
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [VIDEOS_QUERY_KEY] });
    },
    onError: (error) => {
      console.error('[Frontend] Delete failed:', error);
    },
  });
};

export const useSyncVideo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await sdk.client.fetch(`/admin/videos/${id}/sync`, {
        method: 'POST',
      });

      if (response && typeof response === 'object' && 'video' in response) {
        return response;
      }

      return await (response as Response).json();
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: [VIDEOS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [VIDEOS_QUERY_KEY, id] });
    },
    onError: (error) => {
      console.error('[Frontend] Sync failed:', error);
    },
  });
};

// Product Linking

export const useLinkProducts = (videoId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productIds: string[]) => {
      const response = await fetch(`/admin/videos/${videoId}/products`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_ids: productIds }),
      });

      if (!response.ok) {
        throw new Error(`Failed to link products: ${response.status} ${response.statusText}`);
      }

      return response.json();
    },
    onSuccess: async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      await queryClient.refetchQueries({ queryKey: [VIDEOS_QUERY_KEY, videoId] });
      await queryClient.refetchQueries({ queryKey: ['linked-products'] });
    },
  });
};

export const useUnlinkProducts = (videoId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productIds: string[]) => {
      const response = await fetch(`/admin/videos/${videoId}/products`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_ids: productIds }),
      });

      if (!response.ok) {
        throw new Error(`Failed to unlink products: ${response.status} ${response.statusText}`);
      }

      return { success: true };
    },
    onSuccess: async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      await queryClient.refetchQueries({ queryKey: [VIDEOS_QUERY_KEY, videoId] });
      await queryClient.refetchQueries({ queryKey: ['linked-products'] });
    },
  });
};

// Vimeo Library

export const useVimeoVideos = (query?: string, page?: number) => {
  const queryParams = new URLSearchParams();
  if (query) queryParams.set('query', query);
  if (page) queryParams.set('page', page.toString());

  return useQuery({
    queryKey: ['vimeo-videos', query, page],
    queryFn: async () => {
      const response = await sdk.client.fetch(`/admin/vimeo/videos?${queryParams.toString()}`);

      if (response && typeof response === 'object' && 'data' in response) {
        return response;
      }

      return await (response as Response).json();
    },
  });
};

export const useVimeoUpload = () => {
  return useMutation({
    mutationFn: async (data: { title: string; description?: string; file_size?: number }) => {
      const response = await fetch('/admin/vimeo/upload', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
      }

      return response.json();
    },
  });
};
