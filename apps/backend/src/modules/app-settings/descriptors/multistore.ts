import importerSettings from './fragments/catalog-import';
import { normalizeSiteSuffix } from '../../../lib/multistore/site-hosts';
import { defineSettings } from './types';
import { sitesHubSettings } from './fragments/sites-hub';

/**
 * Ajustes de Multitienda.
 *
 * El manifest declaraba `environment: []` y el código usa 4 variables: dos que
 * gobiernan el RITMO con el que el importador le pega a la tienda de origen, y
 * dos de MercadoPago que esta extensión sólo LEE.
 *
 * ─── LAS DOS DE MERCADOPAGO NO SON DE ACÁ ────────────────────────────────────
 *
 * `MERCADOPAGO_ACCOUNTS` y `MERCADOPAGO_PUBLIC_KEY` las declara y las razona
 * `descriptors/mercadopago.ts`, que es el dueño. Acá van en `envOnly` apuntando
 * ahí, por la regla de propiedad de esta migración: una variable la EDITA UN
 * SOLO namespace. Es el mismo precedente que `S3_PUBLIC_URL`, que gestiona
 * `media-library` y `email-templates` sólo lee. La razón técnica de fondo es
 * dura, no una preferencia: `manifest-drift.test.ts` prohíbe la misma env var en
 * dos descriptores, y con razón — dos cards editando la misma cuenta de cobro es
 * peor que una sola.
 *
 * ─── LAS DOS DEL IMPORTADOR SÍ SON DE ACÁ ────────────────────────────────────
 *
 * `DEMO_IMPORT_THROTTLE_MS` y `DEMO_IMPORT_BACKOFF_BASE_MS` las lee
 * `modules/demo-store/catalog/util.ts` DENTRO de `throttle()` y `backoffMs()`
 * (`:39` y `:47`), o sea en cada request saliente — no en el scope del módulo. Eso
 * es lo que las hace migrables sin tocar el momento de la lectura: el snapshot ya
 * está lleno mucho antes del primer fetch.
 *
 * Y son las dos perillas que uno quiere mover EN CALIENTE, que es todo el punto
 * de esta migración: cuando una tienda de origen empieza a devolver 429 en el
 * medio de una importación, hoy hay que editar el `.env` y redeployar — o sea,
 * matar la importación que se estaba tratando de salvar. Con la card, se sube el
 * throttle y la siguiente request ya sale más espaciada.
 *
 * OJO CON LOS NOMBRES: hay TRES `DEMO_IMPORT_*` en el repo y no son de la misma
 * extensión. `DEMO_IMPORT_STALE_MS` y `DEMO_IMPORT_CRON` son de `store-importer`
 * (el ejecutor del job); estas dos son de acá (el cliente HTTP). No hay conflicto
 * de propiedad porque los nombres no se pisan, pero el prefijo compartido invita
 * a asumir que sí.
 */
/**
 * ─── POR QUÉ HAY UNA VARIABLE DE URL ACÁ, Y POR QUÉ NO ES `STOREFRONT_URL` ────
 *
 * `MULTISTORE_PUBLIC_BASE_URL` gobierna UNA cosa: el origen con el que el admin
 * arma el link público de cada tienda del listado (`buildPublicUrlFrom`, que le
 * agrega `/tienda/<slug>`). Hasta acá ese origen sólo salía del entorno —
 * `STOREFRONT_URL`, y si no el primer origin de `STORE_CORS`—, así que mover el
 * dominio exigía editar la config del deploy y redeployar el backend para
 * arreglar un link. Es la misma clase de perilla que las dos de abajo: algo que
 * se quiere corregir EN CALIENTE, sin tirar abajo el proceso.
 *
 * No se declara `STOREFRONT_URL` como editable, y no es por comodidad: es una env
 * del CORE (está en el bloque `envs:` del App Spec, ver `env-coverage.test.ts`) y
 * la leen ~15 lugares del backend —invitaciones, reseteo de contraseña, carritos
 * abandonados, SEO, el OAuth del MCP— TODOS con `process.env` directo. Una fila en
 * la base la vería sólo quien pase por `resolveSetting`, y los otros catorce
 * seguirían con el valor del entorno: el mismo dominio significando dos cosas
 * distintas según quién lo lea, sin ningún error. Es exactamente el escenario que
 * `descriptors/gift-cards.ts` y `descriptors/seo-geo.ts` describen al mandarla a
 * `envOnly`. Migrarla de verdad es su propio cambio, y empieza por esos ~15 call
 * sites.
 *
 * Por eso esta clave es NUEVA y de alcance chico: se antepone a `STOREFRONT_URL`
 * sólo en el camino que arma links de tienda, y vacía no cambia absolutamente
 * nada. El precio está declarado: si alguien la carga con un dominio y deja
 * `STOREFRONT_URL` con otro, los links del listado y los de los mails apuntan a
 * lugares distintos. Se paga a cambio de poder arreglar el link sin redeploy, y
 * el `help` del campo dice que vacío se deduce del entorno.
 */
export default defineSettings({
  namespace: 'extension:multistore',
  title: 'Multitienda',
  /**
   * `instance`, y no es una elección de comodidad: el portón de throttling es un
   * `let nextAllowedAt` de MÓDULO (`catalog/util.ts:37`), uno solo por proceso,
   * compartido por todas las importaciones que pasen por ahí. Un valor por tienda
   * no tendría dónde aplicarse — la función que lee el número no sabe de qué
   * tienda es la importación en curso — y encima el fail-closed dejaría a las
   * secundarias sin valor, con el síntoma de siempre: "anda distinto en la tienda
   * B" y ningún error.
   */
  defaultScope: 'instance',
  envOnly: [
    ...(importerSettings.envOnly ?? []),
    {
      key: 'MERCADOPAGO_ACCOUNTS',
      reason:
        'La declara y la gestiona la extensión MercadoPago, que es su dueña — acá sólo se LEE, para resolver la public key del Payment Brick por sales channel (modules/demo-store/templates/index.ts:50). Sigue siendo `envOnly` allá también: la resuelve `getAccount`, que es síncrona y está en el camino del cobro. Ver `descriptors/mercadopago.ts`.',
    },
    {
      key: 'MERCADOPAGO_PUBLIC_KEY',
      reason:
        'Misma dueña: la extensión MercadoPago. Acá es sólo el fallback global cuando el sales channel de la tienda no tiene cuenta propia en el mapa (modules/demo-store/templates/index.ts:51). Va pegada al access token —son un par de la misma aplicación de MercadoPago— y por eso se edita en un solo lugar.',
    },
  ],
  settings: [
    ...sitesHubSettings,
    ...importerSettings.settings,
    // ─── URL pública ─────────────────────────────────────────────────────────
    {
      key: 'MULTISTORE_PUBLIC_BASE_URL',
      env: ['MULTISTORE_PUBLIC_BASE_URL'],
      type: 'url',
      tier: 'runtime',
      group: 'URL pública',
      label: 'Base pública del storefront',
      // Una oración. Por qué esta variable existe además de `STOREFRONT_URL` está
      // en el bloque de arriba, que es donde se decide y no donde se muestra.
      help: 'Dirección pública de la tienda principal. Las secundarias usan el dominio de tiendas configurado; vacío conserva la configuración del entorno.',
      placeholder: 'https://tienda.midominio.com',
    },

    {
      key: 'MULTISTORE_SITE_HOST_SUFFIX',
      env: ['MULTISTORE_SITE_HOST_SUFFIX'],
      type: 'string',
      tier: 'runtime',
      group: 'URL pública',
      label: 'Dominio de las tiendas',
      help: 'Dominio wildcard configurado en el storefront. Cada tienda usa su subdominio; requiere DNS y certificado previamente habilitados.',
      placeholder: '.tiendas.ejemplo.com',
      refine: value => !value || normalizeSiteSuffix(String(value)) ? null : 'Ingresá un dominio válido, sin protocolo, puerto ni rutas.',
    },

    // ─── Importación de catálogo ─────────────────────────────────────────────
    // Las dos gobiernan al CLIENTE HTTP del importador, no al job que lo dispara.
    {
      key: 'DEMO_IMPORT_THROTTLE_MS',
      env: ['DEMO_IMPORT_THROTTLE_MS'],
      type: 'number',
      tier: 'runtime',
      group: 'Importación de catálogo',
      label: 'Espera mínima entre pedidos (ms)',
      // Una oración. Qué hacer cuando la fuente devuelve 429 —y que el valor se lee EN
      // CADA request, así que se puede subir a mitad de una importación— está en "El
      // ritmo del importador es de la instalación" del drawer.
      help: 'Separación garantizada entre dos requests salientes a la tienda de origen, para no despertarle el rate limiter (0 apaga el throttling).',
      min: 0,
      max: 10_000,
      step: 50,
      default: 200,
    },
    {
      key: 'DEMO_IMPORT_BACKOFF_BASE_MS',
      env: ['DEMO_IMPORT_BACKOFF_BASE_MS'],
      type: 'number',
      tier: 'runtime',
      group: 'Importación de catálogo',
      label: 'Base del backoff exponencial (ms)',
      // Se conserva la fórmula, que es de ESTE campo. Que el `Retry-After` de la fuente
      // gane siempre está en la misma sección del drawer que el ajuste de arriba.
      help: 'Punto de partida de la espera entre reintentos: el intento N espera `base × 2^(N-1)`, con techo de 20 s.',
      min: 0,
      max: 30_000,
      step: 100,
      default: 1000,
    },
  ],
});
