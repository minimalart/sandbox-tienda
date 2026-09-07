import { defineSettings } from './types';

/**
 * Ajustes de Cuentas Corporativas.
 *
 * El manifest declara `environment: []` y el código lee TRES variables: es
 * deriva pura, del tipo que `env-coverage.test.ts` existe para encontrar. Las
 * tres eran invisibles — ni el instalador de `apps/platform` las pide, ni el
 * admin las muestra —, así que hoy toda instalación corre con los defaults
 * hardcodeados y nadie se entera.
 *
 * ─── LAS TRES NO SON LA MISMA CLASE DE AJUSTE ────────────────────────────────
 *
 * `CORPORATE_ACTIVATION_MODE` es POLÍTICA DE LA TIENDA: decide si una empresa
 * que se registra queda operativa sola o espera aprobación humana. Dos tiendas
 * del mismo backend pueden querer lo contrario (la mayorista aprueba a mano, la
 * de retail no tiene a nadie mirando la cola). Va `site`.
 *
 * Las dos de `WHOLESALE_*` configuran UN script de instalación
 * (`scripts/create-wholesale-price-list.ts`) que crea UNA lista de precios para
 * toda la instancia, atada a todos los customer groups mayoristas que encuentre
 * — de companies Y de corporates, sin filtrar por tienda. Declararlas `site`
 * sería mentir sobre lo que hacen: no hay una lista por tienda que configurar.
 * Van `instance`.
 *
 * ─── LÍMITE DE LA LECTURA SINCRÓNICA ─────────────────────────────────────────
 *
 * `modules/corporate/settings.ts` lee por el camino sync (snapshot), así que hoy
 * el `site` de `CORPORATE_ACTIVATION_MODE` se resuelve como instancia
 * (`global ?? env ?? default`) — el cartel largo está en
 * `app-settings/resolve.ts:resolveSettingSync`. Se declara `site` igual y a
 * propósito: el consumidor es una ruta de store (`api/store/corporates/register`)
 * que SÍ tiene request y por lo tanto tiene de dónde sacar la tienda. El día que
 * ese call site pase la `SiteResolution`, el descriptor ya está bien y no hay
 * que migrar el scope de una fila viva.
 *
 * Y el fail-closed de ese día es benigno: una tienda secundaria sin fila cae al
 * fallback de código, que es `'manual'` — o sea, más conservador, no menos.
 */
export default defineSettings({
  namespace: 'extension:corporate',
  title: 'Cuentas corporativas',
  defaultScope: 'site',
  settings: [
    // ─── Alta de cuentas ─────────────────────────────────────────────────────
    {
      key: 'CORPORATE_ACTIVATION_MODE',
      env: ['CORPORATE_ACTIVATION_MODE'],
      type: 'enum',
      tier: 'runtime',
      group: 'Alta de cuentas',
      label: 'Modo de activación',
      /**
       * UNA oración. Qué hace cada modo ya lo dicen los `label` de las opciones de
       * abajo —repetirlo en prosa es leerlo dos veces—, y el riesgo de "Automática"
       * sin validación de CUIT detrás es la primera sección del drawer.
       */
      help: 'Qué pasa cuando una empresa se registra desde el storefront.',
      options: [
        { value: 'manual', label: 'Manual — requiere aprobación' },
        { value: 'automatic', label: 'Automática — opera al registrarse' },
      ],
      /**
       * `manual` y no `automatic`: es el valor que ya tenía el código
       * (`api/store/corporates/register/route.ts:10` sólo activa solo con el
       * string exacto `'automatic'`). Cambiar el default acá le abriría los
       * precios mayoristas a toda instalación existente en el deploy.
       */
      default: 'manual',
    },

    // ─── Lista mayorista ─────────────────────────────────────────────────────
    {
      key: 'WHOLESALE_DISCOUNT',
      env: ['WHOLESALE_DISCOUNT'],
      type: 'number',
      tier: 'runtime',
      /**
       * `instance`: la lista de precios es una sola para todo el backend. Ver la
       * nota de arriba.
       */
      scope: 'instance',
      group: 'Lista mayorista',
      label: 'Descuento mayorista',
      /**
       * UNA oración, y es la que NO se deduce parado frente al campo: un input
       * numérico con `max: 0.9` no dice si 0.2 es "20%" o "0,2%". Que cambiarlo
       * después no reprecie la lista existente es la sección "Guardar el descuento
       * no reprecia nada" del drawer.
       */
      help: 'FRACCIÓN, no porcentaje: 0.2 es 20% de descuento sobre el precio actual.',
      /**
       * `max: 0.9` y no `1`. Con 1 la lista mayorista queda a precio cero y el
       * script no tiene forma de saber que fue un error de tipeo: crea la lista,
       * la deja activa y recién se descubre con la primera orden. 90% de
       * descuento ya es absurdo, pero por lo menos cobra algo.
       */
      min: 0,
      max: 0.9,
      step: 0.01,
      default: 0.2,
    },
    {
      key: 'WHOLESALE_PRICE_LIST_TITLE',
      env: ['WHOLESALE_PRICE_LIST_TITLE'],
      type: 'string',
      tier: 'runtime',
      scope: 'instance',
      group: 'Lista mayorista',
      label: 'Título de la lista',
      /**
       * UNA oración. La consecuencia de cambiarlo —dos listas override en paralelo
       * sobre los mismos grupos— es la sección "El título es la clave de
       * idempotencia" del drawer, que es donde entra el ejemplo completo.
       */
      help: 'El título es la CLAVE DE IDEMPOTENCIA del script: si ya existe una lista con este título, no hace nada.',
      placeholder: 'Mayorista -20%',
      maxLength: 80,
      default: 'Mayorista -20%',
    },
  ],
});
