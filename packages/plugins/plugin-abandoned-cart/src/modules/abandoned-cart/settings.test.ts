import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerAppSettingsSyncReader } from '@minimalart/mercatto-plugin-runtime';
import { getAbandonedCartSettings, orderedStepHours } from './settings';

/**
 * En el plugin la resolución es **snapshot > env > default**. La capa de
 * snapshot vive en el host (`app-settings`) y el plugin la recibe vía
 * `@minimalart/mercatto-plugin-runtime`. Estos tests ejercitan las dos rutas:
 * el bridge conectado (registramos un reader mock en el runtime) y el fallback
 * puro a env cuando el registry está vacío. La capa de base necesita Postgres
 * y vive en el host, así que no se testea acá (este repo corre `node:test`
 * sin DB).
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

/** Las siete gestionables + las tres `envOnly`. Es LA lista auditada. */
const MANAGED_KEYS = [
  'ABANDONED_CART_ENABLED',
  'ABANDONED_CART_STEP1_HOURS',
  'ABANDONED_CART_STEP2_HOURS',
  'ABANDONED_CART_STEP3_HOURS',
  'ABANDONED_CART_MAX_AGE_HOURS',
  'ABANDONED_CART_BATCH_SIZE',
  'ABANDONED_CART_MAX_PAGES',
];
const ENV_ONLY_KEYS = [
  'ABANDONED_CART_SCAN_CRON',
  'NEXT_PUBLIC_BASE_URL',
  'STOREFRONT_DEFAULT_COUNTRY',
];

/** Limpia las diez para que un `.env` del dev no ensucie los defaults. */
const CLEAN_ENV = Object.fromEntries(
  [...MANAGED_KEYS, ...ENV_ONLY_KEYS].map((k) => [k, undefined]),
);

// ─── `orderedStepHours` ──────────────────────────────────────────────────────

test('una secuencia ya ordenada no se toca', () => {
  assert.deepEqual(orderedStepHours([1, 24, 72]), [1, 24, 72]);
});

test('un paso puesto antes que el anterior se arrastra, no se reordena', () => {
  // Con `sort()` esto daría [2, 10, 72] y el mail del incentivo saldría antes que
  // el primer recordatorio. El clamp sólo DEMORA: el contenido nunca cambia de
  // posición. Ver el docblock de `orderedStepHours`.
  assert.deepEqual(orderedStepHours([10, 2, 72]), [10, 10, 72]);
  assert.deepEqual(orderedStepHours([72, 24, 1]), [72, 72, 72]);
});

test('los no positivos y la basura caen al piso del paso anterior', () => {
  assert.deepEqual(orderedStepHours([0, 24, 72]), [0, 24, 72]);
  assert.deepEqual(orderedStepHours([1, -5, 72]), [1, 1, 72]);
  assert.deepEqual(orderedStepHours([1, Number.NaN, 72]), [1, 1, 72]);
});

test('acepta fracciones: media hora es una cadencia legítima', () => {
  assert.deepEqual(orderedStepHours([0.5, 24, 72]), [0.5, 24, 72]);
});

// ─── Resolución efectiva ─────────────────────────────────────────────────────

test('sin nada en el entorno se usan los defaults', () => {
  withEnv(CLEAN_ENV, () => {
    assert.deepEqual(getAbandonedCartSettings(), {
      enabled: true,
      stepHours: [1, 24, 72],
      maxAgeHours: 336,
      batchSize: 100,
      maxPages: 20,
    });
  });
});

test('el env sigue mandando sobre el default, como antes de la migración', () => {
  withEnv({ ...CLEAN_ENV, ABANDONED_CART_STEP1_HOURS: '3', ABANDONED_CART_MAX_PAGES: '5' }, () => {
    const settings = getAbandonedCartSettings();
    assert.equal(settings.stepHours[0], 3);
    assert.equal(settings.maxPages, 5);
  });
});

test('el kill switch conserva la semántica de `envBool`: sólo "true" y "1" prenden', () => {
  withEnv({ ...CLEAN_ENV, ABANDONED_CART_ENABLED: 'false' }, () => {
    assert.equal(getAbandonedCartSettings().enabled, false);
  });
  withEnv({ ...CLEAN_ENV, ABANDONED_CART_ENABLED: '0' }, () => {
    assert.equal(getAbandonedCartSettings().enabled, false);
  });
  withEnv({ ...CLEAN_ENV, ABANDONED_CART_ENABLED: '1' }, () => {
    assert.equal(getAbandonedCartSettings().enabled, true);
  });
  // Una env vacía es "no definida", no "false": es lo que pasa en la práctica
  // cuando un panel de deploy tiene la fila creada sin valor.
  withEnv({ ...CLEAN_ENV, ABANDONED_CART_ENABLED: '' }, () => {
    assert.equal(getAbandonedCartSettings().enabled, true);
  });
});

test('un número no positivo en el entorno cae al default y NO apaga el barrido', () => {
  // Regresión: con `batchSize: 0` la detección paginaba de a cero carritos,
  // para siempre y sin un error.
  withEnv({ ...CLEAN_ENV, ABANDONED_CART_BATCH_SIZE: '0' }, () => {
    assert.equal(getAbandonedCartSettings().batchSize, 100);
  });
  withEnv({ ...CLEAN_ENV, ABANDONED_CART_MAX_PAGES: '-3' }, () => {
    assert.equal(getAbandonedCartSettings().maxPages, 20);
  });
  withEnv({ ...CLEAN_ENV, ABANDONED_CART_MAX_AGE_HOURS: 'muchas' }, () => {
    assert.equal(getAbandonedCartSettings().maxAgeHours, 336);
  });
});

test('una secuencia desordenada en el entorno llega ya normalizada', () => {
  withEnv(
    {
      ...CLEAN_ENV,
      ABANDONED_CART_STEP1_HOURS: '48',
      ABANDONED_CART_STEP2_HOURS: '2',
      ABANDONED_CART_STEP3_HOURS: '72',
    },
    () => {
      assert.deepEqual(getAbandonedCartSettings().stepHours, [48, 48, 72]);
    },
  );
});

// ─── Bridge del snapshot del host (vía runtime contract) ────────────────────

function withReader(map: Record<string, unknown>, body: () => void): void {
  registerAppSettingsSyncReader((namespace, key) => {
    assert.equal(namespace, 'extension:abandoned-cart');
    return map[key];
  });
  try {
    body();
  } finally {
    registerAppSettingsSyncReader(null);
  }
}

test('el snapshot del host gana sobre el env cuando el bridge está conectado', () => {
  withEnv({ ...CLEAN_ENV, ABANDONED_CART_STEP1_HOURS: '3', ABANDONED_CART_MAX_PAGES: '5' }, () => {
    withReader(
      { ABANDONED_CART_STEP1_HOURS: 7, ABANDONED_CART_MAX_PAGES: 42 },
      () => {
        const settings = getAbandonedCartSettings();
        assert.equal(settings.stepHours[0], 7);
        assert.equal(settings.maxPages, 42);
      },
    );
  });
});

test('cuando el reader devuelve undefined para una key, se cae al env', () => {
  withEnv({ ...CLEAN_ENV, ABANDONED_CART_STEP2_HOURS: '9' }, () => {
    withReader({ ABANDONED_CART_STEP1_HOURS: 3 }, () => {
      const settings = getAbandonedCartSettings();
      assert.equal(settings.stepHours[0], 3);
      // El paso 2 no está en el snapshot mock → env manda → clamp con step1.
      assert.equal(settings.stepHours[1], 9);
    });
  });
});

test('un reader que tira NO rompe el getter: se cae al env sin propagar el error', () => {
  withEnv({ ...CLEAN_ENV, ABANDONED_CART_BATCH_SIZE: '77' }, () => {
    registerAppSettingsSyncReader(() => {
      throw new Error('snapshot no está listo');
    });
    try {
      assert.equal(getAbandonedCartSettings().batchSize, 77);
    } finally {
      registerAppSettingsSyncReader(null);
    }
  });
});

test('el kill switch del snapshot manda como boolean, no como string', () => {
  withReader({ ABANDONED_CART_ENABLED: false }, () => {
    assert.equal(getAbandonedCartSettings().enabled, false);
  });
});

test('un valor no positivo del snapshot cae al env (misma regla que el env)', () => {
  // Sin este guard, un usuario que puso 0 en el admin apagaría el barrido en
  // silencio. La regla es la misma que `readPositive` aplica al env.
  withEnv({ ...CLEAN_ENV, ABANDONED_CART_BATCH_SIZE: '50' }, () => {
    withReader({ ABANDONED_CART_BATCH_SIZE: 0 }, () => {
      assert.equal(getAbandonedCartSettings().batchSize, 50);
    });
  });
});
