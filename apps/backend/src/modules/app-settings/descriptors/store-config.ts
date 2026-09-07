import { defineSettings } from './types';

/**
 * Ajustes de Preferencias (store-config).
 *
 * El manifest declaraba `environment: []` y el código lee 13 variables — el
 * agujero que documenta `env-coverage.test.ts`: una lista vacía no la compara
 * nadie, así que el instalador nunca preguntó por ninguna de las trece.
 *
 * ─── ESTE NAMESPACE ES CASI TODO `envOnly`, Y NO ES DEUDA ───────────────────
 *
 * Doce de las trece van a `envOnly`. Antes de leerlo como una migración a medias,
 * mirá QUÉ hacen esas doce en el código: NINGUNA es el valor efectivo de nada.
 * Todas alimentan `AI_CONFIG_DEFAULTS`, que es el objeto sobre el que
 * `mergeAiConfig()` mergea la fila `store_setting.ai_config`. O sea que ya
 * estaban migradas a base — a OTRA tabla, por OTRA migración (`ai_config`, con
 * `site_id`, editable en Preferencias → IA) — y lo único que quedaba en el
 * entorno era la SEMILLA del default.
 *
 * Darles un descriptor editable habría creado un segundo formulario para el mismo
 * valor: el operador cambia el modelo en la card nueva, entra a Preferencias → IA
 * y lo ve distinto, o lo cambia ahí y pisa lo que acababa de guardar. Es
 * exactamente lo que prohíbe `shared-env-ownership.test.ts`.
 *
 * Lo que SÍ cambió, y es la mitad que importa: la semilla ya no sale de
 * `process.env` sino del NAMESPACE DEL ASISTENTE IA, resuelto por
 * `app-settings/foreign.ts`. Cargar `CHAT_AI_MODEL` en la card del asistente
 * ahora mueve también el default de `ai_config`, que antes se quedaba pegado al
 * entorno del arranque. Los `reason` de abajo nombran al dueño uno por uno.
 *
 * ─── LOS CINCO `AI_MEMORY_*` Y `CHAT_AI_VALIDATION` SON OTRO CASO ───────────
 *
 * A esos seis no los lee NADIE más que este módulo: no hay dueño en otro
 * namespace al que apuntar, y darles descriptor acá sería el segundo formulario
 * del párrafo anterior. Quedan `envOnly` apuntando a `ai_config`, que es donde se
 * editan de verdad y encima por tienda. La diferencia con los `CHAT_AI_*` no es
 * arbitraria: aquellos SÍ tienen otro lector vivo (`ai/chat-client.ts`), estos no.
 */
export default defineSettings({
  namespace: 'extension:store-config',
  title: 'Preferencias',
  /**
   * `instance`. Lo único editable de este namespace lo lee un script one-shot que
   * corre por `medusa exec`, sin request y por lo tanto sin `SiteResolution`:
   * `resolveSettingSync` lo resolvería con `SiteKind = 'none'` igual. Marcarlo
   * `site` no leería nunca la fila de la tienda y dejaría a las secundarias en
   * fail-closed, o sea con el nombre del canal vacío.
   *
   * OJO: esto NO dice que Preferencias sea de instancia. La configuración por
   * tienda de esta pantalla vive en `store_setting`, que tiene su propio `site_id`
   * y su propia precedencia (`readSetting`); es otro sistema, anterior a
   * `app-settings`, y sigue funcionando igual.
   */
  defaultScope: 'instance',
  envOnly: [
    // ─── Modelos y parámetros del chat: los edita el Asistente IA ────────────
    {
      key: 'CHAT_AI_MODEL',
      reason:
        'La gestiona la card del Asistente IA (Configuración → Chat del asistente); acá se lee el MISMO valor por `app-settings/foreign.ts`, no el entorno. Sirve sólo como default de `ai_config.chat_model`, que es lo que se edita en Preferencias → IA y lo que gana por tienda.',
    },
    {
      key: 'CHAT_AI_MAX_TOKENS',
      reason:
        'Igual que CHAT_AI_MODEL: la edita el Asistente IA y acá se lee el mismo valor como default de `ai_config.chat_max_tokens`. El presupuesto efectivo de cada turno sale de `ai_config`, que se edita en Preferencias → IA.',
    },
    {
      key: 'CHAT_AI_REASONING_EFFORT',
      reason:
        'Igual que las dos anteriores: la edita el Asistente IA y acá alimenta el default de `ai_config.chat_reasoning_effort`. Un solo lugar donde se elige cuánto piensa el modelo.',
    },
    {
      key: 'EMBEDDINGS_MODEL',
      reason:
        'La gestiona la card del Asistente IA (Configuración → Embeddings), que es donde vive el cliente que la usa de verdad; acá se lee el mismo valor como default de `ai_config.embeddings_model`. Ese campo de Preferencias → IA hoy no gobierna la llamada real — es deriva anterior a esta migración, anotada en el descriptor del asistente.',
    },
    {
      key: 'OPENROUTER_MODEL',
      reason:
        'La gestiona la card de Landings con IA (Generación de texto → Modelo de texto), que es la extensión que la usa de verdad; acá se lee el mismo valor como default de `ai_config.text_model`. Pese al prefijo NO es del Asistente IA: el asistente usa CHAT_AI_MODEL y no lee esta nunca.',
    },
    {
      key: 'LANDING_AI_MAX_RETRIES',
      reason:
        'La gestiona la card de Landings con IA (Generación de texto → Reintentos ante JSON inválido); acá se lee el mismo valor como default de `ai_config.text_max_retries`. El generador la resuelve por argumento desde `ai_config` cuando la ruta la pasa.',
    },

    // ─── Memoria y validación: se editan en Preferencias → IA, no acá ────────
    // Estas seis no las lee ningún otro módulo. No hay dueño externo al que
    // apuntar: el valor efectivo YA está en base, en `ai_config`, con `site_id`.
    {
      key: 'AI_MEMORY_ENABLED',
      reason:
        'Semilla del default de `ai_config.memory_enabled`. El interruptor efectivo se edita en Preferencias → IA y es POR TIENDA; un descriptor acá sería un segundo campo para el mismo valor, que es justo lo que prohíbe shared-env-ownership.test.ts. Queda en el entorno para poder arrancar una instalación nueva con la memoria ya prendida.',
    },
    {
      key: 'AI_MEMORY_AUTOCAPTURE',
      reason:
        'Mismo caso: semilla del default de `ai_config.memory_autocapture_enabled`, que decide si el agente recibe la tool `remember`. Se edita en Preferencias → IA, por tienda.',
    },
    {
      key: 'AI_MEMORY_AUTOCAPTURE_APPROVAL',
      reason:
        'Semilla del default de `ai_config.memory_autocapture_requires_approval`. OJO con la polaridad: es la ÚNICA de las cinco que arranca en `true` — sólo un `"false"` explícito la apaga, para que una memoria auto-capturada no entre como aprobada por descuido. Se edita en Preferencias → IA.',
    },
    {
      key: 'AI_MEMORY_TOPK',
      reason:
        'Semilla del default de `ai_config.memory_retrieval_topk` (cuántas memorias se inyectan al prompt por turno). Se edita en Preferencias → IA, por tienda, con el rango 1-20 aplicado en el merge.',
    },
    {
      key: 'AI_MEMORY_MIN_SIMILARITY',
      reason:
        'Semilla del default de `ai_config.memory_min_similarity` (umbral de similitud coseno). Se edita en Preferencias → IA. Muy bajo, el asistente arrastra memoria irrelevante a cada turno; muy alto, no recupera nada.',
    },
    {
      key: 'CHAT_AI_VALIDATION',
      reason:
        'Semilla del default de `ai_config.chat_validation_enabled`, la validación de grounding que revisa la respuesta contra los datos leídos. Se edita en Preferencias → IA. No la lee ningún otro módulo, así que no hay dueño externo: el formulario que la gobierna es el de esa pantalla.',
    },
  ],
  settings: [
    // ─── Venta presencial ────────────────────────────────────────────────────
    {
      key: 'IN_PERSON_SC_NAME',
      env: ['IN_PERSON_SC_NAME'],
      type: 'string',
      tier: 'runtime',
      group: 'Venta presencial',
      label: 'Nombre del canal de venta presencial',
      // Una oración. Que guardar no renombre nada, y que editarlo DESPUÉS de correr el
      // script cree un canal nuevo en vez de actualizar el viejo, es la sección "El
      // nombre del canal presencial no renombra nada" del drawer de Preferencias. Es
      // el gotcha más caro de la pestaña y estaba en el `help` de un campo, o sea en
      // el único lugar donde nadie lo busca.
      help: 'Con qué nombre busca (y si no existe, crea) el sales channel del escáner de códigos el script `setup-in-person-sales-channel.ts`.',
      placeholder: 'Presencial supermercado',
      default: 'Presencial supermercado',
      maxLength: 128,
    },
  ],
});
