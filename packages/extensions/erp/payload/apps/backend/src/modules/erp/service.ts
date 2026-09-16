import { MedusaError, MedusaService } from '@medusajs/framework/utils';
import { encryptSecret, tryDecryptSecret } from './crypto';
import {
  ErpConfig,
  ErpInvoice,
  ErpOutboxEvent,
  ErpSyncLog,
  ErpSyncLogItem,
  ErpTintingBase,
  ErpTintingColor,
  ErpTintingFormula,
} from './models';
import { sanitizePayload, truncateError } from './sanitize';
import { mergeErpSettings } from './settings-merge';
import {
  mergeColorImagesIntoMetadata,
  readColorImages,
  type ColorImage,
} from './tinting/color-images';
import {
  overrideCodesOf,
  productLinesOf,
  selectBasesForColor,
  type BaseForColor,
} from './tinting/select-bases-for-color';
import type { ErpConfigSettings, ErpOutboxStatus } from './types';

/** Fila de `erp_config` (shape mínimo que usa el service; el DTO real lo genera MedusaService). */
export type ErpConfigRow = {
  id: string;
  provider: string;
  country_code: string;
  enabled: boolean;
  stock_sync_enabled: boolean;
  catalog_sync_enabled: boolean;
  sales_notify_enabled: boolean;
  credentials_enc: string | null;
  settings: ErpConfigSettings | null;
  last_validated_at: Date | string | null;
  last_validation_ok: boolean | null;
  last_validation_error: string | null;
  updated_by: string | null;
};

/** Fila de `erp_invoice` (shape mínimo que consumen el outbox y las rutas). */
export type ErpInvoiceRow = {
  id: string;
  order_id: string;
  provider: string;
  external_ref: string;
  sucursal: number | null;
  numero_comp: number | null;
  tipo_comp: string | null;
  letra: string | null;
  punto_de_venta: number | null;
  fecha: string | null;
  total: number | null;
  file_id: string | null;
  file_url: string | null;
  raw: Record<string, unknown> | null;
  created_at?: Date | string | null;
  updated_at?: Date | string | null;
};

export type ErpOutboxEventRow = {
  id: string;
  event_type: string;
  event_key: string;
  aggregate_type: string;
  aggregate_id: string;
  provider: string;
  payload: unknown;
  status: ErpOutboxStatus;
  attempts: number;
  next_retry_at: Date | string | null;
  claimed_at: Date | string | null;
  sent_at: Date | string | null;
  external_ref: string | null;
  last_error: string | null;
  created_at: Date | string;
};

/** Fila de `erp_tinting_color` (shape que consumen el service y las rutas). */
export type TintingColorRow = {
  id: string;
  code: string;
  name: string;
  collection: string;
  hex: string | null;
  family: string | null;
  group_key: string | null;
  rank: number;
  active: boolean;
  /** Decorativo: hoy sólo `images` (ver `tinting/color-images.ts`). */
  metadata: Record<string, unknown> | null;
};

export type TintingBaseRow = {
  id: string;
  article_code: string;
  base_letter: string | null;
  product_line: string;
  collection: string | null;
  size_label: string | null;
  size_liters: number | null;
  source: 'erp' | 'parsed' | 'manual';
  confirmed: boolean;
  active: boolean;
  /** El artículo también se vende sin entonar (ver el modelo). */
  sellable_untinted: boolean;
};

export type TintingFormulaRow = {
  id: string;
  color_code: string;
  collection: string;
  product_line: string;
  base_letter: string | null;
  zeus_formula_code: string;
  base_article_code: string | null;
  active: boolean;
};

/** Filas de entrada de los upsert (las produce `tinting/import-rows.ts`). */
export type ColorUpsertInput = {
  code: string;
  name: string;
  collection: string;
  hex: string | null;
  family: string | null;
  group_key: string | null;
  rank: number;
  active?: boolean;
  /** `null` = el import no trajo la columna: las fotos guardadas quedan como están. */
  images?: ColorImage[] | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Saca `images` de la fila (no es columna del modelo) y lo deja dentro de
 * `metadata`, respetando lo que ya hubiera guardado. Sin este paso el create le
 * pasaría a Medusa una propiedad que la entidad no tiene.
 */
function withImageMetadata(
  row: ColorUpsertInput,
  existingMetadata: Record<string, unknown> | null
): ColorUpsertInput {
  const { images, ...rest } = row;
  if (!images) return rest;
  return { ...rest, metadata: mergeColorImagesIntoMetadata(existingMetadata, images) };
}

export type FormulaUpsertInput = {
  color_code: string;
  collection: string;
  product_line: string;
  base_letter: string | null;
  zeus_formula_code: string;
  base_article_code: string | null;
  active?: boolean;
};

export type BaseUpsertInput = {
  article_code: string;
  base_letter: string | null;
  product_line: string;
  collection: string | null;
  size_label: string | null;
  size_liters: number | null;
  source?: 'erp' | 'parsed' | 'manual';
  title_snapshot?: string | null;
  active?: boolean;
  /**
   * Ausente = no tocar. Es una decisión humana igual que `confirmed`: el
   * detector no puede saber que un artículo también se vende terminado, así que
   * sólo la pisa quien la manda explícita (el import).
   */
  sellable_untinted?: boolean;
};

export type TintingUpsertResult = {
  created: number;
  updated: number;
  unchanged: number;
};

/** Una selección de entonado ya resuelta contra la data maestra. */
export type TintingSelection = {
  base: TintingBaseRow;
  color: TintingColorRow;
  formula: TintingFormulaRow;
};

/** Una base sobre la que se puede lograr un color (flujo color → base). */
export type TintingBaseForColor = BaseForColor;

type UpsertConfigPatch = {
  provider?: string;
  country_code?: string;
  enabled?: boolean;
  stock_sync_enabled?: boolean;
  catalog_sync_enabled?: boolean;
  sales_notify_enabled?: boolean;
  settings?: ErpConfigSettings;
};

type EnqueueOutboxInput = {
  event_type: string;
  event_key: string;
  aggregate_type: string;
  aggregate_id: string;
  provider: string;
  payload: unknown;
  status?: Extract<ErpOutboxStatus, 'pending' | 'skipped'>;
};

class ErpModuleService extends MedusaService({
  ErpConfig,
  ErpSyncLog,
  ErpSyncLogItem,
  ErpOutboxEvent,
  ErpInvoice,
  ErpTintingColor,
  ErpTintingBase,
  ErpTintingFormula,
}) {
  // ── Config ────────────────────────────────────────────────────────────────

  /** Config de la extensión (MVP: una sola fila, la más antigua no borrada). */
  async getConfig(): Promise<ErpConfigRow | null> {
    const [config] = await this.listErpConfigs({}, { take: 1, order: { created_at: 'ASC' } });
    return (config as unknown as ErpConfigRow) ?? null;
  }

  /** Config lista para operar (master switch prendido) o `null`. */
  async getActiveConfig(): Promise<ErpConfigRow | null> {
    const config = await this.getConfig();
    return config?.enabled ? config : null;
  }

  /**
   * Credenciales descifradas de la config, o `null` si no hay o el blob no
   * valida (p. ej. rotó `JWT_SECRET`: hay que re-ingresarlas).
   */
  getDecryptedCredentials(
    config: Pick<ErpConfigRow, 'credentials_enc'>
  ): Record<string, string> | null {
    const plain = tryDecryptSecret(config.credentials_enc);
    if (!plain) return null;
    try {
      const parsed = JSON.parse(plain) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
      const credentials: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'string') credentials[key] = value;
      }
      return Object.keys(credentials).length ? credentials : null;
    } catch {
      return null;
    }
  }

  /**
   * Crea/actualiza la config única. Las credenciales son write-only: se MERGEAN
   * sobre las guardadas (omitirlas preserva el blob) y se borran por nombre con
   * `removeCredentialKeys`.
   * `settings` se mergea con `mergeErpSettings`, que baja un nivel dentro de
   * las secciones conocidas: la UI del admin reconstruye `catalog_sync` entero
   * sin `category_map` ni `last_synced_at`, y un merge plano las borraba en
   * cada guardado.
   */
  async upsertConfig(
    patch: UpsertConfigPatch,
    opts: {
      credentials?: Record<string, string>;
      /** Claves a borrar del blob. La UI las manda por nombre: nunca ve el valor. */
      removeCredentialKeys?: string[];
      actorId?: string | null;
    } = {}
  ): Promise<ErpConfigRow> {
    const existing = await this.getConfig();
    // `{ ...patch }` arrastraba claves con valor `undefined` de body parciales
    // (típico: la UI manda solo `settings`, sin los root flags). El update de
    // MikroORM lee esos `undefined` como "unset" y tira contra las columnas
    // NOT NULL del modelo ("must pass a non-undefined value to enabled").
    // Filtrar acá cubre a todos los callers del service, no solo al handler
    // que arrancó el bug.
    const values: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) values[key] = value;
    }

    const incoming = opts.credentials ?? {};
    const toRemove = (opts.removeCredentialKeys ?? []).filter(Boolean);
    if (Object.keys(incoming).length > 0 || toRemove.length > 0) {
      // MERGE, no reemplazo. Antes cualquier guardado con una credencial pisaba
      // el blob entero, así que rotar una clave borraba en silencio las otras del
      // provider. Borrar ahora es explícito y por nombre, que es lo único que la
      // UI conoce (los valores son write-only y no se muestran nunca).
      const current = existing ? (this.getDecryptedCredentials(existing) ?? {}) : {};
      const merged: Record<string, string> = { ...current, ...incoming };
      for (const key of toRemove) delete merged[key];
      values.credentials_enc = Object.keys(merged).length
        ? encryptSecret(JSON.stringify(merged))
        : null;
    }
    if (opts.actorId !== undefined) {
      values.updated_by = opts.actorId;
    }
    if (patch.settings) {
      values.settings = mergeErpSettings(existing?.settings, patch.settings);
    }

    if (existing) {
      await this.updateErpConfigs({ id: existing.id, ...values });
      return (await this.retrieveErpConfig(existing.id)) as unknown as ErpConfigRow;
    }
    const created = await this.createErpConfigs({
      provider: 'contabilium',
      country_code: 'AR',
      ...values,
    });
    return created as unknown as ErpConfigRow;
  }

  // ── Outbox ────────────────────────────────────────────────────────────────

  /** Fila del outbox por clave idempotente, o `null`. */
  async findOutboxEventByKey(eventKey: string): Promise<ErpOutboxEventRow | null> {
    const [event] = await this.listErpOutboxEvents({ event_key: eventKey }, { take: 1 });
    return (event as unknown as ErpOutboxEventRow) ?? null;
  }

  /**
   * Encola un evento de forma idempotente por `event_key`. Si ya existe
   * devuelve `{created: false}` con la fila previa; la carrera entre dos
   * procesos la cierra el unique index (el error de duplicado se re-lee).
   */
  async enqueueOutboxEvent(
    input: EnqueueOutboxInput
  ): Promise<{ created: boolean; event: ErpOutboxEventRow }> {
    const findExisting = async (): Promise<ErpOutboxEventRow | null> => {
      const [event] = await this.listErpOutboxEvents({ event_key: input.event_key }, { take: 1 });
      return (event as unknown as ErpOutboxEventRow) ?? null;
    };

    const existing = await findExisting();
    if (existing) return { created: false, event: existing };

    try {
      const event = await this.createErpOutboxEvents({
        event_type: input.event_type,
        event_key: input.event_key,
        aggregate_type: input.aggregate_type,
        aggregate_id: input.aggregate_id,
        provider: input.provider,
        payload: sanitizePayload(input.payload) as Record<string, unknown> | null,
        status: input.status ?? 'pending',
        attempts: 0,
      });
      return { created: true, event: event as unknown as ErpOutboxEventRow };
    } catch (error) {
      const raced = await findExisting();
      if (raced) return { created: false, event: raced };
      throw error;
    }
  }

  /**
   * Toma hasta `limit` eventos vencidos (`pending`/`failed` con
   * `next_retry_at` nulo o pasado) y los marca `processing`. Filtra por
   * `provider` para no entregarle a un adapter eventos de otro (si se cambió
   * el provider, los viejos quedan en cola). El caller debe envolver esto en
   * el lock `erp:outbox` para que no compitan dos processors.
   */
  async claimDueOutboxEvents(limit: number, provider?: string): Promise<ErpOutboxEventRow[]> {
    const filters: Record<string, unknown> = { status: ['pending', 'failed'] };
    if (provider) filters.provider = provider;
    const candidates = (await this.listErpOutboxEvents(filters, {
      take: Math.max(limit * 5, 50),
      order: { created_at: 'ASC' },
    })) as unknown as ErpOutboxEventRow[];

    const now = Date.now();
    const due = candidates
      .filter((event) => !event.next_retry_at || new Date(event.next_retry_at).getTime() <= now)
      .slice(0, limit);
    if (!due.length) return [];

    const claimedAt = new Date();
    await this.updateErpOutboxEvents(
      due.map((event) => ({ id: event.id, status: 'processing' as const, claimed_at: claimedAt }))
    );
    return due;
  }

  async markOutboxSent(
    id: string,
    opts: {
      external_ref?: string | null;
      response?: unknown;
      request?: unknown;
      duplicate?: boolean;
    }
  ): Promise<void> {
    await this.updateErpOutboxEvents({
      id,
      status: opts.duplicate ? ('duplicate' as const) : ('sent' as const),
      sent_at: new Date(),
      external_ref: opts.external_ref ?? null,
      // `undefined` NO pisa lo guardado: el poll del comprobante vuelve a
      // llamar acá cuando la venta ya se envió, y ese segundo paso no tiene el
      // documento a mano. Escribir null ahí borraría la evidencia del envío.
      ...(opts.request === undefined
        ? {}
        : { request_payload: sanitizePayload(opts.request) as Record<string, unknown> | null }),
      response_payload: (opts.response === undefined
        ? null
        : sanitizePayload(opts.response)) as Record<string, unknown> | null,
      last_error: null,
      next_retry_at: null,
    });
  }

  /**
   * Reprograma un evento que NO falló: sigue esperando algo del ERP.
   *
   * Existe aparte de `markOutboxRetry` porque el estado importa. El poll del
   * comprobante puede dar diez vueltas antes de que el ERP facture, y eso es el
   * camino normal: marcarlo `failed` con un `last_error` pintaría de rojo en el
   * panel una venta perfectamente sana, y el operador saldría a buscar un
   * problema que no existe. Queda `pending` con `next_retry_at`, que es
   * exactamente lo que `claimDueOutboxEvents` sabe leer.
   */
  async markOutboxWaiting(
    id: string,
    opts: { attempts: number; next_retry_at: Date; reason?: string | null }
  ): Promise<void> {
    await this.updateErpOutboxEvents({
      id,
      status: 'pending' as const,
      attempts: opts.attempts,
      next_retry_at: opts.next_retry_at,
      last_error: opts.reason ?? null,
      claimed_at: null,
    });
  }

  /** Falla con reintento programado. */
  async markOutboxRetry(
    id: string,
    opts: { attempts: number; next_retry_at: Date; error: unknown }
  ): Promise<void> {
    await this.updateErpOutboxEvents({
      id,
      status: 'failed' as const,
      attempts: opts.attempts,
      next_retry_at: opts.next_retry_at,
      last_error: truncateError(opts.error),
      claimed_at: null,
    });
  }

  /** Falla definitiva: agotó los reintentos o el payload es irrecuperable. */
  async markOutboxDeadLetter(
    id: string,
    opts: { attempts: number; error: unknown }
  ): Promise<void> {
    await this.updateErpOutboxEvents({
      id,
      status: 'dead_letter' as const,
      attempts: opts.attempts,
      next_retry_at: null,
      last_error: truncateError(opts.error),
      claimed_at: null,
    });
  }

  /** Retry manual desde admin: `failed`/`dead_letter` → `pending` con intentos reseteados. */
  async requeueOutboxEvent(id: string): Promise<ErpOutboxEventRow> {
    const event = (await this.retrieveErpOutboxEvent(id)) as unknown as ErpOutboxEventRow;
    if (event.status !== 'failed' && event.status !== 'dead_letter') {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Solo se pueden reintentar eventos failed/dead_letter (estado actual: ${event.status}).`
      );
    }
    await this.updateErpOutboxEvents({
      id,
      status: 'pending' as const,
      attempts: 0,
      next_retry_at: null,
      claimed_at: null,
    });
    return (await this.retrieveErpOutboxEvent(id)) as unknown as ErpOutboxEventRow;
  }

  /**
   * Resync manual: deja la fila en `pending` con el payload RECIÉN ARMADO.
   *
   * A diferencia de `requeueOutboxEvent`, no valida el estado — quién puede
   * volver a mandarse lo decide `outbox/resync-decision.ts`, que es puro y
   * testeado, y esta capa sólo escribe. Reemplazar el payload es el punto:
   * habilita recuperar un `skipped`, cuyo payload guardado no es una venta sino
   * `{ reason: 'sales_notify_disabled' }`.
   *
   * `last_error` se limpia porque el error viejo ya no describe esta fila; si el
   * reenvío vuelve a fallar, el processor lo escribe de nuevo.
   */
  async resetOutboxEventForResync(
    id: string,
    payload: Record<string, unknown> | unknown
  ): Promise<ErpOutboxEventRow> {
    await this.updateErpOutboxEvents({
      id,
      status: 'pending' as const,
      payload: sanitizePayload(payload) as Record<string, unknown> | null,
      attempts: 0,
      next_retry_at: null,
      claimed_at: null,
      last_error: null,
      external_ref: null,
      response_payload: null,
      sent_at: null,
    });
    return (await this.retrieveErpOutboxEvent(id)) as unknown as ErpOutboxEventRow;
  }

  /**
   * Devuelve a `failed` (retry inmediato, sin sumar intento) los eventos que
   * quedaron `processing` demasiado tiempo — un restart a mitad de envío.
   */
  async sweepStaleProcessing(maxAgeMs: number): Promise<number> {
    const processing = (await this.listErpOutboxEvents(
      { status: 'processing' },
      { take: 200 }
    )) as unknown as ErpOutboxEventRow[];
    const cutoff = Date.now() - maxAgeMs;
    const stale = processing.filter(
      (event) => !event.claimed_at || new Date(event.claimed_at).getTime() <= cutoff
    );
    if (!stale.length) return 0;
    await this.updateErpOutboxEvents(
      stale.map((event) => ({
        id: event.id,
        status: 'failed' as const,
        next_retry_at: new Date(),
        last_error: 'Reencolado: quedó en processing (posible restart a mitad de envío).',
        claimed_at: null,
      }))
    );
    return stale.length;
  }

  /** Conteo de eventos por estado, para el dashboard del admin. */
  async countOutboxByStatus(): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    const statuses: ErpOutboxStatus[] = [
      'pending',
      'processing',
      'sent',
      'failed',
      'dead_letter',
      'skipped',
      'duplicate',
    ];
    await Promise.all(
      statuses.map(async (status) => {
        const [, count] = await this.listAndCountErpOutboxEvents({ status }, { take: 0 });
        counts[status] = count;
      })
    );
    return counts;
  }

  // ── Comprobantes ──────────────────────────────────────────────────────────

  /**
   * Comprobante de una orden, o `null`.
   *
   * Se filtra por provider además de por orden porque el unique de la tabla es
   * `(provider, order_id)`: una instalación que cambió de ERP puede tener el
   * comprobante viejo de otro provider para la misma orden, y devolverlo
   * mostraría un número de factura que no corresponde al ERP activo.
   */
  async findInvoiceByOrder(provider: string, orderId: string): Promise<ErpInvoiceRow | null> {
    const [invoice] = await this.listErpInvoices({ provider, order_id: orderId }, { take: 1 });
    return (invoice as unknown as ErpInvoiceRow) ?? null;
  }

  // ── Tintometría ───────────────────────────────────────────────────────────

  /**
   * Resuelve una selección de entonado: artículo base + color → fórmula.
   *
   * Es el ÚNICO camino por el que el código de fórmula llega a la API de Zeus.
   * El cliente manda `(article_code, color_code)` y el servidor busca la
   * fórmula: nunca se acepta un `codFormula` que venga del navegador, porque
   * junto con el precio custom de la línea sería dejar que el comprador elija
   * qué cotizar.
   *
   * Precedencia: primero un override por artículo (`base_article_code`), después
   * la fórmula de la línea+letra. Devuelve `null` si falta cualquiera de las tres
   * piezas o si la base no está confirmada.
   */
  async resolveTintingSelection(input: {
    article_code: string;
    color_code: string;
    collection?: string | null;
  }): Promise<TintingSelection | null> {
    const articleCode = input.article_code?.trim();
    const colorCode = input.color_code?.trim();
    if (!articleCode || !colorCode) return null;

    const [base] = (await this.listErpTintingBases(
      { article_code: articleCode, active: true, confirmed: true },
      { take: 1 }
    )) as unknown as TintingBaseRow[];
    if (!base) return null;

    const collection = input.collection?.trim() || base.collection || undefined;

    const [color] = (await this.listErpTintingColors(
      collection
        ? { code: colorCode, collection, active: true }
        : { code: colorCode, active: true },
      { take: 1 }
    )) as unknown as TintingColorRow[];
    if (!color) return null;

    const [override] = (await this.listErpTintingFormulas(
      {
        color_code: colorCode,
        collection: color.collection,
        base_article_code: articleCode,
        active: true,
      },
      { take: 1 }
    )) as unknown as TintingFormulaRow[];

    const formula =
      override ??
      ((
        await this.listErpTintingFormulas(
          {
            color_code: colorCode,
            collection: color.collection,
            product_line: base.product_line,
            base_letter: base.base_letter,
            active: true,
          },
          { take: 1 }
        )
      )[0] as unknown as TintingFormulaRow | undefined);

    if (!formula) return null;
    return { base, color, formula };
  }

  /**
   * Colores que se pueden entonar sobre una base (flujo base → color).
   *
   * Devuelve también la FILA de la base y no sólo los colores porque el PDP
   * necesita una segunda respuesta de la misma consulta: si el artículo además
   * se vende sin entonar (`sellable_untinted`), y de eso depende que el botón de
   * comprar quede bloqueado. Resolverlo con otra query sería repetir la búsqueda
   * por `article_code` que esta función ya hace.
   */
  async listTintingColorsForBase(
    articleCode: string
  ): Promise<{ base: TintingBaseRow | null; colors: TintingColorRow[] }> {
    const [base] = (await this.listErpTintingBases(
      { article_code: articleCode?.trim(), active: true, confirmed: true },
      { take: 1 }
    )) as unknown as TintingBaseRow[];
    if (!base) return { base: null, colors: [] };

    const formulas = (await this.listErpTintingFormulas(
      { product_line: base.product_line, base_letter: base.base_letter, active: true },
      { take: null }
    )) as unknown as TintingFormulaRow[];
    if (!formulas.length) return { base, colors: [] };

    const collections = [...new Set(formulas.map((f) => f.collection))];
    const codes = [...new Set(formulas.map((f) => f.color_code))];
    const colors = (await this.listErpTintingColors(
      { code: codes, collection: collections, active: true },
      { take: null, order: { rank: 'ASC', name: 'ASC' } }
    )) as unknown as TintingColorRow[];

    // El cruce por `(collection, code)` se hace acá: filtrar por dos listas
    // sueltas admite combinaciones que ninguna fórmula cubre.
    const allowed = new Set(formulas.map((f) => `${f.collection}::${f.color_code}`));
    return { base, colors: colors.filter((c) => allowed.has(`${c.collection}::${c.code}`)) };
  }

  /**
   * Bases sobre las que se puede lograr un color (flujo color → base).
   *
   * Es el espejo de `listTintingColorsForBase` y tiene que devolver EXACTAMENTE
   * las bases que `resolveTintingSelection` sabe resolver para ese color: si
   * lista de menos, la página de colores no ofrece un artículo que el PDP sí
   * entona; si lista de más, se ofrece una combinación que después no cotiza.
   * Por eso replica la misma precedencia, incluido el override por artículo,
   * que puede existir SIN una fórmula de `(línea, letra)`.
   *
   * El cruce de la tupla `(product_line, base_letter)` se hace en memoria, igual
   * que en el flujo directo: filtrar por dos listas sueltas admitiría
   * combinaciones que ninguna fórmula cubre, y las bases son ~150 filas.
   */
  async listTintingBasesForColor(input: {
    color_code: string;
    collection?: string | null;
  }): Promise<TintingBaseForColor[]> {
    const colorCode = input.color_code?.trim();
    if (!colorCode) return [];

    const inputCollection = input.collection?.trim();
    const [color] = (await this.listErpTintingColors(
      inputCollection
        ? { code: colorCode, collection: inputCollection, active: true }
        : { code: colorCode, active: true },
      { take: 1 }
    )) as unknown as TintingColorRow[];
    if (!color) return [];

    // De acá en adelante manda `color.collection`: el código de color sólo es
    // único por carta, y resolver con la carta equivocada cobra otro color.
    const formulas = (await this.listErpTintingFormulas(
      { color_code: colorCode, collection: color.collection, active: true },
      { take: null }
    )) as unknown as TintingFormulaRow[];
    if (!formulas.length) return [];

    const overrideCodes = overrideCodesOf(formulas);
    const basesByLine = (await this.listErpTintingBases(
      { product_line: productLinesOf(formulas), active: true, confirmed: true },
      { take: null }
    )) as unknown as TintingBaseRow[];

    const basesByOverride = overrideCodes.length
      ? ((await this.listErpTintingBases(
          { article_code: overrideCodes, active: true, confirmed: true },
          { take: null }
        )) as unknown as TintingBaseRow[])
      : [];

    return selectBasesForColor({ formulas, basesByLine, basesByOverride });
  }

  /**
   * Carta completa de colores que tienen al menos una fórmula activa, para el
   * flujo color → base (no hay variante todavía cuando se elige el color).
   *
   * Sin el cruce contra fórmulas la carta ofrecería colores sin salida: el
   * import de colores y el de fórmulas son dos pasos distintos y no siempre
   * llegan juntos.
   */
  async listTintingCatalogColors(collection?: string | null): Promise<TintingColorRow[]> {
    const wanted = collection?.trim();
    const formulas = (await this.listErpTintingFormulas(
      wanted ? { collection: wanted, active: true } : { active: true },
      { take: null }
    )) as unknown as TintingFormulaRow[];
    if (!formulas.length) return [];

    const collections = [...new Set(formulas.map((f) => f.collection))];
    const codes = [...new Set(formulas.map((f) => f.color_code))];
    const colors = (await this.listErpTintingColors(
      { code: codes, collection: collections, active: true },
      { take: null, order: { rank: 'ASC', name: 'ASC' } }
    )) as unknown as TintingColorRow[];

    const allowed = new Set(formulas.map((f) => `${f.collection}::${f.color_code}`));
    return colors.filter((c) => allowed.has(`${c.collection}::${c.code}`));
  }

  /**
   * Upsert de la carta de colores, idempotente por `(collection, code)`.
   *
   * `dry_run` corre EXACTAMENTE el mismo diff sin escribir: es la única forma de
   * que el preview del admin no mienta. Devuelve el detalle por fila para poder
   * mostrar qué cambia antes de confirmar.
   */
  async upsertTintingColors(
    rows: ColorUpsertInput[],
    opts: { dryRun?: boolean } = {}
  ): Promise<TintingUpsertResult> {
    const collections = [...new Set(rows.map((r) => r.collection))];
    const existing = collections.length
      ? ((await this.listErpTintingColors(
          { collection: collections },
          { take: null }
        )) as unknown as TintingColorRow[])
      : [];
    const byKey = new Map(existing.map((c) => [`${c.collection}::${c.code}`, c]));

    const creates: ColorUpsertInput[] = [];
    const updates: Array<{ id: string; values: Partial<ColorUpsertInput> }> = [];
    let unchanged = 0;

    for (const row of rows) {
      const current = byKey.get(`${row.collection}::${row.code}`);
      if (!current) {
        creates.push(withImageMetadata(row, null));
        continue;
      }
      const diff: Partial<ColorUpsertInput> = {};
      if (current.name !== row.name) diff.name = row.name;
      if (current.hex !== row.hex) diff.hex = row.hex;
      if (current.family !== row.family) diff.family = row.family;
      if (current.group_key !== row.group_key) diff.group_key = row.group_key;
      if (current.rank !== row.rank) diff.rank = row.rank;
      if (current.active !== true) diff.active = true;

      // Las fotos se comparan por su forma normalizada: reimportar el mismo
      // harvest no tiene que contar como update de 2.848 filas.
      if (row.images) {
        const next = mergeColorImagesIntoMetadata(current.metadata, row.images);
        if (JSON.stringify(readColorImages(current.metadata)) !== JSON.stringify(row.images)) {
          diff.metadata = next;
        }
      }

      if (Object.keys(diff).length === 0) unchanged += 1;
      else updates.push({ id: current.id, values: diff });
    }

    if (!opts.dryRun) {
      if (creates.length) await this.createErpTintingColors(creates);
      for (const update of updates) {
        await this.updateErpTintingColors({ id: update.id, ...update.values });
      }
    }
    return { created: creates.length, updated: updates.length, unchanged };
  }

  /** Upsert de fórmulas, idempotente por `(color, carta, línea, letra)`. */
  async upsertTintingFormulas(
    rows: FormulaUpsertInput[],
    opts: { dryRun?: boolean } = {}
  ): Promise<TintingUpsertResult> {
    const collections = [...new Set(rows.map((r) => r.collection))];
    const existing = collections.length
      ? ((await this.listErpTintingFormulas(
          { collection: collections },
          { take: null }
        )) as unknown as TintingFormulaRow[])
      : [];
    const keyOf = (r: {
      color_code: string;
      collection: string;
      product_line: string;
      base_letter: string | null;
    }) => `${r.color_code}::${r.collection}::${r.product_line}::${r.base_letter ?? ''}`;
    const byKey = new Map(existing.map((f) => [keyOf(f), f]));

    const creates: FormulaUpsertInput[] = [];
    const updates: Array<{ id: string; values: Partial<FormulaUpsertInput> }> = [];
    let unchanged = 0;

    for (const row of rows) {
      const current = byKey.get(keyOf(row));
      if (!current) {
        creates.push(row);
        continue;
      }
      const diff: Partial<FormulaUpsertInput> = {};
      if (current.zeus_formula_code !== row.zeus_formula_code) {
        diff.zeus_formula_code = row.zeus_formula_code;
      }
      if (current.base_article_code !== row.base_article_code) {
        diff.base_article_code = row.base_article_code;
      }
      if (current.active !== true) diff.active = true;

      if (Object.keys(diff).length === 0) unchanged += 1;
      else updates.push({ id: current.id, values: diff });
    }

    if (!opts.dryRun) {
      if (creates.length) await this.createErpTintingFormulas(creates);
      for (const update of updates) {
        await this.updateErpTintingFormulas({ id: update.id, ...update.values });
      }
    }
    return { created: creates.length, updated: updates.length, unchanged };
  }

  /**
   * Upsert de bases, idempotente por `article_code`.
   *
   * `confirmed` NO se pisa desde el import: si alguien ya revisó una base a mano,
   * una re-importación no puede des-confirmarla ni confirmarla sola. Sólo el alta
   * decide, y las que vienen del parser nacen sin confirmar.
   */
  async upsertTintingBases(
    rows: BaseUpsertInput[],
    opts: { dryRun?: boolean; confirmOnCreate?: boolean } = {}
  ): Promise<TintingUpsertResult> {
    const codes = rows.map((r) => r.article_code);
    const existing = codes.length
      ? ((await this.listErpTintingBases(
          { article_code: codes },
          { take: null }
        )) as unknown as TintingBaseRow[])
      : [];
    const byCode = new Map(existing.map((b) => [b.article_code, b]));

    const creates: Array<BaseUpsertInput & { confirmed: boolean }> = [];
    const updates: Array<{ id: string; values: Partial<BaseUpsertInput> }> = [];
    let unchanged = 0;

    for (const row of rows) {
      const current = byCode.get(row.article_code);
      if (!current) {
        creates.push({ ...row, confirmed: Boolean(opts.confirmOnCreate) });
        continue;
      }
      const diff: Partial<BaseUpsertInput> = {};
      if (current.base_letter !== row.base_letter) diff.base_letter = row.base_letter;
      if (current.product_line !== row.product_line) diff.product_line = row.product_line;
      if (current.collection !== row.collection) diff.collection = row.collection;
      if (current.size_label !== row.size_label) diff.size_label = row.size_label;
      if (current.size_liters !== row.size_liters) diff.size_liters = row.size_liters;
      if (current.active !== true) diff.active = true;
      // Ausente = no tocar: el detector re-corre sobre bases que alguien ya
      // marcó como vendibles sin entonar y no puede desmarcarlas.
      if (
        row.sellable_untinted !== undefined &&
        current.sellable_untinted !== row.sellable_untinted
      ) {
        diff.sellable_untinted = row.sellable_untinted;
      }

      if (Object.keys(diff).length === 0) unchanged += 1;
      else updates.push({ id: current.id, values: diff });
    }

    if (!opts.dryRun) {
      if (creates.length) await this.createErpTintingBases(creates);
      for (const update of updates) {
        await this.updateErpTintingBases({ id: update.id, ...update.values });
      }
    }
    return { created: creates.length, updated: updates.length, unchanged };
  }

  /** Confirma (o des-confirma) bases detectadas, que es lo que las habilita. */
  async setTintingBasesConfirmed(articleCodes: string[], confirmed: boolean): Promise<number> {
    const codes = articleCodes.map((c) => c.trim()).filter(Boolean);
    if (!codes.length) return 0;
    const existing = (await this.listErpTintingBases(
      { article_code: codes },
      { take: null }
    )) as unknown as TintingBaseRow[];
    for (const base of existing) {
      await this.updateErpTintingBases({ id: base.id, confirmed });
    }
    return existing.length;
  }

  /** Qué falta para poder prender el entonado. Alimenta el banner del admin. */
  async getTintingReadiness(): Promise<{
    colors: number;
    bases: number;
    bases_confirmed: number;
    formulas: number;
    ready: boolean;
  }> {
    const [, colors] = await this.listAndCountErpTintingColors({ active: true }, { take: 0 });
    const [, bases] = await this.listAndCountErpTintingBases({ active: true }, { take: 0 });
    const [, basesConfirmed] = await this.listAndCountErpTintingBases(
      { active: true, confirmed: true },
      { take: 0 }
    );
    const [, formulas] = await this.listAndCountErpTintingFormulas({ active: true }, { take: 0 });
    return {
      colors,
      bases,
      bases_confirmed: basesConfirmed,
      formulas,
      ready: colors > 0 && basesConfirmed > 0 && formulas > 0,
    };
  }
}

export default ErpModuleService;
