import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import { ERP_MODULE } from '../index';
import type ErpModuleService from '../service';
import type { TintingSelection } from '../service';
import { getErpAdapter } from '../adapters/registry';
import { ErpTintingFormulaNotFoundError } from '../adapters/types';
import { DEFAULT_TINTING_SETTINGS } from '../types';
import type { ErpConfigSettings, ErpTintingSettings } from '../types';
import { normalizeTintingQuote, type NormalizedTintingQuote } from './normalize-quote';
import { resolveTintingListIndex } from './resolve-list-index';

/**
 * Cotización de un entonado, lista para consumir desde una ruta store.
 *
 * Concentra acá lo que las rutas NO deberían repetir: cargar la config, decidir
 * la lista, pegarle a Zeus con caché y normalizar. La regla dura es que la
 * fórmula se resuelve SIEMPRE contra la data maestra a partir de
 * `(article_code, color_code)`: el navegador no elige qué cotizar.
 *
 * La caché guarda la cotización de UN envase y multiplica en memoria. Se puede
 * porque `total` es lineal en `cantidad` (medido: 1/2/3/4 envases dan
 * 66352.822 / 132705.645 / 199058.467 / 265411.289 exactos), y así la clave no
 * depende de la cantidad: un cliente que sube y baja el stepper no genera una
 * llamada nueva por cada click.
 */

export type TintingQuoteResult = {
  quote: NormalizedTintingQuote;
  selection: TintingSelection;
  list_index: number;
  /** La cotización salió de la caché. */
  cached: boolean;
};

/** No se pudo cotizar, y por qué — cada motivo tiene un HTTP distinto. */
export class TintingQuoteError extends Error {
  constructor(
    readonly reason: 'disabled' | 'not_configured' | 'unknown_selection' | 'not_quotable' | 'unavailable',
    message: string
  ) {
    super(message);
    this.name = 'TintingQuoteError';
  }
}

type CacheLike = {
  get<T>(key: string): Promise<T | null>;
  set(key: string, data: unknown, ttl?: number): Promise<void>;
};

const MEMORY_CACHE_MAX = 2_000;
const memoryStore = new Map<string, { data: unknown; expiresAt: number }>();

/**
 * Igual que en la ruta de ARCA: si el módulo CACHE no resuelve, se cae a memoria
 * del proceso en vez de quedarse sin caché y bombardear al ERP.
 */
const memoryCache: CacheLike = {
  async get<T>(key: string): Promise<T | null> {
    const entry = memoryStore.get(key);
    if (!entry || entry.expiresAt <= Date.now()) {
      memoryStore.delete(key);
      return null;
    }
    return entry.data as T;
  },
  async set(key: string, data: unknown, ttl = 900): Promise<void> {
    if (memoryStore.size > MEMORY_CACHE_MAX) {
      const now = Date.now();
      for (const [k, v] of memoryStore) if (v.expiresAt <= now) memoryStore.delete(k);
    }
    memoryStore.set(key, { data, expiresAt: Date.now() + ttl * 1000 });
  },
};

function resolveCache(container: MedusaContainer): CacheLike {
  try {
    const cache = container.resolve(Modules.CACHE) as unknown as CacheLike | undefined;
    if (cache && typeof cache.get === 'function' && typeof cache.set === 'function') return cache;
  } catch {
    // Sin módulo CACHE en el container.
  }
  return memoryCache;
}

export function tintingSettingsOf(settings: ErpConfigSettings | null | undefined): ErpTintingSettings {
  return settings?.tinting ?? {};
}

export function tintingMaxQuantity(settings: ErpConfigSettings | null | undefined): number {
  const max = tintingSettingsOf(settings).max_quantity;
  return Number.isInteger(max) && (max as number) >= 1
    ? (max as number)
    : DEFAULT_TINTING_SETTINGS.max_quantity;
}

export async function quoteTinting(
  container: MedusaContainer,
  input: {
    article_code: string;
    color_code: string;
    collection?: string | null;
    quantity: number;
    /** Grupos del cliente, para elegir la lista (el mayorista cotiza con la suya). */
    customer_group_ids?: string[];
    /** Precio de catálogo de la base, para desglosar el sobreprecio. */
    base_unit_price?: number | null;
  }
): Promise<TintingQuoteResult> {
  const service = container.resolve<ErpModuleService>(ERP_MODULE);
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

  const config = await service.getActiveConfig();
  if (!config) {
    throw new TintingQuoteError('not_configured', 'La extensión ERP no está configurada.');
  }

  const settings = (config.settings ?? {}) as ErpConfigSettings;
  const tinting = tintingSettingsOf(settings);
  if (!tinting.enabled) {
    throw new TintingQuoteError('disabled', 'El sistema tintométrico está desactivado.');
  }

  const adapter = getErpAdapter(config.provider);
  if (!adapter.getCapabilities().tinting_price || !adapter.getTintingPrice) {
    throw new TintingQuoteError(
      'not_configured',
      `El ERP ${config.provider} no sabe cotizar entonados.`
    );
  }

  const selection = await service.resolveTintingSelection({
    article_code: input.article_code,
    color_code: input.color_code,
    collection: input.collection ?? null,
  });
  if (!selection) {
    throw new TintingQuoteError(
      'unknown_selection',
      'Ese color no está disponible para esta base.'
    );
  }

  const quantity = input.quantity;
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new TintingQuoteError('not_quotable', 'La cantidad tiene que ser un número entero de envases.');
  }

  const { list_index } = resolveTintingListIndex(settings, input.customer_group_ids ?? []);
  const gen = tinting.price_cache_gen ?? DEFAULT_TINTING_SETTINGS.price_cache_gen;
  const ttl = tinting.price_cache_ttl_s ?? DEFAULT_TINTING_SETTINGS.price_cache_ttl_s;
  const cacheKey = `erp:tint:${config.provider}:g${gen}:${selection.base.article_code}:${selection.formula.zeus_formula_code}:l${list_index}`;
  const cache = resolveCache(container);

  // Siempre se cotiza y se cachea UN envase; la cantidad se multiplica después.
  let raw = await cache.get<{ total: number; tax_rate: number | null }>(cacheKey).catch(() => null);
  let cached = raw !== null;

  if (!raw) {
    const credentials = service.getDecryptedCredentials(config);
    if (!credentials) {
      throw new TintingQuoteError('not_configured', 'No hay credenciales del ERP guardadas.');
    }
    try {
      const fresh = await adapter.getTintingPrice(
        {
          base_code: selection.base.article_code,
          formula_code: selection.formula.zeus_formula_code,
          list_index,
          quantity: 1,
        },
        {
          credentials,
          settings: settings as unknown as Record<string, unknown>,
          countryCode: config.country_code,
          logger,
        }
      );
      raw = { total: fresh.total, tax_rate: fresh.tax_rate };
      cached = false;
      await cache.set(cacheKey, raw, ttl).catch(() => undefined);
    } catch (error) {
      if (error instanceof ErpTintingFormulaNotFoundError) {
        // La fórmula está en nuestra tabla pero el ERP no la conoce: data
        // maestra desincronizada, no una caída. Se distingue para que la UI diga
        // "ese color no está disponible" en vez de "volvé a intentar".
        logger.warn(
          `[erp] tintométrico: ${selection.formula.zeus_formula_code} sobre ${selection.base.article_code} no existe en el ERP.`
        );
        throw new TintingQuoteError('unknown_selection', 'Ese color no está disponible para esta base.');
      }
      const detail = error instanceof Error ? error.message : String(error);
      logger.error(`[erp] tintométrico: no se pudo cotizar (${detail})`);
      throw new TintingQuoteError('unavailable', 'No pudimos calcular el precio del color en este momento.');
    }
  }

  const quote = normalizeTintingQuote({
    raw,
    quantity,
    // `raw` SIEMPRE viene de una cotización de un envase (así la caché no
    // depende de la cantidad). Sin esto el normalizador dividía el precio de un
    // envase entre la cantidad pedida: el total quedaba clavado y agregar 2 al
    // carrito los cobraba al precio de 1.
    quoted_quantity: 1,
    base_unit_price: input.base_unit_price ?? null,
    includes_tax: tinting.total_includes_tax ?? DEFAULT_TINTING_SETTINGS.total_includes_tax,
  });

  if (!quote) {
    // `total: 0.0` es cómo el ERP contesta una lista sin precio (HTTP 200, no
    // error). Vender un entonado a 0 sería peor que no ofrecerlo.
    throw new TintingQuoteError(
      'not_quotable',
      'El ERP no tiene precio para esa combinación en la lista que corresponde.'
    );
  }

  return { quote, selection, list_index, cached };
}
