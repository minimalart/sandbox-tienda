"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const mercatto_plugin_runtime_1 = require("@minimalart/mercatto-plugin-runtime");
const settings_1 = require("./settings");
/**
 * En el plugin la resolución es **snapshot > env > default**. La capa de
 * snapshot vive en el host (`app-settings`) y el plugin la recibe vía
 * `@minimalart/mercatto-plugin-runtime`. Estos tests ejercitan las dos rutas:
 * el bridge conectado (registramos un reader mock en el runtime) y el fallback
 * puro a env cuando el registry está vacío. La capa de base necesita Postgres
 * y vive en el host, así que no se testea acá (este repo corre `node:test`
 * sin DB).
 */
function withEnv(vars, body) {
    const previous = {};
    for (const [key, value] of Object.entries(vars)) {
        previous[key] = process.env[key];
        if (value === undefined)
            delete process.env[key];
        else
            process.env[key] = value;
    }
    try {
        body();
    }
    finally {
        for (const [key, value] of Object.entries(previous)) {
            if (value === undefined)
                delete process.env[key];
            else
                process.env[key] = value;
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
const CLEAN_ENV = Object.fromEntries([...MANAGED_KEYS, ...ENV_ONLY_KEYS].map((k) => [k, undefined]));
// ─── `orderedStepHours` ──────────────────────────────────────────────────────
(0, node_test_1.test)('una secuencia ya ordenada no se toca', () => {
    strict_1.default.deepEqual((0, settings_1.orderedStepHours)([1, 24, 72]), [1, 24, 72]);
});
(0, node_test_1.test)('un paso puesto antes que el anterior se arrastra, no se reordena', () => {
    // Con `sort()` esto daría [2, 10, 72] y el mail del incentivo saldría antes que
    // el primer recordatorio. El clamp sólo DEMORA: el contenido nunca cambia de
    // posición. Ver el docblock de `orderedStepHours`.
    strict_1.default.deepEqual((0, settings_1.orderedStepHours)([10, 2, 72]), [10, 10, 72]);
    strict_1.default.deepEqual((0, settings_1.orderedStepHours)([72, 24, 1]), [72, 72, 72]);
});
(0, node_test_1.test)('los no positivos y la basura caen al piso del paso anterior', () => {
    strict_1.default.deepEqual((0, settings_1.orderedStepHours)([0, 24, 72]), [0, 24, 72]);
    strict_1.default.deepEqual((0, settings_1.orderedStepHours)([1, -5, 72]), [1, 1, 72]);
    strict_1.default.deepEqual((0, settings_1.orderedStepHours)([1, Number.NaN, 72]), [1, 1, 72]);
});
(0, node_test_1.test)('acepta fracciones: media hora es una cadencia legítima', () => {
    strict_1.default.deepEqual((0, settings_1.orderedStepHours)([0.5, 24, 72]), [0.5, 24, 72]);
});
// ─── Resolución efectiva ─────────────────────────────────────────────────────
(0, node_test_1.test)('sin nada en el entorno se usan los defaults', () => {
    withEnv(CLEAN_ENV, () => {
        strict_1.default.deepEqual((0, settings_1.getAbandonedCartSettings)(), {
            enabled: true,
            stepHours: [1, 24, 72],
            maxAgeHours: 336,
            batchSize: 100,
            maxPages: 20,
        });
    });
});
(0, node_test_1.test)('el env sigue mandando sobre el default, como antes de la migración', () => {
    withEnv({ ...CLEAN_ENV, ABANDONED_CART_STEP1_HOURS: '3', ABANDONED_CART_MAX_PAGES: '5' }, () => {
        const settings = (0, settings_1.getAbandonedCartSettings)();
        strict_1.default.equal(settings.stepHours[0], 3);
        strict_1.default.equal(settings.maxPages, 5);
    });
});
(0, node_test_1.test)('el kill switch conserva la semántica de `envBool`: sólo "true" y "1" prenden', () => {
    withEnv({ ...CLEAN_ENV, ABANDONED_CART_ENABLED: 'false' }, () => {
        strict_1.default.equal((0, settings_1.getAbandonedCartSettings)().enabled, false);
    });
    withEnv({ ...CLEAN_ENV, ABANDONED_CART_ENABLED: '0' }, () => {
        strict_1.default.equal((0, settings_1.getAbandonedCartSettings)().enabled, false);
    });
    withEnv({ ...CLEAN_ENV, ABANDONED_CART_ENABLED: '1' }, () => {
        strict_1.default.equal((0, settings_1.getAbandonedCartSettings)().enabled, true);
    });
    // Una env vacía es "no definida", no "false": es lo que pasa en la práctica
    // cuando un panel de deploy tiene la fila creada sin valor.
    withEnv({ ...CLEAN_ENV, ABANDONED_CART_ENABLED: '' }, () => {
        strict_1.default.equal((0, settings_1.getAbandonedCartSettings)().enabled, true);
    });
});
(0, node_test_1.test)('un número no positivo en el entorno cae al default y NO apaga el barrido', () => {
    // Regresión: con `batchSize: 0` la detección paginaba de a cero carritos,
    // para siempre y sin un error.
    withEnv({ ...CLEAN_ENV, ABANDONED_CART_BATCH_SIZE: '0' }, () => {
        strict_1.default.equal((0, settings_1.getAbandonedCartSettings)().batchSize, 100);
    });
    withEnv({ ...CLEAN_ENV, ABANDONED_CART_MAX_PAGES: '-3' }, () => {
        strict_1.default.equal((0, settings_1.getAbandonedCartSettings)().maxPages, 20);
    });
    withEnv({ ...CLEAN_ENV, ABANDONED_CART_MAX_AGE_HOURS: 'muchas' }, () => {
        strict_1.default.equal((0, settings_1.getAbandonedCartSettings)().maxAgeHours, 336);
    });
});
(0, node_test_1.test)('una secuencia desordenada en el entorno llega ya normalizada', () => {
    withEnv({
        ...CLEAN_ENV,
        ABANDONED_CART_STEP1_HOURS: '48',
        ABANDONED_CART_STEP2_HOURS: '2',
        ABANDONED_CART_STEP3_HOURS: '72',
    }, () => {
        strict_1.default.deepEqual((0, settings_1.getAbandonedCartSettings)().stepHours, [48, 48, 72]);
    });
});
// ─── Bridge del snapshot del host (vía runtime contract) ────────────────────
function withReader(map, body) {
    (0, mercatto_plugin_runtime_1.registerAppSettingsSyncReader)((namespace, key) => {
        strict_1.default.equal(namespace, 'extension:abandoned-cart');
        return map[key];
    });
    try {
        body();
    }
    finally {
        (0, mercatto_plugin_runtime_1.registerAppSettingsSyncReader)(null);
    }
}
(0, node_test_1.test)('el snapshot del host gana sobre el env cuando el bridge está conectado', () => {
    withEnv({ ...CLEAN_ENV, ABANDONED_CART_STEP1_HOURS: '3', ABANDONED_CART_MAX_PAGES: '5' }, () => {
        withReader({ ABANDONED_CART_STEP1_HOURS: 7, ABANDONED_CART_MAX_PAGES: 42 }, () => {
            const settings = (0, settings_1.getAbandonedCartSettings)();
            strict_1.default.equal(settings.stepHours[0], 7);
            strict_1.default.equal(settings.maxPages, 42);
        });
    });
});
(0, node_test_1.test)('cuando el reader devuelve undefined para una key, se cae al env', () => {
    withEnv({ ...CLEAN_ENV, ABANDONED_CART_STEP2_HOURS: '9' }, () => {
        withReader({ ABANDONED_CART_STEP1_HOURS: 3 }, () => {
            const settings = (0, settings_1.getAbandonedCartSettings)();
            strict_1.default.equal(settings.stepHours[0], 3);
            // El paso 2 no está en el snapshot mock → env manda → clamp con step1.
            strict_1.default.equal(settings.stepHours[1], 9);
        });
    });
});
(0, node_test_1.test)('un reader que tira NO rompe el getter: se cae al env sin propagar el error', () => {
    withEnv({ ...CLEAN_ENV, ABANDONED_CART_BATCH_SIZE: '77' }, () => {
        (0, mercatto_plugin_runtime_1.registerAppSettingsSyncReader)(() => {
            throw new Error('snapshot no está listo');
        });
        try {
            strict_1.default.equal((0, settings_1.getAbandonedCartSettings)().batchSize, 77);
        }
        finally {
            (0, mercatto_plugin_runtime_1.registerAppSettingsSyncReader)(null);
        }
    });
});
(0, node_test_1.test)('el kill switch del snapshot manda como boolean, no como string', () => {
    withReader({ ABANDONED_CART_ENABLED: false }, () => {
        strict_1.default.equal((0, settings_1.getAbandonedCartSettings)().enabled, false);
    });
});
(0, node_test_1.test)('un valor no positivo del snapshot cae al env (misma regla que el env)', () => {
    // Sin este guard, un usuario que puso 0 en el admin apagaría el barrido en
    // silencio. La regla es la misma que `readPositive` aplica al env.
    withEnv({ ...CLEAN_ENV, ABANDONED_CART_BATCH_SIZE: '50' }, () => {
        withReader({ ABANDONED_CART_BATCH_SIZE: 0 }, () => {
            strict_1.default.equal((0, settings_1.getAbandonedCartSettings)().batchSize, 50);
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2V0dGluZ3MudGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2FiYW5kb25lZC1jYXJ0L3NldHRpbmdzLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSx5Q0FBaUM7QUFDakMsZ0VBQXdDO0FBQ3hDLGlGQUFvRjtBQUNwRix5Q0FBd0U7QUFFeEU7Ozs7Ozs7O0dBUUc7QUFFSCxTQUFTLE9BQU8sQ0FBQyxJQUF3QyxFQUFFLElBQWdCO0lBQ3pFLE1BQU0sUUFBUSxHQUF1QyxFQUFFLENBQUM7SUFDeEQsS0FBSyxNQUFNLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztRQUNoRCxRQUFRLENBQUMsR0FBRyxDQUFDLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUNqQyxJQUFJLEtBQUssS0FBSyxTQUFTO1lBQUUsT0FBTyxPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDOztZQUM1QyxPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEtBQUssQ0FBQztJQUNoQyxDQUFDO0lBQ0QsSUFBSSxDQUFDO1FBQ0gsSUFBSSxFQUFFLENBQUM7SUFDVCxDQUFDO1lBQVMsQ0FBQztRQUNULEtBQUssTUFBTSxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7WUFDcEQsSUFBSSxLQUFLLEtBQUssU0FBUztnQkFBRSxPQUFPLE9BQU8sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7O2dCQUM1QyxPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEtBQUssQ0FBQztRQUNoQyxDQUFDO0lBQ0gsQ0FBQztBQUNILENBQUM7QUFFRCx5RUFBeUU7QUFDekUsTUFBTSxZ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