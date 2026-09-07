import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { settingsNamespaces } from './index.ts';

/**
 * Tripwire del tier `'boot'`.
 *
 * ─── Qué se eliminó y por qué ────────────────────────────────────────────────
 *
 * `SettingTier` era `'runtime' | 'boot'`. Un descriptor `boot` se renderizaba como
 * un input EDITABLE con un badge naranja de "requiere reinicio", y el POST devolvía
 * `restart_required: true`. Todo eso describía un comportamiento que no existía:
 * `medusa-config.ts` NUNCA lee la base. Se evalúa antes de que haya contenedor y
 * antes de que el loader de `app-settings` llene el snapshot, así que
 * `getAndreaniBootOptions()` y `loadCorreoOptionsFromEnv()` resuelven `env →
 * default` y nada más.
 *
 * O sea: el operador guardaba, veía el cartel, reiniciaba, y el valor seguía sin
 * aplicarse. **Sin error, sin log, sin síntoma.** El peor tipo de bug que puede
 * tener una pantalla de configuración, porque el usuario concluye que la pantalla
 * anda y que el problema está en otro lado.
 *
 * Como ningún descriptor lo usaba, se eliminó el literal del union en vez de
 * maquillar la UI: una opción que no funciona no tiene que poder elegirse.
 *
 * ─── Qué vigila este archivo ─────────────────────────────────────────────────
 *
 * El compilador ya rechaza `tier: 'boot'`, y ese es el guard principal. Lo que TS
 * NO puede impedir es que alguien "arregle" el union agregando el literal de vuelta
 * —parece un cambio de una línea— sin cablear la lectura, que es lo caro. Por eso
 * el test mira el FUENTE de `types.ts`: si el literal reaparece, falla con la lista
 * de lo que hay que construir antes.
 *
 * Es el mismo mecanismo que `_env-report.test.ts` usa para el catálogo de Correo:
 * un test que lee código porque la invariante no es sobre valores en runtime.
 */

const TYPES_FILE = new URL('./types.ts', import.meta.url);

/**
 * El union declarado en `types.ts`, tal como está escrito.
 *
 * Se busca la declaración exacta y no un `includes('boot')` suelto: los docblocks
 * de este repo mencionan `'boot'` todo el tiempo —justamente para explicar por qué
 * no está— y un match sobre la prosa haría que el test rompiera al documentar.
 */
function declaredTierUnion(): string {
  const source = readFileSync(TYPES_FILE, 'utf8');
  const match = /export type SettingTier\s*=\s*([^;]+);/.exec(source);
  assert.ok(match, 'no se encontró la declaración de SettingTier en types.ts');
  return match[1]!.replace(/\s+/g, ' ').trim();
}

test('SettingTier tiene UN solo miembro y es `runtime`', () => {
  assert.equal(
    declaredTierUnion(),
    "'runtime'",
    'SettingTier cambió. Si estás reintroduciendo `boot`, leé el test de abajo primero.',
  );
});

test('reintroducir `boot` exige cablear antes la lectura en medusa-config', () => {
  const union = declaredTierUnion();
  if (!union.includes("'boot'")) return;

  // Llegar acá significa que alguien volvió a poner el literal. Antes de que el
  // tier vuelva a existir, `medusa-config.ts` tiene que LEER la base: sin eso el
  // tier promete un reinicio que no aplica nada, que es exactamente el bug por el
  // que se eliminó.
  const config = readFileSync(configPath(), 'utf8');
  const readsDb = /site_setting|readBootSettingsSync|PG_CONNECTION/.test(config);

  assert.ok(
    readsDb,
    [
      'Volviste a agregar `boot` a SettingTier y `medusa-config.ts` sigue sin leer la base.',
      'Tal como está, un descriptor `boot` se guarda, muestra "requiere reinicio", y',
      'después del reinicio SIGUE sin aplicarse: la config se evalúa antes del contenedor.',
      '',
      'Para reintroducirlo hace falta, como mínimo:',
      '  1. una lectura SINCRÓNICA de `site_setting` en `medusa-config.ts`, con su plan',
      '     para el arranque en frío, para el `predeploy` (que sólo tiene DATABASE_URL) y',
      '     para la base sin migrar;',
      '  2. volver a cablear el diff de "hace falta reiniciar" (`isBootStale`,',
      '     `boot_stale`, `restart_required`), que se eliminó con el tier;',
      '  3. recién ahí, el badge en la UI.',
      '',
      'Si lo que tenés es una variable que SÓLO se puede cambiar en el `.env`, va como',
      '`envOnly` del namespace con la razón escrita: la UI la muestra sin input, que es',
      'la verdad.',
    ].join('\n'),
  );
});

test('ningún descriptor declara un tier distinto de `runtime`', () => {
  // Cinturón sobre el tirante del compilador: un descriptor construido con un cast
  // o cargado desde un JSON no pasaría por el chequeo de tipos.
  const offenders: string[] = [];
  for (const namespace of settingsNamespaces) {
    for (const descriptor of namespace.settings) {
      if (descriptor.tier !== 'runtime') {
        offenders.push(`${namespace.namespace}/${descriptor.key} → ${descriptor.tier}`);
      }
    }
  }

  assert.deepEqual(offenders, [], `tiers inválidos:\n  ${offenders.join('\n  ')}`);
});

/** `medusa-config.ts`, subiendo desde este archivo hasta la raíz del backend. */
function configPath(): string {
  let current = import.meta.dirname;
  for (let i = 0; i < 8; i++) {
    const candidate = join(current, 'medusa-config.ts');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  assert.fail('no se encontró medusa-config.ts');
}
