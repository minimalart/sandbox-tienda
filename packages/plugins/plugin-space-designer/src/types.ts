/** Space Designer v1. Room and object coordinates use metres; x/z are centres. */
export type SpaceAsset = {
  kind: 'image' | 'primitive' | 'glb';
  url?: string;
  shape?: 'box' | 'cylinder';
  color?: string;
  model?:
    | 'table'
    | 'desk'
    | 'hex-table-set'
    | 'shelving'
    | 'cabinet'
    | 'chair'
    | 'computer'
    | 'projector'
    | 'robotics-kit';
  accent_color?: string;
  mount?: 'floor' | 'surface' | 'wall' | 'ceiling';
  /** A scene product reference used to distribute included equipment visually. */
  anchor_product_ref?: string;
};
export type SpaceProduct = {
  id: string;
  product_id: string;
  variant_id: string;
  placement: 'scene' | 'included';
  category: string;
  label?: string;
  dimensions?: { width: number; depth: number; height: number };
  asset?: SpaceAsset;
  allowed_rotations?: number[];
};
export type SpaceRoom = {
  width: number;
  depth: number;
  height: number;
  shape: 'rectangle';
  floor_color: string;
  wall_color: string;
  background_url?: string;
  floor_texture_url?: string;
  wall_texture_url?: string;
};
export type SpaceObject = {
  id: string;
  product_ref: string;
  x: number;
  z: number;
  rotation: number;
  locked?: boolean;
  scale?: number;
};
export type SpaceIncludedItem = { product_ref: string; quantity: number };
export type SpaceSnapshot = {
  version: 1;
  room: SpaceRoom;
  objects: SpaceObject[];
  included_items: SpaceIncludedItem[];
};
export type SpaceTemplate = Omit<SpaceSnapshot, 'version'> & {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  sort_order?: number;
};
export type SpaceConfigV1 = {
  version: 1;
  description?: string;
  products: SpaceProduct[];
  templates: SpaceTemplate[];
  allow_custom: boolean;
  surface_options?: {
    floors?: { label: string; color: string; texture_url?: string }[];
    walls?: { label: string; color: string; texture_url?: string }[];
  };
};
export type SpaceConfigurator = {
  id: string;
  slug: string;
  title: string;
  status: 'draft' | 'published';
  sales_channel_id: string | null;
  config: SpaceConfigV1;
  created_at?: string;
  updated_at?: string;
};
export type SpaceConfiguratorInput = Omit<SpaceConfigurator, 'id' | 'created_at' | 'updated_at'>;
export type SpaceCatalogProduct = {
  id: string;
  title: string;
  handle: string | null;
  thumbnail: string | null;
  variants: {
    id: string;
    title: string;
    sku: string | null;
    calculated_amount: number | null;
    currency_code: string | null;
    available: boolean;
  }[];
};
export type SpacePublicConfigurator = SpaceConfigurator & { catalog: SpaceCatalogProduct[] };
export type SpaceDesign = {
  id: string;
  configurator_id: string;
  customer_id: string;
  sales_channel_id: string | null;
  name: string;
  template_id: string | null;
  snapshot: SpaceSnapshot;
  configuration_snapshot: SpaceConfigV1;
  created_at?: string;
  updated_at?: string;
};
