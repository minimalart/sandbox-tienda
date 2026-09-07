import { defineSettings } from './types';

/**
 * Ajustes de Typesense.
 *
 * El manifest declaraba 4 variables y el código usa 14: la auditoría de este
 * namespace corrigió esa deriva, y `manifest-drift.test.ts` la mantiene cerrada
 * de acá en adelante.
 *
 * ─── LAS TRES QUE APARECIERON DESPUÉS, Y POR QUÉ NINGÚN GREP LAS ENCONTRÓ ────
 *
 * `TYPESENSE_SITE_COLLECTIONS` y `TYPESENSE_SITE_ANALYTICS_COLLECTIONS` son el
 * EJE MULTITIENDA ENTERO de Typesense —deciden a qué colección le pega cada
 * tienda— y estuvieron invisibles hasta esta tanda porque `site-collection.ts:57`
 * las leía con acceso DINÁMICO: `process.env[envVar]`. El texto
 * `process.env.TYPESENSE_SITE_COLLECTIONS` no existía en ninguna línea del repo.
 *
 * VEREDICTO SOBRE ESE ACCESO DINÁMICO, porque de él dependía si se podían migrar:
 * el índice NO se construye en runtime. `envVar` estaba tipado como la unión
 * cerrada `'TYPESENSE_SITE_COLLECTIONS' | 'TYPESENSE_SITE_ANALYTICS_COLLECTIONS'`,
 * con default, y los ocho call sites del repo pasan uno de esos dos literales o
 * nada. O sea: un `switch` de dos ramas escrito como índice, no una env var cuyo
 * nombre se arma concatenando. Por eso migrarlas no pidió ningún rediseño — el
 * parámetro pasó a nombrar el DESCRIPTOR en vez de la env, con los mismos dos
 * literales (la key del descriptor ES el nombre de la env), y ningún call site
 * cambió.
 *
 * (La tercera es `DEFAULT_CURRENCY_CODE`, que es de la instalación y va en
 * `envOnly`. Ver su razón abajo.)
 */

/**
 * Valida un mapa `{ site_id: nombre_de_colección }`.
 *
 * Existe porque `parseSiteCollections` es DELIBERADAMENTE indulgente: descarta en
 * silencio toda entrada cuyo valor no sea un string no vacío, para que un JSON mal
 * pegado en el entorno nunca deje al buscador sin colección. Esa indulgencia es
 * correcta en el camino de lectura y es un desastre en el de escritura — guardar
 * `{"demo_norte": 123}` desde la card se aceptaría, no rompería nada, y la tienda
 * norte seguiría pegándole a la colección global sin un solo mensaje de error.
 *
 * Acá, en cambio, se rechaza a los gritos. Es la asimetría a propósito de este
 * sistema: tolerante con lo que ya está en el entorno, estricto con lo que un
 * humano acaba de tipear.
 */
const refineCollectionMap = (value: unknown): string | null => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return 'Tiene que ser un objeto JSON `{"id_de_tienda": "nombre_de_coleccion"}`.';
  }
  for (const [siteId, collection] of Object.entries(value as Record<string, unknown>)) {
    if (!siteId.trim()) return 'Hay una clave vacía: cada clave es el id de una tienda.';
    if (typeof collection !== 'string' || !collection.trim()) {
      return `"${siteId}": el nombre de la colección tiene que ser un texto no vacío.`;
    }
    if (!/^[A-Za-z0-9_-]+$/.test(collection.trim())) {
      return `"${siteId}": "${collection}" no es un nombre de colección válido (letras, números, guiones y guiones bajos).`;
    }
  }
  return null;
};

export default defineSettings({
  namespace: 'extension:typesense',
  title: 'Typesense',
  /**
   * Decisión 2: typesense va con ENV plano y sin scoping. La separación por tienda
   * se hace por COLECCIÓN (`TYPESENSE_SITE_COLLECTIONS`), no por configuración, así
   * que un valor por tienda acá no gobernaría nada.
   */
  defaultScope: 'instance',
  envOnly: [
    {
      key: 'TYPESENSE_RECONCILE_CRON',
      reason:
        'Medusa hornea el cron al arrancar (job-loader.js:69-78): no se puede reprogramar en runtime. Para apagar el job usá "Reconciliación de stock activa".',
    },
    {
      key: 'TYPESENSE_SYNC_LOG_PRUNE_CRON',
      reason:
        'Igual que el anterior: el schedule se lee una sola vez al arrancar. La retención sí se configura acá.',
    },
    {
      key: 'DEFAULT_CURRENCY_CODE',
      reason:
        'DE NADIE, a propósito: es configuración regional de la INSTALACIÓN, no de una extensión, así que ningún namespace la edita. Acá es sólo el ÚLTIMO fallback de la moneda con la que se piden los `calculated_price` al indexar (`reindex.ts:359`) — antes se intenta la moneda default de la store y después la de la primera región, así que en una instalación bien configurada ni se usa. La leen también el importador VTEX del ERP y los backfills de precios: dos cards editándola es la receta para un catálogo mitad en una moneda y mitad en otra. Se cambia en el entorno y se reinicia.',
    },
  ],
  settings: [
    {
      key: 'TYPESENSE_API_KEY',
      env: ['TYPESENSE_API_KEY'],
      type: 'secret',
      tier: 'runtime',
      group: 'Credenciales',
      label: 'API key de Typesense',
      required: true,
    },
    {
      key: 'TYPESENSE_ANALYTICS_API_KEY',
      env: ['TYPESENSE_ANALYTICS_API_KEY'],
      type: 'secret',
      tier: 'runtime',
      group: 'Credenciales',
      label: 'API key de analítica',
      help: 'Opcional: sin ella se usa la API key principal.',
    },
    // ─── Conexión ────────────────────────────────────────────────────────────
    {
      key: 'TYPESENSE_HOST',
      env: ['TYPESENSE_HOST'],
      type: 'string',
      tier: 'runtime',
      group: 'Conexión',
      label: 'Host',
      help: 'Host del nodo de Typesense, sin protocolo ni puerto.',
      placeholder: 'localhost',
      default: 'localhost',
      required: true,
    },
    {
      key: 'TYPESENSE_PORT',
      env: ['TYPESENSE_PORT'],
      type: 'number',
      tier: 'runtime',
      group: 'Conexión',
      label: 'Puerto',
      min: 1,
      max: 65535,
      step: 1,
      default: 8109,
      required: true,
    },
    {
      key: 'TYPESENSE_PROTOCOL',
      env: ['TYPESENSE_PROTOCOL'],
      type: 'enum',
      tier: 'runtime',
      group: 'Conexión',
      label: 'Protocolo',
      options: [
        { value: 'http', label: 'HTTP' },
        { value: 'https', label: 'HTTPS' },
      ],
      default: 'http',
      required: true,
    },

    // ─── Colecciones ─────────────────────────────────────────────────────────
    {
      key: 'TYPESENSE_COLLECTION_NAME',
      env: ['TYPESENSE_COLLECTION_NAME'],
      type: 'string',
      tier: 'runtime',
      group: 'Colecciones',
      label: 'Colección de productos',
      help: 'Cambiarla apunta la búsqueda a otra colección. Si no existe, hay que reindexar.',
      default: 'products',
      pattern: '^[A-Za-z0-9_-]+$',
      maxLength: 64,
    },
    {
      key: 'TYPESENSE_ANALYTICS_COLLECTION',
      env: ['TYPESENSE_ANALYTICS_COLLECTION'],
      type: 'string',
      tier: 'runtime',
      group: 'Colecciones',
      label: 'Colección de búsquedas populares',
      default: 'popular_queries',
      pattern: '^[A-Za-z0-9_-]+$',
      maxLength: 64,
    },

    // ─── Colecciones por tienda ──────────────────────────────────────────────
    // Los dos mapas son el ÚNICO mecanismo multitienda de Typesense: la
    // separación se hace por COLECCIÓN, no por credencial ni por scope de
    // `site_setting` (decisión 2 de EXTENSIONES-MULTITIENDA.md). Mientras estén
    // vacíos —que es el default— TODA tienda resuelve a la colección global y el
    // comportamiento es byte por byte el de antes de que existieran.
    //
    // SIN `default` a propósito: "no hay mapa" y "mapa vacío" tienen que ser el
    // mismo estado, y un `{}` como default sólo lograría que la card muestre un
    // valor heredado que no significa nada.
    {
      key: 'TYPESENSE_SITE_COLLECTIONS',
      env: ['TYPESENSE_SITE_COLLECTIONS'],
      type: 'json',
      tier: 'runtime',
      group: 'Colecciones por tienda',
      label: 'Colección de productos por tienda',
      help: 'Mapa `{"id_de_tienda": "nombre_de_coleccion"}`. Una tienda que no figure acá usa la colección de productos general. Sólo tiene sentido llenarlo si esas colecciones ya existen y se indexan: apuntar una tienda a una colección inexistente la deja sin resultados de búsqueda.',
      placeholder: '{"demo_norte": "products_norte", "demo_sur": "products_sur"}',
      refine: refineCollectionMap,
    },
    {
      key: 'TYPESENSE_SITE_ANALYTICS_COLLECTIONS',
      env: ['TYPESENSE_SITE_ANALYTICS_COLLECTIONS'],
      type: 'json',
      tier: 'runtime',
      group: 'Colecciones por tienda',
      label: 'Colección de búsquedas populares por tienda',
      help: 'El mapa equivalente para la analítica. Es SEPARADO del de productos y no se deduce de él: las búsquedas populares viven en su propia colección, así que separarlas por tienda pide su propio mapa.',
      placeholder: '{"demo_norte": "popular_queries_norte"}',
      refine: refineCollectionMap,
    },

    // ─── Mantenimiento ───────────────────────────────────────────────────────
    {
      key: 'TYPESENSE_RECONCILE_ENABLED',
      env: ['TYPESENSE_RECONCILE_ENABLED'],
      type: 'boolean',
      tier: 'runtime',
      group: 'Mantenimiento',
      label: 'Reconciliación de stock activa',
      help: 'Corrige diferencias de stock entre Medusa y el índice. La frecuencia se configura por entorno.',
      default: true,
    },
    {
      key: 'TYPESENSE_SYNC_LOG_RETENTION_DAYS',
      env: ['TYPESENSE_SYNC_LOG_RETENTION_DAYS'],
      type: 'number',
      tier: 'runtime',
      group: 'Mantenimiento',
      label: 'Retención del historial (días)',
      help: 'Los registros de sincronización más viejos que esto se borran.',
      min: 1,
      max: 365,
      step: 1,
      default: 30,
    },
  ],
});
