import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * Ningún `route.ts` propio puede estar en el MISMO path que uno de Medusa core.
 *
 * El incidente que motiva este test: al renombrar `/admin/demo-stores` a
 * `/admin/stores`, el `route.ts` nuevo quedó en el mismo path que el BUILT-IN de
 * Medusa (`@medusajs/medusa/dist/api/admin/stores/route.js`). El propio lo sombreó,
 * así que `retrieveActiveStore()` del admin — que pega a `GET /admin/stores`
 * esperando `{ stores: [...] }` — recibió `{ demo_stores, count, offset, limit }` y
 * tiró **"No active store found"**.
 *
 * Y no rompió sólo la pantalla nueva: `retrieveActiveStore` corre al ARRANCAR el
 * admin, así que se cayó el panel completo.
 *
 * Nada lo atrapaba. `tsc` no ve el ruteo por convención de archivos y el admin `.tsx`
 * está fuera del typecheck: sólo se manifestaba abriendo el navegador.
 *
 * ⚠ Lo que se compara es el PATH DEL `route.ts`, no el directorio. Agregar sub-rutas
 * bajo una ruta de core es un patrón legítimo y habitual en este repo
 * (`api/store/carts/…`, `api/admin/customers/…`): eso NO sombrea nada, porque core no
 * tiene un handler en esa sub-ruta. Comparar directorios daba falsos positivos.
 */

const API_DIR = import.meta.dirname;
const CORE_API = join(
  API_DIR,
  '..', '..',
  'node_modules', '@medusajs', 'medusa', 'dist', 'api',
);

/**
 * Paths de RUTA (el directorio que contiene el `route.*`), normalizados con `/`.
 *
 * Se devuelve el directorio y NO el archivo a propósito: comparar
 * `admin/stores/route.ts` contra `admin/stores/route.js` nunca interseca por la
 * extensión, y el test quedaba verde POR VACÍO — pasaba incluso recreando la
 * colisión real. Lo que define el path HTTP es el directorio.
 */
function routePaths(dir: string, ext: string): Set<string> {
  const found = new Set<string>();
  if (!existsSync(dir)) return found;

  const walk = (current: string): void => {
    for (const entry of readdirSync(current)) {
      if (entry.startsWith('_') || entry.startsWith('.')) continue;
      const full = join(current, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (entry === `route.${ext}`) {
        const route = relative(dir, current).split(sep).join('/');
        if (route) found.add(route);
      }
    }
  };

  walk(dir);
  return found;
}

const own = routePaths(API_DIR, 'ts');
const core = routePaths(CORE_API, 'js');

describe('ningún route.ts propio sombrea uno de Medusa core', () => {
  it('encuentra las rutas de core (si no, el test no valida nada)', () => {
    assert.ok(
      existsSync(CORE_API),
      `no encontré las rutas de core en ${CORE_API}. Si Medusa cambió el layout de su ` +
        `dist, hay que actualizar este path o el test da falsos verdes.`,
    );
    assert.ok(core.size > 50, `esperaba >50 route.js de core, encontré ${core.size}`);
  });

  it('encuentra las rutas propias', () => {
    assert.ok(own.size > 20, `esperaba >20 route.ts propios, encontré ${own.size}`);
  });

  it('no hay ningún path compartido', () => {
    const collisions = [...own].filter((p) => core.has(p)).sort();
    assert.deepEqual(
      collisions,
      [],
      `Estos route.ts están en el MISMO path que uno de Medusa core y lo sombrean:\n` +
        collisions.map((c) => `  src/api/${c}/route.ts`).join('\n') +
        `\n\nEl consumidor de core recibe la forma de respuesta equivocada — el mismo ` +
        `bug que dejó el admin entero con "No active store found". Elegí otro nombre ` +
        `de segmento (p. ej. \`sites\` en vez de \`stores\`).`,
    );
  });
});
