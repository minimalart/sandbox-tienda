import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { describe, it } from 'node:test';

/**
 * LA FRONTERA DEL ADMIN.
 *
 * El admin se empaqueta aparte del backend: lo compila Vite y termina en un bundle
 * que baja el navegador. Un import descuidado desde `src/admin` hacia `src/lib` o
 * `src/modules` arrastra Medusa entero a ese bundle, y el síntoma no es un error de
 * compilación —esbuild borra los tipos sin chequearlos y el CI no typechequea
 * `src/admin`— sino un build gigante o una pantalla en blanco en producción.
 *
 * El editor de recorridos cruza esa frontera A PROPÓSITO, en un solo lugar:
 * `lib/graph-contract.ts` importa el modelo del grafo, que es dato puro y es el
 * mismo archivo que valida el servidor. Este test es lo que hace que ese permiso
 * sea una excepción declarada y no una puerta abierta:
 *
 *   1. los archivos permitidos siguen sin importar nada que no esté permitido;
 *   2. ningún otro archivo de `flujos/` se saltea la puerta.
 *
 * Si mañana el editor necesita el motor (`engine.ts`, para el simulador), se agrega
 * acá y el test sigue cuidando el resto.
 */

const FLUJOS = resolve(import.meta.dirname, '..');
const ADMIN = resolve(FLUJOS, '..', '..', '..');
const BACKEND_SRC = resolve(ADMIN, '..');

/** Lo único que el editor puede importar de fuera de `src/admin`. */
const ALLOWED_OUTSIDE = [
  // El modelo del grafo: tipos, límites de WhatsApp y `validateGraph`.
  'lib/whatsapp/flow/graph.ts',
  // El intérprete, para el simulador. Sólo importa `./graph`.
  'lib/whatsapp/flow/engine.ts',
  /**
   * El recorrido de ejemplo. Es una constante sin lógica —importa un TIPO de
   * `./graph` y nada más— y tenerla en el cliente convierte "cargar el ejemplo" en
   * una operación del canvas, deshacible con Ctrl+Z, en vez de una llamada que
   * escribía en la base antes de que nadie lo hubiera visto.
   */
  'lib/whatsapp/flow/seed.ts',
].map((p) => resolve(BACKEND_SRC, p));

/** El único archivo del editor autorizado a cruzar. */
const GATEWAY = resolve(FLUJOS, 'lib', 'graph-contract.ts');

const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');

/** Los specifiers de todo `import`/`export … from` y de un `require()`. */
function specifiersOf(source: string): string[] {
  const code = stripComments(source);
  const found: string[] = [];
  for (const match of code.matchAll(/(?:^|[\s;}])(?:import|export)\s[^;]*?from\s*['"]([^'"]+)['"]/g)) {
    found.push(match[1] as string);
  }
  for (const match of code.matchAll(/(?:^|[\s;=(])import\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    found.push(match[1] as string);
  }
  for (const match of code.matchAll(/(?:^|[\s;=(])require\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    found.push(match[1] as string);
  }
  return found;
}

/** Los `.ts`/`.tsx` de un árbol, sin tests. */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.test.ts')) out.push(full);
  }
  return out;
}

/** Resuelve un specifier relativo a un archivo real, probando las extensiones. */
function resolveRelative(from: string, spec: string): string | null {
  const base = resolve(dirname(from), spec);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    try {
      readFileSync(candidate, 'utf8');
      return candidate;
    } catch {
      // probar el siguiente
    }
  }
  return null;
}

describe('la frontera del bundle del admin', () => {
  it('el editor existe donde este test cree que existe', () => {
    // Si alguien mueve la carpeta, el test tiene que fallar acá y no pasar en verde
    // sin haber mirado un solo archivo.
    const files = sourceFiles(FLUJOS);
    assert.ok(files.length >= 5, `esperaba archivos en ${FLUJOS}, encontré ${files.length}`);
    assert.ok(files.includes(GATEWAY), 'falta lib/graph-contract.ts');
  });

  it('los módulos permitidos no importan nada fuera de la lista', () => {
    // `graph.ts` es importable justamente porque es dato puro. El día que gane un
    // `import` de Medusa, o lea `process.env`, deja de serlo — y ese día el editor
    // se lo lleva al navegador sin que nadie se entere.
    for (const file of ALLOWED_OUTSIDE) {
      const source = readFileSync(file, 'utf8');
      for (const spec of specifiersOf(source)) {
        const target = spec.startsWith('.') ? resolveRelative(file, spec) : null;
        assert.ok(
          target && ALLOWED_OUTSIDE.includes(target),
          `${relative(BACKEND_SRC, file)} importa "${spec}", que no está permitido en el bundle del admin`,
        );
      }
      assert.ok(
        !/\bprocess\.\w/.test(stripComments(source)),
        `${relative(BACKEND_SRC, file)} lee process.*: deja de ser dato puro`,
      );
    }
  });

  it('sólo graph-contract cruza fuera de src/admin', () => {
    const cruces: string[] = [];
    for (const file of sourceFiles(FLUJOS)) {
      for (const spec of specifiersOf(file === GATEWAY ? '' : readFileSync(file, 'utf8'))) {
        if (!spec.startsWith('.')) continue;
        const target = resolveRelative(file, spec);
        if (!target) continue;
        if (!`${target}${sep}`.startsWith(`${ADMIN}${sep}`)) {
          cruces.push(`${relative(FLUJOS, file)} → ${spec}`);
        }
      }
    }
    assert.deepEqual(
      cruces,
      [],
      `Estos archivos se saltean lib/graph-contract.ts:\n  ${cruces.join('\n  ')}\n\n` +
        'Agregá lo que necesites a graph-contract.ts y a ALLOWED_OUTSIDE, con el motivo.',
    );
  });

  it('graph-contract sólo importa lo permitido', () => {
    for (const spec of specifiersOf(readFileSync(GATEWAY, 'utf8'))) {
      const target = resolveRelative(GATEWAY, spec);
      const dentroDelAdmin = target && `${target}${sep}`.startsWith(`${ADMIN}${sep}`);
      assert.ok(
        dentroDelAdmin || (target && ALLOWED_OUTSIDE.includes(target)),
        `graph-contract.ts importa "${spec}", que no está en ALLOWED_OUTSIDE`,
      );
    }
  });
});
