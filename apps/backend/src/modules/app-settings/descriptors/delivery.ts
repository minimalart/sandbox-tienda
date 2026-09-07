import { defineSettings } from './types';

/**
 * Ajustes de Delivery (flota propia y logística).
 *
 * El manifest declara `environment: []` y el código lee tres variables, que en
 * realidad son DOS ajustes: `GOOGLE_MAPS_API_KEY` y `VITE_GOOGLE_MAPS_API_KEY`
 * son la MISMA credencial con dos nombres.
 *
 * ─── POR QUÉ UN SOLO DESCRIPTOR PARA LOS DOS NOMBRES ─────────────────────────
 *
 * `modules/delivery/geocoding.ts:50-55` ya las leía en cascada
 * (`GOOGLE_MAPS_API_KEY ?? VITE_GOOGLE_MAPS_API_KEY`), o sea que siempre fueron
 * un alias, no dos opciones. `env: [...]` respeta ese orden — `coerceFromEnv`
 * recorre el array y se queda con la PRIMERA que esté definida y no vacía, así
 * que con las dos presentes gana `GOOGLE_MAPS_API_KEY`, exactamente como antes.
 * Declararlas como dos descriptores, además, lo prohíbe un test
 * (`manifest-drift.test.ts`: "un namespace no declara la misma env var en dos
 * descriptores"), y con razón: dos campos editando la misma key de Google es la
 * receta para el estado "cambié la key y sigue fallando".
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ LO QUE SE GUARDA ACÁ NO LLEGA AL MAPA DEL ADMIN NI AL DEL STOREFRONT.     │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * El `VITE_` del nombre no es decorativo: `admin/routes/store-locations/
 * components/google-maps-loader.ts:11-12` lee `import.meta.env`, que Vite
 * HORNEA en el bundle del admin en tiempo de build. Lo mismo pasa en el
 * storefront, que lee `process.env.GOOGLE_MAPS_API_KEY` de su propio build de
 * Next. Ninguno de los dos consulta la base.
 *
 * O sea: lo que se edita en esta card gobierna el GEOCODING DEL BACKEND (el
 * respaldo que resuelve lat/lng cuando la dirección no las trae). Para que el
 * selector de direcciones del admin y los mapas del storefront anden, la
 * variable tiene que seguir estando en el entorno de build de cada app. Está
 * escrito en el `help` para que nadie lo descubra a los golpes.
 *
 * ─── SIN `envOnly` ───────────────────────────────────────────────────────────
 *
 * Ninguna de las tres se lee en `medusa-config.ts` ni en el `schedule:` de un
 * job. Las tres se resuelven en runtime.
 */
export default defineSettings({
  namespace: 'extension:delivery',
  title: 'Delivery',
  /**
   * La operación de flota propia es de la tienda: quién despacha, con qué
   * sucursales y con qué reglas ya vive en `delivery/site-scope.ts`.
   */
  defaultScope: 'site',
  settings: [
    // ─── Credenciales ────────────────────────────────────────────────────────
    {
      key: 'GOOGLE_MAPS_API_KEY',
      /** Orden = precedencia. La `VITE_` es el fallback histórico. */
      env: ['GOOGLE_MAPS_API_KEY', 'VITE_GOOGLE_MAPS_API_KEY'],
      /**
       * `secret` porque se factura por request contra la cuenta de Google Cloud
       * del cliente. Una key filtrada no se roba datos: se roba plata, y el
       * primer síntoma es la factura del mes siguiente.
       */
      type: 'secret',
      tier: 'runtime',
      /**
       * `instance` y no `site`. Es la credencial de UN proyecto de Google Cloud,
       * que es de la instalación, no de cada tienda. Con `site`, el fail-closed
       * dejaría a toda tienda secundaria sin geocoding de respaldo y el síntoma
       * sería "en la tienda B las direcciones no resuelven zona", sin un error
       * en ningún lado. Si algún día hace falta facturar por tienda, se cambia
       * el scope — no al revés.
       */
      scope: 'instance',
      group: 'Credenciales',
      label: 'API key de Google Maps',
      help: 'Habilita el geocoding de RESPALDO del backend: cuando el storefront no capturó lat/lng, resuelve las coords para poder asignar zona y sucursal. Necesita la "Geocoding API" habilitada en Google Cloud, o Google responde REQUEST_DENIED y el geocoding queda apagado de hecho (no rompe: la dirección queda sin zona). OJO: NO alimenta el mapa del admin ni el del storefront — esos leen VITE_GOOGLE_MAPS_API_KEY / GOOGLE_MAPS_API_KEY del entorno de BUILD de cada app y no consultan la base.',
    },

    // ─── Operación ───────────────────────────────────────────────────────────
    {
      key: 'OWN_FLEET_AUTO_FULFILL',
      env: ['OWN_FLEET_AUTO_FULFILL'],
      type: 'boolean',
      tier: 'runtime',
      group: 'Operación',
      label: 'Auto-fulfillment de flota propia',
      help: 'Con esto apagado, las compras con envío por flota propia NO generan fulfillment solas y por lo tanto NUNCA entran a Delivery (Medusa no crea el fulfillment de una orden normal). Es la causa número uno de "la compra no aparece en Delivery". Prendido, `subscribers/own-fleet-order.ts` crea el fulfillment con el workflow del core y el resto de la cadena reacciona sola.',
      /**
       * `false`: es opt-in explícito y lo era antes de la migración
       * (`own-fleet-order.ts:95` exige el string exacto `'true'`). Prenderlo por
       * default le crearía fulfillments automáticos a toda instalación que hoy
       * los hace a mano.
       */
      default: false,
    },
  ],
});
