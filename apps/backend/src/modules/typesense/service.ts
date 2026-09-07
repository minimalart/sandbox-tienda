import { Client } from 'typesense';
import type { CollectionFieldSchema, CollectionSchema } from 'typesense/lib/Typesense/Collection';
import type { ConfigurationOptions } from 'typesense/lib/Typesense/Configuration';
import type {
  ImportResponse,
  ImportResponseFail,
  SearchParams,
  SearchResponse,
} from 'typesense/lib/Typesense/Documents';
import type { OverrideSchema } from 'typesense/lib/Typesense/Override';
import type { OverrideCreateSchema } from 'typesense/lib/Typesense/Overrides';
import type { SynonymSchema } from 'typesense/lib/Typesense/Synonym';
import { ProductMapper } from './product-mapper';
import { typesenseSchema } from './schema';
import { connectionFingerprint, getTypesenseSettings } from './settings';

import { collectionForSite } from './site-collection';

type AnyRecord = Record<string, any>;

/** Sinónimos + curaciones de una colección, para sobrevivir a un recreate. */
export interface CollectionConfigSnapshot {
  synonyms: SynonymSchema[];
  overrides: OverrideSchema[];
}

export interface RestoreCollectionConfigResult {
  synonyms_restored: number;
  curations_restored: number;
}

export interface EnsureCollectionResult extends RestoreCollectionConfigResult {
  created: boolean;
  recreated: boolean;
}

export interface ImportDocumentsResult {
  upserted: number;
  failures: Array<{ id?: string; error: string }>;
}

/**
 * Id del documento rechazado por `/documents/import`. Typesense lo devuelve como
 * string JSON cuando `return_doc` está apagado (el default), así que el tipo del
 * cliente (`document: DocumentSchema`) no alcanza.
 */
function extractDocumentId(document: unknown): string | undefined {
  if (!document) return undefined;
  if (typeof document === 'string') {
    try {
      const parsed = JSON.parse(document) as { id?: unknown };
      return typeof parsed.id === 'string' ? parsed.id : undefined;
    } catch {
      return undefined;
    }
  }
  const id = (document as { id?: unknown }).id;
  return typeof id === 'string' ? id : undefined;
}

// ─── Shared types used by both the service and the API routes ────────────────

export interface SynonymData {
  root?: string;
  synonyms: string[];
  locale?: string;
}

export interface Synonym {
  id: string;
  root?: string;
  synonyms: string[];
  locale?: string;
}

export interface StopWord {
  id: string;
  stopwords: string[];
  locale: string;
}

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

// ─────────────────────────────────────────────────────────────────────────────

export default class TypeSenseService {
  public collectionName: string;
  private static clientInstance: Client | null = null;
  private static analyticsClientInstance: Client | null = null;
  /**
   * Huella de conexión con la que se construyeron los clientes estáticos.
   *
   * Antes el cliente se creaba UNA vez por proceso y no se rehacía nunca, así
   * que cambiar el host o la API key no tenía efecto hasta reiniciar — incluso
   * cambiándolos por env. Ahora que la config puede editarse desde el admin,
   * el cliente se reconstruye cuando la huella cambia. Se compara por huella y
   * no por tiempo a propósito: el cliente mantiene conexión, y rehacerlo en
   * cada instanciación (35 call sites) sería caro y sin sentido.
   */
  private static clientFingerprint: string | null = null;
  private client: Client;
  private analyticsClient: Client | null = null;
  private analyticsCollection: string;

  constructor() {
    const settings = getTypesenseSettings();
    const { host, port, protocol } = settings;
    const fingerprint = connectionFingerprint(settings);

    if (!TypeSenseService.clientInstance || TypeSenseService.clientFingerprint !== fingerprint) {
      const logLevel = process.env.NODE_ENV === 'production' ? 'warn' : 'debug';
      const config: ConfigurationOptions = {
        nodes: [{ host, port, protocol }],
        apiKey: settings.apiKey,
        numRetries: 3,
        connectionTimeoutSeconds: 10,
        logLevel,
      };
      TypeSenseService.clientInstance = new Client(config);

      TypeSenseService.analyticsClientInstance = settings.analyticsApiKey
        ? new Client({ ...config, apiKey: settings.analyticsApiKey })
        : null;

      TypeSenseService.clientFingerprint = fingerprint;
    }

    this.client = TypeSenseService.clientInstance;
    this.analyticsClient = TypeSenseService.analyticsClientInstance;
    this.collectionName = settings.collectionName;
    this.analyticsCollection = settings.analyticsCollection;
  }

  private getAnalyticsClient(): Client {
    return this.analyticsClient ?? this.client;
  }

  /**
   * La colección de analítica de búsqueda.
   *
   * Acepta tienda por el MISMO mapa que las de producto pero con su propia env: la
   * analítica vive en una colección aparte (`popular_queries`), así que separarla por
   * tienda pide una colección de analítica por tienda además de las de catálogo.
   *
   *   TYPESENSE_SITE_ANALYTICS_COLLECTIONS='{"demo_norte":"popular_queries_norte"}'
   *
   * Sin mapa —el default— toda tienda ve la global, que es el comportamiento de antes.
   *
   * El fallback global sale de `getTypesenseSettings()` y no de `process.env`
   * directo: es el mismo valor, resuelto una sola vez en el constructor.
   */
  private getAnalyticsCollectionName(siteId: string | null = null): string {
    return collectionForSite(
      this.analyticsCollection,
      siteId,
      undefined,
      'TYPESENSE_SITE_ANALYTICS_COLLECTIONS',
    );
  }

  // ==================== COLLECTION MANAGEMENT ====================

  /**
   * Deja la colección lista SIN vaciarla al pasar: la crea si falta y la recrea
   * SÓLO si el schema local ya no coincide con el remoto (campo nuevo, cambio de
   * tipo o de facet). Es el camino del modo `update` del sync — mientras el
   * schema no cambie, la búsqueda del storefront nunca queda degradada.
   *
   * Cuando sí toca recrear, pasa por `recreateCollectionPreservingConfig` para
   * no perder sinónimos ni curaciones (en Typesense viven en la colección).
   */
  async ensureCollection(): Promise<EnsureCollectionResult> {
    const empty: EnsureCollectionResult = {
      created: false,
      recreated: false,
      synonyms_restored: 0,
      curations_restored: 0,
    };

    if (!(await this.collectionExists())) {
      await this.client.collections().create({ ...typesenseSchema, name: this.collectionName });
      console.warn(`[Typesense] Collection "${this.collectionName}" created.`);
      return { ...empty, created: true };
    }

    if (await this.schemaIsEqual()) return empty;

    console.warn(`[Typesense] Schema drift detected on "${this.collectionName}": recreating.`);
    const restored = await this.recreateCollectionPreservingConfig();
    return { ...empty, recreated: true, ...restored };
  }

  /**
   * DELETE + CREATE de la colección. Si el `create` falla, PROPAGA.
   *
   * Antes se comía ese error (`force = true` por defecto): la colección quedaba
   * borrada y el sync seguía subiendo documentos a la nada, en silencio, dejando
   * la búsqueda del storefront vacía sin ningún rastro. `force` se mantiene por
   * compatibilidad de firma pero ya no silencia nada.
   */
  async recreateCollection(_force = true): Promise<void> {
    try {
      await this.client.collections(this.collectionName).delete();
    } catch (err: unknown) {
      const httpErr = err as { httpStatus?: number };
      if (httpErr.httpStatus !== 404) {
        console.warn('[Typesense] Error deleting collection:', err);
      }
    }

    await this.client.collections().create({ ...typesenseSchema, name: this.collectionName });
    console.warn(`[Typesense] Collection "${this.collectionName}" recreated.`);
  }

  /** True si la colección existe en Typesense. */
  async collectionExists(): Promise<boolean> {
    try {
      await this.client.collections(this.collectionName).retrieve();
      return true;
    } catch (err: unknown) {
      if ((err as { httpStatus?: number }).httpStatus === 404) return false;
      throw err;
    }
  }

  /**
   * Snapshot de los sinónimos y curaciones, recreate, y re-aplicación.
   *
   * En Typesense sinónimos y overrides son POR COLECCIÓN: borrarla los borra.
   * El botón de sync los borraba en cada corrida y nada los volvía a poner, así
   * que toda la configuración de búsqueda hecha desde el admin se perdía en
   * silencio. Devuelve cuántos se pudieron restaurar.
   */
  async recreateCollectionPreservingConfig(): Promise<RestoreCollectionConfigResult> {
    const snapshot = await this.snapshotCollectionConfig();
    await this.recreateCollection();
    return this.restoreCollectionConfig(snapshot);
  }

  /** Sinónimos + curaciones actuales, para poder reponerlos tras un recreate. */
  async snapshotCollectionConfig(): Promise<CollectionConfigSnapshot> {
    const snapshot: CollectionConfigSnapshot = { synonyms: [], overrides: [] };
    try {
      const response = await this.client.collections(this.collectionName).synonyms().retrieve();
      snapshot.synonyms = response.synonyms ?? [];
    } catch (err) {
      console.warn('[Typesense] Could not snapshot synonyms:', err);
    }
    try {
      const response = await this.client.collections(this.collectionName).overrides().retrieve();
      snapshot.overrides = response.overrides ?? [];
    } catch (err) {
      console.warn('[Typesense] Could not snapshot curations:', err);
    }
    return snapshot;
  }

  /**
   * Re-aplica un snapshot sobre la colección (recién) recreada. Cada entrada va
   * por separado y un fallo individual no corta el resto: perder un sinónimo es
   * mejor que abortar el sync entero.
   */
  async restoreCollectionConfig(
    snapshot: CollectionConfigSnapshot
  ): Promise<RestoreCollectionConfigResult> {
    let synonyms_restored = 0;
    let curations_restored = 0;

    for (const synonym of snapshot.synonyms) {
      const { id, ...payload } = synonym as SynonymSchema & AnyRecord;
      if (!id) continue;
      try {
        await this.client
          .collections(this.collectionName)
          .synonyms()
          .upsert(id, payload as SynonymData);
        synonyms_restored++;
      } catch (err) {
        console.warn(`[Typesense] Could not restore synonym ${id}:`, err);
      }
    }

    for (const override of snapshot.overrides) {
      const { id, ...payload } = override as OverrideSchema & AnyRecord;
      if (!id) continue;
      try {
        await this.client
          .collections(this.collectionName)
          .overrides()
          .upsert(id, payload as unknown as OverrideCreateSchema);
        curations_restored++;
      } catch (err) {
        console.warn(`[Typesense] Could not restore curation ${id}:`, err);
      }
    }

    return { synonyms_restored, curations_restored };
  }

  /**
   * Returns all available Typesense collections.
   */
  async getCollections(): Promise<CollectionSchema[]> {
    try {
      return await this.client.collections().retrieve();
    } catch (err) {
      console.error('[Typesense] Error fetching collections:', err);
      throw err;
    }
  }

  /**
   * Returns detailed information about a specific collection.
   */
  async getCollectionInfo(collectionName: string): Promise<CollectionSchema> {
    try {
      return await this.client.collections(collectionName).retrieve();
    } catch (err) {
      console.error('[Typesense] Error fetching collection info:', err);
      throw err;
    }
  }

  /**
   * Returns the fields (schema) of the default collection.
   */
  async getCollectionFields(): Promise<CollectionFieldSchema[]> {
    try {
      const collection = await this.client.collections(this.collectionName).retrieve();
      return (collection.fields ?? []) as CollectionFieldSchema[];
    } catch (err) {
      console.error('[Typesense] Error fetching collection fields:', err);
      throw err;
    }
  }

  // ==================== DOCUMENT CRUD ====================

  async createDocumentInDB(doc: object): Promise<unknown> {
    try {
      // `dirty_values: coerce_or_drop` evita que Typesense RECHACE el documento
      // entero cuando un campo opcional trae un tipo no coincidente (común en
      // catálogos importados): coacciona lo que puede y descarta solo ese campo,
      // en vez de perder el producto completo del índice.
      return await this.client
        .collections(this.collectionName)
        .documents()
        .upsert(doc, { dirty_values: 'coerce_or_drop' });
    } catch (err) {
      console.error('[Typesense] Failed to upsert document:', err);
      throw err;
    }
  }

  async deleteDocumentInDb(id: string): Promise<boolean> {
    try {
      await this.client.collections(this.collectionName).documents(id).delete();
      return true;
    } catch (err) {
      console.error(`[Typesense] Failed to delete document ${id}:`, err);
      return false;
    }
  }

  // ==================== BULK DOCUMENTS ====================

  /**
   * Ids de TODOS los documentos de la colección (export JSONL de un solo campo).
   *
   * Es la base para detectar huérfanos: documentos que siguen en el índice pero
   * ya no existen (o dejaron de ser publicables) en Medusa. Devuelve `[]` si la
   * colección no existe.
   */
  async listAllDocumentIds(): Promise<string[]> {
    return this.listDocumentIdsByFilter();
  }

  /**
   * Ids de los documentos que matchean un `filter_by` de Typesense (o todos si
   * no se pasa ninguno). Sirve para resolver "qué productos tocaba esta promo"
   * cuando la promo ya no existe en Medusa: `promotions.id:=promo_123`.
   */
  async listDocumentIdsByFilter(filterBy?: string): Promise<string[]> {
    let jsonl: string;
    try {
      jsonl = await this.client
        .collections(this.collectionName)
        .documents()
        .export({ include_fields: 'id', ...(filterBy ? { filter_by: filterBy } : {}) });
    } catch (err: unknown) {
      if ((err as { httpStatus?: number }).httpStatus === 404) return [];
      throw err;
    }

    const ids: string[] = [];
    for (const line of jsonl.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const id = (JSON.parse(trimmed) as { id?: unknown }).id;
        if (typeof id === 'string' && id) ids.push(id);
      } catch {
        // Una línea corrupta no debe tirar el sync entero.
      }
    }
    return ids;
  }

  /**
   * Indexa una tanda de documentos en UNA sola llamada (`/documents/import`).
   *
   * Reemplaza el bucle de N `upsert` secuenciales: con 5.000 productos eran
   * 5.000 round-trips HTTP. `emplace` crea o actualiza (mismo efecto que upsert)
   * y `dirty_values: coerce_or_drop` evita que un campo opcional con tipo raro
   * (habitual en catálogos importados) descarte el producto completo.
   *
   * Typesense responde 200 aun con documentos rechazados y el cliente tira
   * `ImportError`: los fallos se devuelven por separado en vez de propagarse,
   * para que cada uno quede como item del log con su id y su error.
   */
  async importDocuments(
    docs: AnyRecord[],
    action: 'upsert' | 'emplace' = 'emplace'
  ): Promise<ImportDocumentsResult> {
    if (docs.length === 0) return { upserted: 0, failures: [] };

    let results: ImportResponse[];
    try {
      results = await this.client
        .collections(this.collectionName)
        .documents()
        .import(docs, { action, dirty_values: 'coerce_or_drop' });
    } catch (err: unknown) {
      const importResults = (err as { importResults?: unknown }).importResults;
      if (!Array.isArray(importResults)) throw err;
      results = importResults as ImportResponse[];
    }

    let upserted = 0;
    const failures: Array<{ id?: string; error: string }> = [];
    results.forEach((result, index) => {
      if (result?.success) {
        upserted++;
        return;
      }
      const failure = result as ImportResponseFail | undefined;
      failures.push({
        // Con `return_doc` apagado Typesense devuelve el documento como STRING;
        // el índice del array es el fallback confiable contra `docs`.
        id: extractDocumentId(failure?.document) ?? (docs[index]?.id as string | undefined),
        error: failure?.error ?? 'unknown import error',
      });
    });

    return { upserted, failures };
  }

  /**
   * Borra documentos por id, en tandas (`filter_by: id:[...]`). Devuelve cuántos
   * borró Typesense. Una lista vacía no hace ninguna llamada.
   */
  async deleteDocumentsByIds(ids: string[], chunkSize = 200): Promise<number> {
    const unique = [...new Set(ids.filter(Boolean))];
    if (unique.length === 0) return 0;

    let deleted = 0;
    for (let i = 0; i < unique.length; i += chunkSize) {
      const chunk = unique.slice(i, i + chunkSize);
      // Los ids de Medusa son alfanuméricos con `_`, pero se citan igual para
      // que un id inesperado no rompa la sintaxis del filtro.
      const filter = `id:[${chunk.map((id) => `\`${id.replace(/`/g, '')}\``).join(',')}]`;
      try {
        const response = await this.client
          .collections(this.collectionName)
          .documents()
          .delete({ filter_by: filter });
        deleted += response?.num_deleted ?? 0;
      } catch (err) {
        console.warn(`[Typesense] Failed to delete a batch of ${chunk.length} documents:`, err);
      }
    }
    return deleted;
  }

  // ==================== BULK SYNC ====================

  /**
   * Recreate the collection and index all provided products.
   * Fails gracefully — logs but does NOT throw if Typesense is unreachable.
   */
  async bulkSync(products: AnyRecord[]): Promise<{ upserted: number; errors: number }> {
    try {
      await this.recreateCollection();

      let upserted = 0;
      let errors = 0;

      for (const product of products) {
        try {
          const doc = ProductMapper.toTypesenseObject(product);
          await this.createDocumentInDB(doc);
          upserted++;
        } catch (err) {
          errors++;
          console.error(`[Typesense] Failed to index product ${String(product.id)}:`, err);
        }
      }

      console.warn(`[Typesense] bulkSync done: upserted=${upserted}, errors=${errors}`);
      return { upserted, errors };
    } catch (err) {
      console.warn('[Typesense] bulkSync failed (Typesense may be unreachable):', err);
      return { upserted: 0, errors: products.length };
    }
  }

  // ==================== SEARCH ====================

  async search(params: SearchParams, collection?: string): Promise<SearchResponse<object>> {
    return this.client
      .collections(collection ?? this.collectionName)
      .documents()
      .search(params);
  }

  /**
   * Advanced search — strips empty/null params before forwarding to Typesense.
   */
  async advancedSearch(
    options: SearchParams,
    collection: string = this.collectionName
  ): Promise<SearchResponse<object>> {
    const searchParams = Object.entries(options).reduce<AnyRecord>((acc, [key, value]) => {
      if (value === undefined || value === null) return acc;
      if (typeof value === 'string' && value.trim().length === 0) return acc;
      if (Array.isArray(value) && value.length === 0) return acc;
      acc[key] = value;
      return acc;
    }, {});

    searchParams['q'] =
      typeof options.q === 'string'
        ? options.q.trim() || '*'
        : options.q ?? '*';

    try {
      return await this.client
        .collections(collection)
        .documents()
        .search(searchParams as SearchParams);
    } catch (err) {
      console.error('[Typesense] advancedSearch error:', err);
      throw err;
    }
  }

  // ==================== SYNONYMS ====================

  async getSynonyms(collection: string = this.collectionName): Promise<Synonym[]> {
    try {
      const response = await this.client.collections(collection).synonyms().retrieve();
      return (response.synonyms ?? []).map((s: SynonymSchema) => ({
        id: s.id ?? '',
        root: s.root ?? '',
        synonyms: s.synonyms ?? [],
        locale: s.locale ?? '',
      }));
    } catch (err) {
      console.error('[Typesense] Error fetching synonyms:', err);
      throw err;
    }
  }

  async getSynonym(id: string, collection: string = this.collectionName): Promise<SynonymSchema> {
    return this.client.collections(collection).synonyms(id).retrieve();
  }

  /**
   * Acepta la colección, igual que `getSynonyms` y `getSynonym`.
   *
   * Clavaban `this.collectionName`, que es la colección POR DEFECTO del clúster, así
   * que en una instalación con colecciones separadas por tienda la ruta no tenía nada
   * que pasarle: leía los sinónimos de la tienda activa y escribía sobre los de la
   * colección por defecto. Con la lectura ya parametrizada y la escritura no, el
   * operador veía sus sinónimos y editaba los de otra.
   */
  async upsertSynonym(
    id: string,
    synonymData: SynonymData,
    collection: string = this.collectionName,
  ): Promise<SynonymSchema> {
    return this.client.collections(collection).synonyms().upsert(id, synonymData);
  }

  async deleteSynonym(id: string, collection: string = this.collectionName): Promise<unknown> {
    return this.client.collections(collection).synonyms(id).delete();
  }

  // ==================== CURATIONS (OVERRIDES) ====================

  /**
   * Las curaciones son POR COLECCIÓN (a diferencia de stopwords y presets, que en
   * Typesense son del clúster). Por eso acepta la colección: con colecciones separadas
   * por tienda, cada una tiene las suyas.
   */
  async getOverrides(collection: string = this.collectionName): Promise<unknown> {
    try {
      const response = await this.client.collections(collection).overrides().retrieve();
      if (response?.overrides && Array.isArray(response.overrides)) {
        return response.overrides;
      }
      return [];
    } catch (err) {
      console.error('[Typesense] Error fetching overrides:', err);
      throw err;
    }
  }

  async getOverride(id: string, collection: string = this.collectionName): Promise<unknown> {
    return this.client.collections(collection).overrides(id).retrieve();
  }

  /**
   * Acepta la colección, igual que `deleteOverride` y que el comentario de arriba
   * ("las curaciones son POR COLECCIÓN") ya exigía. Era el único de los tres verbos
   * de curación que no la tomaba: se listaba y se borraba en la colección de la
   * tienda activa, y se escribía en la de por defecto.
   */
  async upsertOverride(
    id: string,
    overrideData: OverrideCreateSchema,
    collection: string = this.collectionName,
  ): Promise<OverrideSchema> {
    return this.client.collections(collection).overrides().upsert(id, overrideData);
  }

  async deleteOverride(id: string, collection: string = this.collectionName): Promise<unknown> {
    return this.client.collections(collection).overrides(id).delete();
  }

  // ==================== STOP WORDS ====================

  async getStopwordLists(): Promise<StopWord[]> {
    try {
      const response = await this.client.stopwords().retrieve();
      return (response.stopwords ?? []) as StopWord[];
    } catch (err) {
      console.error('[Typesense] Error fetching stopwords:', err);
      throw err;
    }
  }

  async getStopwordList(id: string): Promise<StopWord | null> {
    try {
      return (await this.client.stopwords(id).retrieve()) as StopWord;
    } catch (err) {
      console.error(`[Typesense] Error fetching stopword list ${id}:`, err);
      throw err;
    }
  }

  async upsertStopwordList(id: string, stopwords: string[], locale = 'es'): Promise<StopWord> {
    try {
      return (await this.client.stopwords().upsert(id, { stopwords, locale })) as StopWord;
    } catch (err) {
      console.error(`[Typesense] Error upserting stopword list ${id}:`, err);
      throw err;
    }
  }

  async deleteStopwordList(id: string): Promise<unknown> {
    try {
      return await this.client.stopwords(id).delete();
    } catch (err) {
      console.error(`[Typesense] Error deleting stopword list ${id}:`, err);
      throw err;
    }
  }

  // ==================== PRESETS ====================

  async getPresets(): Promise<SearchPreset[]> {
    try {
      const response = await this.client.presets().retrieve();
      return (response.presets ?? []).map((p) => ({
        name: p.name,
        value: p.value as SearchPresetValue,
      }));
    } catch (err) {
      console.error('[Typesense] Error fetching presets:', err);
      throw err;
    }
  }

  async getPreset(id: string): Promise<SearchPreset> {
    try {
      const preset = await this.client.presets(id).retrieve();
      return { name: preset.name, value: preset.value as SearchPresetValue };
    } catch (err) {
      console.error(`[Typesense] Error fetching preset ${id}:`, err);
      throw err;
    }
  }

  async upsertPreset(id: string, value: SearchPresetValue): Promise<SearchPreset> {
    try {
      const result = await this.client.presets().upsert(id, { value: value as any });
      return { name: result.name, value: result.value as SearchPresetValue };
    } catch (err) {
      console.error(`[Typesense] Error upserting preset ${id}:`, err);
      throw err;
    }
  }

  async deletePreset(id: string): Promise<{ name: string }> {
    try {
      return await this.client.presets(id).delete();
    } catch (err) {
      console.error(`[Typesense] Error deleting preset ${id}:`, err);
      throw err;
    }
  }

  // ==================== ANALYTICS ====================

  /**
   * Creates the analytics collection. Safe to call multiple times.
   *
   * NOTE: we deliberately do NOT register a native Typesense `popular_queries`
   * analytics rule. On the ARM build of Typesense 27.1 the analytics-rules API
   * SEGFAULTS the whole server (a SEGV is not catchable from JS — try/catch is
   * useless), which would take down the storefront search on every query.
   * Instead `storeSearchAnalytics` writes directly into this collection and the
   * admin reads aggregates from it — no native rule needed, search stays
   * isolated from analytics failures.
   */
  async ensureAnalyticsSetup(siteId: string | null = null): Promise<void> {
    const collectionName = this.getAnalyticsCollectionName(siteId);
    const analyticsClient = this.getAnalyticsClient();

    const collectionSchema: CollectionSchema = {
      name: collectionName,
      fields: [
        { name: 'q', type: 'string', facet: true, index: true },
        { name: 'count', type: 'int32', facet: false, index: true },
        { name: 'has_results', type: 'bool', facet: false, index: true },
        { name: 'no_results_count', type: 'int32', facet: false, index: true },
      ],
      default_sorting_field: 'count',
    } as CollectionSchema;

    try {
      await analyticsClient.collections(collectionName).retrieve();
    } catch {
      await analyticsClient.collections().create(collectionSchema);
      console.warn(`[Typesense Analytics] Created collection ${collectionName}`);
    }
  }

  /**
   * Drops and recreates the analytics collection (resets counters).
   *
   * `siteId` no es opcional por comodidad: es DESTRUCTIVO. Sin él, el botón
   * "Resetear analítica" de una tienda secundaria borraba la colección GLOBAL —los
   * contadores de la principal— y dejaba la propia intacta. La lectura hermana
   * (`admin/typesense/analytics` GET) ya resolvía la tienda; el reset no, así que
   * miraba una colección y vaciaba otra.
   */
  async resetAnalyticsCollection(siteId: string | null = null): Promise<void> {
    const collectionName = this.getAnalyticsCollectionName(siteId);
    const analyticsClient = this.getAnalyticsClient();
    try {
      await analyticsClient.collections(collectionName).delete();
    } catch (err) {
      console.warn('[Typesense Analytics] Could not delete analytics collection:', err);
    }
    await this.ensureAnalyticsSetup(siteId);
  }

  /**
   * Persists a search query into the analytics collection (fire-and-forget friendly).
   *
   * `siteId` es la ESCRITURA que le faltaba al eje que las otras tres ya tenían
   * (`ensureAnalyticsSetup`, `resetAnalyticsCollection`, `getPopularSearchQueries`).
   * Sin él todas las tiendas sumaban sobre la colección global, y eso rompe la
   * analítica en las dos direcciones a la vez:
   *
   *  - la tienda con colección propia la ve SIEMPRE VACÍA por más que su buscador se
   *    use, porque el admin lee de la suya y el storefront escribía en la otra;
   *  - la global acumula los términos de todas mezclados, así que el operador de la
   *    principal lee "lo que busca su gente" y en realidad lee lo de tres negocios.
   *
   * Y a diferencia de una lectura mal filtrada, esto NO se puede reparar después: no
   * queda registro de a qué tienda pertenecía cada suma. El contador queda corrompido
   * para siempre — por eso el parámetro entra ahora aunque el mapa de colecciones esté
   * vacío en casi todas las instalaciones.
   */
  async storeSearchAnalytics(
    query: string,
    hasResults = true,
    siteId: string | null = null,
  ): Promise<void> {
    const normalized = (query ?? '').trim().toLowerCase();
    if (!normalized) return;

    const collectionName = this.getAnalyticsCollectionName(siteId);
    const analyticsClient = this.getAnalyticsClient();

    try {
      const existing = await analyticsClient
        .collections(collectionName)
        .documents()
        .search({
          q: normalized,
          query_by: 'q',
          filter_by: `q:=\`${normalized.replace(/`/g, '')}\``,
          per_page: 1,
        });

      const hit = existing.hits?.[0]?.document as
        | { id: string; count?: number; no_results_count?: number }
        | undefined;

      if (hit) {
        await analyticsClient.collections(collectionName).documents(hit.id).update({
          count: (hit.count ?? 0) + 1,
          has_results: hasResults,
          no_results_count: (hit.no_results_count ?? 0) + (hasResults ? 0 : 1),
        });
      } else {
        await analyticsClient.collections(collectionName).documents().create({
          q: normalized,
          count: 1,
          has_results: hasResults,
          no_results_count: hasResults ? 0 : 1,
        });
      }
    } catch (err) {
      // Must never break the storefront search.
      console.error('[Typesense Analytics] Failed to store search analytics:', err);
    }
  }

  async getPopularSearchQueries(
    limit = 100,
    siteId: string | null = null,
  ): Promise<Array<{ term: string; count: number }>> {
    try {
      await this.ensureAnalyticsSetup();
      const collectionName = this.getAnalyticsCollectionName(siteId);
      const result = await this.getAnalyticsClient()
        .collections(collectionName)
        .documents()
        .search({
          q: '*',
          query_by: 'q',
          filter_by: 'has_results:true',
          sort_by: 'count:desc',
          per_page: limit,
        });

      return (result.hits ?? []).map((hit: any) => ({
        term: hit.document.q as string,
        count: (hit.document.count as number) ?? 0,
      }));
    } catch (err) {
      console.error('[Typesense Analytics] Error fetching popular queries:', err);
      return [];
    }
  }

  async getQueriesWithoutResults(
    limit = 100,
    siteId: string | null = null,
  ): Promise<Array<{ term: string; count: number }>> {
    try {
      await this.ensureAnalyticsSetup();
      const collectionName = this.getAnalyticsCollectionName(siteId);
      const result = await this.getAnalyticsClient()
        .collections(collectionName)
        .documents()
        .search({
          q: '*',
          query_by: 'q',
          filter_by: 'has_results:false',
          sort_by: 'no_results_count:desc',
          per_page: limit,
        });

      return (result.hits ?? []).map((hit: any) => ({
        term: hit.document.q as string,
        count: (hit.document.no_results_count as number) ?? 0,
      }));
    } catch (err) {
      console.error('[Typesense Analytics] Error fetching queries without results:', err);
      return [];
    }
  }

  async getMostSearchedProducts(
    limit = 10,
    siteId: string | null = null,
  ): Promise<Array<{ value: string; count: number }>> {
    try {
      // Ojo: esta lee la colección de PRODUCTOS, no la de analítica — son facetas del
      // catálogo, no consultas registradas. Por eso resuelve con el mapa de catálogo.
      const collection = collectionForSite(this.collectionName, siteId);
      const result = await this.client.collections(collection).documents().search({
        q: '*',
        query_by: 'title,description',
        facet_by: 'brand.name',
        per_page: 0,
        max_facet_values: limit,
      });

      return (result.facet_counts?.[0]?.counts ?? []).map((c: any) => ({
        value: c.value as string,
        count: c.count as number,
      }));
    } catch (err) {
      console.error('[Typesense Analytics] Error fetching most searched products:', err);
      return [];
    }
  }

  // ==================== SCHEMA UTILITIES ====================

  private readonly SCHEMA_COMPARE_KEYS: readonly string[] = ['name', 'type', 'facet', 'index', 'optional', 'sort'];

  private async schemaIsEqual(): Promise<boolean> {
    try {
      const remote: CollectionSchema = await this.client
        .collections(this.collectionName)
        .retrieve();

      const localMap = new Map(
        (typesenseSchema.fields || []).map((f: CollectionFieldSchema) => [f.name, f])
      );
      const remoteMap = new Map(
        (remote.fields || []).map((f: CollectionFieldSchema) => [f.name, f])
      );

      for (const [name, local] of localMap) {
        if (name === 'id') continue;
        const remoteField = remoteMap.get(name);
        if (!remoteField) return false;

        for (const key of this.SCHEMA_COMPARE_KEYS) {
          if (key === 'name') continue;
          const lv = (local as AnyRecord)[key];
          const rv = (remoteField as AnyRecord)[key];
          if (lv !== undefined && rv !== undefined && lv !== rv) return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }
}
