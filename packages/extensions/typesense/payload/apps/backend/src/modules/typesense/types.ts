import type { CollectionSchema } from 'typesense/lib/Typesense/Collection';
import type { SearchResponse } from 'typesense/lib/Typesense/Documents';
import type { Control } from 'react-hook-form';

type UseFormRegister<T> = (name: keyof T, options?: unknown) => unknown;
type FieldValues = Record<string, any>;

export type OpaqueObject = { [key: string]: any };
export interface SynonymData {
  root?: string;
  synonyms: string[];
  locale?: string;
}
export interface Product {
  id: string;
  title: string;
  description: string;
  image: string | null;
}
export interface ActionsSectionProps {
  formHook: unknown; // CurationFormHook imported from hook file to avoid circular dependency
}
export interface CurationsHeaderProps {
  onNewCuration: () => void;
}
export interface CurationFormProps {
  editingId: string | null;
  formHook: unknown; // CurationFormHook imported from hook file to avoid circular dependency
}
export interface CurationFormModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  editingId: string | null;
  loading: boolean;
  formHook: unknown; // CurationFormHook imported from hook file to avoid circular dependency
}
export interface Override {
  id: string;
  rule: {
    query?: string;
    filter_by?: string;
    tags?: string[];
    match?: string;
  };
  includes?: { id: string; position?: number }[];
  excludes?: { id: string }[];
  filter_by?: string;
  sort_by?: string;
  replace_query?: string;
  remove_matched_tokens?: boolean;
  filter_curated_hits?: boolean;
  stop_processing?: boolean;
  actions?: {
    filter_by?: string;
    remove_matched_tokens?: boolean;
    apply_filters_to_curated_items?: boolean;
    metadata?: Record<string, unknown>;
    stop_processing?: boolean;
    pin_documents?: string;
    pin_documents_query_by?: string;
    pin_documents_additional_fields?: string;
    pin_documents_image_field?: string;
    pin_documents_columns?: string;
  };
  effective_from_ts?: number;
  effective_to_ts?: number;
}

export interface OptionsSectionProps {
  useEffectiveFrom: boolean;
  setUseEffectiveFrom: (value: boolean) => void;
  useEffectiveTo: boolean;
  setUseEffectiveTo: (value: boolean) => void;
  register: UseFormRegister<FieldValues>;
  /** react-hook-form control, para integrar el <DatePicker> controlado de Medusa. */
  control: Control<FieldValues>;
}

export interface ProductSelectorProps {
  selectedProducts: Product[];
  onProductsChange: (products: Product[]) => void;
}
export interface RulesSectionProps {
  useQueryRule: boolean;
  setUseQueryRule: (value: boolean) => void;
  useFilterRule: boolean;
  setUseFilterRule: (value: boolean) => void;
  useTagsRule: boolean;
  setUseTagsRule: (value: boolean) => void;
  register: UseFormRegister<FieldValues>;
}

// Note: CurationFormHook interface is now defined in the useCurationForm hook file
// to avoid circular dependencies and maintain better type organization

export interface StopWordList {
  id: string;
  stopwords: string[];
  locale: string;
}

export interface Synonym {
  id: string;
  root?: string;
  synonyms: string[];
  locale?: string;
}

export interface SynonymFormModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: SynonymFormData) => void;
  editingData?: Synonym | null;
  loading?: boolean;
  title: string;
  subtitle?: string;
  submitText: string;
}
export interface SynonymFormData {
  id: string;
  root: string;
  synonyms: string;
  locale?: string;
}

export interface SynonymsResponse {
  success: boolean;
  data?: Synonym[];
  message: string;
}

export interface SynonymResponse {
  success: boolean;
  data?: Synonym;
  message: string;
}

// StopWord data model - actual data structure
export interface StopWord {
  id: string;
  stopwords: string[];
  locale: string;
}

// StopWordFormData - for form handling only
export interface StopWordFormData {
  id?: string;
  stopwords: string;
  locale: string;
}

export interface StopWordFormModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSubmit: (formData: StopWordFormData) => void;
  editingData?: StopWord | null;
  loading?: boolean;
  title: string;
  submitText: string;
  subtitle?: string;
}

// API Response types
export interface StopWordsResponse {
  success: boolean;
  data?: StopWord[];
  message: string;
}

export interface StopWordResponse {
  success: boolean;
  data?: StopWord;
  message: string;
}

export interface DefaultCollectionResponse {
  success: boolean;
  message?: string;
  data?: { collectionName: string; collectionInfo: CollectionSchema };
}

export interface CollectionInfoResponse {
  success: boolean;
  message?: string;
  data?: CollectionSchema;
}

export interface CustomSearchResponse {
  success: boolean;
  message?: string;
  data?: SearchResponse<object>;
}

// Curations API Response types
export interface CurationsResponse {
  success: boolean;
  data?: Override[];
  message: string;
}

export interface CurationResponse {
  success: boolean;
  data?: Override;
  message: string;
}

// Curation Form Data Types
export type OverrideRuleMatch = 'exact' | 'contains';

export interface CurationFormData {
  id: string;
  query: string;
  filter_by: string;
  tags: string;
  includes: string[];
  excludes: string[];
  filter_documents: string;
  sort_by: string;
  replace_query: string;
  custom_metadata: string;
  effective_from: string;
  effective_to: string;
  match: OverrideRuleMatch;
}

export interface CurationFormState {
  useQueryRule: boolean;
  useFilterRule: boolean;
  useTagsRule: boolean;
  useFilterDocuments: boolean;
  useSortDocuments: boolean;
  useReplaceQuery: boolean;
  useRemoveMatchedTokens: boolean;
  useApplyFilters: boolean;
  useCustomMetadata: boolean;
  useStopProcessing: boolean;
  useEffectiveFrom: boolean;
  useEffectiveTo: boolean;
  usePinDocuments: boolean;
  useHideDocuments: boolean;
}

// ==================== PRESET / SEARCH PRIORITIES TYPES ====================

export interface SearchPresetValue {
  query_by?: string;
  query_by_weights?: string;
  sort_by?: string;
  num_typos?: number | string;
  prefix?: boolean | string;
  per_page?: number;
  [key: string]: unknown;
}

export interface SearchPreset {
  name: string;
  value: SearchPresetValue;
}

export interface SearchPresetFieldRow {
  field: string;
  weight: number;
  enabled: boolean;
}

export interface SearchPresetFormData {
  name: string;
  fields: SearchPresetFieldRow[];
  sort_by: string;
  num_typos: number;
  prefix: boolean;
  per_page: number;
}

export interface PresetsResponse {
  success: boolean;
  data?: SearchPreset[];
  message: string;
}

export interface PresetResponse {
  success: boolean;
  data?: SearchPreset;
  message: string;
}

// ==================== SYNC (corridas + logs) ====================

/** `update` actualiza sobre la colección viva; `recreate` la borra y la rehace. */
export type TypesenseSyncMode = 'update' | 'recreate';
export type TypesenseSyncTrigger = 'manual' | 'cron' | 'event';
export type TypesenseSyncStatus =
  | 'running'
  | 'completed'
  | 'completed_with_errors'
  | 'failed';
export type TypesenseSyncStage =
  | 'loading'
  | 'listing'
  | 'recreating'
  | 'upserting'
  | 'deleting'
  | 'done'
  | 'error';
export type TypesenseSyncItemStatus = 'failed' | 'deleted' | 'skipped';

/**
 * Contenido de `typesense_sync_log.summary`. `total` se resuelve ANTES del
 * barrido (count de productos publicados) para que el % del admin sea real: la
 * ruta vieja hacía `touch({ done, total: done })` por página, así que la barra
 * marcaba 100% desde el primer lote.
 */
export interface TypesenseSyncSummary {
  total: number;
  processed: number;
  upserted: number;
  failed: number;
  deleted: number;
  skipped: number;
  duration_ms?: number;
  recreated?: boolean;
  synonyms_restored?: number;
  curations_restored?: number;
  collection?: string;
  /** Avisos de la corrida (p. ej. detalle de borrados truncado). */
  notes?: string[];
}

/**
 * Fila de `typesense_sync_log`.
 *
 * Las fechas van como `string | Date` a propósito: el service las devuelve como
 * `Date` y el admin las recibe ya serializadas a string por JSON.
 */
export interface TypesenseSyncLogRow {
  id: string;
  mode: TypesenseSyncMode;
  trigger: TypesenseSyncTrigger;
  status: TypesenseSyncStatus;
  stage: TypesenseSyncStage | string | null;
  collection: string | null;
  started_at: string | Date;
  finished_at: string | Date | null;
  summary: TypesenseSyncSummary | null;
  error: { message?: string } | null;
  created_by: string | null;
  updated_at?: string | Date;
}

/** Fila de `typesense_sync_log_item`. */
export interface TypesenseSyncLogItemRow {
  id: string;
  sync_log_id: string;
  entity_type: string;
  entity_id: string;
  status: TypesenseSyncItemStatus;
  error: string | null;
  payload: Record<string, unknown> | null;
  created_at?: string | Date;
}

export interface PreparedOverrideData {
  rule: {
    query?: string;
    filter_by?: string;
    tags?: string[];
    match?: OverrideRuleMatch;
  };
  includes?: { id: string; position?: number }[];
  excludes?: { id: string }[];
  filter_by?: string;
  sort_by?: string;
  replace_query?: string;
  remove_matched_tokens?: boolean;
  filter_curated_hits?: boolean;
  stop_processing?: boolean;
  actions?: {
    metadata?: Record<string, unknown>;
  };
  effective_from_ts?: number;
  effective_to_ts?: number;
}
