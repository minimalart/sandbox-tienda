import { defineSettings } from './types';

/**
 * Ajustes del ERP.
 *
 * El manifest declaraba `environment: []` y el código usa 7 variables, así que
 * las 7 eran invisibles para el instalador de `apps/platform`: un proyecto
 * generado arrancaba con los defaults hardcodeados y nadie se enteraba. Este
 * descriptor cierra esa deriva.
 *
 * ─── POR QUÉ NO TIENE NI UN AJUSTE EDITABLE ──────────────────────────────────
 *
 * Las 7 quedan en `envOnly`. Un descriptor con `settings: []` parece inútil, pero
 * es el mismo caso que `mercadopago.ts`: lo que hace es que las variables
 * APAREZCAN en el buscador central (`/app/settings/ajustes`) con la razón escrita
 * al lado, en vez de vivir en un comentario que nadie va a encontrar.
 *
 * Se parten en dos grupos, y cada uno tiene su propio bloqueo:
 *
 *  1. LOS TRES `*_CRON`. Medusa hornea el `schedule` de cada job al arrancar
 *     (`job-loader.js:69-78`), antes de que exista la base. Regla general de esta
 *     migración: un cron que sólo se lee como `schedule:` nunca baja a la DB; lo
 *     que sí puede bajar es el kill switch o la ventana que el job evalúa DENTRO
 *     de su cuerpo — y los tres jobs del ERP hoy no tienen ninguno.
 *
 *  2. LAS CUATRO DEL IMPORTADOR VTEX. Las lee UN SOLO archivo,
 *     `scripts/import-vtex.ts:53-56`, que es un `medusa exec` de una sola pasada
 *     que levanta `src/scripts/data/vtex-products.json` — un archivo que en una
 *     instalación normal ni existe. No es configuración del ERP en producción: es
 *     el parametrizado de un comando de onboarding.
 *
 *     Y hay una razón MÁS FUERTE que esa para no darles card, que es la que
 *     decidió el asunto: `STOCK_LOCATION` y `SHIPPING_PROFILE` ya tienen su
 *     equivalente de runtime en la configuración propia del ERP —
 *     `erp_config.stock_location_id` y `erp_config.shipping_profile_id`
 *     (`modules/erp/types.ts:473` y `:259`), que la página de admin
 *     (`admin/routes/erp/configuracion/page.tsx`) edita con SELECTS de entidades
 *     reales. Meter acá dos campos de texto que se llaman casi igual, en la misma
 *     pantalla, al lado de los dropdowns buenos, es fabricar el error de
 *     configuración que esta migración existe para evitar.
 *
 *     Detalle que conviene saber antes de reabrir la discusión: las tres NO son
 *     IDs, son NOMBRES —`listStockLocations({ name })` y
 *     `listShippingProfiles({ name })`— y el script TIRA con un mensaje explícito
 *     cuando no encuentra el nombre (`import-vtex.ts:112-126`). O sea que el
 *     riesgo de "se pega un ID inválido y falla en silencio" no aplica: acá falla
 *     a los gritos, que es exactamente lo que uno quiere de un script.
 */
export default defineSettings({
  namespace: 'extension:erp',
  title: 'ERP',
  /**
   * `instance`. Las tres del importador describen entidades de ESTA instalación
   * de Medusa (un depósito, un shipping profile) y los crones gobiernan jobs que
   * corren una vez por proceso, no una vez por tienda. Es moot mientras no haya
   * ajustes editables, pero el día que se agregue el primero este es el default
   * correcto: un `site` de más deja a las tiendas secundarias sin valor por el
   * fail-closed, sin error visible.
   */
  defaultScope: 'instance',
  envOnly: [
    {
      key: 'APPLY',
      reason:
        'Interruptor explícito del backfill de títulos de tintura. El script corre en dry-run salvo que esta variable sea true; es un parámetro de medusa exec, no configuración operativa del ERP.',
    },
    {
      key: 'ERP_CATALOG_SYNC_CRON',
      reason:
        'Medusa hornea el cron al arrancar (job-loader.js:69-78): no se puede reprogramar en runtime. Default `*/15 * * * *` en jobs/erp-catalog-sync.ts:56. Para apagar la sincronización de catálogo se usa la configuración del ERP, no esta variable.',
    },
    {
      key: 'ERP_STOCK_SYNC_CRON',
      reason:
        'Medusa hornea el cron al arrancar (job-loader.js:69-78): el schedule se lee una sola vez y no se puede reprogramar en runtime. Default `0 * * * *` (cada hora) en jobs/erp-stock-sync.ts:37.',
    },
    {
      key: 'ERP_OUTBOX_CRON',
      reason:
        'Medusa hornea el cron al arrancar (job-loader.js:69-78): no se puede reprogramar en runtime. Default `* * * * *` (cada minuto) en jobs/erp-outbox-processor.ts:41. Es el latido del outbox: bajarle la frecuencia retrasa TODO lo que el ERP tiene que empujar, no una parte.',
    },
    {
      key: 'DEFAULT_CURRENCY_CODE',
      reason:
        'DE NADIE, a propósito: es configuración regional de la INSTALACIÓN, no de una extensión. La leen el importador VTEX (scripts/import-vtex.ts:53), el indexador de Typesense y los backfills de precios; dos cards editándola es la receta para un catálogo mitad en una moneda y mitad en otra. Se cambia en el entorno y se reinicia.',
    },
    {
      key: 'STOCK_LOCATION',
      reason:
        'Sólo la lee el importador VTEX (scripts/import-vtex.ts:54), un `medusa exec` de una pasada, y es el NOMBRE del depósito, no su ID. El equivalente de runtime ya existe y se edita con un dropdown de depósitos reales en la configuración del ERP (`erp_config.stock_location_id`): un campo de texto acá al lado sería un segundo depósito que gobierna otra cosa.',
    },
    {
      key: 'SHIPPING_PROFILE',
      reason:
        'Mismo caso que la anterior (scripts/import-vtex.ts:55). Es el NOMBRE del shipping profile y su equivalente de runtime es `erp_config.shipping_profile_id`, que la card del ERP ya edita con un select.',
    },
    {
      key: 'STOCKED_QUANTITY',
      reason:
        'Stock inicial que el importador VTEX le pone a cada variante nueva (scripts/import-vtex.ts:56, default 500). Es un parámetro de esa corrida, no una política de inventario: el stock real lo gobierna el sync de stock del ERP, que lo pisa en la primera pasada.',
    },
    {
      key: 'NEXT_PUBLIC_BASE_URL',
      reason:
        'Alias legado de la URL pública usado por el email de factura del ERP. Se configura en el entorno de la instalación y requiere reinicio; no es un ajuste propio por tienda.',
    },
  ],
  settings: [],
});
