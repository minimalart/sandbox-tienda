import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { loadLazyModule, sourceSpecifier } from './lazy-module';

describe('loadLazyModule', () => {
  test('devuelve el primer intento que carga algo', async () => {
    const calls: string[] = [];
    const loaded = await loadLazyModule<{ ok: boolean }>(
      'el módulo de prueba',
      () => {
        calls.push('primero');
        return { ok: true };
      },
      () => {
        calls.push('segundo');
        return { ok: false };
      },
    );

    assert.deepEqual(loaded, { ok: true });
    assert.deepEqual(calls, ['primero'], 'no puede seguir probando después de un éxito');
  });

  test('pasa al intento siguiente cuando `require` no existe (el caso de los tests, que corren como ESM)', async () => {
    // Es EXACTAMENTE lo que pasa en `node --test`: los `.ts` se cargan como ESM y
    // `require` ni siquiera está declarado, así que el primer intento tira
    // ReferenceError. Si eso no estuviera adentro de un try, el call site
    // explotaría en vez de caer al `import()`.
    const loaded = await loadLazyModule<{ from: string }>(
      'el módulo de prueba',
      () => {
        throw new ReferenceError('require is not defined');
      },
      () => Promise.resolve({ from: 'import()' }),
    );

    assert.deepEqual(loaded, { from: 'import()' });
  });

  test('saltea un intento que resuelve vacío en vez de devolver undefined', async () => {
    const loaded = await loadLazyModule<{ ok: boolean }>(
      'el módulo de prueba',
      () => undefined,
      () => null,
      () => ({ ok: true }),
    );

    assert.deepEqual(loaded, { ok: true });
  });

  test('si fallan todos, el error nombra CADA forma probada y su motivo', async () => {
    // El antipatrón que este helper viene a cerrar es el catch que entierra: el
    // monitor del event bus se quedó 50 minutos mudo porque el motivo real no
    // quedaba escrito en ningún lado.
    await assert.rejects(
      () =>
        loadLazyModule(
          'el registry de providers de delivery',
          () => {
            throw new ReferenceError('require is not defined');
          },
          () => {
            throw new Error("Cannot find module '../x'");
          },
        ),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /el registry de providers de delivery/);
        assert.match(error.message, /\[1\] ReferenceError: require is not defined/);
        assert.match(error.message, /\[2\] Error: Cannot find module '\.\.\/x'/);
        return true;
      },
    );
  });

  test('espera los intentos asincrónicos, no devuelve la promesa cruda', async () => {
    const loaded = await loadLazyModule<{ ok: boolean }>('el módulo de prueba', async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return { ok: true };
    });

    assert.deepEqual(loaded, { ok: true });
  });
});

test('sourceSpecifier devuelve el especificador tal cual', () => {
  assert.equal(sourceSpecifier('../modules/email/admin-recipient'), '../modules/email/admin-recipient');
});

/**
 * ── EL GUARD ────────────────────────────────────────────────────────────────
 *
 * Este test es el que impide que la regresión vuelva. `await import('../x.js')`
 * compila, pasa `tsc`, pasa el lint y NO RESUELVE en producción: el backend corre
 * el fuente con ts-node y el archivo en disco es `.ts`. Se llevó puesto el job de
 * tracking de Correo Argentino (caído todas las horas) y el de carritos abandonados
 * (fallando cada minuto para las 7 tiendas), los dos en silencio.
 *
 * Lo único que no se toca son los `typeof import('….js')`, que son TIPOS: no emiten
 * nada y ahí el `.js` es lo que `moduleResolution: nodenext` pide.
 */
const BACKEND_SRC = join(import.meta.dirname, '..');

/** Saca comentarios sin romper los strings, para no acusar a un ejemplo de un docblock. */
function stripComments(source: string): string {
  let out = '';
  let state: 'code' | 'line' | 'block' | "'" | '"' | '`' = 'code';

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]!;
    const next = source[index + 1];

    if (state === 'code') {
      if (char === '/' && next === '/') { state = 'line'; index += 1; continue; }
      if (char === '/' && next === '*') { state = 'block'; index += 1; continue; }
      if (char === "'" || char === '"' || char === '`') state = char;
      out += char;
      continue;
    }

    if (state === 'line') {
      if (char === '\n') { state = 'code'; out += char; }
      continue;
    }

    if (state === 'block') {
      if (char === '*' && next === '/') { state = 'code'; index += 1; }
      continue;
    }

    // Adentro de un string: el escape se copia entero para no cerrar de más.
    out += char;
    if (char === '\\') { out += source[index + 1] ?? ''; index += 1; continue; }
    if (char === state) state = 'code';
  }

  return out;
}

function sourceFiles(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    if (entry === 'node_modules' || entry === '.medusa' || entry === 'dist') continue;
    const absolute = join(directory, entry);
    if (statSync(absolute).isDirectory()) { found.push(...sourceFiles(absolute)); continue; }
    if (/\.tsx?$/.test(entry)) found.push(absolute);
  }
  return found;
}

test('ningún `import()` dinámico relativo termina en `.js` (no resuelve en producción)', () => {
  const offenders: string[] = [];

  for (const file of sourceFiles(BACKEND_SRC)) {
    const code = stripComments(readFileSync(file, 'utf8'));
    const pattern = /import\s*\(\s*(['"])(\.[^'"]*\.js)\1/g;

    for (const match of code.matchAll(pattern)) {
      const before = code.slice(Math.max(0, match.index - 12), match.index);
      if (/typeof\s*$/.test(before)) continue; // `typeof import('….js')` es un TIPO
      offenders.push(`${file.slice(BACKEND_SRC.length + 1)} → ${match[2]}`);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    'Un `import()` relativo con `.js` no resuelve cuando el backend corre el fuente ' +
      '(ts-node + require). Usá `loadLazyModule` de `lib/lazy-module.ts`: primero ' +
      '`require()` sin extensión, después `import(sourceSpecifier(…))`.',
  );
});
