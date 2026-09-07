import { defineSettings } from './types';

/**
 * Ajustes del Catalogador.
 *
 * El manifest declaraba 8 variables; el código lee 9 (`OPENROUTER_SITE_URL` no
 * estaba declarada — misma clase de deriva que corrigió la auditoría de
 * Typesense). Las 9 quedan cubiertas acá entre `settings` y `envOnly`, y
 * `manifest-drift.test.ts` mantiene la deriva cerrada de acá en adelante.
 *
 * Nota sobre precedencia con la config del Catalogador: los dos modelos también
 * se pueden editar desde "Configuración del Catalogador" (se persiste como el
 * setting `catalogador_config` en store-config). Esa config gana, porque lo de
 * acá alimenta sus DEFAULTS. O sea, la cadena completa es
 * `catalogador_config > site_setting > env > default`.
 */
export default defineSettings({
  namespace: 'extension:catalogador',
  title: 'Catalogador',
  /**
   * main pasó su config a `store_setting` con `site_id` (`readSetting(key, siteId)`),
   * así que el catálogo de cada tienda se cataloga con sus propios parámetros.
   */
  defaultScope: 'site',
  envOnly: [
    {
      key: 'OPENROUTER_API_KEY',
      reason:
        'Credencial compartida entre catalogador, seo-geo y el asistente de IA; se gestiona en un namespace propio. Si cada extensión la declarara, dos filas distintas competirían por la misma variable y no habría forma de saber cuál gana.',
    },
    {
      key: 'OPENROUTER_SITE_URL',
      reason:
        'Igual que la anterior: la comparten cuatro extensiones (catalogador, seo-geo, asistente de IA y landing-page). Sólo alimenta los headers HTTP-Referer/X-Title de OpenRouter.',
    },
    {
      key: 'CATALOGADOR_JOB_SCHEDULE',
      reason:
        'Medusa hornea el schedule al arrancar (job-loader.js:69-78): no se puede reprogramar en runtime. Cambiarlo requiere redeploy.',
    },
  ],
  settings: [
    // ─── Modelos de IA ───────────────────────────────────────────────────────
    {
      key: 'CATALOGADOR_TEXT_MODEL',
      env: ['CATALOGADOR_TEXT_MODEL'],
      type: 'string',
      tier: 'runtime',
      group: 'Modelos de IA',
      label: 'Modelo de texto/visión',
      // Una oración. Que sea el DEFAULT —lo pisa la pantalla de configuración del
      // Catalogador— es la regla de precedencia de la extensión entera, no de este
      // campo: vive en la sección "Cuál de las dos configuraciones gana" del drawer.
      help: 'Modelo multimodal de OpenRouter que analiza el producto y su imagen para proponer título, descripción y SEO.',
      placeholder: 'google/gemini-2.5-flash',
      default: 'google/gemini-2.5-flash',
      maxLength: 120,
      required: true,
    },
    {
      key: 'CATALOGADOR_IMAGE_MODEL',
      env: ['CATALOGADOR_IMAGE_MODEL'],
      type: 'string',
      tier: 'runtime',
      group: 'Modelos de IA',
      label: 'Modelo de imagen',
      help: 'Modelo de generación/recreación de imágenes (nano-banana).',
      placeholder: 'google/gemini-2.5-flash-image',
      default: 'google/gemini-2.5-flash-image',
      maxLength: 120,
      required: true,
    },

    // ─── Barcode ─────────────────────────────────────────────────────────────
    {
      key: 'CATALOGADOR_BARCODE_API_URL',
      env: ['CATALOGADOR_BARCODE_API_URL'],
      type: 'url',
      tier: 'runtime',
      group: 'Barcode',
      label: 'Endpoint del proveedor',
      // El modo de falla —la misma ficha repetida en todo el catálogo— está en el
      // drawer ("El enriquecimiento externo falla callado") y, sobre todo, lo ataja el
      // `refine` de abajo, que no deja guardar la URL sin el marcador.
      help: 'URL del proveedor de datos por código de barras, con {code} donde va el EAN/UPC.',
      placeholder: 'https://api.proveedor.com/v1/product/{code}',
      // Sin `{code}` la misma URL se consultaría para todos los productos y
      // devolvería siempre lo mismo — falla en silencio, no con un error.
      refine: (value) =>
        typeof value === 'string' && value.includes('{code}')
          ? null
          : 'Tiene que incluir el placeholder {code}.',
    },
    {
      key: 'CATALOGADOR_BARCODE_API_KEY',
      env: ['CATALOGADOR_BARCODE_API_KEY'],
      type: 'secret',
      tier: 'runtime',
      group: 'Barcode',
      label: 'API key del proveedor',
      help: 'Opcional: se manda como Bearer. Si el proveedor es público, dejala vacía.',
    },

    // ─── Scraping web ────────────────────────────────────────────────────────
    {
      key: 'CATALOGADOR_TAVILY_API_KEY',
      env: ['CATALOGADOR_TAVILY_API_KEY'],
      type: 'secret',
      tier: 'runtime',
      group: 'Scraping web',
      label: 'API key de Tavily',
      help: 'Necesaria cuando el proveedor de scraping es "tavily" (el recomendado).',
    },
    {
      key: 'CATALOGADOR_SCRAPE_SEARCH_TEMPLATE',
      env: ['CATALOGADOR_SCRAPE_SEARCH_TEMPLATE'],
      type: 'url',
      tier: 'runtime',
      group: 'Scraping web',
      label: 'Template de búsqueda (proveedor "http")',
      help: 'Sólo aplica con el proveedor "http": {query} se reemplaza por la búsqueda y {domain} por cada dominio permitido.',
      placeholder: 'https://{domain}/search?q={query}',
      // `{domain}` es opcional a propósito (hay templates con el buscador fijo y
      // el dominio dentro del query), pero sin `{query}` el fetch es constante.
      refine: (value) =>
        typeof value === 'string' && value.includes('{query}')
          ? null
          : 'Tiene que incluir el placeholder {query}.',
    },
  ],
});
