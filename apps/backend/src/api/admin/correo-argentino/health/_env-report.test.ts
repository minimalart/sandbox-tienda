/**
 * Tests del reporte de configuración de Correo Argentino.
 *
 * El test que importa es el primero: **que el reporte NUNCA contenga el valor de
 * un ajuste.** Esta respuesta viaja por HTTP al admin, así que un campo de más con
 * el valor adentro es publicar la API-Key de facturación del comercio. Y ahora la
 * frontera es más fina que antes: el builder RECIBE los valores en claro —los
 * necesita para preguntarle al normalizador del módulo si los acepta— así que lo
 * único que impide que se filtren es que nunca se copien a la salida.
 *
 * Los demás cubren las dos distinciones que un booleano ingenuo esconde:
 *
 *  - "hay valor" vs "el módulo lo acepta" (`configured` vs `usable`).
 *  - DE DÓNDE sale el valor. Es el motivo entero de esta reescritura: mientras el
 *    reporte miraba `process.env`, una tienda con todo cargado en `site_setting`
 *    veía las 42 filas en rojo.
 */

import { readdirSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildCorreoConfigReport,
  CORREO_ENV_VAR_NAMES,
  resolveCorreoTarget,
  resolveCorreoTargets,
  type CorreoConfigReport,
  type CorreoReportInput,
  type CorreoResolvedSetting,
  type EnvLike,
} from './_env-report.ts';
import type { SettingSource } from '../../../../modules/app-settings/resolve.ts';

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Arma la entrada del builder a partir de un mapa `clave → valor`, todas con el
 * mismo origen. Es el atajo para los tests que no están mirando la precedencia:
 * la mayoría sólo necesitan que la clave TENGA un valor.
 */
function resolved(
  values: Record<string, unknown>,
  source: SettingSource = 'site',
): Record<string, CorreoResolvedSetting> {
  const out: Record<string, CorreoResolvedSetting> = {};
  for (const [key, value] of Object.entries(values)) {
    out[key] = { source, value };
  }
  return out;
}

const report = (input: Partial<CorreoReportInput> = {}): CorreoConfigReport =>
  buildCorreoConfigReport({ settings: {}, ...input });

function find(
  built: CorreoConfigReport,
  name: string,
): CorreoConfigReport['settings'][number] {
  const entry = built.settings.find((candidate) => candidate.name === name);
  assert.ok(entry, `${name} no está en el catálogo`);
  return entry;
}

/* -------------------------------------------------------------------------- */
/* Fuga de valores                                                             */
/* -------------------------------------------------------------------------- */

/** Valores marcados: si alguno aparece en el JSON del reporte, hay una fuga. */
const SECRETS: Record<string, string> = {
  CORREO_ARGENTINO_API_KEY: 'Apikey eyJhbGciOiJIUzI1NiJ9.SECRETO-API-KEY.zzz',
  CORREO_ARGENTINO_AGREEMENT: 'SECRETO-AGREEMENT-4242',
  CORREO_ARGENTINO_SELLER_ID: 'SECRETO-SELLER-99',
  CORREO_ARGENTINO_MICORREO_USER: 'SECRETO-USER',
  CORREO_ARGENTINO_MICORREO_PASS: 'SECRETO-PASS',
  CORREO_ARGENTINO_CUSTOMER_ID: 'SECRETO-CUSTOMER-0000550137',
  CORREO_ARGENTINO_HOSTNAME: 'secreto-host.interno.example',
  CORREO_ARGENTINO_MICORREO_HOSTNAME: 'secreto-cotizador.interno.example',
  CORREO_ARGENTINO_PAQAR_BASE_PATH: '/secreto-paqar/v9',
  CORREO_ARGENTINO_MICORREO_BASE_PATH: '/secreto-micorreo/v9',
  CORREO_ARGENTINO_EXT_CLIENT: '007',
  CORREO_ARGENTINO_ORIGIN_POSTAL_CODE: 'SECRETO-1414',
  CORREO_ARGENTINO_ORIGIN_STREET: 'SECRETO-Calle-Falsa',
  CORREO_ARGENTINO_ORIGIN_NUMBER: 'SECRETO-123',
  CORREO_ARGENTINO_ORIGIN_CITY: 'SECRETO-Ciudad',
  CORREO_ARGENTINO_ORIGIN_STATE: 'SECRETO-C',
  CORREO_ARGENTINO_SENDER_NAME: 'SECRETO-Remitente',
  CORREO_ARGENTINO_SENDER_EMAIL: 'secreto@example.com',
  CORREO_ARGENTINO_SENDER_PHONE: 'SECRETO-1122334455',
  CORREO_ARGENTINO_PRODUCT_CATEGORY: 'SECRETO-Mercaderia',
  CORREO_ARGENTINO_AFORO_DIVISOR: 'SECRETO-4000',
  // Ojo con los valores que colisionan con los tokens del JSON (`true`, números
  // pelados): el reporte los emite como booleanos legítimos y un `includes()`
  // los confundiría con una fuga.
  CORREO_ARGENTINO_SEED_SHIPPING_OPTIONS: 'SECRETO-habilitado',
};

describe('buildCorreoConfigReport — NUNCA filtra un valor', () => {
  it('el reporte serializado no contiene ninguno de los valores de entrada', () => {
    const serialized = JSON.stringify(
      report({
        settings: resolved(SECRETS),
        env: SECRETS as EnvLike,
        // También por la capa de credenciales, que es la otra puerta de entrada
        // de valores en claro a este archivo.
        siteCredentials: {
          apiKey: 'SECRETO-CREDENCIAL-APIKEY',
          agreement: 'SECRETO-CREDENCIAL-AGREEMENT',
          micorreoPassword: 'SECRETO-CREDENCIAL-PASS',
        },
      }),
    );

    for (const [name, value] of Object.entries(SECRETS)) {
      assert.ok(
        !serialized.includes(value),
        `el valor de ${name} apareció en la respuesta del health check`,
      );
    }
    for (const value of [
      'SECRETO-CREDENCIAL-APIKEY',
      'SECRETO-CREDENCIAL-AGREEMENT',
      'SECRETO-CREDENCIAL-PASS',
    ]) {
      assert.ok(!serialized.includes(value), `${value} salió por la respuesta`);
    }
  });

  it('cada clave reporta SOLO nombre, origen, booleanos y clasificación', () => {
    const built = report({ settings: resolved(SECRETS) });

    for (const entry of built.settings) {
      assert.deepEqual(
        Object.keys(entry).sort(),
        ['configured', 'group', 'name', 'requirement', 'source', 'usable'],
        `${entry.name} expone campos de más`,
      );
      assert.equal(typeof entry.configured, 'boolean');
      assert.equal(typeof entry.usable, 'boolean');
      // Los únicos strings libres son el NOMBRE de la clave y el ORIGEN, y los dos
      // salen de conjuntos cerrados: así un campo con el valor adentro no se puede
      // colar disfrazado de metadato.
      assert.ok(CORREO_ENV_VAR_NAMES.includes(entry.name));
      assert.ok(
        ['site', 'global', 'credential', 'env', 'default', 'off', 'unset'].includes(
          entry.source,
        ),
        `${entry.name}: origen desconocido ${entry.source}`,
      );
    }
  });

  it('el reporte de una instalación vacía tampoco inventa strings', () => {
    const built = report();
    const serialized = JSON.stringify(built);

    assert.ok(!serialized.includes('undefined'));
    assert.equal(built.paqar_ready, false);
    assert.equal(built.micorreo_ready, false);
  });
});

/* -------------------------------------------------------------------------- */
/* Origen                                                                      */
/* -------------------------------------------------------------------------- */

describe('buildCorreoConfigReport — de dónde sale cada valor', () => {
  /**
   * EL test de esta reescritura. Con el reporte anterior —presencia de env var—
   * esta tienda mostraba "sin cargar" en las dos claves obligatorias mientras
   * despachaba sin problemas, y el operador terminaba pisando su configuración con
   * un `.env`.
   */
  it('una tienda con su fila propia reporta `site`, no "sin cargar"', () => {
    const built = report({
      settings: resolved(
        {
          CORREO_ARGENTINO_API_KEY: 'eyJvalida',
          CORREO_ARGENTINO_AGREEMENT: '18018',
        },
        'site',
      ),
    });

    assert.equal(find(built, 'CORREO_ARGENTINO_API_KEY').source, 'site');
    assert.equal(find(built, 'CORREO_ARGENTINO_API_KEY').configured, true);
    assert.equal(built.paqar_ready, true);
    assert.deepEqual(built.missing_required, []);
  });

  it('distingue las cuatro capas que aportan valor', () => {
    const built = report({
      settings: {
        CORREO_ARGENTINO_API_KEY: { source: 'site', value: 'eyJde-la-tienda' },
        CORREO_ARGENTINO_AGREEMENT: { source: 'global', value: '18018' },
        CORREO_ARGENTINO_SELLER_ID: { source: 'env', value: '99' },
        CORREO_ARGENTINO_SERVICE_TYPE: { source: 'default', value: 'CP' },
      },
    });

    assert.equal(find(built, 'CORREO_ARGENTINO_API_KEY').source, 'site');
    assert.equal(find(built, 'CORREO_ARGENTINO_AGREEMENT').source, 'global');
    assert.equal(find(built, 'CORREO_ARGENTINO_SELLER_ID').source, 'env');
    assert.equal(find(built, 'CORREO_ARGENTINO_SERVICE_TYPE').source, 'default');
    for (const entry of built.settings) {
      if (entry.source === 'unset') continue;
      assert.equal(entry.configured, true, `${entry.name} debería tener valor`);
    }
  });

  // Fail-closed: una tienda secundaria que no declaró lo suyo NO hereda la global.
  // El reporte tiene que decir `off` y no `unset`, porque son problemas distintos:
  // `unset` se arregla cargando el valor en cualquier capa, `off` se arregla
  // cargándolo EN ESA TIENDA.
  it('`off` y `unset` no tienen valor, y no son lo mismo', () => {
    const built = report({
      settings: {
        CORREO_ARGENTINO_API_KEY: { source: 'off', value: undefined },
        CORREO_ARGENTINO_AGREEMENT: { source: 'unset', value: undefined },
      },
    });

    assert.equal(find(built, 'CORREO_ARGENTINO_API_KEY').source, 'off');
    assert.equal(find(built, 'CORREO_ARGENTINO_API_KEY').configured, false);
    assert.equal(find(built, 'CORREO_ARGENTINO_AGREEMENT').source, 'unset');
    assert.equal(built.paqar_ready, false);
    assert.deepEqual(built.missing_required, [
      'CORREO_ARGENTINO_API_KEY',
      'CORREO_ARGENTINO_AGREEMENT',
    ]);
  });

  /**
   * `site_credential` PISA al descriptor en runtime (`applyCorreoSiteCredentials`).
   * Si el reporte se quedara con el origen del descriptor, una tienda que cargó su
   * cuenta por la pantalla de credenciales vería "heredado del entorno" mientras
   * despacha con la suya — que es el mismo falso negativo, sólo que más difícil de
   * ver porque la fila estaría en verde.
   */
  it('la credencial de la tienda gana sobre el descriptor', () => {
    const built = report({
      settings: resolved({ CORREO_ARGENTINO_AGREEMENT: 'de-la-instancia' }, 'env'),
      siteCredentials: { agreement: '18018' },
    });

    assert.equal(find(built, 'CORREO_ARGENTINO_AGREEMENT').source, 'credential');
    assert.equal(find(built, 'CORREO_ARGENTINO_AGREEMENT').configured, true);
  });

  it('una credencial vacía NO cuenta como capa: se sigue viendo el descriptor', () => {
    const built = report({
      settings: resolved({ CORREO_ARGENTINO_AGREEMENT: '18018' }, 'global'),
      siteCredentials: { agreement: '   ', apiKey: undefined },
    });

    assert.equal(find(built, 'CORREO_ARGENTINO_AGREEMENT').source, 'global');
  });

  /**
   * Las dos `envOnly` (el cron del job y el flag de los seeds) no tienen descriptor
   * a propósito: Medusa hornea el cron al arrancar y los seeds corren por CLI. Su
   * único origen posible sigue siendo el entorno, y el reporte tiene que decirlo
   * en vez de mostrarlas siempre en `unset`.
   */
  it('las claves sin descriptor caen al entorno', () => {
    const built = report({
      env: { CORREO_ARGENTINO_TRACKING_SYNC_SCHEDULE: '*/15 * * * *' },
    });

    assert.equal(
      find(built, 'CORREO_ARGENTINO_TRACKING_SYNC_SCHEDULE').source,
      'env',
    );
    assert.equal(
      find(built, 'CORREO_ARGENTINO_SEED_SHIPPING_OPTIONS').source,
      'unset',
    );
  });

  it('el descriptor gana sobre el entorno crudo: la precedencia ya la resolvió', () => {
    // El `env` que recibe el builder es el respaldo de las claves SIN descriptor.
    // Si además pisara a las que sí lo tienen, un `.env` viejo taparía la fila de
    // la tienda y el reporte volvería a mentir, ahora al revés.
    const built = report({
      settings: { CORREO_ARGENTINO_AGREEMENT: { source: 'off', value: undefined } },
      env: { CORREO_ARGENTINO_AGREEMENT: 'del-env-viejo' },
    });

    assert.equal(find(built, 'CORREO_ARGENTINO_AGREEMENT').source, 'off');
    assert.equal(find(built, 'CORREO_ARGENTINO_AGREEMENT').configured, false);
  });
});

/* -------------------------------------------------------------------------- */
/* Valor presente vs valor usable                                              */
/* -------------------------------------------------------------------------- */

describe('buildCorreoConfigReport — hay valor', () => {
  it('whitespace no es un valor', () => {
    const built = report({
      settings: resolved({
        CORREO_ARGENTINO_AGREEMENT: '   ',
        CORREO_ARGENTINO_SENDER_NAME: '\t\n',
      }),
    });

    const agreement = find(built, 'CORREO_ARGENTINO_AGREEMENT');
    assert.equal(agreement.configured, false);
    assert.equal(agreement.usable, false);
    assert.equal(find(built, 'CORREO_ARGENTINO_SENDER_NAME').configured, false);
  });

  // La base guarda booleanos y números YA tipados (los coerciona `validate.ts`),
  // mientras que el entorno siempre da strings. Un `false` guardado a propósito es
  // un valor configurado, no un hueco.
  it('un booleano o un número guardados cuentan como valor', () => {
    const built = report({
      settings: resolved({
        CORREO_ARGENTINO_TEST_MODE: false,
        CORREO_ARGENTINO_MAX_WEIGHT_G: 25000,
      }),
    });

    assert.equal(find(built, 'CORREO_ARGENTINO_TEST_MODE').configured, true);
    assert.equal(find(built, 'CORREO_ARGENTINO_MAX_WEIGHT_G').configured, true);
  });

  it('reporta las obligatorias que faltan por nombre', () => {
    const built = report({
      settings: resolved({ CORREO_ARGENTINO_API_KEY: 'eyJvalida' }),
    });

    assert.deepEqual(built.missing_required, ['CORREO_ARGENTINO_AGREEMENT']);
    assert.equal(built.paqar_ready, false);
  });

  it('paqar_ready solo con apiKey Y agreement: son las dos que autentican', () => {
    const built = report({
      settings: resolved({
        CORREO_ARGENTINO_API_KEY: 'eyJvalida',
        CORREO_ARGENTINO_AGREEMENT: '12345',
      }),
    });

    assert.equal(built.paqar_ready, true);
    assert.deepEqual(built.missing_required, []);
  });

  it('micorreo_ready exige las TRES: sin customerId no se puede cotizar', () => {
    const base = {
      CORREO_ARGENTINO_MICORREO_USER: 'u',
      CORREO_ARGENTINO_MICORREO_PASS: 'p',
    };

    assert.equal(report({ settings: resolved(base) }).micorreo_ready, false);
    assert.deepEqual(report({ settings: resolved(base) }).missing_quoting, [
      'CORREO_ARGENTINO_CUSTOMER_ID',
    ]);
    assert.equal(
      report({
        settings: resolved({ ...base, CORREO_ARGENTINO_CUSTOMER_ID: 'c' }),
      }).micorreo_ready,
      true,
    );
  });

  it('las de operar se reportan aparte: el provider arranca sin ellas', () => {
    const built = report({
      settings: resolved({
        CORREO_ARGENTINO_API_KEY: 'eyJvalida',
        CORREO_ARGENTINO_AGREEMENT: '12345',
      }),
    });

    assert.equal(built.paqar_ready, true);
    assert.ok(
      built.missing_operating.includes('CORREO_ARGENTINO_ORIGIN_POSTAL_CODE'),
    );
    assert.ok(built.missing_operating.includes('CORREO_ARGENTINO_SENDER_NAME'));
    // Las opcionales NUNCA entran en ninguna lista de faltantes.
    assert.ok(!built.missing_operating.includes('CORREO_ARGENTINO_ORIGIN_FLOOR'));
  });
});

describe('buildCorreoConfigReport — con valor pero inservible', () => {
  // El caso real: la planilla de credenciales de Correo trae la celda con el
  // prefijo `"Apikey "` ya puesto, y el cliente lo agrega de nuevo.
  it('una API-Key que es SOLO el prefijo cuenta como faltante', () => {
    const built = report({
      settings: resolved({
        CORREO_ARGENTINO_API_KEY: 'Apikey',
        CORREO_ARGENTINO_AGREEMENT: '12345',
      }),
    });

    const apiKey = find(built, 'CORREO_ARGENTINO_API_KEY');
    assert.equal(apiKey.configured, true, 'la clave SÍ tiene valor');
    assert.equal(apiKey.usable, false, 'pero el normalizador la descarta');
    assert.equal(built.paqar_ready, false);
    assert.deepEqual(built.missing_required, ['CORREO_ARGENTINO_API_KEY']);
  });

  it('la API-Key con el prefijo pegado adelante sí es usable', () => {
    const built = report({
      settings: resolved({
        CORREO_ARGENTINO_API_KEY: 'Apikey eyJhbGciOiJIUzI1NiJ9.abc.def',
        CORREO_ARGENTINO_AGREEMENT: '12345',
      }),
    });

    assert.equal(find(built, 'CORREO_ARGENTINO_API_KEY').usable, true);
    assert.equal(built.paqar_ready, true);
  });

  // Una credencial de tienda mal cargada rompe igual que una del entorno, y el
  // reporte tiene que delatarla con el mismo detalle.
  it('una credencial de tienda inservible se reporta como tal', () => {
    const built = report({
      settings: resolved({ CORREO_ARGENTINO_API_KEY: 'eyJla-buena-de-la-instancia' }),
      siteCredentials: { apiKey: 'Apikey' },
    });

    const apiKey = find(built, 'CORREO_ARGENTINO_API_KEY');
    assert.equal(apiKey.source, 'credential');
    assert.equal(apiKey.configured, true);
    assert.equal(apiKey.usable, false);
  });

  it('un extClient que no son 3 dígitos se reporta con valor e inservible', () => {
    for (const value of ['12', '1234', 'abc']) {
      const entry = find(
        report({ settings: resolved({ CORREO_ARGENTINO_EXT_CLIENT: value }) }),
        'CORREO_ARGENTINO_EXT_CLIENT',
      );
      assert.equal(entry.configured, true, `${value} tiene valor`);
      assert.equal(entry.usable, false, `${value} no lo acepta el normalizador`);
    }

    assert.equal(
      find(
        report({ settings: resolved({ CORREO_ARGENTINO_EXT_CLIENT: '007' }) }),
        'CORREO_ARGENTINO_EXT_CLIENT',
      ).usable,
      true,
    );
  });
});

/* -------------------------------------------------------------------------- */
/* Target                                                                      */
/* -------------------------------------------------------------------------- */

describe('resolveCorreoTarget — sin ecoar el hostname', () => {
  it('sin host manda el modo de prueba, y solo "true" es test', () => {
    assert.equal(resolveCorreoTarget({}), 'prod');
    assert.equal(resolveCorreoTarget({ testMode: true }), 'test');
    assert.equal(resolveCorreoTarget({ testMode: 'true' }), 'test');
    assert.equal(resolveCorreoTarget({ testMode: 'TRUE ' }), 'test');
    assert.equal(resolveCorreoTarget({ testMode: false }), 'prod');
    assert.equal(resolveCorreoTarget({ testMode: 'false' }), 'prod');
    assert.equal(resolveCorreoTarget({ testMode: '1' }), 'prod');
  });

  it('reconoce los dos hostnames conocidos del módulo', () => {
    assert.equal(
      resolveCorreoTarget({ hostname: 'apitest.correoargentino.com.ar' }),
      'test',
    );
    assert.equal(
      resolveCorreoTarget({ hostname: 'api.correoargentino.com.ar' }),
      'prod',
    );
  });

  it('el host manda sobre el modo de prueba (es lo que hace el loader)', () => {
    assert.equal(
      resolveCorreoTarget({
        testMode: true,
        hostname: 'api.correoargentino.com.ar',
      }),
      'prod',
    );
  });

  it('un hostname desconocido es "custom" y su valor no se devuelve', () => {
    assert.equal(resolveCorreoTarget({ hostname: 'proxy.interno.example' }), 'custom');
  });

  // Se clasifica con el MISMO normalizador del loader, así que un valor pegado
  // del manual (con esquema, con path) no se reporta como "custom" cuando en
  // realidad apunta a prod.
  it('un hostname con esquema o path pegado se clasifica igual que en el loader', () => {
    assert.equal(
      resolveCorreoTarget({
        hostname: 'https://api.correoargentino.com.ar/paqar/v1',
      }),
      'prod',
    );
    assert.equal(
      resolveCorreoTarget({ hostname: ' APITEST.correoargentino.com.ar ' }),
      'test',
    );
  });
});

describe('resolveCorreoTargets — una API puede apuntar distinto que la otra', () => {
  it('sin el override de MiCorreo, los dos targets coinciden', () => {
    assert.deepEqual(resolveCorreoTargets({}), { paqar: 'prod', micorreo: 'prod' });
    assert.deepEqual(resolveCorreoTargets({ testMode: true }), {
      paqar: 'test',
      micorreo: 'test',
    });
    assert.deepEqual(resolveCorreoTargets({ hostname: 'proxy.interno.example' }), {
      paqar: 'custom',
      micorreo: 'custom',
    });
  });

  // El escenario que motiva la variable: el sandbox de MiCorreo no responde, así
  // que se opera en test y se cotiza en prod. Esto es exactamente lo que el admin
  // tiene que poder mostrar.
  it('operar en test y cotizar en prod se reporta como tal', () => {
    assert.deepEqual(
      resolveCorreoTargets({
        testMode: true,
        micorreoHostname: 'api.correoargentino.com.ar',
      }),
      { paqar: 'test', micorreo: 'prod' },
    );
  });

  it('el override de MiCorreo gana sobre el host general', () => {
    assert.deepEqual(
      resolveCorreoTargets({
        hostname: 'apitest.correoargentino.com.ar',
        micorreoHostname: 'cotizador.interno.example',
      }),
      { paqar: 'test', micorreo: 'custom' },
    );
  });

  /**
   * El target sale de los valores EFECTIVOS, no de `process.env`. Una instalación
   * que movió el host a la base y dejó el `.env` viejo tiene que reportar a dónde
   * le pega de verdad: decir "prod" mientras cotiza contra el sandbox es el error
   * que más caro sale de todos los de esta pantalla.
   */
  it('el reporte clasifica el host resuelto, no la env var', () => {
    const built = report({
      settings: resolved(
        { CORREO_ARGENTINO_HOSTNAME: 'apitest.correoargentino.com.ar' },
        'global',
      ),
      env: { CORREO_ARGENTINO_HOSTNAME: 'api.correoargentino.com.ar' },
    });

    assert.equal(built.target, 'test');
  });

  it('el reporte expone los dos y `target` sigue siendo el de paqar', () => {
    const built = report({
      settings: resolved({
        CORREO_ARGENTINO_TEST_MODE: true,
        CORREO_ARGENTINO_MICORREO_HOSTNAME: 'api.correoargentino.com.ar',
      }),
    });

    assert.equal(built.target, 'test');
    assert.deepEqual(built.targets, { paqar: 'test', micorreo: 'prod' });
  });
});

/* -------------------------------------------------------------------------- */
/* Catálogo                                                                    */
/* -------------------------------------------------------------------------- */

describe('catálogo — host y base path por API', () => {
  it('las tres claves nuevas están catalogadas como opcionales', () => {
    const built = report();

    for (const name of [
      'CORREO_ARGENTINO_PAQAR_BASE_PATH',
      'CORREO_ARGENTINO_MICORREO_BASE_PATH',
      'CORREO_ARGENTINO_MICORREO_HOSTNAME',
    ]) {
      const entry = find(built, name);
      assert.equal(entry.requirement, 'opcional', name);
      assert.equal(entry.configured, false, name);
    }

    // Opcionales: no pueden aparecer en ninguna lista de faltantes.
    const missing = [
      ...built.missing_required,
      ...built.missing_quoting,
      ...built.missing_operating,
    ];
    assert.ok(!missing.includes('CORREO_ARGENTINO_PAQAR_BASE_PATH'));
    assert.ok(!missing.includes('CORREO_ARGENTINO_MICORREO_BASE_PATH'));
    assert.ok(!missing.includes('CORREO_ARGENTINO_MICORREO_HOSTNAME'));
  });
});

describe('catálogo de claves', () => {
  it('no hay nombres repetidos y todas son CORREO_ARGENTINO_*', () => {
    assert.equal(
      new Set(CORREO_ENV_VAR_NAMES).size,
      CORREO_ENV_VAR_NAMES.length,
    );
    for (const name of CORREO_ENV_VAR_NAMES) {
      assert.ok(
        name.startsWith('CORREO_ARGENTINO_'),
        `${name} no pertenece a este módulo`,
      );
    }
  });

  /**
   * Este test es el que mantiene honesta la afirmación "el catálogo son TODAS":
   * escanea el código y exige que toda `CORREO_ARGENTINO_*` que aparezca esté
   * catalogada. Si alguien agrega una clave y no la reporta, el health check dice
   * "todo configurado" mientras falta algo, y este test rompe primero.
   *
   * ⚠️ Escanea CUATRO orígenes, no solo el loader. Mirar únicamente
   * `env-options.ts` fue el agujero real por el que se colaron cinco variables
   * (`AUTO_FULFILL`, `TRACKING_SYNC_SCHEDULE`, `TRACKING_BUSINESS_HOURS_ONLY`,
   * `SELF_GENERATED_TN`, `TN_PREFIX`): NO pasan por el loader — las leen el
   * subscriber, el job y el workflow de su propio `env` inyectado— así que el
   * guard nunca las vio y el health check nunca las reportó.
   *
   * Al revés no se exige: el catálogo puede tener claves que estas carpetas no
   * mencionan (`CORREO_ARGENTINO_SEED_SHIPPING_OPTIONS` la usan los seeds).
   */
  it('cubre todas las CORREO_ARGENTINO_* del módulo, los jobs, los workflows y los subscribers', () => {
    const referenced = correoVarsReferencedInSources();

    // Cota de humo: si el escaneo se rompe (un rename de carpeta, un cwd
    // distinto), lo que queda es un set chico y el test pasaría por vacío.
    assert.ok(
      referenced.size > 30,
      `el escaneo encontró solo ${referenced.size} variables: probablemente no leyó las fuentes`,
    );

    const missing = [...referenced].filter(
      (name) => !CORREO_ENV_VAR_NAMES.includes(name),
    );
    assert.deepEqual(
      missing,
      [],
      `el código lee variables que el health check no reporta: ${missing.join(', ')}`,
    );
  });

  // Las cinco que se habían escapado, pineadas por nombre: el test de arriba las
  // cubre por escaneo, pero si alguien las borra del catálogo Y del código el
  // escaneo no dice nada. Estas existen y tienen que estar reportadas.
  it('reporta los flags de operación que NO pasan por el loader', () => {
    for (const name of [
      'CORREO_ARGENTINO_AUTO_FULFILL',
      'CORREO_ARGENTINO_TRACKING_SYNC_SCHEDULE',
      'CORREO_ARGENTINO_TRACKING_BUSINESS_HOURS_ONLY',
      'CORREO_ARGENTINO_SELF_GENERATED_TN',
      'CORREO_ARGENTINO_TN_PREFIX',
    ]) {
      const entry = find(report(), name);
      assert.equal(entry.requirement, 'opcional', name);
      assert.equal(entry.group, 'operacion', name);
    }
  });
});

/**
 * Carpetas donde puede aparecer una `CORREO_ARGENTINO_*`.
 *
 * El loader del módulo NO es la única puerta: el job, el workflow y el subscriber
 * las leen de un `env` inyectado (`env.CORREO_ARGENTINO_X`), así que un escaneo de
 * `process.env.` no las vería. Por eso el match es el nombre pelado.
 */
const SCANNED_SOURCE_DIRS: readonly string[] = [
  '../../../../modules/correo-argentino-fulfillment',
  '../../../../jobs',
  '../../../../workflows',
  '../../../../subscribers',
];

/** Nombres de variable mencionados en las fuentes escaneadas. */
function correoVarsReferencedInSources(): Set<string> {
  const found = new Set<string>();

  for (const dir of SCANNED_SOURCE_DIRS) {
    for (const file of sourceFilesIn(new URL(`${dir}/`, import.meta.url))) {
      for (const match of readFileSync(file, 'utf8').match(
        /CORREO_ARGENTINO_[A-Z0-9_]+/g,
      ) ?? []) {
        // Los globs de los comentarios (`CORREO_ARGENTINO_ORIGIN_*`) dejan el
        // nombre cortado en `_`. No son variables.
        if (!match.endsWith('_')) found.add(match);
      }
    }
  }

  return found;
}

/** `.ts`/`.tsx` de un directorio, recursivo y sin tests. */
function sourceFilesIn(dir: URL): URL[] {
  const files: URL[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      files.push(...sourceFilesIn(new URL(`${entry.name}/`, dir)));
      continue;
    }
    // Los tests quedan afuera a propósito: un fixture puede setear una variable
    // que el código ya no lee, y eso no es una variable a catalogar.
    if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      files.push(new URL(entry.name, dir));
    }
  }

  return files;
}
