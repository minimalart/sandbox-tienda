import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { siteFromRequest } from '../../../../lib/multistore/request';
import { readForeignSetting } from '../../../../modules/app-settings/foreign';
import { pickStorefrontBase } from './base';

/**
 * GET /admin/store-config/storefront-url
 *
 * Devuelve DOS campos, y la diferencia entre ellos es el punto del handler:
 *
 *   `url`  — la URL de la TIENDA ACTIVA (`<base>/tienda/<slug>` si no es la
 *            principal). Es lo que necesita el Preview de una landing o de un
 *            artículo: cuelga de la tienda en la que el operador está parado.
 *   `base` — la base de la INSTANCIA, sin prefijo de tienda. Es lo que necesita
 *            quien arma él mismo la URL de una tienda que elige por separado —el
 *            listado de tiendas linkea a la FILA, no a la activa—.
 *
 * Antes devolvía sólo `url`, y las pantallas que necesitaban la base no tenían de
 * dónde sacarla en runtime: leían `VITE_STOREFRONT_URL`, que se inyecta en BUILD y
 * el Dockerfile de DO no recibe build args `VITE_*`. Caían entonces al literal
 * hardcodeado del template, así que el listado de una instalación linkeaba al
 * dominio de OTRA marca —un link que parece correcto y abre la tienda de otro—.
 * Ese literal no puede existir: en build no se sabe de qué instalación se trata.
 * Por eso la base se sirve desde acá, donde el proceso sí conoce su entorno.
 *
 * Usar `url` como si fuera `base` es el error espejo y también da 404: quien le
 * agrega su propio prefijo termina con `/tienda/activa/tienda/elegida`.
 *
 * ─── DE DÓNDE SALE `base`, EN ORDEN ─────────────────────────────────────────
 *
 *   1. `MULTISTORE_PUBLIC_BASE_URL` de la card de Multitienda (fila en la base).
 *   2. La misma clave por entorno.
 *   3. `STOREFRONT_URL`.
 *   4. El primer origin público de `STORE_CORS` (en producción ya es el dominio
 *      del storefront).
 *   5. `http://localhost:3000`.
 *
 * El escalón 1 es el que se agregó: sin él, corregir el dominio del link que el
 * listado de tiendas le muestra al operador exigía editar la config del deploy y
 * redeployar el backend. Los escalones 3 a 5 son los de siempre, en el mismo
 * orden, así que una instalación que no cargue nada en la card se comporta
 * exactamente como antes. Por qué la clave es nueva y no `STOREFRONT_URL` editable
 * está escrito en `modules/app-settings/descriptors/multistore.ts`.
 *
 * `readForeignSetting` y no un import del módulo de Multitienda: la lectura tiene
 * que degradar sola si esa extensión no está instalada en el proyecto, que es
 * justo el contrato de `app-settings/foreign.ts`. Los escalones 4 y 5 —y la
 * normalización de la barra final— viven en `base.ts`, que es puro y tiene test.
 */

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // Escalones 1 a 3 de la precedencia: fila de la card, su env, y `STOREFRONT_URL`.
  const configured = readForeignSetting('extension:multistore', 'MULTISTORE_PUBLIC_BASE_URL', {
    envFallback: ['MULTISTORE_PUBLIC_BASE_URL', 'STOREFRONT_URL'],
  });

  const base = pickStorefrontBase(configured, process.env.STORE_CORS);

  /**
   * La URL de la TIENDA activa, no la de la instancia.
   *
   * Sin esto, el link "Preview" de una landing de la tienda B abre el storefront de
   * la principal: el operador ve una página que parece la suya, no encuentra su
   * contenido y reporta que la landing "no se publicó".
   *
   * La ruta pública NO es configurable —el certificado es un wildcard—, así que se
   * deriva del slug: `/tienda/<slug>`, y `/` para la principal. Es la misma
   * convención que arma `modules/store-config/site-gate.ts`.
   */
  const resolution = await siteFromRequest(req);
  const site = resolution.status === 'site' ? resolution.site : null;
  const url = site && !site.is_main ? `${base}/tienda/${site.slug}` : base;

  res.json({ url, base });
}
