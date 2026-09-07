import { test } from 'node:test';
import assert from 'node:assert/strict';
import descriptors from '../app-settings/descriptors/recurring-orders.ts';
import { getRecurringOrderConfig } from './config.ts';
import { mergeRuntimeConfig } from './runtime-config.ts';
import { getRecurringOrderSettings } from './settings.ts';

/**
 * El snapshot de `app-settings` arranca vacío en los tests, así que todo lo que
 * toca `getRecurringOrderSettings()` ejercita el tramo **env > default** del
 * resolver — que es exactamente el comportamiento que la migración tenía que
 * preservar. La capa de base necesita Postgres y no se testea acá (este repo
 * corre `node:test` sin DB).
 */

function withEnv(vars: Record<string, string | undefined>, body: () => void): void {
  const previous: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(vars)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    body();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

/** Las siete gestionables + las quince `envOnly`. Es LA lista auditada. */
const MANAGED_KEYS = [
  'SUBSCRIPTIONS_V2_ENABLED',
  'SUBSCRIPTIONS_STOREFRONT_ENABLED',
  'SUBSCRIPTIONS_AUTO_PAYMENT_ENABLED',
  'SUBSCRIPTIONS_STOCK_FORECAST_ENABLED',
  'SUBSCRIPTIONS_RETENTION_ENABLED',
  'RECURRING_ORDERS_ENABLED',
  'RECURRING_BATCH_SIZE',
  'RECURRING_MAX_ATTEMPTS',
  'RECURRING_RETRY_HOURS',
  'RECURRING_MAX_CONSECUTIVE_FAILURES',
  'RECURRING_PAYMENT_EXPIRATION_HOURS',
  'RECURRING_REMINDER_HOURS',
];
const ENV_ONLY_KEYS = [
  'APPLY',
  'AUDIT_STRICT',
  'MEDUSA_BACKEND_URL',
  'RECURRING_RENEWAL_CRON',
  'RECURRING_METRICS_CRON',
  'NEXT_PUBLIC_BASE_URL',
  'STOREFRONT_DEFAULT_COUNTRY',
  'SUBSCRIPTIONS_PREFLIGHT_CRON',
  'SUBSCRIPTIONS_STOCK_FORECAST_CRON',
  'SUBSCRIPTIONS_NOTIFICATIONS_CRON',
];

/** Limpia las veintidós para que un `.env` del dev no ensucie los defaults. */
const CLEAN_ENV = Object.fromEntries(
  [...MANAGED_KEYS, ...ENV_ONLY_KEYS].map((k) => [k, undefined])
);

const byKey = new Map(descriptors.settings.map((d) => [d.key, d]));

// ─── Descriptor ──────────────────────────────────────────────────────────────

test('cubre las 22 variables auditadas, ni una más ni una menos', () => {
  const covered = [
    ...descriptors.settings.flatMap((s) => s.env),
    ...(descriptors.envOnly ?? []).map((e) => e.key),
  ].sort();
  assert.equal(covered.length, 22);
  assert.deepEqual(
    covered,
    [...MANAGED_KEYS, ...ENV_ONLY_KEYS].sort(),
    'el descriptor y la auditoría discrepan: si agregaste una env var, actualizá las dos listas'
  );
});

test('las siete gestionables son `instance`: la capa por tienda es `recurring_setting`', () => {
  // Un `site` acá sería una TERCERA capa por tienda compitiendo con la que ya
  // funciona, y encima muerta: el único lector es el camino sincrónico, que
  // resuelve con `SiteKind = 'none'` y ni mira la fila de la tienda. Ver las
  // notas 1 y 2 de `descriptors/recurring-orders.ts`.
  assert.equal(descriptors.defaultScope, 'instance');
  for (const d of descriptors.settings) {
    assert.equal(d.scope, 'instance', `${d.key} debería ser instance`);
  }
});

test('los cron son envOnly; las activaciones se administran en runtime', () => {
  // El `schedule:` lo hornea el job loader al arrancar; el `enabled` se evalúa
  // dentro del cuerpo de los dos jobs, o sea en cada corrida.
  const envOnly = (descriptors.envOnly ?? []).map((e) => e.key).sort();
  assert.deepEqual(envOnly, [...ENV_ONLY_KEYS].sort());
  assert.ok(byKey.has('RECURRING_ORDERS_ENABLED'));
  for (const entry of descriptors.envOnly ?? []) {
    assert.ok(entry.reason.trim().length > 40, `${entry.key}: la razón es demasiado corta`);
  }
});

test('las dos compartidas nombran por qué no son de nadie', () => {
  // `NEXT_PUBLIC_BASE_URL` y `STOREFRONT_DEFAULT_COUNTRY` las leen varias
  // extensiones. Que la razón diga "INSTALACIÓN" es lo que evita que la próxima
  // migración se las adjudique y aparezcan dos cards editando el mismo valor.
  for (const key of ['NEXT_PUBLIC_BASE_URL', 'STOREFRONT_DEFAULT_COUNTRY']) {
    const entry = (descriptors.envOnly ?? []).find((e) => e.key === key);
    assert.ok(entry, `${key} debería estar en envOnly`);
    assert.match(entry!.reason, /INSTALACIÓN/);
  }
});

test('invariantes de forma: UPPER_SNAKE, namespace, label, group, env y tier', () => {
  for (const d of descriptors.settings) {
    assert.match(d.key, /^[A-Z][A-Z0-9_]*$/, `key inválida: ${d.key}`);
    assert.equal(d.namespace, 'extension:recurring-orders', `${d.key}: namespace desalineado`);
    assert.ok(d.label.trim().length > 0, `${d.key}: sin label`);
    assert.ok(d.group.trim().length > 0, `${d.key}: sin group`);
    assert.ok(d.env.length > 0, `${d.key}: sin env var de la que heredar`);
    assert.equal(d.tier, 'runtime', `${d.key}: los tiers boot van en envOnly, no acá`);
  }
});

test('cada default cae dentro de su propio min/max', () => {
  for (const d of descriptors.settings) {
    if (d.type !== 'number' || typeof d.default !== 'number') continue;
    assert.ok(d.default >= (d.min ?? -Infinity), `${d.key}: default < min`);
    assert.ok(d.default <= (d.max ?? Infinity), `${d.key}: default > max`);
  }
});

test('el recordatorio por defecto llega antes de que venza el link', () => {
  // Un recordatorio agendado después de la expiración no se manda nunca: para
  // cuando toca, el ciclo ya expiró. No se puede validar entre campos en el
  // descriptor (`refine` recibe UN valor), así que al menos los defaults se cruzan.
  const reminder = byKey.get('RECURRING_REMINDER_HOURS')?.default as number;
  const expiration = byKey.get('RECURRING_PAYMENT_EXPIRATION_HOURS')?.default as number;
  assert.ok(reminder < expiration, 'el recordatorio por defecto cae después de la expiración');
});

// ─── Resolución efectiva ─────────────────────────────────────────────────────

test('sin nada en el entorno se usan los defaults del descriptor', () => {
  withEnv(CLEAN_ENV, () => {
    assert.deepEqual(getRecurringOrderSettings(), {
      enabled: true,
      batchSize: 50,
      maxAttempts: 3,
      retryHours: 6,
      paymentExpirationHours: 72,
      reminderHours: 24,
      maxConsecutiveFailures: 2,
    });
  });
});

test('el env sigue mandando sobre el default, como antes de la migración', () => {
  withEnv({ ...CLEAN_ENV, RECURRING_BATCH_SIZE: '10', RECURRING_RETRY_HOURS: '2' }, () => {
    const settings = getRecurringOrderSettings();
    assert.equal(settings.batchSize, 10);
    assert.equal(settings.retryHours, 2);
  });
});

test('el kill switch conserva la semántica de `envBool`: sólo "true" y "1" prenden', () => {
  withEnv({ ...CLEAN_ENV, RECURRING_ORDERS_ENABLED: 'false' }, () => {
    assert.equal(getRecurringOrderSettings().enabled, false);
  });
  withEnv({ ...CLEAN_ENV, RECURRING_ORDERS_ENABLED: '0' }, () => {
    assert.equal(getRecurringOrderSettings().enabled, false);
  });
  withEnv({ ...CLEAN_ENV, RECURRING_ORDERS_ENABLED: '1' }, () => {
    assert.equal(getRecurringOrderSettings().enabled, true);
  });
  // Una env vacía es "no definida", no "false".
  withEnv({ ...CLEAN_ENV, RECURRING_ORDERS_ENABLED: '' }, () => {
    assert.equal(getRecurringOrderSettings().enabled, true);
  });
});

test('un número no positivo en el entorno cae al default y NO rompe el motor', () => {
  // Regresión de la migración: `coerceFromEnv` acepta el 0 y el viejo `envInt` no.
  // Con `maxAttempts: 0` todo ciclo quedaba en fallo terminal al primer intento.
  withEnv({ ...CLEAN_ENV, RECURRING_MAX_ATTEMPTS: '0' }, () => {
    assert.equal(getRecurringOrderSettings().maxAttempts, 3);
  });
  withEnv({ ...CLEAN_ENV, RECURRING_BATCH_SIZE: '-1' }, () => {
    assert.equal(getRecurringOrderSettings().batchSize, 50);
  });
  withEnv({ ...CLEAN_ENV, RECURRING_REMINDER_HOURS: 'pronto' }, () => {
    assert.equal(getRecurringOrderSettings().reminderHours, 24);
  });
});

// ─── Integración con lo que ya existía ───────────────────────────────────────

test('`getRecurringOrderConfig` mantiene su forma y el cron sigue saliendo del env', () => {
  // La forma no puede cambiar: `mergeRuntimeConfig` la recibe entera con spread y
  // el job la consume campo por campo.
  withEnv({ ...CLEAN_ENV, RECURRING_RENEWAL_CRON: '*/7 * * * *' }, () => {
    const config = getRecurringOrderConfig();
    assert.equal(config.renewalCron, '*/7 * * * *');
    assert.deepEqual(Object.keys(config).sort(), [
      'batchSize',
      'enabled',
      'maxAttempts',
      'maxConsecutiveFailures',
      'paymentExpirationHours',
      'reminderHours',
      'renewalCron',
      'retryHours',
    ]);
  });
  withEnv(CLEAN_ENV, () => {
    assert.equal(getRecurringOrderConfig().renewalCron, '*/5 * * * *');
  });
});

test('la fila del canal le sigue ganando a lo que se configure en la card', () => {
  // La card es el PISO de la instalación; `recurring_setting` es la excepción por
  // canal. Si esta precedencia se diera vuelta, la pantalla por tienda pasaría a
  // ser decorativa — el mismo error que documenta `ga4/settings.ts`.
  withEnv({ ...CLEAN_ENV, RECURRING_REMINDER_HOURS: '10' }, () => {
    const env = getRecurringOrderConfig();
    assert.equal(env.reminderHours, 10);
    const merged = mergeRuntimeConfig([{ reminder_hours: 4 }], env);
    assert.equal(merged.reminderHours, 4);
    // Y lo que el canal no declara sigue cayendo al valor de la instalación.
    assert.equal(merged.maxAttempts, env.maxAttempts);
  });
});
