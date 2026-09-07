import type { MiddlewareRoute } from '@medusajs/medusa';
import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import type { IProductModuleService, Logger } from '@medusajs/framework/types';
import { ContainerRegistrationKeys, MedusaError, Modules } from '@medusajs/framework/utils';

/**
 * Arregla el export de productos del admin, que ignora los filtros de pantalla.
 *
 * BUG UPSTREAM (verificado en 2.17.2, 2.18.0 y en `develop`): la lista de
 * productos escribe sus filtros en la URL SIN prefijo (`?sales_channel_id=…`) y
 * le pasa el `location.search` crudo al drawer de export, pero el drawer los lee
 * con `useProductTableQuery({ prefix: "p" })`, o sea busca `p_sales_channel_id`.
 * Ningún filtro matchea, el `POST /admin/products/export` sale sin filtros y el
 * workflow exporta el catálogo COMPLETO con variantes y precios: en un vCPU eso
 * no termina, el proceso muere y como el workflow engine es in-memory no queda
 * ni la notificación de fallo. El usuario ve el toast "estamos procesando" y
 * nunca le llega el CSV.
 *
 * Reportado dos veces upstream (medusajs/medusa#12195, #13470) y cerrado sin
 * fix, así que no hay versión a la que upgradear. Tampoco alcanza con
 * overridear la ruta del drawer desde `src/admin`: las rutas de extensión se
 * agregan DESPUÉS del árbol core en el mismo array de children, y React Router
 * desempata paths idénticos por orden de declaración, así que gana la core.
 *
 * Fix: reconstruimos los filtros desde el `Referer`, que sí los trae completos
 * (`/app/products/export?sales_channel_id=…`), y los inyectamos a mano.
 *
 * Escribimos en `req.filterableFields` Y en `req.query`, a propósito. El loader
 * de Medusa registra `../api` del core antes que la api del proyecto, así que
 * hoy el `validateAndTransformQuery(AdminGetProductsParams)` de la ruta ya corrió
 * cuando llegamos acá: lo que manda es `filterableFields` (salteamos zod, así que
 * los valores van con el tipo final que espera el query graph). La copia en
 * `query` cubre el orden inverso, para que un cambio de registro upstream no
 * vuelva a dejar el export sin filtros en silencio.
 */

// Filtros de la barra de la lista que llegan como lista separada por comas.
const LIST_FILTERS = [
  'sales_channel_id',
  'category_id',
  'collection_id',
  'tag_id',
  'type_id',
  'status',
] as const;

// Filtros de fecha: la lista los serializa como JSON (`{"$gte":"…"}`).
const OPERATOR_FILTERS = ['created_at', 'updated_at'] as const;

const ALL_FILTER_KEYS: string[] = [...LIST_FILTERS, ...OPERATOR_FILTERS, 'q', 'id'];

// Tope de seguridad para el export sin filtros. Un export del catálogo entero
// con todos los campos es justo el perfil que ya nos tiró el CPU al 100%, así
// que arriba de este número pedimos que filtren. 0 lo desactiva.
const DEFAULT_MAX_PRODUCTS = 5000;

// Aceptamos la clave con y sin el prefijo `p_`: si algún día upstream alinea la
// lista con el drawer, los params van a venir prefijados y esto sigue andando.
const readParam = (params: URLSearchParams, key: string): string | null =>
  params.get(key) ?? params.get(`p_${key}`);

// Exportada sólo para el test unitario.
export const recoverFiltersFromReferer = (
  referer: string | undefined
): Record<string, unknown> => {
  if (!referer) {
    return {};
  }

  let params: URLSearchParams;
  try {
    const url = new URL(referer);
    // Sólo el listado de productos y su drawer de export.
    if (!/\/app\/products(\/|$)/.test(url.pathname)) {
      return {};
    }
    params = url.searchParams;
  } catch {
    return {};
  }

  const filters: Record<string, unknown> = {};

  for (const key of LIST_FILTERS) {
    const values =
      readParam(params, key)
        ?.split(',')
        .map((value) => value.trim())
        .filter(Boolean) ?? [];
    if (values.length) {
      filters[key] = values;
    }
  }

  for (const key of OPERATOR_FILTERS) {
    const raw = readParam(params, key);
    if (!raw) {
      continue;
    }
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        filters[key] = parsed;
      }
    } catch {
      // Fecha ilegible: la ignoramos en vez de romper el export.
    }
  }

  const q = readParam(params, 'q');
  if (q) {
    filters.q = q;
  }

  return filters;
};

const hasFilter = (fields: Record<string, unknown>): boolean =>
  ALL_FILTER_KEYS.some((key) => {
    const value = fields[key];
    if (value === undefined || value === null) {
      return false;
    }
    return Array.isArray(value) ? value.length > 0 : true;
  });

const recoverProductExportFilters = async (
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
): Promise<void> => {
  let logger: Logger | undefined;
  try {
    logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  } catch {
    // Sin logger seguimos igual.
  }

  try {
    const fields = (req.filterableFields ?? {}) as Record<string, unknown>;
    const query = (req.query ?? {}) as Record<string, unknown>;

    // Si el cliente mandó filtros de verdad (API propia, o un dashboard futuro
    // ya arreglado), no tocamos nada.
    if (hasFilter(fields) || hasFilter(query)) {
      return next();
    }

    const recovered = recoverFiltersFromReferer(req.get('referer'));

    if (Object.keys(recovered).length) {
      Object.assign(fields, recovered);
      // La lista siempre excluye gift cards, así que el export la espeja.
      if (fields.is_giftcard === undefined) {
        fields.is_giftcard = false;
      }
      req.filterableFields = fields;
      // Sólo las claves recuperadas, con formas que zod acepta (arrays y objetos,
      // igual que las produciría qs). `is_giftcard` no va acá para no depender de
      // cómo el validador castea el booleano.
      Object.assign(query, recovered);
      logger?.info(
        `[product-export] filtros recuperados del referer: ${JSON.stringify(recovered)}`
      );
      return next();
    }

    // Export sin ningún filtro: verificamos el tope antes de dejarlo arrancar.
    const maxProducts = Number(
      process.env.PRODUCT_EXPORT_MAX_PRODUCTS ?? DEFAULT_MAX_PRODUCTS
    );
    if (!Number.isFinite(maxProducts) || maxProducts <= 0) {
      return next();
    }

    const productModule = req.scope.resolve<IProductModuleService>(Modules.PRODUCT);
    const [, count] = await productModule.listAndCountProducts(
      {},
      { select: ['id'], take: 1 }
    );

    if (count > maxProducts) {
      logger?.warn(
        `[product-export] export sin filtros rechazado: ${count} productos (tope ${maxProducts})`
      );
      return next(
        new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `El catálogo tiene ${count} productos y el export sin filtros está limitado a ${maxProducts}. Filtrá la lista (por canal de venta, categoría o colección) antes de exportar.`
        )
      );
    }

    return next();
  } catch (error) {
    // Nunca bloqueamos un export por un problema de este helper.
    logger?.warn(
      `[product-export] no se pudieron recuperar los filtros: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return next();
  }
};

export const productExportMiddlewares: MiddlewareRoute[] = [
  {
    matcher: '/admin/products/export',
    method: ['POST'],
    middlewares: [recoverProductExportFilters],
  },
];
