import { defineSettings } from './types';

/**
 * Ajustes de B2B (empresas y compra mayorista).
 *
 * Una sola variable, y es de las peligrosas: un ID de entidad de Medusa
 * escrito a mano en un panel de deploy.
 *
 * ─── QUÉ HACE ────────────────────────────────────────────────────────────────
 *
 * `B2B_SALES_CHANNEL_ID` es el canal de ventas MAYORISTA que se le estampa a
 * cada empresa al crearla (`api/store/companies/register/route.ts:26` y
 * `api/admin/companies/route.ts:66,80`). No es cosmético: `company/site-scope.ts`
 * usa esa columna para decidir a qué TIENDA pertenece la empresa, cruzándola
 * contra los `channel_ids` de la tienda. Un canal equivocado no rompe nada
 * visible — la empresa se crea igual — pero queda colgada de la tienda que no
 * es, y sus pedidos cotizan con la lista de precios de otra.
 *
 * ─── POR QUÉ `refine` Y NO `pattern` ─────────────────────────────────────────
 *
 * Un `enum` sería lo ideal (elegir el canal de una lista en vez de pegar un ID),
 * pero los descriptores son DATOS ESTÁTICOS compartidos con el bundle del admin:
 * no pueden consultar los canales de la instalación. Queda validar la forma.
 *
 * Se usa `refine` y no `pattern` a propósito: `validate.ts:coerceString` corta
 * en el `pattern` ANTES de llegar al `refine`, y el mensaje que devuelve es "El
 * formato no es válido" — que para alguien que pegó el NOMBRE del canal en vez
 * del ID no dice absolutamente nada. Con `refine` el error nombra el formato
 * esperado y de dónde sacarlo. `pattern` tampoco aporta del otro lado: la UI
 * (`admin/components/app-settings/setting-field.tsx`) no lo renderiza.
 *
 * La validación corre SÓLO al guardar desde el admin: `coerceFromEnv` no valida
 * nada, así que una instalación con un valor raro en el entorno sigue
 * comportándose como antes de esta migración.
 */

/** `sc_` + ULID de 26 caracteres. Es lo que genera Medusa v2 para un sales channel. */
const SALES_CHANNEL_ID = /^sc_[0-9A-Z]{26}$/;

export default defineSettings({
  namespace: 'extension:b2b',
  title: 'B2B',
  /**
   * `site`. Cada tienda tiene su propio canal mayorista — `SiteRef.channel_ids`
   * incluye el `b2b_sales_channel_id` de la tienda —, así que un valor de
   * instancia estamparía a todas las empresas el canal de una sola. Ese fue un
   * bug real, el que documenta `company/site-scope.ts`.
   *
   * El fail-closed de una tienda secundaria sin fila propia deja la empresa con
   * `sales_channel_id: null`, que es EXACTAMENTE lo que pasa hoy cuando la env
   * no está (`?? null`): la empresa se crea sin canal y se le asigna después.
   * Heredar el canal de la tienda principal sería peor.
   */
  defaultScope: 'site',
  settings: [
    {
      key: 'B2B_SALES_CHANNEL_ID',
      env: ['B2B_SALES_CHANNEL_ID'],
      type: 'string',
      tier: 'runtime',
      group: 'Canal mayorista',
      label: 'Canal de ventas mayorista',
      /**
       * UNA oración. De dónde copiar el ID ya lo dice el `refine` de abajo —y lo
       * dice CUANDO hace falta, con el valor malo en pantalla, en vez de todo el
       * tiempo—; que cambiarlo no reasigna las empresas existentes es la sección
       * "Cambiarlo no reasigna nada" del drawer.
       */
      help: 'ID del canal al que se atan las empresas nuevas.',
      placeholder: 'sc_01KYBDZ85NFZK0F66T1G6ZBAHC',
      maxLength: 40,
      refine: (value) => {
        if (typeof value !== 'string') return 'Tiene que ser texto.';
        if (SALES_CHANNEL_ID.test(value.trim())) return null;
        return (
          'No parece el ID de un canal de ventas: tiene que empezar con "sc_" y seguir con ' +
          '26 caracteres (ej. sc_01KYBDZ85NFZK0F66T1G6ZBAHC). Copialo de Configuración → ' +
          'Canales de venta en vez de escribirlo.'
        );
      },
    },
  ],
});
