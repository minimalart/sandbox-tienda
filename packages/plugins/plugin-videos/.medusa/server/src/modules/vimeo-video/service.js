"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mercatto_plugin_runtime_1 = require("@minimalart/mercatto-plugin-runtime");
const utils_1 = require("@medusajs/framework/utils");
const models_1 = require("./models");
class VimeoVideoModuleService extends (0, utils_1.MedusaService)({
    VimeoVideo: models_1.VimeoVideo,
    ProductVideoLink: models_1.ProductVideoLink,
    VimeoToken: models_1.VimeoToken,
}) {
    bootOptions;
    get options() {
        const reader = (0, mercatto_plugin_runtime_1.getAppSettingsSyncReader)();
        const read = (key, fallback) => {
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
    VIMEO_API_BASE = 'https://api.vimeo.com';
    vimeoVideoRepository_;
    constructor(container, options = {}) {
        super(...arguments);
        this.bootOptions = options;
        this.vimeoVideoRepository_ = container.vimeoVideoRepository;
    }
    // ─── OAuth ────────────────────────────────────────────────────────────────
    async getAuthorizationUrl(state) {
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
    async exchangeCodeForTokens(code) {
        if (!this.options.clientId || !this.options.clientSecret) {
            throw new Error('Vimeo OAuth credentials are not configured');
        }
        const response = await fetch(`${this.VIMEO_API_BASE}/oauth/access_token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `basic ${Buffer.from(`${this.options.clientId}:${this.options.clientSecret}`).toString('base64')}`,
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
    async storeTokens(tokens) {
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
        }
        else {
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
    async getAccessToken() {
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
    async refreshAccessToken(refreshToken) {
        if (!this.options.clientId || !this.options.clientSecret) {
            throw new Error('Vimeo OAuth credentials are not configured');
        }
        const response = await fetch(`${this.VIMEO_API_BASE}/oauth/access_token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `basic ${Buffer.from(`${this.options.clientId}:${this.options.clientSecret}`).toString('base64')}`,
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
    async isConnected() {
        const token = await this.getAccessToken();
        return !!token;
    }
    async getConnectionStatus() {
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
        }
        catch (error) {
            console.error('[Vimeo] Failed to fetch user:', error);
            return {
                connected: false,
                error: error?.message || 'Failed to connect to Vimeo',
            };
        }
    }
    async getVimeoUser(token) {
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
    async searchVimeoVideos(query, page = 1, perPage = 25) {
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
    async getVimeoVideo(vimeoId) {
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
    async listVideos(filters = {}, config = {}) {
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
        }
        catch (error) {
            console.error('[Vimeo] Error listing videos:', error);
            return [];
        }
    }
    async createVideo(data) {
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
                        const thumbnail640 = vimeoVideo.pictures.sizes.find((s) => s.width === 640);
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
                }
                catch (vimeoError) {
                    console.warn('[Vimeo] Failed to fetch video details from Vimeo API:', vimeoError);
                }
            }
            const manager = this.__container__.manager;
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
                    sales_channel_ids: videoData.sales_channel_ids != null
                        ? JSON.stringify(videoData.sales_channel_ids)
                        : null,
                    created_at: knex.fn.now(),
                    updated_at: knex.fn.now(),
                })
                    .returning('*');
                return (result[0] || {
                    id: videoId,
                    ...videoData,
                });
            }
            catch (sqlError) {
                console.error('[Vimeo] Raw SQL insert failed:', sqlError);
                throw sqlError;
            }
        }
        catch (error) {
            console.error('[Vimeo] Error creating video:', error);
            throw error;
        }
    }
    async syncVideoFromVimeo(id) {
        try {
            const manager = this.__container__.manager;
            const knex = manager.getKnex();
            const [video] = await knex('vimeo_video').where({ id }).select('*');
            if (!video) {
                throw new Error('Video not found');
            }
            const vimeoVideo = await this.getVimeoVideo(video.vimeo_id);
            let thumbnailUrl = video.thumbnail_url;
            if (vimeoVideo.pictures?.sizes && !vimeoVideo.pictures.base_link?.includes('default')) {
                const thumbnail640 = vimeoVideo.pictures.sizes.find((s) => s.width === 640);
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
        }
        catch (error) {
            console.error('[Vimeo] Error syncing video:', error);
            throw error;
        }
    }
    async updateVideo(id, data) {
        try {
            const manager = this.__container__.manager;
            const knex = manager.getKnex();
            const updateData = {
                updated_at: knex.fn.now(),
            };
            if (data.title !== undefined)
                updateData.title = data.title;
            if (data.description !== undefined)
                updateData.description = data.description;
            if (data.is_active !== undefined)
                updateData.is_active = data.is_active;
            if (data.sort_order !== undefined)
                updateData.sort_order = data.sort_order;
            if (data.sales_channel_ids !== undefined) {
                // jsonb: serializar el array (o SQL null cuando es null/[]).
                updateData.sales_channel_ids =
                    data.sales_channel_ids == null ? null : JSON.stringify(data.sales_channel_ids);
            }
            await knex('vimeo_video').where({ id }).update(updateData);
            const [updatedVideo] = await knex('vimeo_video').where({ id }).select('*');
            return updatedVideo;
        }
        catch (error) {
            console.error('[Vimeo] Error updating video:', error);
            throw error;
        }
    }
    async deleteVideo(id) {
        try {
            const manager = this.__container__.manager;
            const knex = manager.getKnex();
            await knex('product_video_link').where({ vimeo_video_id: id }).delete();
            const result = await knex('vimeo_video').where({ id }).delete();
            return result;
        }
        catch (error) {
            console.error('[Vimeo] Error deleting video:', error);
            throw error;
        }
    }
    async initiateUpload(title, description, fileSize) {
        const token = await this.getAccessToken();
        if (!token) {
            throw new Error('Not connected to Vimeo');
        }
        const body = {
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
    async disconnect() {
        const tokens = await this.listVimeoTokens();
        await Promise.all(tokens.map((token) => this.deleteVimeoTokens(token.id)));
    }
}
exports.default = VimeoVideoModuleService;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL3ZpbWVvLXZpZGVvL3NlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxpRkFBK0U7QUFDL0UscURBQTBEO0FBQzFELHFDQUFvRTtBQVVwRSxNQUFxQix1QkFBd0IsU0FBUSxJQUFBLHFCQUFhLEVBQUM7SUFDakUsVUFBVSxFQUFWLG1CQUFVO0lBQ1YsZ0JBQWdCLEVBQWhCLHlCQUFnQjtJQUNoQixVQUFVLEVBQVYsbUJBQVU7Q0FDWCxDQUFDO0lBQ1EsV0FBVyxDQUFxQjtJQUN4QyxJQUFZLE9BQU87UUFDakIsTUFBTSxNQUFNLEdBQUcsSUFBQSxrREFBd0IsR0FBRSxDQUFDO1FBQzFDLE1BQU0sSUFBSSxHQUFHLENBQUMsR0FBVyxFQUFFLFFBQWlCLEVBQUUsRUFBRTtZQUM5QyxNQUFNLEtBQUssR0FBRyxNQUFNLEVBQUUsQ0FBQyxrQkFBa0IsRUFBRSxHQUFHLENBQUMsQ0FBQztZQUNoRCxPQUFPLE9BQU8sS0FBSyxLQUFLLFFBQVEsSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxRQUFRLENBQUM7UUFDbkYsQ0FBQyxDQUFDO1FBQ0YsT0FBTztZQUNMLFFBQVEsRUFBRSxJQUFJLENBQUMsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUM7WUFDNUQsWUFBWSxFQUFFLElBQUksQ0FBQyxxQkFBcUIsRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLFlBQVksQ0FBQztZQUN4RSxXQUFXLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxXQUFXO1lBQ3pDLFdBQVcsRUFBRSxJQUFJLENBQUMsb0JBQW9CLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxXQUFXLENBQUM7WUFDckUsU0FBUyxFQUFFLElBQUksQ0FB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