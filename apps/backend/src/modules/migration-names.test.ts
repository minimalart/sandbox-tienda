import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Los módulos custom comparten la tabla `mikro_orm_migrations` y umzug registra
 * cada migración por NOMBRE de archivo, sin módulo: dos migraciones homónimas en
 * módulos distintos hacen que la del módulo que migra después quede salteada EN
 * SILENCIO (caso shop_by_look "registrada-pero-sin-tabla", #368). Este test hace
 * cumplir la convención que lo evita. Ver docs/recipes/migraciones-modulos-custom.md.
 */

const MODULES_DIR = import.meta.dirname;

/** `apps/backend/node_modules`, desde `src/modules`. */
const NODE_MODULES_DIR = join(MODULES_DIR, '..', '..', 'node_modules');

/**
 * Colisiones ya reconciliadas contra migraciones del CORE (`@medusajs/*`), que no
 * podemos renombrar. Igual que `LEGACY_DUPLICATES`: NO agregar entradas sin la
 * reconciliación correspondiente — el valor es la migración que la repara.
 */
const CORE_DUPLICATES_RECONCILED: Record<string, string> = {
  // @medusajs/cart@2.18.0 vs delivery (vehículo multi-sucursal, aplicada 2026-06-26).
  Migration20260626000000:
    'delivery/migrations/Migration20260803120000DeliveryReconcileCartCollision.ts',
};

/**
 * Colisiones históricas, ya reconciliadas con migraciones `*Reconcile*` de nombre
 * único. NO agregar entradas: cualquier nombre nuevo debe ser único globalmente.
 */
const LEGACY_DUPLICATES: Record<string, string[]> = {
  // Migration20260619120000: ['ai-assistant', 'comments'] — comments moved to
  // @minimalart/mercatto-plugin-comments; only ai-assistant keeps this name.
  Migration20260622120000: ['ai-assistant', 'delivery'],
  Migration20260630120000: ['ai-assistant', 'shop-by-look'],
};

/**
 * Desde esta fecha, toda migración nueva DEBE llevar el módulo en el nombre
 * (`Migration<YYYYMMDDHHmmss><ModuloEnPascal>.ts`). Las anteriores quedan
 * exceptuadas: renombrarlas las haría re-correr como "pendientes".
 */
const BARE_NAME_CUTOFF = 20260702000000;

function toPascal(module: string): string {
  return module
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join('');
}

/**
 * Recorre los módulos y ANIDADOS: un módulo hermano puede vivir dentro de la
 * carpeta de otro (`typesense/sync-log`) para que la extensión lo mapee sin
 * agregar un root nuevo. Esas migraciones comparten la misma tabla global
 * `mikro_orm_migrations`, así que también tienen que cumplir la convención —
 * antes quedaban fuera del barrido y sin validar.
 */
function collectMigrationNames(): Map<string, string[]> {
  const byName = new Map<string, string[]>();

  const visit = (dir: string, label: string): void => {
    const migrationsDir = join(dir, 'migrations');
    if (existsSync(migrationsDir)) {
      for (const file of readdirSync(migrationsDir)) {
        if (!file.endsWith('.ts') || file.endsWith('.d.ts')) continue;
        const name = file.slice(0, -3);
        const modules = byName.get(name) ?? [];
        modules.push(label);
        byName.set(name, modules);
      }
    }
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === 'migrations') continue;
      visit(join(dir, entry.name), `${label}/${entry.name}`);
    }
  };

  for (const entry of readdirSync(MODULES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    visit(join(MODULES_DIR, entry.name), entry.name);
  }
  return byName;
}

/**
 * Junta los nombres de migración que traen los paquetes `@medusajs/*` instalados.
 * Comparten la misma tabla global `mikro_orm_migrations`, así que un nombre
 * homónimo entre el core y un módulo custom se saltea igual que entre dos
 * módulos custom — pero el barrido de `collectMigrationNames()` no los ve.
 *
 * Cubre los dos layouts posibles: el plano (`npm ci`, que es lo que corre el
 * buildpack de DigitalOcean, y los deps directos de pnpm) y el store de pnpm
 * (`node_modules/.pnpm/@medusajs+<pkg>@<ver>/node_modules/@medusajs/<pkg>`), donde
 * viven los módulos del core, que son deps transitivas de `@medusajs/medusa`.
 *
 * Devuelve un Map vacío si no hay `node_modules` (clone fresco sin install): el
 * test no puede validar lo que no está instalado, y no debe fallar por eso.
 */
function collectCoreMigrationNames(): Map<string, string[]> {
  const byName = new Map<string, string[]>();

  const scan = (pkgDir: string, label: string): void => {
    for (const migrationsDir of [
      join(pkgDir, 'dist', 'migrations'),
      // Los plugins publican el build de Medusa, no `dist/`.
      join(pkgDir, '.medusa', 'server', 'src', 'migrations'),
    ]) {
      if (!existsSync(migrationsDir)) continue;
      for (const file of readdirSync(migrationsDir)) {
        if (!file.startsWith('Migration') || !file.endsWith('.js')) continue;
        const name = file.slice(0, -3);
        const labels = byName.get(name) ?? [];
        if (!labels.includes(label)) labels.push(label);
        byName.set(name, labels);
      }
    }
  };

  const scanMedusaScope = (scopeDir: string): void => {
    if (!existsSync(scopeDir)) return;
    for (const entry of readdirSync(scopeDir, { withFileTypes: true })) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
      scan(join(scopeDir, entry.name), `@medusajs/${entry.name}`);
    }
  };

  // Layout plano: deps directas (pnpm) y el árbol completo de `npm ci`.
  scanMedusaScope(join(NODE_MODULES_DIR, '@medusajs'));

  // Store de pnpm, en la raíz del workspace: ahí están las transitivas del core.
  const pnpmStore = join(NODE_MODULES_DIR, '..', '..', '..', 'node_modules', '.pnpm');
  if (existsSync(pnpmStore)) {
    for (const entry of readdirSync(pnpmStore, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith('@medusajs+')) continue;
      scanMedusaScope(join(pnpmStore, entry.name, 'node_modules', '@medusajs'));
    }
  }

  return byName;
}

test('las migraciones de módulos custom no repiten nombre entre módulos', () => {
  const byName = collectMigrationNames();
  for (const [name, modules] of byName) {
    if (modules.length === 1) continue;
    assert.deepEqual(
      [...modules].sort(),
      LEGACY_DUPLICATES[name],
      `"${name}" está repetida en [${modules.join(', ')}]: mikro_orm_migrations registra por ` +
        `nombre global y una de las dos se saltearía en silencio. Renombrala con el módulo ` +
        `en el nombre (ej. ${name}${toPascal(modules[modules.length - 1]!)}.ts). ` +
        `Ver docs/recipes/migraciones-modulos-custom.md.`
    );
  }
});

test('las migraciones de módulos custom no colisionan con las del core @medusajs', () => {
  const core = collectCoreMigrationNames();
  if (core.size === 0) return; // sin node_modules no hay nada que validar

  for (const [name, modules] of collectMigrationNames()) {
    const paquetes = core.get(name);
    if (!paquetes) continue;

    // Ya reconciliada: la migración del core queda salteada a propósito y una
    // `*Reconcile*` de nombre único re-aplica su contenido idempotentemente.
    if (CORE_DUPLICATES_RECONCILED[name]) {
      const reconcile = CORE_DUPLICATES_RECONCILED[name]!;
      assert.ok(
        existsSync(join(MODULES_DIR, reconcile)),
        `"${name}" colisiona con ${paquetes.join(', ')} y está declarada como reconciliada ` +
          `en CORE_DUPLICATES_RECONCILED, pero falta "${reconcile}". Sin esa migración la del ` +
          `core queda salteada EN SILENCIO y el esquema incompleto.`
      );
      continue;
    }

    assert.fail(
      `"${name}" (módulo custom: ${modules.join(', ')}) tiene el mismo nombre que una migración ` +
        `de ${paquetes.join(', ')}. mikro_orm_migrations registra por nombre global y sin módulo, ` +
        `así que una de las dos se saltea EN SILENCIO: db:migrate sale 0 con el esquema ` +
        `incompleto. La del core no se puede renombrar. Si la custom NO está aplicada todavía, ` +
        `renombrala con el módulo en el nombre (ej. ${name}${toPascal(modules[0]!)}.ts). Si YA ` +
        `está aplicada, escribí una migración *Reconcile* que re-aplique idempotentemente el ` +
        `contenido de la del core y anotala en CORE_DUPLICATES_RECONCILED. ` +
        `Ver docs/recipes/migraciones-modulos-custom.md.`
    );
  }
});

test('toda migración posterior al cutoff lleva el módulo en el nombre', () => {
  const byName = collectMigrationNames();
  for (const [name, modules] of byName) {
    const match = /^Migration(\d{14})([A-Za-z0-9]*)$/.exec(name);
    assert.ok(
      match,
      `"${name}" (${modules.join(', ')}) no sigue el formato Migration<YYYYMMDDHHmmss>[Sufijo].ts`
    );
    const [, timestamp, suffix] = match;
    if (Number(timestamp) < BARE_NAME_CUTOFF) continue;
    assert.ok(
      suffix && /^[A-Z]/.test(suffix),
      `"${name}" (${modules.join(', ')}) necesita el módulo como sufijo PascalCase en el ` +
        `nombre (ej. Migration${timestamp}${toPascal(modules[0]!)}.ts) para no poder ` +
        `colisionar nunca con otro módulo. Ver docs/recipes/migraciones-modulos-custom.md.`
    );
  }
});
