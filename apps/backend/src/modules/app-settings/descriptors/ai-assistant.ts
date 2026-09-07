import { defineSettings } from './types';

/** Runtime settings. Account fields are edited in Settings > Integrations.
 * Shared providers retain their persisted namespace for compatibility. */
export default defineSettings({
  namespace: 'extension:ai-assistant',
  title: 'Asistente IA',
  /**
   * Todos los consumidores de este namespace son SINCRÓNICOS y sin request:
   * `ai/chat-client.ts` y `ai/embedding-client.ts` se llaman desde adentro de un
   * `fetch` ya armado, el middleware de `/mcp` corre en el camino caliente, y los
   * dos jobs (`generate-proposals`, `embed-pending-memories`) no tienen tienda de
   * dónde agarrarse. `resolveSettingSync` resuelve con `SiteKind = 'none'`, así
   * que un `scope: 'site'` acá sería una mentira doble: nunca leería la fila de la
   * tienda y encima expondría un campo por tienda que no gobierna nada — y las
   * secundarias quedarían en fail-closed, o sea con el asistente apagado y sin
   * ningún error visible. El cartel largo está en `resolve.ts:resolveSettingSync`.
   *
   * Lo que SÍ varía por tienda —qué modelo usa el chat de ESA tienda, si su
   * memoria está prendida— ya vive en `store_setting.ai_config`, que tiene
   * `site_id` y se edita en Preferencias → IA. Estos descriptores son la capa de
   * INSTANCIA: el default sobre el que `mergeAiConfig` mergea, y el valor que usan
   * los call sites que no resuelven `store-config`.
   */
  defaultScope: 'instance',
  envOnly: [
    // ─── Muertas: las declara el manifest y no las lee nadie ─────────────────
    {
      key: 'OPENAI_API_KEY',
      reason:
        'No la lee ningún archivo del repo: no hay dependencia de `openai` ni de `@ai-sdk/openai`, y todos los modelos salen por OpenRouter (OPENROUTER_API_KEY, que sí se edita en la sección "Proveedor de IA" de esta misma card). Queda declarada sólo para no romper el contrato del manifest; el paso siguiente es sacarla del environment[].',
    },
    {
      key: 'MCP_MEDUSA_URL',
      reason:
        'Tampoco la lee ningún archivo: la URL del conector MCP se arma en el navegador desde el origen del admin (pestaña Configuración → Conectar clientes), no desde el entorno del backend. Mismo caso que OPENAI_API_KEY.',
    },

    // ─── Schedules: los hornea el job loader al arrancar ─────────────────────
    {
      key: 'AI_PROPOSALS_CRON',
      reason:
        'Es el `schedule:` del job de Propuestas. Medusa lo hornea al arrancar (job-loader.js:69-78), leyendo el módulo del job ANTES de que exista la conexión a la base: una fila en `site_setting` no llegaría a tiempo, y tampoco podría reprogramar el cron después. Lo que sí se configura acá es cuánto analiza cada corrida ("Propuestas por corrida") y con qué motor.',
    },
    {
      key: 'AI_MEMORY_EMBED_CRON',
      reason:
        'Igual que el anterior: es el `schedule:` del job que embebe las memorias pendientes y se lee una sola vez al arrancar. El interruptor de la memoria no está acá sino en Preferencias → IA (`ai_config.memory_enabled`), y el job lo evalúa DENTRO de su cuerpo, así que apagarla sí tiene efecto en la corrida siguiente.',
    },

    // ─── Migración de datos disfrazada de perilla ────────────────────────────
    {
      key: 'EMBEDDINGS_DIMENSIONS',
      reason:
        'NO es configuración: es el ancho del vector. La columna de la memoria es `vector(1536)` fija en la migración, así que cambiarla desde un formulario deja al insert tirando o —peor— convive con los vectores viejos y la búsqueda por similitud empieza a devolver resultados al azar, sin ningún error. Cambiar de dimensión es una migración de la columna más reindexar todo, no guardar una card. Mismo criterio que en el descriptor de SEO & GEO. El MODELO sí se edita acá porque tiene camino de vuelta: `jobs/embed-pending-memories.ts` re-embebe las filas que quedaron con un `embedding_model` viejo.',
    },

    // ─── Infraestructura de la instalación: no son de nadie ──────────────────
    {
      key: 'MEDUSA_BACKEND_URL',
      reason:
        'URL pública del propio backend, no configuración de esta extensión: la comparten el subscriber de invitaciones, la ruta que las acepta y el fetch de imágenes del agente, con `BACKEND_URL` (que es del core) ganándole en dos de los tres. Es un dato de la INSTALACIÓN y se decide en el deploy, donde se decide el dominio. OJO: es la misma URL que MEDUSA_BASE_URL con otro nombre — ver la nota de esa entrada.',
    },
    {
      key: 'MEDUSA_BASE_URL',
      reason:
        'ALIAS DE HECHO de MEDUSA_BACKEND_URL, no una variable distinta: las dos son "la URL base de este backend" y ninguna cae en la otra. Esta la usan las tools del MCP (`api/mcp/_loader.ts`, que las lee del entorno al ejecutarse porque viven en el paquete `mcp-medusa`) y `ai-assistant/oauth.ts`. Que sean dos nombres es deuda, no diseño: un deploy que setee una sola deja al otro grupo de consumidores en `http://localhost:9000`. Unificarlas es un cambio de comportamiento y va aparte; mientras tanto se setean las dos, en el deploy.',
    },
    {
      key: 'NEXT_PUBLIC_BASE_URL',
      reason:
        'URL pública del STOREFRONT (alias de menor precedencia de STOREFRONT_URL), no de este backend. La lee `ai/native-tools/whatsapp-tools.ts` para armar los links que manda el asistente, y otras ~15 partes del repo hacen lo mismo. El prefijo `NEXT_PUBLIC_` no es decorativo: Next la hornea EN EL BUILD del storefront, así que el valor efectivo se fija al compilar el front y una fila en la base no lo movería. Se decide en el deploy, para los dos apps a la vez.',
    },
  ],
  settings: [
    // ─── Proveedor de IA ─────────────────────────────────────────────────────
    // La credencial que comparten el chat, los embeddings, el Catalogador, SEO &
    // GEO y el generador de landings. Ver el pendiente del encabezado.
    {
      key: 'OPENROUTER_API_KEY',
      env: ['OPENROUTER_API_KEY'],
      type: 'secret',
      tier: 'runtime',
      group: 'Proveedor de IA',
      label: 'API key de OpenRouter',
      help: 'Cuenta compartida por el Asistente IA, el Catalogador, SEO y la generación de landings.',
      required: true,
    },
    {
      key: 'OPENROUTER_SITE_URL',
      env: ['OPENROUTER_SITE_URL'],
      type: 'url',
      tier: 'runtime',
      group: 'Proveedor de IA',
      label: 'URL de atribución (HTTP-Referer)',
      help: 'Sólo alimenta los headers `HTTP-Referer` / `X-Title` con los que OpenRouter atribuye el consumo en su dashboard. No cambia nada del comportamiento del modelo; sirve para saber qué instalación gastó qué.',
      placeholder: 'https://mi-tienda.com',
      default: 'https://mercatto.minimalart.studio',
      maxLength: 200,
    },

    // ─── Chat del asistente ──────────────────────────────────────────────────
    // Capa de INSTANCIA. La de tienda es `ai_config.chat_*` (Preferencias → IA),
    // que mergea SOBRE estos valores y le gana a cada call site que la resuelve.
    {
      key: 'CHAT_AI_MODEL',
      env: ['CHAT_AI_MODEL'],
      type: 'string',
      tier: 'runtime',
      group: 'Chat del asistente',
      label: 'Modelo del chat',
      help: 'Identificador de OpenRouter (`proveedor/modelo`). Es el valor por defecto de la instancia: Preferencias → IA lo pisa por tienda, y este es el que usan los call sites que no resuelven store-config (validación de grounding, subagentes, análisis headless).',
      placeholder: 'openai/gpt-5-mini',
      default: 'openai/gpt-5-mini',
      maxLength: 120,
    },
    {
      key: 'CHAT_AI_MAX_TOKENS',
      env: ['CHAT_AI_MAX_TOKENS'],
      type: 'number',
      tier: 'runtime',
      group: 'Chat del asistente',
      label: 'Tokens de salida por turno',
      help: 'Los modelos de razonamiento (gpt-5*, o*) gastan "reasoning tokens" contra este mismo presupuesto. Con el valor muy bajo el modelo se queda sin aire razonando y devuelve una respuesta VACÍA con `finish_reason: length`, que en el chat se ve como "No pude generar una respuesta" — no como un error de configuración. Si aparece eso, subilo antes que ninguna otra cosa.',
      min: 500,
      max: 32000,
      step: 100,
      default: 6000,
    },
    {
      key: 'CHAT_AI_REASONING_EFFORT',
      env: ['CHAT_AI_REASONING_EFFORT'],
      type: 'enum',
      tier: 'runtime',
      group: 'Chat del asistente',
      label: 'Esfuerzo de razonamiento',
      help: 'Cuánto piensa el modelo antes de responder. Más esfuerzo = mejores respuestas en preguntas de análisis, más latencia y más tokens comidos del presupuesto de arriba. OpenRouter lo ignora en los modelos que no razonan (gpt-4.1-mini, gpt-4o-mini), así que es seguro dejarlo puesto.',
      options: [
        { value: 'minimal', label: 'Mínimo' },
        { value: 'low', label: 'Bajo' },
        { value: 'medium', label: 'Medio' },
        { value: 'high', label: 'Alto' },
      ],
      default: 'low',
    },

    // ─── Embeddings ──────────────────────────────────────────────────────────
    // La DIMENSIÓN no está acá: es `envOnly` y arriba está el motivo.
    {
      key: 'EMBEDDINGS_API_KEY',
      env: ['EMBEDDINGS_API_KEY'],
      type: 'secret',
      tier: 'runtime',
      group: 'Embeddings',
      label: 'API key del proveedor de embeddings',
      help: 'Opcional: vacía, se usa la API key de OpenRouter de arriba. Sólo hace falta si apuntás los embeddings a otro proveedor (OpenAI directo, un endpoint propio compatible) con la URL base de abajo. La clave y la URL se mueven JUNTAS: una en base y otra en entorno permite el estado imposible "endpoint nuevo + key vieja", que falla con un 401 sin ninguna pista.',
    },
    {
      key: 'EMBEDDINGS_BASE_URL',
      env: ['EMBEDDINGS_BASE_URL'],
      type: 'url',
      tier: 'runtime',
      group: 'Embeddings',
      label: 'URL base del proveedor de embeddings',
      help: 'Sin `/embeddings` al final: se le agrega solo. Sirve cualquier endpoint compatible con la API de OpenAI.',
      placeholder: 'https://openrouter.ai/api/v1',
      default: 'https://openrouter.ai/api/v1',
      maxLength: 200,
    },
    {
      key: 'EMBEDDINGS_MODEL',
      env: ['EMBEDDINGS_MODEL'],
      type: 'string',
      tier: 'runtime',
      group: 'Embeddings',
      label: 'Modelo de embeddings',
      help: 'OJO: tiene que devolver vectores de la MISMA dimensión que la columna (1536). Un modelo de otra dimensión —`-3-large` da 3072— lo corta el guard del cliente con un 500 explícito, no lo escribe roto. Cambiar de modelo DENTRO de la misma dimensión sí es seguro: `jobs/embed-pending-memories.ts` re-embebe sólo las filas que quedaron con el modelo viejo, así que la memoria converge sola en unas corridas. Los campos "modelo de embeddings" de Preferencias → IA y de SEO & GEO no gobiernan esta llamada: este es el que se usa de verdad.',
      placeholder: 'openai/text-embedding-3-small',
      default: 'openai/text-embedding-3-small',
      maxLength: 120,
    },

    // ─── Propuestas proactivas ───────────────────────────────────────────────
    // Las cinco eran `const` de nivel superior leídas de `process.env` al cargar
    // el módulo: invisibles para el instalador y no configurables sin redeploy.
    // Ahora se leen DENTRO del cuerpo del job y del motor, que es lo que hace que
    // guardar acá tenga efecto en la corrida siguiente sin reiniciar.
    {
      key: 'AI_PROPOSALS_ENGINE',
      env: ['AI_PROPOSALS_ENGINE'],
      type: 'enum',
      tier: 'runtime',
      group: 'Propuestas proactivas',
      label: 'Motor de análisis',
      help: '"Especialistas" hace un triage y después manda un agente por cada frente detectado; "Simple" hace fan-out a todos los agentes de propuestas. Especialistas gasta menos y apunta mejor, pero si el triage no encuentra ningún lead se cae solo al modo simple. Forzar "Simple" sirve para diagnosticar cuando las propuestas dejaron de salir.',
      options: [
        { value: 'specialists', label: 'Especialistas (triage + expertos)' },
        { value: 'simple', label: 'Simple (todos los agentes)' },
      ],
      default: 'specialists',
    },
    {
      key: 'AI_PROPOSALS_LIMIT',
      env: ['AI_PROPOSALS_LIMIT'],
      type: 'number',
      tier: 'runtime',
      group: 'Propuestas proactivas',
      label: 'Propuestas por corrida',
      help: 'Cuántos leads pide el triage y cuántas propuestas se le piden a cada agente. Es el tope de lo que un humano va a tener que revisar cada mañana: el job NO acumula, si quedan propuestas pendientes la corrida siguiente se saltea entera.',
      min: 1,
      max: 20,
      step: 1,
      default: 3,
    },
    {
      key: 'AI_PROPOSALS_SPECIALIST_STEPS',
      env: ['AI_PROPOSALS_SPECIALIST_STEPS'],
      type: 'number',
      tier: 'runtime',
      group: 'Propuestas proactivas',
      label: 'Pasos por especialista',
      help: 'Cuántas vueltas de tool-calling puede dar cada especialista antes de tener que concluir. Bajo, el especialista se queda sin datos y propone en el aire; alto, cada corrida cuesta más tokens y tarda más. Aplica sólo al motor "Especialistas".',
      min: 1,
      max: 40,
      step: 1,
      default: 6,
    },
    {
      key: 'AI_PROPOSALS_MAX_STEPS',
      env: ['AI_PROPOSALS_MAX_STEPS'],
      type: 'number',
      tier: 'runtime',
      group: 'Propuestas proactivas',
      label: 'Pasos por agente (motor simple)',
      help: 'El equivalente del anterior para el motor "Simple", donde cada agente analiza su frente completo y por eso necesita más vueltas. Es también el que se usa cuando el triage no encontró leads y el motor se cayó a simple.',
      min: 1,
      max: 40,
      step: 1,
      default: 12,
    },
    {
      key: 'AI_PROPOSALS_AGENT',
      env: ['AI_PROPOSALS_AGENT'],
      type: 'string',
      tier: 'runtime',
      group: 'Propuestas proactivas',
      label: 'Correr un solo agente (diagnóstico)',
      help: 'Vacío = comportamiento normal. Con la clave de un agente (`ventas`, `catalogo`, `redactor`…) se saltea el triage y se corre SÓLO ese, que es como se reproduce a mano lo que hace el cron. Dejarlo puesto apaga el motor de especialistas sin decirlo: es una perilla de diagnóstico, no de operación.',
      placeholder: 'ventas',
      pattern: '^[a-z0-9_-]+$',
      maxLength: 64,
    },

    // ─── Servidor MCP ────────────────────────────────────────────────────────
    {
      key: 'MCP_AUTH_TOKEN',
      env: ['MCP_AUTH_TOKEN'],
      type: 'secret',
      tier: 'runtime',
      group: 'Servidor MCP',
      label: 'Token de acceso de compatibilidad',
      help: 'Fallback opcional del endpoint /mcp (api/mcp/middlewares.ts:106). Lo normal es usar las API keys gestionadas de la pestaña Configuración, que se revocan una por una; esto es un único token compartido que existe por compatibilidad. Si no hace falta, dejalo vacío.',
    },
    {
      key: 'MCP_OAUTH_REDIRECT_BASE',
      env: ['MCP_OAUTH_REDIRECT_BASE'],
      type: 'url',
      tier: 'runtime',
      group: 'Servidor MCP',
      label: 'Base pública del callback OAuth',
      help: 'Origen público del backend, alcanzable por el navegador; se le agrega /mcp-oauth/callback. Opcional: sin esto se cae a MEDUSA_BACKEND_URL / BACKEND_URL / MEDUSA_BASE_URL y, en última instancia, a los headers x-forwarded-*. Sólo hace falta cuando el proxy no los propaga bien.',
      placeholder: 'https://admin.tutienda.com',
    },
  ],
});
