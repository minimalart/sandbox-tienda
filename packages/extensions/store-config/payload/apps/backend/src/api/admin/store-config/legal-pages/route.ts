import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { z } from 'zod';
import { siteFromRequest } from '../../../../lib/multistore/request';
import { STORE_CONFIG_MODULE } from '../../../../modules/store-config';
import type StoreConfigModuleService from '../../../../modules/store-config/service';

/**
 * La tienda cuya configuración se está viendo o editando. `null` = la fila GLOBAL
 * de la instancia, que es el fallback de toda tienda que no defina el suyo. Mismo
 * helper y misma razón que en `email-branding/route.ts`.
 */
const siteOf = async (req: MedusaRequest): Promise<string | null> => {
  const resolution = await siteFromRequest(req);
  return resolution.status === 'site' ? resolution.site.id : null;
};

/**
 * Una sección. Los tres campos son laxos a propósito: la validación de verdad —qué
 * sección se descarta y qué HTML sobrevive— vive en `normalizeSection`, del lado del
 * módulo, para que sea la MISMA tanto si el guardado entra por acá como si entra por
 * un script. Un 400 acá sólo protege del payload absurdo.
 */
const SectionSchema = z.object({
  id: z.string().max(120).optional(),
  name: z.string().max(300).optional(),
  html: z.string().max(200_000).optional(),
});

/**
 * Un documento parcial: se puede mandar sólo el campo que se editó.
 *
 * Todos los strings aceptan cadena vacía porque es lo que emite el formulario cuando
 * el operador borra un campo, y el service la lee como "volvé al default" en vez de
 * publicar una legal en blanco. Sin el `''` permitido, ese guardado devolvería un 400
 * y el editor quedaría trabado con un texto que ya no se ve.
 *
 * Y los tres campos que `LegalPageDoc` declara `string | null` aceptan **`null`**,
 * porque es lo que devuelve el GET de esta misma ruta y el editor manda de vuelta el
 * documento entero. `updated_label` arranca en `null` en las TRES páginas por diseño
 * (es una afirmación del cliente sobre su documento, no un timestamp), así que sin
 * esto NINGUNA legal se podía guardar hasta que alguien escribiera algo en "Última
 * actualización": el 400 decía `expected string, received null`.
 *
 * La regla que se rompió es más general que este campo: lo que la ruta DEVUELVE tiene
 * que poder volver a entrar. Por eso van los tres nullables y no sólo el que falló.
 * `normalizeStoredDoc` ya trata el `null` igual que el `''` — lo omite y la página cae
 * a su default — así que abajo del schema no cambia nada.
 *
 * `sections` es un ARRAY y su orden ES el orden del documento (ver `LegalSection`).
 * El tope de 100 no es una regla de negocio: es el techo que evita que un bug del
 * formulario escriba una fila de megabytes en `store_setting`.
 */
const DocSchema = z.object({
  title: z.string().max(200).optional(),
  intro: z.string().max(2_000).nullable().optional(),
  updated_label: z.string().max(120).nullable().optional(),
  sections: z.array(SectionSchema).max(100).optional(),
  seo_description: z.string().max(500).nullable().optional(),
});

/**
 * Las tres claves van ESCRITAS, no derivadas de `LEGAL_PAGE_SLUGS` con un
 * `fromEntries`: Zod pierde el tipo del shape armado en runtime y habría que
 * castearlo, que es exactamente donde un slug mal escrito deja de ser un error de
 * compilación. Si algún día hay una cuarta legal, el compilador la pide acá.
 */
export const UpdateLegalPagesSchema = z.object({
  pages: z.object({
    legals: DocSchema.optional(),
    conditions: DocSchema.optional(),
    exchangesAndReturns: DocSchema.optional(),
  }),
});

/**
 * GET /admin/store-config/legal-pages — los tres textos legales de la tienda activa,
 * completos, más `customized` (qué páginas siguen mostrando el texto de ejemplo).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const service: StoreConfigModuleService = req.scope.resolve(STORE_CONFIG_MODULE);
    const { pages, customized } = await service.getLegalPages(await siteOf(req));
    return res.status(200).json({ legal_pages: pages, customized });
  } catch (error) {
    console.error('[Admin StoreConfig] Error reading legal pages:', error);
    return res.status(500).json({ message: 'Error reading legal pages' });
  }
}

/** POST /admin/store-config/legal-pages — upsert parcial de una o varias páginas. */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const body = UpdateLegalPagesSchema.parse(req.body);
    const service: StoreConfigModuleService = req.scope.resolve(STORE_CONFIG_MODULE);
    const { pages, customized } = await service.upsertLegalPages(
      body.pages,
      await siteOf(req),
    );
    return res.status(200).json({ legal_pages: pages, customized });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error updating legal pages';
    console.error('[Admin StoreConfig] Error updating legal pages:', message);
    return res.status(400).json({ message });
  }
}
