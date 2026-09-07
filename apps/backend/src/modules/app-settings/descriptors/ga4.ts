import { defineSettings } from './types';

/**
 * Ajustes de GA4.
 *
 * El manifest declaraba 2 variables (`GA_MEASUREMENT_ID`, `GA_API_SECRET`) y el
 * código usa 6: la auditoría de este namespace agrega los alias
 * `NEXT_PUBLIC_*` y las dos que faltaban (`GTM_ID`, `GA_DEBUG`).
 * `manifest-drift.test.ts` mantiene la deriva cerrada de acá en adelante.
 *
 * Sobre los alias `NEXT_PUBLIC_*`: son la MISMA opción con dos nombres, no dos
 * ajustes. Existen porque en muchos deploys el backend y el storefront comparten
 * el mismo bloque de env, así que el backend acepta el nombre "público" como
 * fallback. Van como segundo elemento de `env[]`, nunca como descriptor aparte
 * (hay un test que prohíbe declarar la misma env var dos veces en un namespace).
 *
 * OJO — alcance real de estos valores: lo que se guarda acá gobierna el envío
 * SERVER-SIDE (Measurement Protocol, `modules/ga4`). El storefront es Next y lee
 * `NEXT_PUBLIC_GA_MEASUREMENT_ID` / `NEXT_PUBLIC_GTM_ID` de su propio entorno en
 * build time (`apps/storefront/src/lib/analytics/gtag.ts`,
 * `apps/storefront/src/app/layout.tsx`): cambiarlos acá NO reetiqueta el
 * storefront. Está escrito en los `help` para que nadie lo descubra a los golpes.
 *
 * Sin `envOnly`: ninguna variable de GA4 se lee en `medusa-config.ts` (el módulo
 * se registra por existencia de carpeta, no por env) ni en un `schedule:` de
 * `src/jobs/**`. Las 6 se resuelven en runtime.
 */
export default defineSettings({
  namespace: 'extension:ga4',
  title: 'Google Analytics 4',
  /**
   * main hizo `ga4_settings` por tienda: cada una puede medir en su propia
   * propiedad de Analytics.
   */
  defaultScope: 'site',
  settings: [
    // ─── Medición ────────────────────────────────────────────────────────────
    {
      key: 'GA_MEASUREMENT_ID',
      env: ['GA_MEASUREMENT_ID', 'NEXT_PUBLIC_GA_MEASUREMENT_ID'],
      type: 'string',
      tier: 'runtime',
      group: 'Medición',
      label: 'Measurement ID',
      help: 'ID de la propiedad GA4 (Administrar → Flujos de datos). Sin esto el envío server-side queda apagado: los subscribers hacen no-op. No reetiqueta el storefront, que lee NEXT_PUBLIC_GA_MEASUREMENT_ID de su propio build.',
      placeholder: 'G-XXXXXXXXXX',
      pattern: '^G-[A-Za-z0-9]+$',
      maxLength: 32,
      required: true,
    },
    {
      key: 'GA_API_SECRET',
      env: ['GA_API_SECRET'],
      type: 'secret',
      tier: 'runtime',
      group: 'Medición',
      label: 'API secret',
      help: 'Se crea en GA4 → Administrar → Flujos de datos → Measurement Protocol API secrets. Nunca se muestra: sólo se puede reemplazar o borrar. Sin esto no se envía nada.',
      required: true,
    },

    // ─── Etiquetado ──────────────────────────────────────────────────────────
    {
      key: 'GTM_ID',
      env: ['GTM_ID', 'NEXT_PUBLIC_GTM_ID'],
      type: 'string',
      tier: 'runtime',
      group: 'Etiquetado',
      label: 'Google Tag Manager ID',
      help: 'Informativo para el backoffice: el backend no lo usa para enviar (el Measurement Protocol no pasa por GTM). Quien carga el contenedor es el storefront, con NEXT_PUBLIC_GTM_ID de su propio build.',
      placeholder: 'GTM-XXXXXXX',
      pattern: '^GTM-[A-Za-z0-9]+$',
      maxLength: 32,
    },

    // ─── Diagnóstico ─────────────────────────────────────────────────────────
    {
      key: 'GA_DEBUG',
      env: ['GA_DEBUG'],
      type: 'boolean',
      tier: 'runtime',
      group: 'Diagnóstico',
      label: 'Modo debug',
      help: 'Manda los eventos a /debug/mp/collect en vez de /mp/collect: GA4 valida el payload y responde los errores, pero NO registra el hit. Dejarlo prendido en producción equivale a no medir.',
      default: false,
    },
  ],
});
