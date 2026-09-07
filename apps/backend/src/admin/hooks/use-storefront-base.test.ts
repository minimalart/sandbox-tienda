import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * EL TRIPWIRE DE LA URL PÚBLICA.
 *
 * Este archivo existe porque el mismo bug volvió TRES veces, y las tres por la misma
 * razón estructural: el admin resolvía el dominio del storefront en BUILD.
 *
 * `VITE_STOREFRONT_URL` se inyecta al compilar y el Dockerfile de despliegue no recibe
 * build args `VITE_*`, así que en toda instalación real llega vacía y el código cae al
 * literal que tenga escrito el template. El literal del template es el dominio de UNA
 * marca, entonces el listado de tiendas de cualquier otra instalación linkeaba a la
 * tienda de otro cliente: un `href` que se ve perfecto y abre el sitio equivocado.
 *
 * Se parcheó dos veces cambiando el literal en el repo del cliente. Las dos veces el
 * sync desde el template lo revirtió —el literal es del template, el dominio es del
 * cliente— y nadie lo notó hasta el siguiente reporte. No hay literal que sirva: en
 * build no se sabe de qué instalación se trata. La base es un dato de RUNTIME y sale
 * de `GET /admin/store-config/storefront-url` vía `useStorefrontBase()`.
 *
 * Un comentario explicando esto no alcanzó las dos primeras veces. Esto sí: cualquiera
 * que vuelva a leer la variable en build se pone rojo el día que lo escribe.
 */

const ADMIN_DIR = join(import.meta.dirname, '..');

/**
 * El ÚNICO lugar del admin donde `VITE_STOREFRONT_URL` es legítima: el fallback del
 * hook, mientras la query no resolvió. Ahí es un valor de arranque, no la fuente.
 */
const HOOK = 'hooks/use-storefront-base.ts';

/**
 * Las pantallas que antes leían la variable migraron con blog y landing pages a sus
 * plugins publicados. En el host no queda ninguna excepción: cualquier lector nuevo
 * tiene que resolver la base en runtime mediante `useStorefrontBase()`.
 */
const KNOWN: string[] = [];

const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
};

const readers = walk(ADMIN_DIR)
  .map((path) => ({ file: path.slice(ADMIN_DIR.length + 1).split('\\').join('/'), source: readFileSync(path, 'utf8') }))
  // Que la LEA, no que la nombre. El `.` (o el `[`) es lo que separa el acceso a la
  // variable de la prosa que la menciona: los comentarios que explican por qué NO hay
  // que usarla la escriben entre backticks, y contarlos habría puesto rojo justamente
  // al archivo que documenta el arreglo — un ratchet que grita en falso se desactiva a
  // la semana, que es peor que no tenerlo.
  .filter(({ source }) => /[.[]\s*'?VITE_STOREFRONT_URL/.test(source))
  .map(({ file }) => file)
  .filter((file) => file !== HOOK)
  .sort();

test('nadie nuevo resuelve el dominio del storefront en build', () => {
  assert.deepEqual(
    readers,
    KNOWN,
    `Cambió quién lee \`VITE_STOREFRONT_URL\` en \`src/admin\`.\n\n` +
      `Esperado: ${KNOWN.join(', ') || '(nadie)'}\n` +
      `Encontrado: ${readers.join(', ') || '(nadie)'}\n\n` +
      `Esa variable se inyecta en BUILD y el Dockerfile de despliegue no la recibe, así ` +
      `que en producción llega vacía y el código cae a su literal —el dominio de otra ` +
      `instalación—. Si agregaste un lector: usá \`useStorefrontBase()\`, que la pide al ` +
      `backend. Si migraste uno: gracias, sacalo de \`KNOWN\`.`,
  );
});

test('el fallback del hook es local, nunca el dominio de una instalación', () => {
  const source = readFileSync(join(ADMIN_DIR, HOOK), 'utf8');
  const literals = source.match(/'https?:\/\/[^']+'/g) ?? [];

  assert.deepEqual(
    literals.filter((literal) => !/\/\/(localhost|127\.0\.0\.1)/.test(literal)),
    [],
    `El fallback del hook tiene un dominio concreto: ${literals.join(', ')}.\n\n` +
      `Tiene que ser localhost. La diferencia no es estética: un link a localhost se ve ` +
      `roto y no engaña a nadie, mientras que uno al dominio de otra marca se ve bien, ` +
      `abre la tienda de otro cliente y se reporta como un bug de otra cosa —que es ` +
      `exactamente cómo este bug sobrevivió tres veces—.`,
  );
});
