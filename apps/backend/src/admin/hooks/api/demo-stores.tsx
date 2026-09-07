import { FetchError } from '@medusajs/js-sdk';
import {
  QueryKey,
  useMutation,
  UseMutationOptions,
  useQuery,
  useQueryClient,
  UseQueryOptions,
} from '@tanstack/react-query';
import { sdk } from '../../lib/client';
import { queryKeysFactory } from '../../lib/query-key-factory';
import { toQueryString } from '../../lib/query-string';

export type DemoStoreStatus = 'draft' | 'provisioning' | 'importing' | 'ready' | 'failed';
/**
 * `sales_channel` no es una plataforma externa: el catálogo ya está en esta
 * instancia y los productos se vinculan al canal de la demo en vez de importarse.
 * Con ese origen, `source_url` guarda el ID del canal de origen.
 */
export type DemoSourceType = 'woocommerce' | 'vtex' | 'shopify' | 'sales_channel';
export type ImportJobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface DemoStoreTheme {
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  /** Fondo del header/footer. Ausente = default del template. */
  header_background?: string;
  footer_background?: string;
  logo?: string;
  logo_negative?: string;
  icon?: string;
  icon_negative?: string;
  /** @deprecated Compat: fallback de `icon`. */
  mobile_logo?: string;
  favicon?: string;
  favicon_negative?: string;
  typography?: string;
}

export interface DemoContentConfig {
  /** Section visibility toggles (nav + home). Absent/true = shown. */
  sections?: {
    blog?: boolean;
    contact?: boolean;
    shoppingList?: boolean;
    sucursales?: boolean;
    /** "Cuentas corporativas" (/corporate/register) link in the footer. */
    corporate?: boolean;
    /** Menú "Categorías" del nav de escritorio (antes de "Tienda"). */
    categories?: boolean;
    /** Etiquetas de formato/color en las cards del catálogo. */
    variantLabels?: boolean;
  };
  /** Override for the blog section name (nav label + blog page title). */
  blogSectionName?: string;
  /**
   * Variante visual del menú "Categorías": 'hamburger' (default, ícono de
   * hamburguesa + submenú lateral) o 'button' (pill sólido + acordeón).
   */
  categoriesMenuLayout?: 'hamburger' | 'button';
  /**
   * Descripción de la tienda → `metadata.description` (meta description + social
   * card). NO la edita la ficha: está tipada acá para que `formToContentConfig`
   * pueda ARRASTRARLA, porque reconstruir el objeto desde los campos del
   * formulario la borraba en silencio.
   */
  description?: string;
  /** Contact data shown on the contact page + footer (address/phone/email). */
  contact?: {
    address?: string;
    phone?: string;
    email?: string;
    /** Horario de atención. Lo edita la ficha de la tienda, junto al resto del contacto. */
    hours?: string;
  };
  /**
   * Copy de la sección "Atención al cliente" de `/contact`: título, párrafo y el
   * cartel al pie. Clave HERMANA de `contact` a propósito — la pantalla del
   * footer reconstruye `contact` entero y un `contact.title` habría muerto en el
   * primer guardado del footer, sin error.
   *
   * `description` acá es el párrafo de la tarjeta. Son TRES textos distintos con
   * ese nombre en este objeto: el de SEO (arriba), el del footer (abajo) y este.
   */
  contactPage?: {
    title?: string;
    description?: string;
    note?: string;
  };
  /**
   * Textos del footer. Ausente = el copy del template / `defaultConfig` del
   * storefront. La ficha sólo modela `description`; el resto lo edita
   * "Personalizar footer" y está tipado acá para poder arrastrarlo.
   */
  footer?: {
    /** El párrafo bajo el logo. NO es `description` (esa es la de SEO). */
    description?: string;
    social?: { name: string; href: string; icon?: string }[];
    legal?: { name: string; href: string }[];
    newsletter?: {
      title?: string;
      placeholder?: string;
      buttonText?: string;
    };
    copyright?: string;
  };
  /**
   * Página de sucursales. Subtítulo ausente = default del storefront; cadena
   * vacía = no se muestra. La visibilidad del link sigue en `sections`.
   */
  sucursales?: {
    subtitle?: string;
    showLocationFilters?: boolean;
    showCategoryFilters?: boolean;
    layout?: 'full' | 'compact';
  };
  /** Editable copy for the shopping-list page. */
  shoppingList?: {
    title?: string;
    subtitle?: string;
    quickTerms?: string[];
  };
  /** "Explorar:" quick suggestions in the header search (grocery only). */
  searchSuggestions?: { label: string; query: string }[];
  /** Rotating placeholder hints in the header/mobile search bars. */
  searchHints?: string[];
  /**
   * Diseño de la sección "Nuestras marcas" del home: 'carousel' (default, fila
   * con flechas), 'marquee' (marquesina infinita) o 'dots' (paginado con puntos).
   */
  brandsLayout?: 'carousel' | 'marquee' | 'dots';
  /**
   * Which MercadoPago checkout(s) the demo offers at the payment step:
   * 'express' (default, redirect), 'api' (embedded Payment Brick), or 'both'.
   */
  mercadopagoCheckoutMode?: 'api' | 'express' | 'both';
}

export interface ImportJob {
  id: string;
  status: ImportJobStatus;
  target_count?: number | null;
  total_products: number;
  fetched_products: number;
  imported_products: number;
  linked_products: number;
  skipped_products: number;
  failed_products: number;
  duration_ms: number;
  error_log?: { samples?: string[] } | null;
  run_log?: {
    events?: Array<{
      at: string;
      stage: string;
      level: 'info' | 'warn' | 'error';
      message: string;
      data?: Record<string, unknown>;
    }>;
  } | null;
  started_at?: string | null;
  finished_at?: string | null;
  created_at: string;
}

export interface DemoStore {
  id: string;
  name: string;
  slug: string;
  /**
   * La tienda PRINCIPAL: la que se sirve en el host raíz. Es una fila real como
   * cualquier otra, pero no se puede eliminar, ni reintentar, ni importarle
   * catálogo, ni cambiarle la plantilla. El backend la ordena primera.
   */
  is_main?: boolean | null;
  /** Forma canónica para SEO: 'host' (subdominio) | 'path' (ruta). */
  canonical_form?: 'host' | 'path' | null;
  template_code: string;
  country_code: string;
  currency_code: string;
  locale: string;
  source_type: DemoSourceType;
  source_url: string;
  target_count?: number | null;
  status: DemoStoreStatus;
  theme?: DemoStoreTheme | null;
  content_config?: DemoContentConfig | null;
  /** Puck document ({ content, root }) for the demo home, if customized. */
  home_puck_data?: Record<string, any> | null;
  sales_channel_id?: string | null;
  region_id?: string | null;
  stock_location_id?: string | null;
  /** B2B / Mayorista: enabled flag + provisioned resource ids + test credentials. */
  b2b_enabled?: boolean | null;
  b2b_sales_channel_id?: string | null;
  b2b_customer_group_id?: string | null;
  b2b_price_list_id?: string | null;
  b2b_company_id?: string | null;
  b2b_test_email?: string | null;
  b2b_test_password?: string | null;
  /** Compras recurrentes: expone Suscribirse + la API store para el demo. */
  recurring_enabled?: boolean | null;
  /** Tintometría: expone la página "Buscá tu color" (color → bases) del demo. */
  tinting_enabled?: boolean | null;
  latest_import_job?: ImportJob | null;
  product_count?: number;
  created_at: string;
  updated_at: string;
}

export interface DemoTemplate {
  code: string;
  name: string;
  preview_image: string;
}

export interface AdminDemoStoresResponse {
  demo_stores: DemoStore[];
  count: number;
  offset: number;
  limit: number;
}

export interface AdminDemoStoreResponse {
  demo_store: DemoStore;
  import_jobs: ImportJob[];
  latest_import_job: ImportJob | null;
}

export interface AdminCreateDemoStore {
  canonical_form?: 'host' | 'path';
  name: string;
  slug: string;
  template_code?: string;
  country_code: string;
  currency_code: string;
  locale?: string;
  source_type: DemoSourceType;
  source_url: string;
  source_config?: Record<string, unknown> | null;
  theme?: DemoStoreTheme;
  content_config?: DemoContentConfig | null;
  target_count?: number;
  /** Provision a dedicated wholesale (B2B) setup for the demo. */
  b2b_enabled?: boolean;
  /** Enable recurring purchases (compras recurrentes) for the demo. */
  recurring_enabled?: boolean;
  /** Enable the color-first tinting page for the demo. */
  tinting_enabled?: boolean;
  /**
   * Reusar un stock location existente en vez de crear uno nuevo. Ausente =
   * comportamiento default (crea `Depósito Demo <nombre>`). Presente = validar
   * que exista y linkearlo al SC de la demo.
   */
  reuse_stock_location_id?: string;
}

export interface AdminUpdateDemoStore {
  canonical_form?: 'host' | 'path';
  name?: string;
  template_code?: string;
  theme?: DemoStoreTheme;
  content_config?: DemoContentConfig | null;
  home_puck_data?: Record<string, any> | null;
  /** Enable B2B on an existing demo (provisioned inline on the transition to true). */
  b2b_enabled?: boolean;
  /** Toggle recurring purchases (pure feature flag, no provisioning). */
  recurring_enabled?: boolean;
  /** Toggle the color-first tinting page (pure feature flag, no provisioning). */
  tinting_enabled?: boolean;
  /**
   * Reasignar el stock location de la demo (incluso la principal). Presente string
   * = ID del stock location a linkear. `null` explícito = desasignar (detach).
   * Ausente = no se toca. Dispara el workflow `updateDemoStoreStockLocation` en
   * el backend, que re-linkea el SC.
   */
  stock_location_id?: string | null;
  /**
   * Reasignar la region de la demo. Misma semántica que stock_location_id. En
   * Medusa un país sólo puede pertenecer a UNA region — cambiar la region de la
   * demo puede rechazarse si hay conflicto (el workflow devuelve un error tipado).
   */
  region_id?: string | null;
}

export const demoStoreQueryKey = queryKeysFactory('demo-store');

export const useDemoStores = (
  query?: Record<string, any>,
  options?: UseQueryOptions<AdminDemoStoresResponse, FetchError, AdminDemoStoresResponse, QueryKey>,
) => {
  const filterQuery = toQueryString(query);
  return useQuery({
    queryKey: demoStoreQueryKey.list(query),
    queryFn: async () =>
      sdk.client.fetch<AdminDemoStoresResponse>(
        `/admin/sites${filterQuery ? `?${filterQuery}` : ''}`,
        { method: 'GET' },
      ),
    ...options,
  });
};

export const useDemoStore = (
  id: string,
  options?: UseQueryOptions<AdminDemoStoreResponse, FetchError, AdminDemoStoreResponse, QueryKey>,
) => {
  return useQuery({
    queryKey: demoStoreQueryKey.detail(id),
    queryFn: async () =>
      sdk.client.fetch<AdminDemoStoreResponse>(`/admin/sites/${id}`, { method: 'GET' }),
    enabled: !!id,
    ...options,
  });
};

/**
 * Sales channels disponibles como ORIGEN de catálogo (selector del paso de
 * origen cuando `source_type === 'sales_channel'`).
 */
export const useSourceSalesChannels = () =>
  useQuery({
    queryKey: ['demo-store', 'source-sales-channels'],
    queryFn: async () =>
      sdk.client.fetch<{ sales_channels: { id: string; name: string }[] }>(
        '/admin/sales-channels?limit=200&fields=id,name',
        { method: 'GET' },
      ),
  });

/** Stock locations nativos para crear o reasignar un site sin depender del ERP opcional. */
export const useDemoStoreStockLocationOptions = () =>
  useQuery({
    queryKey: ['demo-store', 'stock-locations'],
    queryFn: async () =>
      sdk.client.fetch<{ stock_locations: { id: string; name: string }[] }>(
        '/admin/stock-locations?limit=100&fields=id,name',
        { method: 'GET' },
      ),
  });

/**
 * Regions disponibles para asignar/reasignar en el edit de un site. Cheap
 * admin lookup — `fields=id,name,currency_code` es lo mínimo que el Select
 * necesita para pintar el label.
 */
export const useAdminRegions = () =>
  useQuery({
    queryKey: ['demo-store', 'admin-regions'],
    queryFn: async () =>
      sdk.client.fetch<{
        regions: { id: string; name: string; currency_code: string }[];
      }>('/admin/regions?limit=100&fields=id,name,currency_code', { method: 'GET' }),
  });

/**
 * Resolve the human names behind a demo's operational IDs (sales channel,
 * region, stock location) so the detail view can show "Depósito Central"
 * instead of "sloc_01…". Each is a cheap admin lookup, disabled until its id
 * is known; the detail page falls back to the raw id if the name can't load.
 */
export const useSalesChannelName = (id?: string | null) =>
  useQuery({
    queryKey: ['demo-store', 'sales-channel-name', id],
    queryFn: async () =>
      sdk.client.fetch<{ sales_channel: { id: string; name: string } }>(
        `/admin/sales-channels/${id}`,
        { method: 'GET' },
      ),
    enabled: !!id,
  });

export const useRegionName = (id?: string | null) =>
  useQuery({
    queryKey: ['demo-store', 'region-name', id],
    queryFn: async () =>
      sdk.client.fetch<{ region: { id: string; name: string } }>(`/admin/regions/${id}`, {
        method: 'GET',
      }),
    enabled: !!id,
  });

export const useStockLocationName = (id?: string | null) =>
  useQuery({
    queryKey: ['demo-store', 'stock-location-name', id],
    queryFn: async () =>
      sdk.client.fetch<{ stock_location: { id: string; name: string } }>(
        `/admin/stock-locations/${id}`,
        { method: 'GET' },
      ),
    enabled: !!id,
  });

export const useDemoTemplates = (
  options?: UseQueryOptions<{ demo_templates: DemoTemplate[] }, FetchError, { demo_templates: DemoTemplate[] }, QueryKey>,
) => {
  return useQuery({
    queryKey: ['demo-template', 'list'],
    queryFn: async () =>
      sdk.client.fetch<{ demo_templates: DemoTemplate[] }>('/admin/site-templates', { method: 'GET' }),
    ...options,
  });
};

/** Polls the latest import job; pass refetchInterval while status is running. */
export const useDemoStoreImportJob = (
  id: string,
  options?: UseQueryOptions<{ import_job: ImportJob | null }, FetchError, { import_job: ImportJob | null }, QueryKey>,
) => {
  return useQuery({
    queryKey: [...demoStoreQueryKey.detail(id), 'import-job'],
    queryFn: async () =>
      sdk.client.fetch<{ import_job: ImportJob | null }>(`/admin/sites/${id}/import-job`, {
        method: 'GET',
      }),
    enabled: !!id,
    ...options,
  });
};

export const useCreateDemoStore = (
  options?: UseMutationOptions<AdminDemoStoreResponse, FetchError, AdminCreateDemoStore>,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AdminCreateDemoStore) =>
      sdk.client.fetch<AdminDemoStoreResponse>('/admin/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      }),
    onSuccess: (data: any, variables: any, context: any) => {
      queryClient.invalidateQueries({ queryKey: demoStoreQueryKey.lists() });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
};

export const useUpdateDemoStore = (
  id: string,
  options?: UseMutationOptions<{ demo_store: DemoStore }, FetchError, AdminUpdateDemoStore>,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AdminUpdateDemoStore) =>
      sdk.client.fetch<{ demo_store: DemoStore }>(`/admin/sites/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      }),
    onSuccess: (data: any, variables: any, context: any) => {
      queryClient.invalidateQueries({ queryKey: demoStoreQueryKey.lists() });
      queryClient.invalidateQueries({ queryKey: demoStoreQueryKey.detail(id) });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
};

export const useDeleteDemoStore = (
  id: string,
  options?: UseMutationOptions<{ deleted: boolean }, FetchError, void>,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      sdk.client.fetch<{ deleted: boolean }>(`/admin/sites/${id}`, { method: 'DELETE' }),
    onSuccess: (data: any, variables: any, context: any) => {
      queryClient.invalidateQueries({ queryKey: demoStoreQueryKey.lists() });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
};

/** Generate random demo promotions over the demo's catalog (sales channel). */
export const useCreateDemoStorePromotions = (
  id: string,
  options?: UseMutationOptions<
    { totalProducts: number; promotedProducts: number; promotions: number },
    FetchError,
    void
  >,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      sdk.client.fetch<{ totalProducts: number; promotedProducts: number; promotions: number }>(
        `/admin/sites/${id}/promotions`,
        { method: 'POST' },
      ),
    onSuccess: (data: any, variables: any, context: any) => {
      queryClient.invalidateQueries({ queryKey: demoStoreQueryKey.detail(id) });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
};

/** Re-provision (if needed) and re-run the catalog import for a demo. */
export const useRetryDemoStoreImport = (
  id: string,
  options?: UseMutationOptions<AdminDemoStoreResponse, FetchError, void>,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      sdk.client.fetch<AdminDemoStoreResponse>(`/admin/sites/${id}/retry`, {
        method: 'POST',
      }),
    onSuccess: (data: any, variables: any, context: any) => {
      queryClient.invalidateQueries({ queryKey: demoStoreQueryKey.lists() });
      queryClient.invalidateQueries({ queryKey: demoStoreQueryKey.detail(id) });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
};
