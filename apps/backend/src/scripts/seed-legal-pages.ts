/**
 * Carga los textos legales de un sitio desde un archivo JSON.
 *
 * Existe porque el backoffice es el lugar para EDITAR una cláusula, no para dar de
 * alta un documento entero: cargar a mano las 18 secciones de las tres páginas de un
 * cliente son 18 formularios, y el error de tipeo en el nombre de una sección se paga
 * en el ancla del índice.
 *
 * El script es GENÉRICO y el contenido NO vive acá: el boilerplate no lleva datos de
 * ningún cliente. El JSON vive en el repo del proyecto (por ejemplo
 * `data/legal-pages/<cliente>.json` en el repo del cliente) y se pasa por argumento.
 *
 *   # plan, no escribe (desde apps/backend)
 *   pnpm seed:legal-pages ../../data/legal-pages/cliente.json
 *   # escribe
 *   pnpm seed:legal-pages ../../data/legal-pages/cliente.json apply
 *   # escribe en UNA tienda (instalación multitienda)
 *   pnpm seed:legal-pages ../../data/legal-pages/cliente.json apply site:dsm_01H…
 *
 * OJO con la forma de los argumentos: `medusa exec` parsea con yargs y RECHAZA
 * cualquier flag que no conozca ("Unknown argument: file"), así que todo va POSICIONAL.
 * Por eso la tienda se pasa como `site:<id>` y no como `--site=<id>`.
 *
 * `site:` toma el ID de la tienda, no el slug: resolver un slug necesitaría el módulo
 * de sitios, que puede no estar instalado. El id se copia del listado de Tiendas del
 * backoffice. Sin `site:` se escribe la fila GLOBAL, que es lo correcto en una
 * instalación mono-tienda (y el fallback del que heredan las demás).
 *
 * ARRANCA EN DRY RUN. Y es idempotente en el sentido que importa: `upsertLegalPages`
 * mergea POR PÁGINA sobre lo guardado, así que un JSON con una sola página no le toca
 * las otras dos. Dentro de una página, en cambio, `sections` REEMPLAZA el array
 * entero — es lo correcto (el orden es el dato) pero significa que correr el script
 * DESPUÉS de que alguien editó en el backoffice le pisa el trabajo. El plan lo avisa.
 *
 * NOTE: requiere DB alcanzable, igual que las migraciones y el resto de los backfills.
 */
import { readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import type { ExecArgs, Logger } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { STORE_CONFIG_MODULE } from '../modules/store-config';
import type StoreConfigModuleService from '../modules/store-config/service';
import {
  LEGAL_PAGE_SLUGS,
  isLegalPageSlug,
  type LegalPageSlug,
} from '../modules/store-config/legal/pages';

/**
 * Marcador de una sección cuyo texto todavía no se escribió.
 *
 * Un esqueleto es legítimo —se cargan los nombres y el orden, y el texto se redacta
 * después— pero NO puede quedar invisible: `normalizeSection` descarta la sección sin
 * cuerpo, así que sin un placeholder las secciones a redactar simplemente no se
 * guardarían y el operador abriría el backoffice con la mitad del índice faltando.
 *
 * El texto es a propósito imposible de confundir con contenido real. Se cuenta y se
 * reporta al final: publicar "pendiente de redacción" en una legal es malo, pero es
 * VISIBLE — al revés que el "La Empresa S.A." del texto de ejemplo, que se lee como
 * si fuera propio.
 */
export const LEGAL_PLACEHOLDER_MARK = 'PENDIENTE DE REDACCIÓN';

type RawSection = { id?: unknown; name?: unknown; html?: unknown };
type RawDoc = {
  title?: unknown;
  intro?: unknown;
  updated_label?: unknown;
  sections?: unknown;
  seo_description?: unknown;
};

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value : undefined;

/** Lee y valida la forma del JSON. Tira con un mensaje útil, no con un stack. */
function parseSeedFile(path: string): Partial<Record<LegalPageSlug, RawDoc>> {
  const absolute = resolvePath(process.cwd(), path);
  let raw: string;
  try {
    raw = readFileSync(absolute, 'utf8');
  } catch (error) {
    throw new Error(
      `No se pudo leer ${absolute}: ${(error as Error)?.message ?? 'error desconocido'}. ` +
        'La ruta se resuelve desde el directorio donde corre el comando (apps/backend).',
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`${absolute} no es JSON válido: ${(error as Error)?.message}`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(
      `${absolute} tiene que ser un objeto con las páginas como claves ` +
        `(${LEGAL_PAGE_SLUGS.join(', ')}).`,
    );
  }

  const entries = Object.entries(parsed as Record<string, unknown>);
  // Una clave mal escrita (`conditons`) se IGNORARÍA en silencio y el operador vería
  // una página sin cargar sin ninguna explicación. Mejor cortar acá.
  const unknown = entries.filter(([key]) => !isLegalPageSlug(key)).map(([key]) => key);
  if (unknown.length) {
    throw new Error(
      `Claves desconocidas en ${absolute}: ${unknown.join(', ')}. ` +
        `Las válidas son: ${LEGAL_PAGE_SLUGS.join(', ')}.`,
    );
  }

  return Object.fromEntries(entries) as Partial<Record<LegalPageSlug, RawDoc>>;
}

type PagePlan = {
  slug: LegalPageSlug;
  title?: string;
  sections: { name: string; pending: boolean }[];
  /** Secciones del JSON que se van a DESCARTAR por no tener nombre o cuerpo. */
  dropped: number;
  /** Cuántas secciones tenía la fila guardada antes de esta corrida. */
  existing: number;
};

export default async function seedLegalPages({ container, args }: ExecArgs) {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const service = container.resolve<StoreConfigModuleService>(STORE_CONFIG_MODULE);

  const apply = args.some((a) => a === 'apply' || a === '--apply');
  const siteArg = args.find((a) => a.startsWith('site:'));
  const siteId = siteArg ? siteArg.slice('site:'.length) || null : null;
  const filePath = args.find(
    (a) => a !== 'apply' && a !== '--apply' && !a.startsWith('site:'),
  );

  if (!filePath) {
    logger.error(
      'Falta la ruta del JSON. Uso: medusa exec ./src/scripts/seed-legal-pages.ts <ruta.json> [apply] [site:<id>]',
    );
    return;
  }

  const seed = parseSeedFile(filePath);
  const slugs = LEGAL_PAGE_SLUGS.filter((slug) => seed[slug]);

  if (!slugs.length) {
    logger.error(`${filePath} no trae ninguna de las tres páginas. No hay nada que hacer.`);
    return;
  }

  // El estado ACTUAL, para poder avisar qué se va a sobrescribir. Se lee antes de
  // escribir nada, incluso en modo apply.
  const before = await service.getLegalPages(siteId);

  const plans: PagePlan[] = slugs.map((slug) => {
    const doc = seed[slug] as RawDoc;
    const rawSections = Array.isArray(doc.sections) ? (doc.sections as RawSection[]) : [];
    const usable = rawSections.filter(
      (s) => asString(s?.name) !== undefined && asString(s?.html) !== undefined,
    );
    return {
      slug,
      title: asString(doc.title),
      sections: usable.map((s) => ({
        name: asString(s.name) as string,
        pending: (asString(s.html) as string).includes(LEGAL_PLACEHOLDER_MARK),
      })),
      dropped: rawSections.length - usable.length,
      existing: before.customized[slug] ? before.pages[slug].sections.length : 0,
    };
  });

  logger.info('================================================');
  logger.info(
    `${apply ? 'ESCRIBIENDO' : 'DRY RUN'} — legales de ${
      siteId ? `la tienda ${siteId}` : 'la fila GLOBAL (instalación mono-tienda)'
    }`,
  );
  logger.info(`Archivo: ${resolvePath(process.cwd(), filePath)}`);
  logger.info('================================================');

  let pending = 0;
  for (const plan of plans) {
    logger.info('');
    logger.info(`── ${plan.slug}${plan.title ? ` — "${plan.title}"` : ''}`);
    if (plan.existing > 0) {
      // `sections` reemplaza el array entero, así que esto NO es un detalle.
      logger.warn(
        `   ⚠ esta página YA tiene ${plan.existing} sección(es) guardadas y se ` +
          'REEMPLAZAN por completo. Si alguien editó en el backoffice, se pierde.',
      );
    }
    plan.sections.forEach((section, index) => {
      pending += section.pending ? 1 : 0;
      logger.info(
        `   ${String(index + 1).padStart(2)}. ${section.name}${
          section.pending ? '   ← PENDIENTE DE REDACCIÓN' : ''
        }`,
      );
    });
    if (plan.dropped > 0) {
      logger.warn(
        `   ⚠ ${plan.dropped} sección(es) del JSON se descartan por no tener nombre o cuerpo.`,
      );
    }
  }

  const total = plans.reduce((acc, p) => acc + p.sections.length, 0);
  logger.info('');
  logger.info('================================================');
  logger.info(`${total} secciones en ${plans.length} página(s); ${pending} sin redactar.`);

  if (!apply) {
    logger.info('DRY RUN: no se escribió nada. Agregá `apply` para escribir.');
    return;
  }

  for (const slug of slugs) {
    await service.upsertLegalPages(
      { [slug]: seed[slug] as Record<string, unknown> },
      siteId,
    );
    logger.info(`✔ ${slug} guardado`);
  }

  if (pending > 0) {
    logger.warn(
      `Quedan ${pending} secciones con "${LEGAL_PLACEHOLDER_MARK}" publicadas. ` +
        'Completalas en Preferencias → Legales antes de que el sitio salga.',
    );
  }
}
