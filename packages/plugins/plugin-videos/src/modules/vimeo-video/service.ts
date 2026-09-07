import { getAppSettingsSyncReader } from '@minimalart/mercatto-plugin-runtime';
import { MedusaService } from '@medusajs/framework/utils';
import { VimeoVideo, ProductVideoLink, VimeoToken } from './models';

type VimeoModuleOptions = {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  accessToken?: string;
  folderUri?: string;
};

export default class VimeoVideoModuleService extends MedusaService({
  VimeoVideo,
  ProductVideoLink,
  VimeoToken,
}) {
  private bootOptions: VimeoModuleOptions;
  private get options(): VimeoModuleOptions {
    const reader = getAppSettingsSyncReader();
    const read = (key: string, fallback?: string) => {
      const value = reader?.('extension:videos', key);
      return typeof value === 'string' && value ? value : process.env[key] || fallback;
    };
    return {
      clientId: read('VIMEO_CLIENT_ID', this.bootOptions.clientId),
      clientSecret: read('VIMEO_CLIENT_SECRET', this.bootOptions.clientSecret),
      redirectUri: this.bootOptions.redirectUri,
      accessToken: read('VIMEO_ACCESS_TOKEN', this.bootOptions.accessToken),
      folderUri: read('VIMEO_FOLDER_URI', this.bootOptions.folderUri),
    };
  }
  private readonly VIMEO_API_BASE = 'https://api.vimeo.com';
  protected readonly vimeoVideoRepository_: any;

  constructor(container: any, options: VimeoModuleOptions = {}) {
    super(...arguments);
    this.bootOptions = options;
    this.vimeoVideoRepository_ = container.vimeoVideoRepository;
  }

  // ─── OAuth ────────────────────────────────────────────────────────────────

  async getAuthorizationUrl(state?: string): Promise<string> {
    if (!this.options.clientId) {
      throw new Error('VIMEO_CLIENT_ID is not configured');
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.options.clientId,
      redirect_uri: this.options.redirectUri || '',
      state: state || 'default',
      scope: 'public private create edit delete upload',
    });

    return `${this.VIMEO_API_BASE}/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<any> {
    if (!this.options.clientId || !this.options.clientSecret) {
      throw new Error('Vimeo OAuth credentials are not configured');
    }

    const response = await fetch(`${this.VIMEO_API_BASE}/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `basic ${Buffer.from(
          `${this.options.clientId}:${this.options.clientSecret}`
        ).toString('base64')}`,
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.options.redirectUri || '',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange code: ${error}`);
    }

    const data = await response.json();
    await this.storeTokens(data);
    return data;
  }

  async storeTokens(tokens: any): Promise<void> {
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    const existingToken = await this.listVimeoTokens({}, { take: 1 });

    if (existingToken.length > 0 && existingToken[0]) {
      await this.updateVimeoTokens({
        id: existingToken[0].id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        token_type: tokens.token_type || 'bearer',
        scope: tokens.scope || null,
        expires_at: expiresAt,
        user_id: tokens.user?.uri?.split('/').pop() || null,
      });
    } else {
      await this.createVimeoTokens({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        token_type: tokens.token_type || 'bearer',
        scope: tokens.scope || null,
        expires_at: expiresAt,
        user_id: tokens.user?.uri?.split('/').pop() || null,
      });
    }
  }

  async getAccessToken(): Promise<string | null> {
    // Personal access token takes priority
    if (this.options.accessToken) {
      return this.options.accessToken;
    }

    // Fall back to OAuth token from database
    const tokens = await this.listVimeoTokens({}, { take: 1 });

    if (!tokens || tokens.length === 0) {
      return null;
    }

    const token = tokens[0];

    if (!token) {
      return null;
    }

    if (!token.expires_at || new Date(token.expires_at) > new Date()) {
      return token.access_token;
    }

    if (!token.refresh_token) {
      return null;
    }

    await this.refreshAccessToken(token.refresh_token);

    const refreshedTokens = await this.listVimeoTokens({}, { take: 1 });

    if (!refreshedTokens || refreshedTokens.length === 0) {
      return null;
    }

    return refreshedTokens[0]?.access_token ?? null;
  }

  async refreshAccessToken(refreshToken: string): Promise<void> {
    if (!this.options.clientId || !this.options.clientSecret) {
      throw new Error('Vimeo OAuth credentials are not configured');
    }

    const response = await fetch(`${this.VIMEO_API_BASE}/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `basic ${Buffer.from(
          `${this.options.clientId}:${this.options.clientSecret}`
        ).toString('base64')}`,
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh token');
    }

    const data = await response.json();
    await this.storeTokens(data);
  }

  async isConnected(): Promise<boolean> {
    const token = await this.getAccessToken();
    return !!token;
  }

  async getConnectionStatus(): Promise<{
    connected: boolean;
    user?: any;
    error?: string;
    folderUri?: string;
  }> {
    const token = await this.getAccessToken();

    if (!token) {
      return { connected: false, error: 'No token available' };
    }

    try {
      const user = await this.getVimeoUser(token);
      return {
        connected: true,
        user,
        folderUri: this.options.folderUri,
      };
    } catch (error: any) {
      console.error('[Vimeo] Failed to fetch user:', error);
      return {
        connected: false,
        error: error?.message || 'Failed to connect to Vimeo',
      };
    }
  }

  async getVimeoUser(token: string): Promise<any> {
    const response = await fetch(`${this.VIMEO_API_BASE}/me`, {
      headers: {
        Authorization: `bearer ${token}`,
        Accept: 'application/vnd.vimeo.*+json;version=3.4',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Vimeo] API Error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      throw new Error(`Failed to fetch Vimeo user: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async searchVimeoVideos(query?: string, page = 1, perPage = 25): Promise<any> {
    const token = await this.getAccessToken();

    if (!token) {
      throw new Error('Not connected to Vimeo');
    }

    const params = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString(),
      fields: 'uri,name,description,duration,pictures,link,status',
    });

    if (query) {
      params.append('query', query);
    }

    let endpoint = `${this.VIMEO_API_BASE}/me/videos`;

    if (this.options.folderUri) {
      endpoint = `${this.VIMEO_API_BASE}${this.options.folderUri}/videos`;
    }

    const response = await fetch(`${endpoint}?${params.toString()}`, {
      headers: {
        Authorization: `bearer ${token}`,
        Accept: 'application/vnd.vimeo.*+json;version=3.4',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Vimeo] Search failed:', response.status, errorText);
      throw new Error(`Failed to search Vimeo videos: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getVimeoVideo(vimeoId: string): Promise<any> {
    const token = await this.getAccessToken();

    if (!token) {
      throw new Error('Not connected to Vimeo');
    }

    const response = await fetch(`${this.VIMEO_API_BASE}/videos/${vimeoId}`, {
      headers: {
        Authorization: `bearer ${token}`,
        Accept: 'application/vnd.vimeo.*+json;version=3.4',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch Vimeo video');
    }

    return response.json();
  }

  async listVideos(filters: any = {}, config: any = {}) {
    if (!this.vimeoVideoRepository_) {
      console.error('[Vimeo] Repository not found');
      return [];
    }

    try {
      const [_allVideos, allCount] = await this.vimeoVideoRepository_.findAndCount();

      if (allCount > 0) {
        const [videos] = await this.vimeoVideoRepository_.findAndCount(filters, config);
        return videos;
      }
      return [];
    } catch (error) {
      console.error('[Vimeo] Error listing videos:', error);
      return [];
    }
  }

  async createVideo(data: any) {
    if (!this.vimeoVideoRepository_) {
      console.error('[Vimeo] Repository not found');
      throw new Error('VimeoVideo repository not found');
    }

    try {
      let videoData = { ...data };

      if (data.vimeo_id && !data.thumbnail_url) {
        try {
          const vimeoVideo = await this.getVimeoVideo(data.vimeo_id);

          let thumbnailUrl = null;
          if (vimeoVideo.pictures?.sizes && !vimeoVideo.pictures.base_link?.includes('default')) {
            const thumbnail640 = vimeoVideo.pictures.sizes.find(
              (s: Record<string, unknown>) => s.width === 640
            );
            thumbnailUrl =
              thumbnail640?.link ||
              vimeoVideo.pictures.sizes[vimeoVideo.pictures.sizes.length - 1]?.link;
          }

          videoData = {
            ...data,
            vimeo_url: vimeoVideo.link || `https://vimeo.com/${data.vimeo_id}`,
            thumbnail_url: thumbnailUrl,
            duration: vimeoVideo.duration > 0 ? vimeoVideo.duration : null,
            status: vimeoVideo.status || 'available',
          };
        } catch (vimeoError) {
          console.warn('[Vimeo] Failed to fetch video details from Vimeo API:', vimeoError);
        }
      }

      const manager = (this as any).__container__.manager;

      const { generateEntityId } = await import('@medusajs/framework/utils');
      const videoId = generateEntityId();

      try {
        const knex = manager.getKnex();
        const result = await knex('vimeo_video')
          .insert({
            id: videoId,
            vimeo_id: videoData.vimeo_id,
            vimeo_uri: videoData.vimeo_uri,
            title: videoData.title,
            description: videoData.description || '',
            duration: videoData.duration || null,
            thumbnail_url: videoData.thumbnail_url || null,
            vimeo_url: videoData.vimeo_url || null,
            status: videoData.status || 'available',
            is_active: videoData.is_active ?? true,
            sort_order: videoData.sort_order || 0,
            // jsonb: node-postgres manda los arrays JS como arrays de Postgres,
            // así que serializamos a JSON string (null = SQL null).
            sales_channel_ids:
              videoData.sales_channel_ids != null
                ? JSON.stringify(videoData.sales_channel_ids)
                : null,
            created_at: knex.fn.now(),
            updated_at: knex.fn.now(),
          })
          .returning('*');

        return (
          result[0] || {
            id: videoId,
            ...videoData,
          }
        );
      } catch (sqlError) {
        console.error('[Vimeo] Raw SQL insert failed:', sqlError);
        throw sqlError;
      }
    } catch (error) {
      console.error('[Vimeo] Error creating video:', error);
      throw error;
    }
  }

  async syncVideoFromVimeo(id: string) {
    try {
      const manager = (this as any).__container__.manager;
      const knex = manager.getKnex();

      const [video] = await knex('vimeo_video').where({ id }).select('*');

      if (!video) {
        throw new Error('Video not found');
      }

      const vimeoVideo = await this.getVimeoVideo(video.vimeo_id);

      let thumbnailUrl = video.thumbnail_url;
      if (vimeoVideo.pictures?.sizes && !vimeoVideo.pictures.base_link?.includes('default')) {
        const thumbnail640 = vimeoVideo.pictures.sizes.find(
          (s: Record<string, unknown>) => s.width === 640
        );
        thumbnailUrl =
          thumbnail640?.link ||
          vimeoVideo.pictures.sizes[vimeoVideo.pictures.sizes.length - 1]?.link;
      }

      const updateData = {
        vimeo_url: vimeoVideo.link || video.vimeo_url,
        thumbnail_url: thumbnailUrl,
        duration: vimeoVideo.duration > 0 ? vimeoVideo.duration : video.duration,
        status: vimeoVideo.status || video.status,
        updated_at: knex.fn.now(),
      };

      await knex('vimeo_video').where({ id }).update(updateData);

      const [updatedVideo] = await knex('vimeo_video').where({ id }).select('*');
      return updatedVideo;
    } catch (error) {
      console.error('[Vimeo] Error syncing video:', error);
      throw error;
    }
  }

  async updateVideo(id: string, data: any) {
    try {
      const manager = (this as any).__container__.manager;
      const knex = manager.getKnex();

      const updateData: any = {
        updated_at: knex.fn.now(),
      };

      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.is_active !== undefined) updateData.is_active = data.is_active;
      if (data.sort_order !== undefined) updateData.sort_order = data.sort_order;
      if (data.sales_channel_ids !== undefined) {
        // jsonb: serializar el array (o SQL null cuando es null/[]).
        updateData.sales_channel_ids =
          data.sales_channel_ids == null ? null : JSON.stringify(data.sales_channel_ids);
      }

      await knex('vimeo_video').where({ id }).update(updateData);

      const [updatedVideo] = await knex('vimeo_video').where({ id }).select('*');
      return updatedVideo;
    } catch (error) {
      console.error('[Vimeo] Error updating video:', error);
      throw error;
    }
  }

  async deleteVideo(id: string) {
    try {
      const manager = (this as any).__container__.manager;
      const knex = manager.getKnex();

      await knex('product_video_link').where({ vimeo_video_id: id }).delete();
      const result = await knex('vimeo_video').where({ id }).delete();
      return result;
    } catch (error) {
      console.error('[Vimeo] Error deleting video:', error);
      throw error;
    }
  }

  async initiateUpload(title: string, description?: string, fileSize?: number): Promise<any> {
    const token = await this.getAccessToken();

    if (!token) {
      throw new Error('Not connected to Vimeo');
    }

    const body: any = {
      name: title,
      upload: {
        approach: 'tus',
        size: fileSize?.toString(),
      },
    };

    if (description) {
      body.description = description;
    }

    if (this.options.folderUri) {
      body.folder_uri = this.options.folderUri;
    }

    const response = await fetch(`${this.VIMEO_API_BASE}/me/videos`, {
      method: 'POST',
      headers: {
        Authorization: `bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.vimeo.*+json;version=3.4',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to initiate upload: ${error}`);
    }

    return response.json();
  }

  async disconnect(): Promise<void> {
    const tokens = await this.listVimeoTokens();
    await Promise.all(tokens.map((token) => this.deleteVimeoTokens(token.id)));
  }
}
