/**
 * Carga el footer de una tienda desde un archivo JSON.
 *
 * Mismo molde que `seed-legal-pages.ts` y por el mismo motivo: el backoffice es el
 * lugar para corregir un teléfono, no para dar de alta un footer entero. El script
 * es GENÉRICO y el contenido NO vive acá — el boilerplate no lleva datos de ningún
 * cliente. El JSON va en el repo del proyecto.
 *
 *   # plan, no escribe (desde apps/backend)
 *   pnpm seed:site-footer ../../data/footer/cliente.json site:dsm_01H…
 *   # escribe
 *   pnpm seed:site-footer ../../data/footer/cliente.json site:dsm_01H… apply
 *
 * OJO con la forma de los argumentos: `medusa exec` parsea con yargs y RECHAZA
 * cualquier flag que no conozca, así que todo va POSICIONAL. La tienda va como
 * `site:<id>` y acá es OBLIGATORIA: el footer es de UNA tienda (una fila de
 * `demo_store`), no un setting de instancia con fila global. El id se copia del
 * listado de Tiendas del backoffice.
 *
 * ─── LO QUE ESTE SCRIPT CUIDA ──────────────────────────────────────────────
 *
 * `POST /admin/sites/{id}` y `updateDemoStores` REEMPLAZAN la columna
 * `content_config` entera. Escribir `{ footer }` a secas le borraría a la tienda
 * `sections`, `sucursales`, `shoppingList` y todo lo demás. Así que lee la fila,
 * hace spread de lo que ya está y sólo pisa `footer` y `contact`.
 *
 * ARRANCA EN DRY RUN.
 *
 * Forma del JSON (todo opcional; lo que falte cae al default del template):
 *
 *   {
 *     "footer": {
 *       "description": "…",
 *       "social":  [{ "name": "Instagram", "href": "https://…", "icon": "instagram" }],
 *       "legal":   [{ "name": "Política de privacidad", "href": "/legal/legals" }],
 *       "newsletter": { "title": "…", "placeholder": "…", "buttonText": "…" },
 *       "copyright": "NOMBRE © {year} Todos los derechos reservados."
 *     },
 *     "contact": { "phone": "…", "email": "…", "address": "…", "hours": "…" }
 *   }
 *
 * `contact` va aparte de `footer` a propósito: es el MISMO dato que usa la página
 * de contacto, así que vive en `content_config.contact`. Partirlo en dos lugares
 * habría dejado dos teléfonos que se contradicen.
 *
 * NOTE: requiere DB alcanzable.
 */
import { readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import type { ExecArgs, Logger } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { DEMO_STORE_MODULE } from '../modules/demo-store';

type RawFooter = {
  description?: unknown;
  social?: unknown;
  legal?: unknown;
  newsletter?: unknown;
  copyright?: unknown;
};
type RawSeed = { footer?: RawFooter; contact?: Record<string, unknown> };

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;

/** Filas con nombre Y destino. Una red social sin URL es un ícono que no lleva a nada. */
function usableRows(value: unknown): { name: string; href: string; icon?: string }[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      const r = (row ?? {}) as Record<string, unknown>;
      const name = asString(r.name);
      const href = asString(r.href);
      if (!name || !href) return null;
      const icon = asString(r.icon);
      return { name, href, ...(icon ? { icon } : {}) };
    })
    .filter((r): r is { name: string; href: string; icon?: string } => r !== null);
}

function parseSeedFile(path: string): RawSeed {
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
    throw new Error(`${absolute} tiene que ser un objeto con \`footer\` y/o \`contact\`.`);
  }
  const entries = Object.keys(parsed as Record<string, unknown>);
  // Una clave mal escrita se ignoraría en silencio y el operador vería el footer sin
  // cambios sin ninguna explicación.
  const unknown = entries.filter((k) => k !== 'footer' && k !== 'contact');
  if (unknown.length) {
    throw new Error(
      `Claves desconocidas en ${absolute}: ${unknown.join(', ')}. Sólo van \`footer\` y \`contact\`.`,
    );
  }
  return parsed as RawSeed;
}

export default async function seedSiteFooter({ container, args }: ExecArgs) {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const service: any = container.resolve(DEMO_STORE_MODULE);

  const apply = args.some((a) => a === 'apply' || a === '--apply');
  const siteArg = args.find((a) => a.startsWith('site:'));
  const siteId = siteArg ? siteArg.slice('site:'.length) : '';
  const filePath = args.find(
    (a) => a !== 'apply' && a !== '--apply' && !a.startsWith('site:'),
  );

  if (!filePath || !siteId) {
    logger.error(
      'Uso: medusa exec ./src/scripts/seed-site-footer.ts <ruta.json> site:<id> [apply]. ' +
        'La tienda es obligatoria: el footer es de una tienda, no de la instancia.',
    );
    return;
  }

  const seed = parseSeedFile(filePath);

  let demo: any;
  try {
    demo = await service.retrieveDemoStore(siteId);
  } catch {
    logger.error(`No existe la tienda ${siteId}. El id se copia del listado de Tiendas.`);
    return;
  }

  const current = (demo.content_config ?? {}) as Record<string, unknown>;
  const currentFooter = (current.footer ?? {}) as Record<string, unknown>;
  const currentContact = (current.contact ?? {}) as Record<string, unknown>;

  const rawFooter = seed.footer ?? {};
  const social = usableRows(rawFooter.social);
  const legal = usableRows(rawFooter.legal);
  const newsletterRaw = (rawFooter.newsletter ?? {}) as Record<string, unknown>;
  const newsletter = {
    ...(asString(newsletterRaw.title) ? { title: asString(newsletterRaw.title) } : {}),
    ...(asString(newsletterRaw.placeholder)
      ? { placeholder: asString(newsletterRaw.placeholder) }
      : {}),
    ...(asString(newsletterRaw.buttonText)
      ? { buttonText: asString(newsletterRaw.buttonText) }
      : {}),
  };

  const footer = {
    ...(asString(rawFooter.description)
      ? { description: asString(rawFooter.description) }
      : {}),
    ...(social.length ? { social } : {}),
    ...(legal.length ? { legal } : {}),
    ...(Object.keys(newsletter).length ? { newsletter } : {}),
    ...(asString(rawFooter.copyright) ? { copyright: asString(rawFooter.copyright) } : {}),
  };

  const rawContact = seed.contact ?? {};
  const contact = {
    ...(asString(rawContact.phone) ? { phone: asString(rawContact.phone) } : {}),
    ...(asString(rawContact.email) ? { email: asString(rawContact.email) } : {}),
    ...(asString(rawContact.address) ? { address: asString(rawContact.address) } : {}),
    ...(asString(rawContact.hours) ? { hours: asString(rawContact.hours) } : {}),
  };

  logger.info('================================================');
  logger.info(`${apply ? 'ESCRIBIENDO' : 'DRY RUN'} — footer de "${demo.name}" (${siteId})`);
  logger.info(`Archivo: ${resolvePath(process.cwd(), filePath)}`);
  logger.info('================================================');

  const describe = (label: string, before: unknown, after: unknown) => {
    const had = before !== undefined && before !== null;
    logger.info(`  ${label}: ${had ? 'REEMPLAZA lo que había' : 'nuevo'} → ${JSON.stringify(after)}`);
  };

  if (Object.keys(footer).length) {
    logger.info('footer:');
    for (const key of Object.keys(footer)) {
      describe(key, currentFooter[key], (footer as Record<string, unknown>)[key]);
    }
    // Las sub-claves que el JSON NO trae quedan afuera del objeto que se escribe, y
    // `assets.footer` se mergea shallow POR CLAVE: el footer del template repone lo
    // que falte. Vale decirlo porque es lo contrario de lo intuitivo.
    const dropped = Object.keys(currentFooter).filter((k) => !(k in footer));
    if (dropped.length) {
      logger.warn(
        `  ⚠ estas sub-claves del footer actual NO están en el JSON y se PIERDEN: ${dropped.join(', ')}`,
      );
    }
  } else {
    logger.info('footer: el JSON no trae nada — no se toca.');
  }

  if (Object.keys(contact).length) {
    logger.info('contact (compartido con la página de contacto):');
    for (const key of Object.keys(contact)) {
      describe(key, currentContact[key], (contact as Record<string, unknown>)[key]);
    }
  } else {
    logger.info('contact: el JSON no trae nada — no se toca.');
  }

  if (!apply) {
    logger.info('');
    logger.info('DRY RUN: no se escribió nada. Agregá `apply` para escribir.');
    return;
  }

  if (!Object.keys(footer).length && !Object.keys(contact).length) {
    logger.warn('Nada que escribir.');
    return;
  }

  // Spread de `current`: `updateDemoStores` REEMPLAZA la columna entera, así que sin
  // esto la tienda perdería `sections`, `sucursales`, `shoppingList` y el resto.
  await service.updateDemoStores({
    id: siteId,
    content_config: {
      ...current,
      ...(Object.keys(footer).length ? { footer } : {}),
      ...(Object.keys(contact).length ? { contact } : {}),
    },
  });

  logger.info('');
  logger.info('✔ Footer guardado. Puede tardar hasta un minuto en verse (cache de config).');
}
