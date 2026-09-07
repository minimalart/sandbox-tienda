import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';

/**
 * Resolve hook para correr los *.test.ts del storefront con el runner nativo de Node
 * (`node --test`). Se registra vía `test-register.mjs` con `node --import`.
 *
 * Hace dos cosas que el runner TS de Node no hace solo:
 *
 *  1. Extensionless → `.ts` / `.tsx` / `/index.ts`. El código importa
 *     `from './foo'` y sin esto da ERR_MODULE_NOT_FOUND.
 *  2. Los alias de `tsconfig.json` (`@lib/*`, `@modules/*`, `@/*`, `@pages/*`).
 *     El hook del backend NO los resuelve porque allá no existen — por eso este
 *     archivo no es una copia del suyo.
 *
 * Aun así, los módulos que importan `server-only`, `next/headers` o `next/server` no
 * son testeables así. Es a propósito: la lógica riesgosa se extrae a módulos PUROS
 * (ver `lib/site-config/main-tenant.ts`) y el adaptador que toca Next queda fino.
 */
const SRC = resolvePath(dirname(fileURLToPath(import.meta.url)), 'src');

const ALIASES = [
  ['@lib/', 'lib/'],
  ['@modules/', 'modules/'],
  ['@pages/', 'pages/'],
  ['@/', ''],
];

const CANDIDATES = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];

async function tryCandidates(base, ctx, next) {
  for (const suffix of CANDIDATES) {
    try {
      return await next(`${base}${suffix}`, ctx);
    } catch {
      // probar el siguiente
    }
  }
  return null;
}

export async function resolve(spec, ctx, next) {
  for (const [alias, target] of ALIASES) {
    if (spec.startsWith(alias)) {
      const abs = pathToFileURL(resolvePath(SRC, target + spec.slice(alias.length))).href;
      const hit = await tryCandidates(abs, ctx, next);
      if (hit) return hit;
    }
  }

  if (spec.startsWith('.') && !/\.(json|node|css|[cm]?[jt]sx?)$/.test(spec)) {
    const hit = await tryCandidates(spec, ctx, next);
    if (hit) return hit;
  }

  return next(spec, ctx);
}
