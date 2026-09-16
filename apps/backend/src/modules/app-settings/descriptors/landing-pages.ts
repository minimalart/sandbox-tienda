import { defineSettings } from './types';

/**
 * Ajustes del generador de Landings con IA.
 *
 * El manifest declaraba `environment: []` y el código lee 4 variables: es el
 * agujero que documenta `env-coverage.test.ts` —un manifest vacío no lo compara
 * nadie, así que el instalador de `apps/platform` nunca le pidió al cliente la
 * API key sin la cual el botón "Generar con IA" devuelve 503.
 *
 * ─── LAS CUATRO, Y QUIÉN EDITA CADA UNA ─────────────────────────────────────
 *
 * Dos son propias y se editan acá (`OPENROUTER_MODEL`, `LANDING_AI_MAX_RETRIES`);
 * las otras dos son la credencial y la atribución de OpenRouter, compartidas con
 * el Asistente IA, el Catalogador y SEO & GEO. Esas van en `envOnly` porque la
 * regla es que una variable la EDITE UN SOLO namespace: cuatro cards con un campo
 * "API key de OpenRouter" son cuatro filas distintas compitiendo por el mismo
 * valor, y no hay forma de saber cuál gana.
 *
 * `envOnly` acá NO significa "se lee del entorno". `ai/client.ts` e
 * `ai/image-client.ts` resuelven el descriptor del Asistente IA por namespace con
 * `app-settings/foreign.ts`, así que ven EL MISMO valor efectivo que la card que
 * lo edita. Y si el proyecto se generó sin el Asistente IA, `findDescriptor()`
 * devuelve `null` y se cae a `process.env` igual que siempre. El detalle está en
 * el encabezado de `foreign.ts`.
 *
 * ─── POR QUÉ `OPENROUTER_MODEL` LO EDITA ESTE NAMESPACE Y NO EL ASISTENTE ───
 *
 * Por el nombre parece de OpenRouter, pero no lo es: es el modelo de TEXTO del
 * generador de landings y de banners (`ai/client.ts:23`, y de ahí
 * `banner/ai/generator.ts`). El Asistente IA no lo lee nunca — usa
 * `CHAT_AI_MODEL`. El único otro lector es `store-config`, que lo usa para
 * sembrar el default de `ai_config.text_model`, y lo declara en `envOnly`
 * apuntando acá. El prefijo es deuda de nombres, no propiedad compartida.
 */
export default defineSettings({
  namespace: 'extension:landing-pages',
  title: 'Landings con IA',
  /**
   * `instance`, aunque las landings sí sean por tienda.
   *
   * Los dos consumidores son `getAiConfig()` en `ai/client.ts`, que corre dentro
   * de un `fetch` ya armado y sin request de dónde sacar la tienda, y el
   * generador de banners, que lo llama igual. `resolveSettingSync` resuelve esos
   * casos con `SiteKind = 'none'`, así que un `scope: 'site'` no leería nunca la
   * fila de la tienda y encima dejaría a las secundarias en fail-closed —
   * apagando el generador en la tienda B sin ningún error visible.
   *
   * La personalización por tienda de estos dos valores YA EXISTE por otro camino:
   * `ai_config.text_model` y `ai_config.text_max_retries` tienen `site_id`, se
   * editan en Preferencias → IA y las rutas de admin se los pasan al generador
   * por argumento (`generator.ts:57`: `aiConfig?.maxRetries ?? getAiConfig()`).
   * Lo de acá es la capa de instancia, o sea el valor que se usa cuando nadie
   * resolvió `store-config`.
   */
  defaultScope: 'instance',
  envOnly: [
    { key: 'TYPESENSE_SITE_COLLECTIONS', reason: 'Se configura en Búsqueda → Typesense; las landings reutilizan ese mapa para validar resultados de cada tienda.' },
    {
      key: 'OPENROUTER_API_KEY',
      /**
       * UNA oración, y se queda la que dice A DÓNDE IR: la ruta exacta del panel que
       * sí la edita no se deduce parado frente a este bloque de sólo lectura. El
       * porqué —una credencial compartida por cuatro extensiones, cuatro filas
       * compitiendo si cada una la declarara— está en el encabezado de este archivo y
       * en la sección "Sin credencial, el botón de IA devuelve un error de servicio".
       */
      reason:
        'La gestiona la card del Asistente IA (Asistente IA → Configuración → Proveedor de IA); acá se lee el MISMO valor por `app-settings/foreign.ts`, no el entorno.',
    },
    {
      key: 'OPENROUTER_SITE_URL',
      /** UNA oración: lo que hace y quién la edita, que es todo lo que decide algo. */
      reason:
        'La edita el Asistente IA igual que la anterior, y sólo alimenta los headers `HTTP-Referer` / `X-Title` con los que OpenRouter atribuye el consumo.',
    },
  ],
  settings: [
    // ─── Generación de texto ─────────────────────────────────────────────────
    {
      key: 'OPENROUTER_MODEL',
      env: ['OPENROUTER_MODEL'],
      type: 'string',
      tier: 'runtime',
      group: 'Generación de texto',
      label: 'Modelo de texto',
      /**
       * UNA oración, y se queda la RESTRICCIÓN del valor: qué modelo sirve acá no se
       * deduce del nombre, y elegir uno que no respete `response_format: json_object`
       * gasta los reintentos y falla sin decir por qué. Que no es el modelo del chat
       * es la sección "El modelo de texto no es el del chat" del drawer.
       */
      help: 'Identificador de OpenRouter (`proveedor/modelo`) para generar la estructura de la landing y el copy de los banners; tiene que respetar `response_format: json_object`.',
      placeholder: 'openai/gpt-4.1-mini',
      default: 'openai/gpt-4.1-mini',
      maxLength: 120,
    },
    {
      key: 'LANDING_AI_MAX_RETRIES',
      env: ['LANDING_AI_MAX_RETRIES'],
      type: 'number',
      tier: 'runtime',
      group: 'Generación de texto',
      label: 'Reintentos ante JSON inválido',
      /**
       * UNA oración. Que cada reintento es una llamada completa al proveedor —y por
       * eso el tope de 5— es la sección "Los reintentos son caros" del drawer; el
       * `min`/`max` del campo ya acota el rango sin necesidad de explicarlo.
       */
      help: 'Cuántas veces se le vuelve a pedir al modelo cuando la respuesta no parsea como JSON.',
      min: 0,
      max: 5,
      step: 1,
      default: 2,
    },
  ],
});
