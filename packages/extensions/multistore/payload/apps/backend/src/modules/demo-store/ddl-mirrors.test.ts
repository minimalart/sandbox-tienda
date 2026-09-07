import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Los DOS espejos de DDL de este módulo tienen que coincidir en lo que la fila
 * principal necesita.
 *
 * El incidente que motiva este test: la fila principal usa `source_type = 'native'`.
 * `Migration20260804120000DemoStore.ts` ensancha el CHECK
 * `demo_store_source_type_check` para aceptarlo, pero `ensure-tables.ts` — que es el
 * espejo que corre en CADA arranque y auto-cura el esquema en desarrollo — sólo hacía
 * `add column if not exists` y NO tocaba constraints.
 *
 * Resultado en una base creada por migraciones y sin la migración nueva aplicada: el
 * insert moría con Postgres 23514, `ensureMainStore()` lo degradaba a un `logger.warn`
 * (no puede tirar un 500 en el listado) y el único síntoma visible era **"la tienda
 * principal no aparece en el listado"**. Dos vueltas de diagnóstico para encontrarlo.
 *
 * Nada lo atrapaba: `tsc` no lee SQL dentro de un template literal, y no hay ningún
 * test de integración con Postgres. Así que se chequea a nivel de texto, que es
 * exactamente el nivel en el que los dos espejos se desincronizan.
 */

/**
 * Fuera los comentarios (`--` de SQL y `//`/`/* *\/` de TS) ANTES de buscar.
 *
 * La primera versión de este test buscaba `'native'` en un rango de caracteres después
 * del nombre del constraint, y quedaba VERDE contra un mutante que le sacaba 'native'
 * al CHECK: matcheaba el comentario que explica el incidente ("…SIN 'native'") y el
 * `not like '%native%'` del guard. Un test que se satisface con la prosa que lo rodea
 * no está midiendo el código.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/^\s*--.*$/gm, ' ');
}

/**
 * Las listas de valores de cada `check ("source_type" in (…))`. Se asserta sobre la
 * lista en sí, no sobre "aparece 'native' cerca del nombre del constraint".
 */
function sourceTypeCheckLists(source: string): string[] {
  const clean = stripComments(source);
  const re = /check\s*\(\s*"source_type"\s+in\s*\(([^)]*)\)/gi;
  return [...clean.matchAll(re)].map((m) => m[1]);
}

const MODULE_DIR = import.meta.dirname;
const ENSURE_TABLES = join(MODULE_DIR, 'ensure-tables.ts');
const MIGRATIONS_DIR = join(MODULE_DIR, 'migrations');

function readMigrations(): string {
  if (!existsSync(MIGRATIONS_DIR)) return '';
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => readFileSync(join(MIGRATIONS_DIR, f), 'utf8'))
    .join('\n');
}

/**
 * Sólo el `up()`. El `down()` de la migración vuelve a poner el CHECK angosto (sin
 * 'native'), así que buscar en el archivo entero daría verde por el motivo
 * equivocado: encontraría el 'native' del `up` incluso si el `up` lo perdiera.
 */
function upSectionOf(source: string): string {
  const start = source.indexOf('async up(');
  const end = source.indexOf('async down(');
  if (start === -1) return source;
  return end === -1 ? source.slice(start) : source.slice(start, end);
}

describe('espejos de DDL de demo-store', () => {
  const ensure = existsSync(ENSURE_TABLES) ? readFileSync(ENSURE_TABLES, 'utf8') : '';
  const migrations = readMigrations();

  it('encuentra los dos espejos (si no, el test no valida nada)', () => {
    assert.ok(ensure.length > 0, `no pude leer ${ENSURE_TABLES}`);
    assert.ok(migrations.length > 0, `no pude leer migraciones en ${MIGRATIONS_DIR}`);
  });

  it("ensure-tables.ts acepta source_type 'native'", () => {
    const lists = sourceTypeCheckLists(ensure);
    assert.ok(
      lists.length > 0,
      'ensure-tables.ts no tiene ningún check ("source_type" in (…)). Si el CHECK se ' +
        'escribe de otra forma, hay que actualizar este test o queda dando falsos verdes.',
    );
    assert.ok(
      lists.every((l) => l.includes("'native'")),
      'ensure-tables.ts define un check de source_type que NO acepta \'native\': ' +
        `${JSON.stringify(lists)}. La fila principal usa ese source_type, así que en ` +
        'cualquier base creada por migraciones el insert muere con Postgres 23514 y ' +
        'ensureMainStore lo degrada a un warn — el síntoma visible es "la tienda ' +
        'principal no aparece en el listado".',
    );
  });

  it("el up() de las migraciones acepta source_type 'native'", () => {
    const ups = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.ts'))
      .map((f) => upSectionOf(readFileSync(join(MIGRATIONS_DIR, f), 'utf8')))
      .join('\n');
    const lists = sourceTypeCheckLists(ups);
    assert.ok(
      lists.some((l) => l.includes("'native'")),
      "ninguna migración ensancha el check de source_type para aceptar 'native' en su " +
        `up() (listas encontradas: ${JSON.stringify(lists)}). Producción crea el ` +
        'esquema por migraciones, así que sin esto la fila principal no se puede ' +
        'sembrar en prod.',
    );
  });

  it('los dos espejos crean el índice único parcial de is_main', () => {
    for (const [name, source] of [
      ['ensure-tables.ts', ensure],
      ['migrations/', migrations],
    ] as const) {
      assert.match(
        source,
        /IDX_demo_store_is_main_unique/,
        `${name} no crea IDX_demo_store_is_main_unique. Es lo que garantiza que haya a ` +
          'lo sumo UNA fila principal y lo que hace idempotente a ensureMainStore() ' +
          'con varias instancias arrancando en paralelo.',
      );
    }
  });

  /**
   * El backfill del toggle de tintometría en la fila principal, que TAMBIÉN tiene que
   * estar en los dos espejos y por el mismo motivo que el resto de este archivo.
   *
   * Cuando el toggle se cableó al storefront (antes la principal se salteaba la llave
   * de la fila), toda instancia con `tinting_enabled = false` en su fila principal
   * —el default, porque hasta entonces el toggle no hacía nada— habría perdido la
   * página /colores. Cada espejo cubre un mundo distinto: la migración las bases que
   * ya tienen la columna, el DO block de ensure-tables las que la estrenan en el mismo
   * deploy. Borrar cualquiera de los dos deja mitad del parque sin la vidriera.
   */
  it('los dos espejos backfillean tinting_enabled en la fila principal', () => {
    const BACKFILL = /update\s+"demo_store"\s+set\s+"tinting_enabled"\s*=\s*true\s+where[^;]*"is_main"/i;
    const ups = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.ts'))
      .map((f) => upSectionOf(readFileSync(join(MIGRATIONS_DIR, f), 'utf8')))
      .join('\n');
    for (const [name, source] of [
      ['ensure-tables.ts', ensure],
      ['el up() de las migraciones', ups],
    ] as const) {
      assert.match(
        stripComments(source),
        BACKFILL,
        `${name} no prende tinting_enabled en la fila principal. Sin ese backfill, ` +
          'cablear el toggle le apaga /colores a toda instancia cuya fila principal ' +
          'quedó en el default false — que es la mayoría, porque el toggle no estaba ' +
          'conectado a nada.',
      );
    }
  });

  it('los dos espejos agregan la columna is_main', () => {
    for (const [name, source] of [
      ['ensure-tables.ts', ensure],
      ['migrations/', migrations],
    ] as const) {
      assert.match(source, /"is_main"/, `${name} no agrega la columna is_main.`);
    }
  });
});
