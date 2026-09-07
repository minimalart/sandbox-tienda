import { test } from 'node:test';
import assert from 'node:assert/strict';

/**
 * El contrato de la KEK compartida. Lo que se custodia acá no es el cifrado
 * —eso ya lo prueban `app-settings/crypto.test.ts` y `multistore/credentials.test.ts`—
 * sino las dos propiedades que hacen que el cambio de contrato sea seguro:
 *
 *   1. Se ESCRIBE con la clave dedicada y se LEE con toda la cadena. Es lo que
 *      permite deployar la clave nueva sin brickear los blobs que ya están
 *      cifrados con `JWT_SECRET`.
 *   2. Los salts NO se comparten. Que los dos dominios usen la misma KEK no
 *      puede volver intercambiables sus blobs.
 */

// Entorno controlado: si el shell trae alguna de estas, los asserts de orden de
// precedencia dejan de significar lo que dicen.
for (const name of ['CREDENTIAL_ENCRYPTION_KEY', 'APP_SETTINGS_ENC_KEY', 'JWT_SECRET']) {
  delete process.env[name];
}

const { deriveKeys, deriveWriteKey, decryptWithAnyKey, resolveEncryptionSecrets } = await import(
  './encryption-key.ts'
);

const SALT_A = 'multistore-credentials-v1';
const SALT_B = 'app-settings-v1';

/** Deja el entorno como estaba: los tests de este archivo lo pisan a propósito. */
function withEnv(vars: Record<string, string | undefined>, run: () => void): void {
  const previous: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(vars)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

// ─── Precedencia ─────────────────────────────────────────────────────────────

test('sin ninguna variable cae al fallback de dev', () => {
  assert.deepEqual(resolveEncryptionSecrets({}), ['supersecret']);
});

test('CREDENTIAL_ENCRYPTION_KEY es la clave de escritura', () => {
  assert.deepEqual(
    resolveEncryptionSecrets({
      CREDENTIAL_ENCRYPTION_KEY: 'dedicada',
      APP_SETTINGS_ENC_KEY: 'legacy-app',
      JWT_SECRET: 'sesiones',
    }),
    ['dedicada', 'legacy-app', 'sesiones'],
  );
});

test('APP_SETTINGS_ENC_KEY sigue valiendo cuando no hay clave dedicada', () => {
  // Es el estado de un proyecto que ya había migrado app-settings: sus blobs
  // están cifrados con esta variable y no se pueden perder.
  assert.deepEqual(
    resolveEncryptionSecrets({ APP_SETTINGS_ENC_KEY: 'legacy-app', JWT_SECRET: 'sesiones' }),
    ['legacy-app', 'sesiones'],
  );
});

test('el mismo valor en dos variables no duplica la clave', () => {
  // Copiar el JWT_SECRET a la variable nueva "por las dudas" es lo que va a
  // hacer medio mundo. Derivar dos veces lo mismo sólo agrega intentos inútiles.
  assert.deepEqual(
    resolveEncryptionSecrets({ CREDENTIAL_ENCRYPTION_KEY: 'igual', JWT_SECRET: 'igual' }),
    ['igual'],
  );
});

test('un valor en blanco no cuenta como clave configurada', () => {
  // Una variable declarada y vacía en el App Spec es un accidente común, y
  // tomarla como clave dejaría los blobs cifrados con el string vacío.
  assert.deepEqual(
    resolveEncryptionSecrets({ CREDENTIAL_ENCRYPTION_KEY: '   ', JWT_SECRET: 'sesiones' }),
    ['sesiones'],
  );
});

test('deriveWriteKey usa la primera de la cadena, no la última', () => {
  withEnv({ CREDENTIAL_ENCRYPTION_KEY: 'dedicada', JWT_SECRET: 'sesiones' }, () => {
    const write = deriveWriteKey(SALT_A);
    const chain = deriveKeys(SALT_A);
    assert.equal(chain.length, 2);
    assert.ok(write.equals(chain[0]!));
    assert.ok(!write.equals(chain[1]!));
  });
});

// ─── Round-trip y fallback ───────────────────────────────────────────────────

/** Mini AES-256-GCM equivalente al de los dos dominios, para probar el contrato. */
async function cryptoHelpers() {
  const { createCipheriv, createDecipheriv, randomBytes } = await import('crypto');
  const seal = (key: Buffer, plain: string) => {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return { iv, tag: cipher.getAuthTag(), ct };
  };
  const open = (key: Buffer, blob: { iv: Buffer; tag: Buffer; ct: Buffer }) => {
    const decipher = createDecipheriv('aes-256-gcm', key, blob.iv);
    decipher.setAuthTag(blob.tag);
    return Buffer.concat([decipher.update(blob.ct), decipher.final()]).toString('utf8');
  };
  return { seal, open };
}

test('round-trip con la clave dedicada', async () => {
  const { seal, open } = await cryptoHelpers();
  await new Promise<void>((resolve) => {
    withEnv({ CREDENTIAL_ENCRYPTION_KEY: 'dedicada' }, () => {
      const blob = seal(deriveWriteKey(SALT_A), 'token-de-andreani');
      assert.equal(decryptWithAnyKey(SALT_A, (key) => open(key, blob)), 'token-de-andreani');
      resolve();
    });
  });
});

test('un blob cifrado con JWT_SECRET se sigue leyendo tras adoptar la clave dedicada', async () => {
  // ESTE es el test que justifica todo el diseño. Es el deploy real: el
  // operador ya tenía `CREDENTIAL_ENCRYPTION_KEY` en el `.env` (muerta) y sus
  // credenciales cifradas con `JWT_SECRET`. Al empezar a leerse la variable, si
  // no hubiera cadena de fallback, TODAS quedarían indescifrables de golpe.
  const { seal, open } = await cryptoHelpers();
  let legacy!: { iv: Buffer; tag: Buffer; ct: Buffer };

  withEnv({ JWT_SECRET: 'sesiones' }, () => {
    legacy = seal(deriveWriteKey(SALT_A), 'api-key-vieja');
  });

  withEnv({ CREDENTIAL_ENCRYPTION_KEY: 'dedicada', JWT_SECRET: 'sesiones' }, () => {
    assert.equal(decryptWithAnyKey(SALT_A, (k) => open(k, legacy)), 'api-key-vieja');
    // Y lo nuevo YA se escribe con la dedicada: la migración avanza sola a
    // medida que se reescriben los blobs.
    const fresh = seal(deriveWriteKey(SALT_A), 'api-key-nueva');
    withEnv({ JWT_SECRET: undefined }, () => {
      assert.equal(decryptWithAnyKey(SALT_A, (k) => open(k, fresh)), 'api-key-nueva');
    });
  });
});

test('un blob cifrado con APP_SETTINGS_ENC_KEY se sigue leyendo', async () => {
  const { seal, open } = await cryptoHelpers();
  let legacy!: { iv: Buffer; tag: Buffer; ct: Buffer };

  withEnv({ APP_SETTINGS_ENC_KEY: 'legacy-app' }, () => {
    legacy = seal(deriveWriteKey(SALT_B), 'secreto-de-settings');
  });
  withEnv({ CREDENTIAL_ENCRYPTION_KEY: 'dedicada', APP_SETTINGS_ENC_KEY: 'legacy-app' }, () => {
    assert.equal(decryptWithAnyKey(SALT_B, (k) => open(k, legacy)), 'secreto-de-settings');
  });
});

test('retirar del entorno la clave con la que se cifró SÍ rompe el blob', async () => {
  // La cadena de fallback no es magia: es una lista de claves. Si sacás una que
  // todavía tiene blobs, esos blobs se pierden. Es el único paso destructivo de
  // la migración y tiene que fallar RUIDOSO, no devolver basura.
  const { seal, open } = await cryptoHelpers();
  let legacy!: { iv: Buffer; tag: Buffer; ct: Buffer };

  withEnv({ JWT_SECRET: 'sesiones' }, () => {
    legacy = seal(deriveWriteKey(SALT_A), 'api-key-vieja');
  });
  withEnv({ CREDENTIAL_ENCRYPTION_KEY: 'dedicada', JWT_SECRET: undefined }, () => {
    assert.throws(() => decryptWithAnyKey(SALT_A, (k) => open(k, legacy)));
  });
});

// ─── Compartimentos ──────────────────────────────────────────────────────────

test('los salts siguen separando los dominios aunque la clave sea la misma', async () => {
  // Unificar la KEK no puede unificar los compartimentos: un blob de
  // multitienda no se tiene que poder abrir con la derivación de app-settings.
  const { seal, open } = await cryptoHelpers();
  await new Promise<void>((resolve) => {
    withEnv({ CREDENTIAL_ENCRYPTION_KEY: 'dedicada' }, () => {
      assert.ok(!deriveWriteKey(SALT_A).equals(deriveWriteKey(SALT_B)), 'salts distintos, claves distintas');
      const blob = seal(deriveWriteKey(SALT_A), 'credencial-de-tienda');
      assert.throws(() => decryptWithAnyKey(SALT_B, (k) => open(k, blob)));
      resolve();
    });
  });
});

test('la clave se re-deriva cuando el secreto rota', () => {
  // El cache es por salt: si no comparara el valor del secreto, rotar la clave
  // seguiría cifrando con la vieja y el operador creería que rotó.
  let before!: Buffer;
  withEnv({ CREDENTIAL_ENCRYPTION_KEY: 'uno' }, () => {
    before = deriveWriteKey(SALT_A);
  });
  withEnv({ CREDENTIAL_ENCRYPTION_KEY: 'dos' }, () => {
    assert.ok(!deriveWriteKey(SALT_A).equals(before));
  });
  withEnv({ CREDENTIAL_ENCRYPTION_KEY: 'uno' }, () => {
    assert.ok(deriveWriteKey(SALT_A).equals(before), 'volver al secreto anterior da la misma clave');
  });
});
