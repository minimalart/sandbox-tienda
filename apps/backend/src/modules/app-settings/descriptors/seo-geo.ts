import { defineSettings } from './types';

/**
 * Ajustes de SEO & GEO.
 *
 * El manifest declaraba 7 variables y el código usa 17: la auditoría de este
 * namespace agrega las 10 invisibles (los tres `schedule:`, los dos topes duros
 * de crawl, la pausa entre lotes, el batch de embeddings, los minutos de
 * huérfana, `OPENROUTER_SITE_URL` y el alias `NEXT_PUBLIC_BASE_URL`).
 * `manifest-drift.test.ts` mantiene la deriva cerrada de acá en adelante.
 *
 * NO entra `STORE_CORS`: la lee `lib/storefront-url.ts` como último recurso para
 * adivinar el origen del storefront, pero es infraestructura del core (la
 * consume `medusa-config.ts` para el CORS del backend) y no config de esta
 * extensión. Declararla acá haría que el instalador se la pidiera al cliente dos
 * veces con dos significados distintos.
 *
 * ─── POR QUÉ QUEDAN TANTAS EN `envOnly` ──────────────────────────────────────
 *
 * Este namespace no tiene NINGUNA lectura en `medusa-config.ts` ni gates de
 * registración, así que el freno no es el boot: es que 6 de sus 17 variables las
 * comparte con otras extensiones (`OPENROUTER_*`, `EMBEDDINGS_*`, `STOREFRONT_URL`).
 * Una fila en la base sólo la vería el cliente de SEO & GEO, y el de `ai-assistant`
 * y el de `catalogador` seguirían leyendo el env: dos clientes que hoy SIEMPRE
 * coinciden pasarían a poder divergir, en silencio, según qué módulo los lea.
 * Es exactamente el criterio que ya aplicaron `catalogador.ts` y `gift-cards.ts`.
 */
export default defineSettings({
  namespace: 'extension:seo-geo',
  title: 'SEO & GEO',
  /**
   * `instance`, y NO `site`, aunque `seo_geo_config` sí tenga `site_id`.
   *
   * Lo que queda acá son perillas del PROCESO —presupuesto de CPU del crawler,
   * tamaño del lote de embeddings, cuándo dar por muerta una auditoría— y las
   * lee todas el camino SINCRÓNICO (`const` de nivel superior en `crawl.ts` y en
   * los jobs), que por definición no tiene `SiteResolution`. Un `scope: 'site'`
   * acá sería una mentira doble: nunca leería la fila de la tienda y encima
   * expondría un campo por tienda que no gobierna nada. La configuración que SÍ
   * varía por tienda (motores, umbrales, modelo del simulador) ya vive en
   * `seo_geo_config`, que se edita arriba en esta misma pantalla.
   */
  defaultScope: 'instance',
  envOnly: [
    // ─── Credenciales y proveedor de IA: compartidas con otras extensiones ───
    {
      key: 'OPENROUTER_API_KEY',
      reason:
        'Credencial compartida entre catalogador, seo-geo y el asistente de IA; se gestiona en un namespace propio. Si cada extensión la declarara, dos filas distintas competirían por la misma variable y no habría forma de saber cuál gana. Mismo criterio que en el descriptor del Catalogador.',
    },
    {
      key: 'OPENROUTER_SITE_URL',
      reason:
        'Igual que la anterior: la comparten cuatro extensiones (catalogador, seo-geo, asistente de IA y landing-page). Sólo alimenta los headers HTTP-Referer/X-Title de OpenRouter.',
    },
    {
      key: 'EMBEDDINGS_API_KEY',
      reason:
        'Misma clase que OPENROUTER_API_KEY: la leen el cliente de embeddings de seo-geo y el de ai-assistant (ai/embedding-client.ts en los dos módulos), y es el fallback de OPENROUTER_API_KEY. Migrar sólo la copia de seo-geo dejaría los dos clientes autenticando contra cuentas distintas.',
    },
    {
      key: 'EMBEDDINGS_BASE_URL',
      reason:
        'Va pegada a la credencial anterior: la URL del proveedor y la key que lo autentica tienen que moverse juntas. Una en base y otra en entorno permite el estado imposible "endpoint nuevo + key vieja", que falla con un 401 sin ninguna pista.',
    },
    {
      key: 'EMBEDDINGS_MODEL',
      reason:
        'Ya se edita en dos lugares: Preferencias → IA la persiste como `ai_config.embeddings_model` (store-config/service.ts:187) y la config de SEO & GEO como `seo_geo_config.simulator.embedding_model`. Una tercera fuente de verdad para el mismo valor no se puede reconciliar. OJO: hoy `ai/embedding-client.ts` ignora las dos y lee el entorno directo — es deriva preexistente, anotada acá para que se arregle en su propio cambio.',
    },
    {
      key: 'EMBEDDINGS_DIMENSIONS',
      reason:
        'Cambiarla invalida TODOS los embeddings ya guardados: los vectores viejos y los nuevos dejan de ser comparables y el Simulador devuelve resultados al azar hasta que se reindexa el catálogo entero. No es una perilla de formulario, es una migración de datos. Además el vector store del ai-assistant tiene la dimensión fija en la columna pgvector.',
    },

    // ─── URL pública del storefront ──────────────────────────────────────────
    {
      key: 'STOREFRONT_URL',
      reason:
        'URL compartida por todo el backend (invitaciones, reset de contraseña, carritos abandonados, SEO, OAuth del MCP); se gestiona en un namespace propio. Si la declarara esta extensión, se pisaría con las otras ~15 que la usan. Mismo criterio que en el descriptor de Gift Cards.',
    },
    {
      key: 'NEXT_PUBLIC_BASE_URL',
      reason:
        'Alias de STOREFRONT_URL con menor precedencia (lib/storefront-url.ts:17): existe porque en muchos deploys el backend comparte el bloque de env con el storefront de Next. Sigue a la variable que aliasea, así que también queda por entorno.',
    },

    // ─── Topes duros del crawler: el guardia no puede vivir dentro de la caja ─
    {
      key: 'SEO_GEO_MAX_PAGES_CAP',
      reason:
        // Una oración. El incidente del 2026-07-23 y por qué el guardia no puede vivir
        // en la misma tabla que vigila están en el drawer, en "El crawler corre adentro
        // del web service" y "Subir el máximo de páginas a 500 no hace nada".
        'Tope de seguridad y no configuración: acota los valores persistidos de seo_geo_config, así que vive donde se decide el tamaño de la infraestructura.',
    },
    {
      key: 'SEO_GEO_CONCURRENCY_CAP',
      reason:
        // Se conserva lo que NO dice el drawer y no se deduce del anterior: aunque se
        // persistiera, `CRAWL_HARD_CAPS` se evalúa al cargar el módulo y no aplicaría
        // sin reiniciar.
        'Mismo caso que el anterior, y además CRAWL_HARD_CAPS se evalúa al cargar el módulo: un valor en base no tendría efecto sin reiniciar.',
    },

    // ─── Schedules: los hornea el job loader al arrancar ─────────────────────
    {
      key: 'SEO_GEO_JOB_SCHEDULE',
      reason:
        'Medusa hornea el cron al arrancar (job-loader.js:69-78): no se puede reprogramar en runtime. Para apagar las auditorías automáticas usá "Auditorías programadas" en la configuración de arriba.',
    },
    {
      key: 'SEO_GEO_SCHEDULE_CHECK',
      reason:
        'Igual que el anterior: es el cron del job que decide si toca encolar la auditoría periódica. La frecuencia de negocio (semanal/mensual) se elige en "Auditorías programadas"; esto sólo dice cada cuánto se pregunta.',
    },
    {
      key: 'SEO_GEO_EMBED_SCHEDULE',
      reason:
        'Igual que los dos anteriores: el schedule del job que embebe el catálogo se lee una sola vez al arrancar. El tamaño del lote sí se configura acá.',
    },
  ],
  settings: [
    // ─── Modelos de IA ───────────────────────────────────────────────────────
    {
      key: 'SEO_GEO_LLM_MODEL',
      env: ['SEO_GEO_LLM_MODEL'],
      type: 'string',
      tier: 'runtime',
      group: 'Modelos de IA',
      label: 'Modelo de chat (OpenRouter)',
      // Una oración. Que ÉSTE sea el que se usa de verdad y el de la config de arriba
      // no lo lea nadie es la sección "Cuál es el modelo de chat que se usa de verdad"
      // del drawer: es una relación entre dos pantallas, no una nota de este campo.
      help: 'Modelo que usan el Simulador IA y las Correcciones asistidas cuando el Catalogador no está instalado.',
      placeholder: 'openai/gpt-5-mini',
      default: 'openai/gpt-5-mini',
      maxLength: 120,
    },

    // ─── Crawler ─────────────────────────────────────────────────────────────
    {
      key: 'SEO_GEO_BATCH_PAUSE_MS',
      env: ['SEO_GEO_BATCH_PAUSE_MS'],
      type: 'number',
      tier: 'runtime',
      group: 'Crawler',
      label: 'Pausa entre lotes (ms)',
      // Una oración. El porqué —el crawl corre DENTRO del web service— y el incidente
      // del 2026-07-23 están en "El crawler corre adentro del web service" del drawer,
      // que es donde alguien que está por bajar este número los va a leer enteros.
      help: 'Cuánto cede el crawl el event loop al HTTP server entre lote y lote: bajarla acelera la auditoría a costa de latencia en el storefront.',
      min: 0,
      max: 5000,
      step: 50,
      default: 250,
    },

    // ─── Automatización ──────────────────────────────────────────────────────
    {
      key: 'SEO_GEO_STALE_MINUTES',
      env: ['SEO_GEO_STALE_MINUTES'],
      type: 'number',
      tier: 'runtime',
      group: 'Automatización',
      label: 'Minutos sin progreso para dar una auditoría por huérfana',
      // Una oración. El mecanismo completo y las dos formas de errarle están en
      // "Auditorías que quedan trabadas" del drawer.
      help: 'Pasado este tiempo sin progreso, una auditoría en curso se da por muerta y se marca como fallida.',
      min: 1,
      max: 1440,
      step: 1,
      default: 30,
    },

    // ─── Embeddings del catálogo ─────────────────────────────────────────────
    {
      key: 'SEO_GEO_EMBED_BATCH',
      env: ['SEO_GEO_EMBED_BATCH'],
      type: 'number',
      tier: 'runtime',
      group: 'Embeddings del catálogo',
      label: 'Productos por corrida del job',
      help: 'Cuántos productos embebe cada pasada del job (es incremental: saltea los que no cambiaron). Subirlo acelera la primera carga del Simulador y sube el costo por corrida en el proveedor de embeddings.',
      min: 1,
      max: 500,
      step: 1,
      default: 100,
    },
  ],
});
