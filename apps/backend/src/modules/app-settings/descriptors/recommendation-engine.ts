import { defineSettings } from './types';

/**
 * Ajustes del motor de recomendaciones.
 *
 * El manifest declaraba `environment: []` y el código usa 20 variables. No es
 * deriva de a poco como en Andreani: acá NUNCA se declaró ninguna, así que las 20
 * fueron invisibles para el instalador desde el día uno. `manifest-drift.test.ts`
 * ni siquiera lo veía —saltea los manifests sin `environment`—, y por eso existe
 * `env-coverage.test.ts`: este namespace es el caso que lo motivó.
 *
 * CUATRO DECISIONES QUE NO SON OBVIAS, y que hay que respetar al editar esto:
 *
 * 1. LOS CUATRO CRON VAN A `envOnly`. `job-loader.js:69-78` hornea el `schedule`
 *    al evaluar el archivo del job, antes de que exista el contenedor y por lo
 *    tanto antes de que exista la base. Un valor en `site_setting` no se podría
 *    aplicar sin reiniciar, y una perilla que miente es peor que no tener perilla.
 *    Lo que SÍ se gestiona son los kill switches y las ventanas, porque se evalúan
 *    DENTRO del cuerpo del job, en cada tick, con la base ya disponible.
 *
 * 2. LOS CUATRO `*_CAP` TAMBIÉN VAN A `envOnly`, y por una razón distinta: son los
 *    topes que acotan valores que el merchant YA edita desde
 *    `/recomendaciones/configuracion` (`default_result_limit`,
 *    `default_candidate_limit`, `max_basket_size`). Se aplican en
 *    `mergeRecommendationsConfig` / `mergeStrategyConfig`, el embudo por el que
 *    pasa toda config efectiva, y existen por el incidente del 2026-07-23: el motor
 *    corre DENTRO del web service, en 1 vCPU compartido con el HTTP server, y un
 *    presupuesto alto clavó el CPU al 100% hasta que DO mató el contenedor en loop.
 *    Ponerlos en la misma UI que acotan sería dejar al guardia adentro de la caja
 *    que vigila: el primer reflejo ante "me lo guardó en 24" es subir el tope, y el
 *    tope es exactamente lo que impide repetir el incidente. Se cambian por entorno,
 *    con un deploy que alguien tiene que aprobar.
 *
 * 3. `defaultScope: 'instance'` PARA LAS DOCE. No es pereza: los cuatro jobs
 *    recorren TODAS las tiendas en una sola pasada, el rate limit es un `Map` por
 *    proceso (`api/store/recommendations/rate-limit.ts:23`), la cache del serve es
 *    in-process y el kill switch se lee desde subscribers y hooks sin request. O
 *    sea: no hay un solo call site que tenga una `SiteResolution` de dónde sacar la
 *    tienda. Declararlas `site` no habilitaría nada y sí activaría el fail-closed —
 *    la tienda B quedaría con el motor apagado sin ningún error, que es el síntoma
 *    más caro de esta migración. Lo que sí varía por tienda —límites, umbrales,
 *    mensajes de envío gratis— ya vive en `store_setting` con `site_id`, gestionado
 *    por `recommendations/config.ts`. Son dos capas distintas a propósito: acá está
 *    la OPERACIÓN (cuánto CPU puede gastar, cada cuánto, con qué secreto firma) y
 *    allá el PRODUCTO (qué se le muestra al comprador).
 *
 * 4. LOS BOOLEANOS CAMBIAN DE PARSER, Y ESO ES UN CAMBIO DE COMPORTAMIENTO REAL.
 *    Antes `RECOMMENDATIONS_ENABLED` se leía como `!== 'false'`, o sea que
 *    `RECOMMENDATIONS_ENABLED=0` dejaba el motor PRENDIDO. Ahora pasa por
 *    `coerceFromEnv`, que acepta `true`/`1` y `false`/`0`. Los tres valores que se
 *    usan en la práctica —`true`, `false`, sin definir— se comportan igual; `0` y
 *    `no` ahora apagan en vez de prender. Se documenta acá y no se "arregla" con un
 *    parser propio: tener dos gramáticas de booleano en el mismo backend es peor que
 *    corregir un valor raro en un panel de deploy.
 */
export default defineSettings({
  namespace: 'extension:recommendation-engine',
  title: 'Motor de recomendaciones',
  /** Ver la nota 3: NINGUNO de los doce tiene un call site con tienda. */
  defaultScope: 'instance',
  envOnly: [
    // ─── Schedules: los hornea el job loader al arrancar (nota 1) ───────────
    {
      key: 'RECOMMENDATIONS_SCHEDULE_CRON',
      reason:
        'Medusa hornea el cron al arrancar (job-loader.js:69-78): no se puede reprogramar en runtime. Es el encolador de recálculos, que corre a los 5 minutos de cada hora. Para apagarlo usá "Tareas programadas activas".',
    },
    {
      key: 'RECOMMENDATIONS_BUILD_CRON',
      reason:
        'Igual que el anterior: el schedule se lee una sola vez al arrancar. Es el drainer de la cola de recálculos (cada 10 minutos). Bajarlo a un minuto fue el incidente del 2026-07-23; lo que sí se configura acá es cuánto puede durar cada corrida.',
    },
    {
      key: 'RECOMMENDATIONS_AGGREGATE_CRON',
      reason:
        'Igual que los anteriores. Agrega eventos a métricas horarias y diarias (a los 15 de cada hora). La VENTANA que recalcula sí se configura acá.',
    },
    {
      key: 'RECOMMENDATIONS_PURGE_CRON',
      reason:
        'Igual que los anteriores. Corre la purga una vez por día de madrugada. El tamaño de lote y el tope de lotes sí se configuran acá.',
    },

    // ─── Topes duros: el guardia no vive adentro de la caja (nota 2) ────────
    {
      key: 'RECOMMENDATIONS_RESULT_LIMIT_CAP',
      reason:
        'Tope duro (24 por defecto) de "Productos por defecto", que el merchant ya edita en /recomendaciones/configuracion. Existe por el incidente del 2026-07-23: el motor corre en el mismo vCPU que el HTTP server. Un tope editable desde la misma pantalla que acota no acota nada.',
    },
    {
      key: 'RECOMMENDATIONS_CANDIDATE_LIMIT_CAP',
      reason:
        'Mismo caso: tope duro (60) de "Candidatos por defecto". Cada candidato es una fila hidratada con precio y stock, así que es el número que más pesa por request.',
    },
    {
      key: 'RECOMMENDATIONS_BRIDGE_CANDIDATE_LIMIT_CAP',
      reason:
        'Mismo caso: tope duro (150) de los candidatos del bridge de envío gratis, que barre una banda de precio en vez de partir de un producto y por eso necesita un techo más alto y más vigilado.',
    },
    {
      key: 'RECOMMENDATIONS_BASKET_CAP',
      reason:
        'Mismo caso, del lado del build: tope duro (60) del tamaño de canasta del self-join de co-compra. El costo es O(Σ basket²) y una sola orden B2B de 200 líneas aporta 40.000 pares. El merchant ya edita "max_basket_size" por estrategia.',
    },
  ],
  settings: [
    // ─── Estado ──────────────────────────────────────────────────────────────
    // Los tres son interruptores de PROCESO y se chequean antes de tocar la base.
    // Siguen leyéndose por el camino sincrónico (snapshot en memoria), así que
    // apagarlos no depende de que Postgres responda en ese instante; y si la base
    // es el problema de fondo, el break-glass es `APP_SETTINGS_DISABLE=true`, que
    // devuelve el comportamiento exacto de antes de esta migración.
    {
      key: 'RECOMMENDATIONS_ENABLED',
      env: ['RECOMMENDATIONS_ENABLED'],
      type: 'boolean',
      tier: 'runtime',
      group: 'Estado',
      label: 'Motor activo',
      help: 'Apagado, el serve devuelve vacío y la ingesta de eventos se descarta, sin leer configuración ni tocar la base. Es distinto del toggle "Motor activo" de la pantalla de recomendaciones: aquél es por tienda y se guarda en la config del motor; éste es el corte de luz de la instalación entera y le gana a todo.',
      default: true,
    },
    {
      key: 'RECOMMENDATIONS_JOBS_ENABLED',
      env: ['RECOMMENDATIONS_JOBS_ENABLED'],
      type: 'boolean',
      tier: 'runtime',
      group: 'Estado',
      label: 'Tareas programadas activas',
      help: 'Apaga los cuatro jobs (encolar, recalcular, agregar métricas y purgar) sin apagar el serve: la tienda sigue mostrando las recomendaciones ya calculadas. Es la palanca para descomprimir el vCPU en un pico sin quedarse sin recomendaciones. Apagar el motor apaga también los jobs, no al revés.',
      default: true,
    },
    {
      key: 'RECOMMENDATIONS_DEBUG',
      env: ['RECOMMENDATIONS_DEBUG'],
      type: 'boolean',
      tier: 'runtime',
      group: 'Estado',
      label: 'Diagnóstico en la respuesta pública',
      help: 'Agrega el objeto `debug` —cadena de fallbacks recorrida, estrategia que ganó, cuántos candidatos se descartaron— a la respuesta de la ruta PÚBLICA de recomendaciones. Deja de ser un detalle interno: expone cómo se arma el catálogo a cualquiera que mire el Network. Prenderlo para diagnosticar y APAGARLO.',
      default: false,
    },

    // ─── Servicio ────────────────────────────────────────────────────────────
    {
      key: 'RECOMMENDATIONS_EVENT_SECRET',
      env: ['RECOMMENDATIONS_EVENT_SECRET'],
      type: 'secret',
      tier: 'runtime',
      group: 'Servicio',
      label: 'Secreto de firma de eventos',
      // SIN `default`, y no es un olvido: un secreto con default queda en claro en
      // el código y en el bundle del admin, que importa este archivo. El fallback
      // vive en `serve/request-token.ts:resolveEventSecret` y es `COOKIE_SECRET`,
      // que ya existe en todo entorno desplegado y NO es de esta extensión.
      help: 'Firma el `request_id` que viaja en cada respuesta y vuelve en cada beacon de evento: un id forjado se rechaza sin tocar la base. Vacío, se usa el COOKIE_SECRET del proyecto. Rotarlo invalida los request_id en vuelo, así que se pierde la atribución de las visitas de los minutos siguientes — nada histórico.',
    },
    {
      key: 'RECOMMENDATIONS_RATE_LIMIT_PER_MINUTE',
      env: ['RECOMMENDATIONS_RATE_LIMIT_PER_MINUTE'],
      type: 'number',
      tier: 'runtime',
      group: 'Servicio',
      label: 'Consultas por minuto y por IP',
      help: 'Es generoso porque una sola PDP dispara varios placements y un usuario navegando rápido es legítimo. Se cuenta POR PROCESO: con N réplicas el efectivo es N veces esto. Sirve para acotar el daño de un script, no para hacer cuotas.',
      min: 10,
      max: 10_000,
      step: 10,
      default: 120,
    },
    {
      key: 'RECOMMENDATIONS_CONFIG_TTL_MS',
      env: ['RECOMMENDATIONS_CONFIG_TTL_MS'],
      type: 'number',
      tier: 'runtime',
      group: 'Servicio',
      label: 'Vigencia de la config en memoria (ms)',
      help: 'Cuánto dura el memo in-process de config, placements, estrategias y versiones activas. Sin él, cada request cuesta 3-4 lecturas antes de empezar a trabajar. Con varias réplicas, el desfase máximo de un cambio del backoffice es este número. Lo que necesita efecto inmediato (el swap de versiones) invalida a mano y no espera el TTL.',
      min: 1000,
      max: 600_000,
      step: 1000,
      default: 60_000,
    },

    // ─── Recálculo ───────────────────────────────────────────────────────────
    // Las tres gobiernan cuánto CPU puede morder UNA corrida de build. El drainer
    // ejecuta una sola por tick y puede terminar sin completar, dejando su cursor:
    // por eso se puede recalcular un catálogo entero desde 1 vCPU sin bloquear el
    // HTTP server. Subirlas es negociar contra ese vCPU.
    {
      key: 'RECOMMENDATIONS_BUILD_MAX_MS',
      env: ['RECOMMENDATIONS_BUILD_MAX_MS'],
      type: 'number',
      tier: 'runtime',
      group: 'Recálculo',
      label: 'Presupuesto por corrida (ms)',
      help: 'Agotado el presupuesto, la corrida guarda su cursor y devuelve `in_progress`: la sigue el próximo tick. El tope de 60 s no es arbitrario — el drainer corre cada 10 minutos, así que es el 10% del ciclo; más que eso y el build deja de ser un invitado en el vCPU del HTTP server.',
      min: 1000,
      max: 60_000,
      step: 1000,
      default: 20_000,
    },
    {
      key: 'RECOMMENDATIONS_BUILD_BATCH',
      env: ['RECOMMENDATIONS_BUILD_BATCH'],
      type: 'number',
      tier: 'runtime',
      group: 'Recálculo',
      label: 'Productos por lote',
      help: 'Cuántos productos origen procesa cada vuelta del build. Lotes grandes amortizan mejor las queries pero alargan el tramo en que la corrida no puede chequear el presupuesto de tiempo: el corte por reloj ocurre ENTRE lotes, no adentro.',
      min: 10,
      max: 2000,
      step: 10,
      default: 200,
    },
    {
      key: 'RECOMMENDATIONS_STALE_MINUTES',
      env: ['RECOMMENDATIONS_STALE_MINUTES'],
      type: 'number',
      tier: 'runtime',
      group: 'Recálculo',
      label: 'Minutos sin progreso para dar por colgada una corrida',
      help: 'Un deploy o un OOM a mitad de un build deja una fila en `building` que nadie va a retomar, y el encolador no encola si ya hay una pendiente: sin esta reconciliación la estrategia queda bloqueada para siempre. Tiene que ser holgadamente mayor que el presupuesto por corrida, o el drainer va a matar builds que estaban avanzando bien.',
      min: 5,
      max: 1440,
      step: 5,
      default: 30,
    },

    // ─── Retención y métricas ────────────────────────────────────────────────
    {
      key: 'RECOMMENDATIONS_AGGREGATE_LOOKBACK_HOURS',
      env: ['RECOMMENDATIONS_AGGREGATE_LOOKBACK_HOURS'],
      type: 'number',
      tier: 'runtime',
      group: 'Retención y métricas',
      label: 'Ventana rodante de agregación (horas)',
      help: 'La agregación recalcula esta ventana entera cada hora en vez de sólo el período que cerró. Eso es lo que hace que se autocorrijan las órdenes canceladas, los beacons que llegan tarde y las corridas que fallaron, sin lógica de reconciliación aparte. Achicarla ahorra CPU y deja huecos; agrandarla es recalcular lo mismo muchas veces.',
      min: 2,
      max: 168,
      step: 1,
      default: 48,
    },
    {
      key: 'RECOMMENDATIONS_PURGE_BATCH',
      env: ['RECOMMENDATIONS_PURGE_BATCH'],
      type: 'number',
      tier: 'runtime',
      group: 'Retención y métricas',
      label: 'Filas por lote de borrado',
      help: 'Los borrados son DUROS (un soft-delete no libera espacio y la tabla de eventos es la de mayor volumen de la extensión) y van en `DELETE ... WHERE id IN (SELECT ... LIMIT n)`. Ese `n` es esto: es lo que acota el lock. Subirlo mucho convierte la purga nocturna en un incidente.',
      min: 100,
      max: 50_000,
      step: 100,
      default: 5000,
    },
    {
      key: 'RECOMMENDATIONS_PURGE_MAX_BATCHES',
      env: ['RECOMMENDATIONS_PURGE_MAX_BATCHES'],
      type: 'number',
      tier: 'runtime',
      group: 'Retención y métricas',
      label: 'Lotes máximos por corrida',
      help: 'Techo de trabajo por noche. Si se agota, la purga corta y deja el resto para mañana: es idempotente y reentrante. Después de una limpieza grande —o de importar historia— conviene subirlo temporalmente en vez de esperar semanas a que se ponga al día.',
      min: 1,
      max: 200,
      step: 1,
      default: 20,
    },
  ],
});
