/**
 * Resolve hook para correr los *.test.ts con el runner nativo de Node (`node --test`).
 *
 * El código fuente importa SIN extensión (`import { x } from './foo'`), pero el
 * runner TS de Node no resuelve extensionless → ERR_MODULE_NOT_FOUND. Este hook
 * prueba `.ts`/`.tsx`/`/index.ts` antes de delegar. Se registra vía
 * `test-register.mjs` con `node --import`.
 */
export async function resolve(spec, ctx, next) {
  if (spec.startsWith('.') && !/\.(json|node|[cm]?[jt]sx?)$/.test(spec)) {
    for (const candidate of [`${spec}.ts`, `${spec}.tsx`, `${spec}/index.ts`]) {
      try {
        return await next(candidate, ctx);
      } catch {
        // probar el siguiente candidato
      }
    }
  }
  return next(spec, ctx);
}
