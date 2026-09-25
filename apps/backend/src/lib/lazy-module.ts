/**
 * Cargar un módulo del proyecto EN RUNTIME, sin importarlo estáticamente.
 *
 * ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────
 *
 * Había 11 `await import('../x.js')` repartidos por el backend y NINGUNO resolvía
 * en producción. Logs del boilerplate del 2026-09-18:
 *
 *   13:00:00  Scheduled job sync-correo-tracking-status failed with error:
 *             Cannot find module '/workspace/apps/backend/src/modules/delivery/providers/registry.js'
 *             imported from /workspace/apps/backend/src/jobs/sync-correo-tracking-status.ts
 *
 *   12:22:27  [AbandonedCart] demo_main: Cannot find module
 *             '/workspace/apps/backend/src/modules/app-settings/descriptors/index.js'
 *             imported from /workspace/apps/backend/src/loaders/plugin-runtime-bridge.ts
 *
 * El job de tracking de Correo Argentino estaba caído TODAS LAS HORAS y el de
 * carritos abandonados fallaba para las 7 tiendas CADA MINUTO, los dos en silencio.
 *
 * ── POR QUÉ FALLA, Y POR QUÉ EL DOBLE INTENTO ANTERIOR TAMPOCO ALCANZÓ ───────
 *
 * En producción el backend corre el FUENTE: `medusa start` arranca por
 * `@medusajs/cli/cli.js`, que hace `require('ts-node').register({})`. O sea que
 * cada `.ts` se compila en memoria con el tsconfig del proyecto —`module: nodenext`,
 * y `apps/backend/package.json` NO tiene `"type": "module"`, así que el archivo es
 * CommonJS— y se carga con `require()`. La confirmación está en Medusa misma:
 * `@medusajs/utils` → `dynamicImport(path)` es, literalmente, `require(path)`.
 *
 * Con `module: nodenext`, TypeScript emite `require()` para los imports estáticos
 * pero **preserva `import()`** para los dinámicos: queda un import ESM de verdad. Y
 * el resolver ESM de Node no inventa extensiones. De ahí que el mensaje de error
 * tenga la forma de ESM (`… imported from …`) y no la de CJS (`Require stack:`).
 *
 * Medido con Node 24 sobre un `.ts` real (paquete sin `"type"`), por `import()`:
 *
 *   './target.js'   → ERR_MODULE_NOT_FOUND   (el archivo en disco es .ts)
 *   './target'      → ERR_MODULE_NOT_FOUND   (ESM exige extensión)
 *   './target.ts'   → OK, pero lo carga por strip de tipos: una SEGUNDA instancia
 *                     del módulo, y sus propios imports relativos sin extensión
 *                     vuelven a romper. No sirve.
 *
 * Por eso el doble intento de `event-bus-monitor.ts` (`.js` y después sin
 * extensión) SEGUÍA fallando, con el fix instalado, el 2026-09-18 a las 12:28:03:
 *
 *   [event-bus-monitor] no se pudo resolver el destinatario por el módulo de email
 *   (Cannot find module '…/modules/email/admin-recipient.js' …). Se sigue con la env.
 *
 * Las dos ramas eran `import()`, y las dos son ESM: probar dos especificadores del
 * mismo mecanismo roto no arregla nada.
 *
 * ── LA FORMA QUE SÍ RESUELVE ────────────────────────────────────────────────
 *
 * `require('../x')` SIN extensión. La resolución CJS prueba `.js`, `.json`, `.node`
 * y las extensiones registradas —ts-node registra `.ts`—, así que el MISMO
 * especificador funciona en los dos entornos:
 *
 *   producción/dev (ts-node, fuente)      → ../x.ts
 *   build compilado (`medusa build`, CJS) → ../x.js
 *
 * No es un invento: ya es el patrón del repo en `modules/demo-store/provision.ts`,
 * `api/admin/sites/[id]/promotions/route.ts` y `scripts/test-catalog-import-fixture.ts`.
 * Y sigue siendo perezoso, que es todo el punto de no importarlo estáticamente:
 * el módulo puede no existir en un proyecto compuesto sin esa extensión.
 *
 * El segundo intento, `import()` sin extensión, NO es decoración: es el que corre
 * en el runner de tests (`node --test` carga los `.ts` como ESM, donde `require` ni
 * siquiera está declarado, y `test-resolve-hook.mjs` resuelve extensionless → `.ts`).
 * Sin él, cualquier test que toque estos caminos mediría otra cosa que producción.
 *
 * ── LO QUE NO SE HACE ───────────────────────────────────────────────────────
 *
 * No se llama a `require` directamente en el call site sin este envoltorio, porque
 * en ESM `require` no existe y sería un `ReferenceError` pelado. Acá cada intento
 * va adentro de un `try`, así que el `ReferenceError` es sólo "esta forma no aplica
 * en este entorno" y se pasa a la siguiente.
 *
 * Y NO se traga el error: si fallan todas, el mensaje nombra CADA forma con su
 * motivo. Un `catch` que devuelve lo mismo que el camino de al lado es cómo el
 * monitor del event bus se quedó mudo durante 50 minutos (ver `event-bus-monitor.ts`).
 */

/**
 * Un intento de carga. Se escribe SIEMPRE en el archivo que llama: `require()` e
 * `import()` resuelven contra el módulo donde están escritos, así que un helper que
 * recibiera el especificador como string lo resolvería contra `src/lib/`.
 */
export type LazyModuleAttempt = () => unknown;

const messageOf = (error: unknown): string =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error);

/**
 * Devuelve el primer intento que cargue algo. Si fallan todos, tira un `Error` que
 * nombra las formas probadas y por qué falló cada una.
 *
 * @param what Qué se estaba cargando, en palabras del que lo lee en el log.
 * @param attempts Los intentos, EN ORDEN. Primero el que sirve en producción.
 */
export async function loadLazyModule<T>(
  what: string,
  ...attempts: LazyModuleAttempt[]
): Promise<T> {
  const failures: string[] = [];

  for (const attempt of attempts) {
    try {
      const loaded = await attempt();
      if (loaded !== null && loaded !== undefined) return loaded as T;
      failures.push('resolvió vacío');
    } catch (error) {
      failures.push(messageOf(error));
    }
  }

  throw new Error(
    `no se pudo cargar ${what} en runtime. Formas probadas, en orden: ` +
      failures.map((failure, index) => `[${index + 1}] ${failure}`).join(' | '),
  );
}

/**
 * Devuelve el especificador tal cual, pero tipado como `string`.
 *
 * `import('../x')` con literal NO compila: `moduleResolution: nodenext` exige la
 * extensión del archivo emitido (TS2835). Pasar por una variable `string` saca al
 * especificador del chequeo de literales sin apagar nada globalmente, y deja a la
 * vista que la falta de extensión es DELIBERADA y no un olvido.
 */
export const sourceSpecifier = (specifier: string): string => specifier;
