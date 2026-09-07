import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  RecommendationEvent,
  RecommendationMetric,
  RecommendationPlacement,
  RecommendationRelation,
  RecommendationStrategy,
  RecommendationVersion,
} from './models';

/**
 * Paridad entre los modelos DML y la migración escrita a mano.
 *
 * La migración de este módulo es SQL a mano (como el resto de los módulos custom
 * del repo), así que nada garantiza que al agregar un campo al modelo se agregue
 * la columna. Ese desfase no lo caza `tsc` ni el arranque: explota recién al
 * escribir/leer la fila, o sea en producción. Este test lo convierte en un fallo
 * de `pnpm test`.
 *
 * No valida tipos ni constraints —para eso hay que correr la migración contra
 * Postgres— pero sí que el conjunto de columnas coincida exactamente en ambos
 * sentidos: campo sin columna (rompe al insertar) y columna sin campo (columna
 * muerta o un rename a medio hacer).
 *
 * Vive acá y no dentro de `migrations/` porque `migration-names.test.ts` exige que
 * TODO archivo de esa carpeta se llame `Migration<ts><Modulo>.ts`.
 */
const MIGRATION_PATH = path.join(
  import.meta.dirname,
  'migrations',
  'Migration20260724120000Recommendations.ts',
);

/** Columnas que Medusa agrega a toda entidad DML y que no están en el schema. */
const FRAMEWORK_COLUMNS = new Set(['created_at', 'updated_at', 'deleted_at']);

const MODELS: Array<{ table: string; entity: { schema: Record<string, unknown> } }> = [
  { table: 'recommendation_relation', entity: RecommendationRelation as any },
  { table: 'recommendation_strategy', entity: RecommendationStrategy as any },
  { table: 'recommendation_placement', entity: RecommendationPlacement as any },
  { table: 'recommendation_version', entity: RecommendationVersion as any },
  { table: 'recommendation_event', entity: RecommendationEvent as any },
  { table: 'recommendation_metric', entity: RecommendationMetric as any },
];

/** Extrae los nombres de columna del `create table` de una tabla en la migración. */
function migrationColumns(sql: string, table: string): Set<string> {
  const start = sql.indexOf(`create table if not exists "${table}" (`);
  assert.notEqual(start, -1, `la migración no crea la tabla "${table}"`);
  const bodyStart = sql.indexOf('(', start) + 1;

  // Recorre balanceando paréntesis para cortar exactamente en el cierre del
  // create table (el cuerpo tiene paréntesis anidados en las constraints).
  let depth = 1;
  let i = bodyStart;
  while (i < sql.length && depth > 0) {
    if (sql[i] === '(') depth++;
    else if (sql[i] === ')') depth--;
    i++;
  }
  const body = sql.slice(bodyStart, i - 1);

  const columns = new Set<string>();
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('constraint')) continue;
    const match = /^"([a-z0-9_]+)"/.exec(trimmed);
    if (match) columns.add(match[1]);
  }
  return columns;
}

describe('paridad modelos ↔ migración de recomendaciones', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf8');

  for (const { table, entity } of MODELS) {
    it(`${table}: cada campo del modelo tiene columna`, () => {
      const fields = Object.keys(entity.schema);
      const columns = migrationColumns(sql, table);
      const missing = fields.filter((field) => !columns.has(field));
      assert.deepEqual(missing, [], `campos sin columna en "${table}": ${missing.join(', ')}`);
    });

    it(`${table}: cada columna corresponde a un campo`, () => {
      const fields = new Set(Object.keys(entity.schema));
      const columns = [...migrationColumns(sql, table)];
      const orphans = columns.filter((c) => !fields.has(c) && !FRAMEWORK_COLUMNS.has(c));
      assert.deepEqual(orphans, [], `columnas sin campo en "${table}": ${orphans.join(', ')}`);
    });

    it(`${table}: lleva las columnas de framework y la PK`, () => {
      const columns = migrationColumns(sql, table);
      for (const column of FRAMEWORK_COLUMNS) {
        assert.ok(columns.has(column), `falta "${column}" en "${table}"`);
      }
      assert.ok(
        sql.includes(`constraint "${table}_pkey" primary key ("id")`),
        `falta la primary key de "${table}"`,
      );
    });
  }

  it('la migración dropea en down todas las tablas que crea', () => {
    for (const { table } of MODELS) {
      assert.ok(
        sql.includes(`drop table if exists "${table}" cascade;`),
        `el down() no dropea "${table}"`,
      );
    }
  });

  it('todo create index/table es idempotente', () => {
    // Los entornos quedan parcialmente migrados con más frecuencia de la que uno
    // quisiera (ver docs/recipes/migraciones-modulos-custom.md); sin IF NOT
    // EXISTS un re-run aborta la migración entera.
    const creates = sql.match(/create (?:unique )?index (?!if not exists)/g) ?? [];
    assert.deepEqual(creates, [], 'hay CREATE INDEX sin IF NOT EXISTS');
    const tables = sql.match(/create table (?!if not exists)/g) ?? [];
    assert.deepEqual(tables, [], 'hay CREATE TABLE sin IF NOT EXISTS');
  });

  it('garantiza una sola versión activa por estrategia y canal', () => {
    // Este índice es lo que hace que "una versión activa" sea invariante de base
    // y no convención del código: sin él, dos builds concurrentes pueden dejar
    // dos versiones activas sirviendo relaciones mezcladas.
    assert.match(sql, /create unique index if not exists "UQ_recommendation_version_active"/);
    assert.match(sql, /coalesce\("sales_channel_id", ''\)\) where "status" = 'active'/);
  });
});
