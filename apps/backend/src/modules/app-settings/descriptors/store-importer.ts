import { defineSettings } from './types';

/**
 * Ajustes del Importador de catálogo.
 *
 * El manifest declaraba `environment: []` y el código usa 5 variables. De las 5,
 * UNA sola merece bajar a la base — y no es un detalle: es la que decide cuándo
 * una importación se declara muerta.
 *
 * ─── LA LÍNEA QUE SEPARA UN CRON DE UNA VENTANA ──────────────────────────────
 *
 * `DEMO_IMPORT_CRON` y `DEMO_IMPORT_STALE_MS` viven en el MISMO archivo
 * (`jobs/process-demo-store-imports.ts`) y sin embargo caen de lados distintos:
 *
 *  - El CRON es el `schedule:` del job (`:155`). Medusa lo hornea al arrancar
 *    (`job-loader.js:69-78`), cuando la base todavía no se leyó. Una fila no
 *    llegaría a tiempo ni reiniciando: el loader no la consulta nunca.
 *  - El STALE_MS lo evalúa el CUERPO del job en cada tick (`:55` y `:75`) para
 *    decidir si un job en `running` quedó huérfano de un reinicio. Eso sí se
 *    puede leer de la base, y es justo el número que uno quiere poder mover en
 *    caliente cuando una importación grande está tardando más de lo previsto.
 *
 * OJO AL MIGRARLO: hoy es `const STALE_MS = Number(process.env...)` en el SCOPE
 * DEL MÓDULO (`:24`), o sea que se congela en el import, antes de que el loader
 * de `app-settings` llene el snapshot. Al pasarlo a `store-importer/settings.ts`
 * hay que leerlo DENTRO de la función del job, si no la migración es cosmética:
 * seguiría viendo el env de arranque para siempre.
 *
 * ─── LAS OTRAS TRES ──────────────────────────────────────────────────────────
 *
 * `APPLY` y `DEMO_SLUG` son banderas de línea de comandos de
 * `scripts/backfill-woocommerce-variant-prices.ts`, no configuración; y
 * `DEFAULT_CURRENCY_CODE` es de la instalación y no la edita nadie. Los detalles
 * están en cada `reason`, que es lo que la card muestra.
 */
export default defineSettings({
  namespace: 'extension:store-importer',
  title: 'Importador de catálogo',
  /**
   * `instance`. El ejecutor es UN job que barre las importaciones de TODAS las
   * tiendas en una sola pasada: no hay forma de que respete un umbral distinto
   * por tienda, así que un `scope: 'site'` sería una perilla que no gobierna
   * nada — y encima dejaría a las secundarias sin valor por el fail-closed.
   */
  defaultScope: 'instance',
  envOnly: [
    {
      key: 'DEMO_IMPORT_CRON',
      reason:
        'Medusa hornea el cron al arrancar (job-loader.js:69-78): no se puede reprogramar en runtime. Default `*/5 * * * *` en jobs/process-demo-store-imports.ts:155. Lo que SÍ se configura acá es el umbral de importación huérfana.',
    },
    {
      key: 'DEFAULT_CURRENCY_CODE',
      reason:
        'DE NADIE, a propósito: es configuración regional de la INSTALACIÓN, no de una extensión. Acá la usa el backfill de precios de WooCommerce (scripts/backfill-woocommerce-variant-prices.ts:30), y la leen también el importador VTEX del ERP y el indexador de Typesense. Dos cards editándola es la receta para un catálogo mitad en una moneda y mitad en otra.',
    },
    {
      key: 'APPLY',
      reason:
        'NO ES CONFIGURACIÓN: es el interruptor dry-run/escritura de cuatro scripts de línea de comandos (`APPLY=true pnpm ... backfill:woo-prices`, ver scripts/backfill-woocommerce-variant-prices.ts:31). Su valor por defecto —no escribir— es justamente la red de seguridad; una fila en la base que la dejara en `true` de forma permanente convertiría todo dry-run futuro en una escritura real sin que nadie lo pida.',
    },
    {
      key: 'DEMO_SLUG',
      reason:
        'Tampoco es configuración: acota una corrida del backfill a UNA tienda (`DEMO_SLUG=dorking pnpm ... backfill:woo-prices`, scripts/backfill-woocommerce-variant-prices.ts:32). Es un argumento del comando que quedó disfrazado de env var; persistirlo sólo lograría que la próxima corrida sin querer se limite a la tienda de la corrida anterior.',
    },
  ],
  settings: [
    // ─── Ejecución ───────────────────────────────────────────────────────────
    {
      key: 'DEMO_IMPORT_STALE_MS',
      env: ['DEMO_IMPORT_STALE_MS'],
      type: 'number',
      tier: 'runtime',
      group: 'Ejecución',
      label: 'Umbral de importación huérfana (ms)',
      // Una oración. Las dos formas de errarle —trabar la fila subiéndolo, matar
      // importaciones sanas bajándolo— son la sección "El umbral de importación
      // huérfana" del drawer, que es donde entra la explicación entera.
      help: 'Una importación en curso que no registra avance durante este tiempo se da por muerta y se marca como fallida (1.200.000 ms = 20 minutos).',
      min: 60_000,
      max: 7_200_000,
      step: 60_000,
      default: 1_200_000,
    },
  ],
});
