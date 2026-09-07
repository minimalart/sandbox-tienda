export type VideoStatus =
  | "uploading"
  | "transcoding"
  | "processing"
  | "available"
  | "error"
  | "quota_exceeded"
  | "total_cap_exceeded"
  | "transcode_starting"
  | "unavailable";

export interface VideoProduct {
  id: string;
  title: string;
  handle: string;
  description: string | null;
  thumbnail: string | null;
}

export interface ProductVideoLink {
  id: string;
  product_id: string;
  vimeo_video_id: string;
  created_at: string;
}

export interface Video {
  id: string;
  vimeo_id: string;
  vimeo_uri: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  poster_url: string | null;
  vimeo_url: string | null;
  duration: number | null;
  status: VideoStatus;
  is_active: boolean;
  show_in_carousel: boolean;
  sort_order: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  products?: VideoProduct[];
  product_links?: ProductVideoLink[];
}

export interface VideosResponse {
  videos: Video[];
}
