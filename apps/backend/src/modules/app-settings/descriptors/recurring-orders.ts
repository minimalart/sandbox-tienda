import { defineSettings } from './types';

/**
 * Ajustes de compras recurrentes.
 *
 * El manifest declaraba `environment: []` y el código lee 11 variables: la
 * extensión era INVISIBLE para el instalador y para el admin. Nadie le pidió
 * nunca un valor a nadie, así que toda instalación corre con los defaults
 * horneados en `recurring-order/config.ts` y ni siquiera sabe que existen.
 *
 * TRES DECISIONES QUE NO SON OBVIAS, y que hay que respetar al editar esto:
 *
 * 1. `defaultScope: 'instance'` para las SIETE, y no es pereza — es la
 *    invariante "se escribe donde se lee" de `precedence.ts:192`. El único
 *    lector de estos valores es `getRecurringOrderSettings()`, que va por el
 *    camino SINCRÓNICO (`resolveSettingSync`), y ese camino resuelve siempre con
 *    `SiteKind = 'none'`: lee la fila GLOBAL y no mira la de la tienda. Con
 *    `scope: 'site'`, el admin con una tienda activa escribiría en la fila de esa
 *    tienda y el backend seguiría leyendo la global — "guardo y no pasa nada", el
 *    modo de falla exacto que documenta `precedence.ts:178-183`. Y no es que falte
 *    propagar la `SiteResolution`: el job de renovaciones recorre los ciclos de
 *    TODAS las tiendas en una sola pasada, así que no hay una tienda de la cual
 *    sacarla. Mismo criterio y misma razón que
 *    `ANDREANI_TRACKING_BUSINESS_HOURS_ONLY`.
 *
 * 2. LA PERSONALIZACIÓN POR TIENDA YA EXISTE Y NO VIVE ACÁ: cinco de estos siete
 *    valores los pisa `recurring_setting` POR CANAL DE VENTA
 *    (`recurring-order/runtime-config.ts:48-72`), y esa fila se edita en
 *    `/admin/recurring-orders/settings`. Lo que se declara acá es la capa de
 *    ABAJO — el default de la instalación, lo que hoy es el `.env`. Declararlos
 *    `site` además de tener `recurring_setting` sería una tercera capa por tienda
 *    compitiendo con la que ya funciona.
 *
 *    Los dos que NO tienen override por canal son `RECURRING_ORDERS_ENABLED` (el
 *    kill switch, que por canal se resuelve con `demo_store.recurring_enabled` en
 *    `recurring-order/toggle.ts`) y `RECURRING_BATCH_SIZE` (es el tope de trabajo
 *    de UNA corrida del cron, que es global por definición).
 *
 * 3. LOS DOS CRON VAN EN `envOnly` Y EL KILL SWITCH NO. La diferencia no es de
 *    importancia sino de MOMENTO: el `schedule:` lo lee el job loader al arrancar
 *    (`job-loader.js:69-78`), cuando la base todavía no se consultó, y no se puede
 *    reprogramar en runtime; el `enabled`, en cambio, se evalúa DENTRO del cuerpo
 *    del job (`jobs/process-recurring-renewals.ts:30` y
 *    `jobs/compute-recurring-metrics.ts:17`), o sea en cada corrida, así que
 *    apagarlo desde el admin tiene efecto en la corrida siguiente sin reiniciar.
 */
export default defineSettings({
  namespace: 'extension:recurring-orders',
  title: 'Compras recurrentes',
  /** Ver la nota 1 del encabezado antes de poner un `scope: 'site'` acá. */
  defaultScope: 'instance',
  envOnly: [
    {
      key: 'APPLY',
      reason:
        'Confirmación explícita para los scripts de migración, conciliación y rollback. Todos corren en dry-run mientras no valga true.',
    },
    {
      key: 'AUDIT_STRICT',
      reason:
        'Hace fallar el proceso de auditoría cuando encuentra incidentes críticos. Sólo afecta el script de diagnóstico y se evalúa al ejecutarlo.',
    },
    {
      key: 'MEDUSA_BACKEND_URL',
      reason:
        'Alias legado del origen público del backend usado para callbacks y health checks. Es configuración de despliegue y requiere reinicio.',
    },
    {
      key: 'SUBSCRIPTIONS_PREFLIGHT_CRON',
      reason:
        'El schedule del preflight se carga al iniciar Medusa y no puede cambiarse en runtime.',
    },
    {
      key: 'SUBSCRIPTIONS_STOCK_FORECAST_CRON',
      reason:
        'El schedule del pronóstico se carga al iniciar Medusa y no puede cambiarse en runtime.',
    },
    {
      key: 'SUBSCRIPTIONS_NOTIFICATIONS_CRON',
      reason: 'El schedule del outbox se carga al iniciar Medusa y no puede cambiarse en runtime.',
    },
    {
      key: 'RECURRING_RENEWAL_CRON',
      reason:
        'Medusa hornea el cron al arrancar (job-loader.js:69-78): un valor en base no se podría aplicar sin reiniciar. Para apagar el motor de renovaciones usá "Compras recurrentes activas", que se evalúa en cada corrida.',
    },
    {
      key: 'RECURRING_METRICS_CRON',
      reason:
        'Igual que el anterior: el schedule del job de métricas se lee una sola vez al arrancar. El job también respeta "Compras recurrentes activas".',
    },
    {
      key: 'NEXT_PUBLIC_BASE_URL',
      reason:
        'Es de INSTALACIÓN, no de esta extensión: el storefront la necesita en build time para armar los links absolutos, así que tiene que estar en el entorno antes de que exista base alguna. La leen también abandoned-cart, checkout-links y ai-assistant; ninguna es la dueña. Acá sólo se usa como base de los links de confirmación y de "mis suscripciones" (recurring-order/lib.ts:70).',
    },
    {
      key: 'STOREFRONT_DEFAULT_COUNTRY',
      reason:
        'Es de INSTALACIÓN: la resuelve la configuración regional del proyecto y la comparten todas las extensiones que arman URLs del storefront. Acá sólo tapa el hueco cuando la suscripción no tiene país propio (recurring-order/lib.ts:76). Ponerla en la card de compras recurrentes daría a entender que cambiarla acá cambia el prefijo de país de todo el sitio, y no es así.',
    },
  ],
  settings: [
    {
      key: 'SUBSCRIPTIONS_V2_ENABLED',
      env: ['SUBSCRIPTIONS_V2_ENABLED'],
      type: 'boolean',
      tier: 'runtime',
      group: 'Suscripciones',
      label: 'Motor de suscripciones V2',
      default: false,
    },
    {
      key: 'SUBSCRIPTIONS_STOREFRONT_ENABLED',
      env: ['SUBSCRIPTIONS_STOREFRONT_ENABLED'],
      type: 'boolean',
      tier: 'runtime',
      group: 'Suscripciones',
      label: 'Planes en la tienda',
      default: false,
    },
    {
      key: 'SUBSCRIPTIONS_AUTO_PAYMENT_ENABLED',
      env: ['SUBSCRIPTIONS_AUTO_PAYMENT_ENABLED'],
      type: 'boolean',
      tier: 'runtime',
      group: 'Suscripciones',
      label: 'Cobros automáticos',
      default: false,
    },
    {
      key: 'SUBSCRIPTIONS_STOCK_FORECAST_ENABLED',
      env: ['SUBSCRIPTIONS_STOCK_FORECAST_ENABLED'],
      type: 'boolean',
      tier: 'runtime',
      group: 'Suscripciones',
      label: 'Pronóstico de stock',
      default: false,
    },
    {
      key: 'SUBSCRIPTIONS_RETENTION_ENABLED',
      env: ['SUBSCRIPTIONS_RETENTION_ENABLED'],
      type: 'boolean',
      tier: 'runtime',
      group: 'Suscripciones',
      label: 'Ofertas de retención',
      default: false,
    },
    // ─── Operación ───────────────────────────────────────────────────────────
    {
      key: 'RECURRING_ORDERS_ENABLED',
      env: ['RECURRING_ORDERS_ENABLED'],
      type: 'boolean',
      tier: 'runtime',
      group: 'Operación',
      label: 'Compras recurrentes activas',
      /**
       * UNA oración, y se queda la que despeja el miedo de apretar el switch: que
       * apagar CONGELA y no cancela. Tiene sección propia en el drawer ("Apagar el
       * motor no cancela nada"), igual que el reparto instalación/tienda ("Tres capas,
       * y la de abajo es la que se edita acá").
       */
      help: 'Apagado, el motor no ejecuta renovaciones, no manda recordatorios y no expira links: las suscripciones quedan congeladas donde estén, no se cancelan.',
      default: true,
    },
    {
      key: 'RECURRING_BATCH_SIZE',
      env: ['RECURRING_BATCH_SIZE'],
      type: 'number',
      tier: 'runtime',
      group: 'Operación',
      label: 'Ciclos por corrida',
      help: 'Tope de ciclos que procesa CADA corrida del cron, y también el de recordatorios y expiraciones. Existe para que un pico de vencimientos no se coma el worker de una: lo que no entra queda para la corrida siguiente. Subirlo acorta la cola pero alarga cada corrida.',
      min: 1,
      max: 1000,
      step: 1,
      default: 50,
    },

    // ─── Reintentos ──────────────────────────────────────────────────────────
    // Los tres los puede pisar `recurring_setting` por canal de venta. Lo que se
    // configura acá es el default de la instalación — ver la nota 2.
    {
      key: 'RECURRING_MAX_ATTEMPTS',
      env: ['RECURRING_MAX_ATTEMPTS'],
      type: 'number',
      tier: 'runtime',
      group: 'Reintentos',
      label: 'Intentos por ciclo',
      help: 'Cuántas veces se reintenta ARMAR el ciclo (carrito, stock, precios) antes de darlo por fallado. No cuenta intentos de pago: el pago lo hace el cliente desde el link. Valor base; la pantalla de configuración lo puede pisar por tienda.',
      min: 1,
      max: 10,
      step: 1,
      default: 3,
    },
    {
      key: 'RECURRING_RETRY_HOURS',
      env: ['RECURRING_RETRY_HOURS'],
      type: 'number',
      tier: 'runtime',
      group: 'Reintentos',
      label: 'Horas entre intentos',
      help: 'Cuánto se re-agenda un ciclo que falló al armarse. Ponerlo por debajo de la frecuencia del cron no acelera nada: el reintento igual espera a la corrida siguiente. Valor base; se puede pisar por tienda.',
      min: 1,
      max: 720,
      step: 1,
      default: 6,
    },
    {
      key: 'RECURRING_MAX_CONSECUTIVE_FAILURES',
      env: ['RECURRING_MAX_CONSECUTIVE_FAILURES'],
      type: 'number',
      tier: 'runtime',
      group: 'Reintentos',
      label: 'Fallas seguidas antes de cortar',
      help: 'Ciclos fallados o expirados EN FILA que tolera una suscripción antes de pasar a `failed` y dejar de intentar. La racha se resetea con un ciclo bueno. Es la diferencia entre acompañar a un cliente con una tarjeta vencida y seguir mandándole mails para siempre. Valor base; se puede pisar por tienda.',
      min: 1,
      max: 20,
      step: 1,
      default: 2,
    },

    // ─── Pago ────────────────────────────────────────────────────────────────
    {
      key: 'RECURRING_PAYMENT_EXPIRATION_HOURS',
      env: ['RECURRING_PAYMENT_EXPIRATION_HOURS'],
      type: 'number',
      tier: 'runtime',
      group: 'Pago',
      label: 'Vida del link de pago (horas)',
      /**
       * UNA oración. El gotcha del `expires_at` ya persistido —que el valor nuevo
       * rige recién para los ciclos que se generen de acá en adelante— tiene sección
       * propia en el drawer ("Los valores nuevos no reescriben los ciclos en vuelo"),
       * y es donde entra bien porque vale para los cinco campos, no sólo para éste.
       * "Valor base; se puede pisar por tienda" ya lo dice el título de la card.
       */
      help: 'Pasado esto el ciclo expira y cuenta como falla.',
      min: 1,
      max: 720,
      step: 1,
      default: 72,
    },
    {
      key: 'RECURRING_REMINDER_HOURS',
      env: ['RECURRING_REMINDER_HOURS'],
      type: 'number',
      tier: 'runtime',
      group: 'Pago',
      label: 'Horas hasta el recordatorio',
      help: 'Cuánto se espera con el ciclo en `pending_payment` antes de mandar el recordatorio. Se manda UNO solo por ciclo. Tenerlo por encima de la vida del link significa que el recordatorio no llega nunca. Valor base; se puede pisar por tienda.',
      min: 1,
      max: 720,
      step: 1,
      default: 24,
    },
  ],
});
