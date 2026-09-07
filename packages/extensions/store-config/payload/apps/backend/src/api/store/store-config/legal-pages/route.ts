import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { STORE_CONFIG_MODULE } from '../../../../modules/store-config';
import { LEGAL_PAGE_DEFAULTS } from '../../../../modules/store-config/legal/defaults';
import type StoreConfigModuleService from '../../../../modules/store-config/service';
import { siteIdFromPublishableKey } from '../../../../lib/multistore/publishable-key';

/**
 * GET /store/store-config/legal-pages — los textos de las tres páginas legales.
 *
 * El HTML sale ya SANEADO (se sanea al escribir, en `normalizeStoredDoc`), así que el
 * storefront lo inyecta con `dangerouslySetInnerHTML` sin trabajo extra. Es la misma
 * garantía que da el blog, movida del render a la escritura: ver el encabezado de
 * `legal/defaults.ts` para por qué acá se guarda HTML y no el JSON de Tiptap.
 *
 * `customized` NO se publica: es un dato del backoffice ("esta tienda todavía publica
 * el texto de ejemplo") y en el store sólo serviría para que un tercero audite qué
 * clientes no configuraron sus legales.
 *
 * Siempre 200: una legal que no carga es una página legal que no existe, y ante un
 * error de base es mejor servir el texto por defecto que un 500. El storefront tiene
 * su propio fallback para cuando ni esto responde.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const service: StoreConfigModuleService = req.scope.resolve(STORE_CONFIG_MODULE);
    /**
     * La tienda sale de la PUBLISHABLE KEY, no de un header: es el eje confiable del
     * store (ver `publishable-key.ts`). `null` = la fila global, que es lo correcto en
     * una instalación mono-tienda y el fallback de toda tienda sin texto propio.
     */
    const { pages } = await service.getLegalPages(await siteIdFromPublishableKey(req));
    return res.status(200).json({ legal_pages: pages });
  } catch (error) {
    console.error('[Store StoreConfig] Error reading legal pages:', error);
    return res.status(200).json({ legal_pages: LEGAL_PAGE_DEFAULTS });
  }
}
