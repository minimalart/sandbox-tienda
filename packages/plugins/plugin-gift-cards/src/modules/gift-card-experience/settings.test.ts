import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign, verify } from 'node:crypto';
import { getGiftCardExperienceSettings, normalizeSendgridPublicKey } from './settings.ts';

/**
 * El snapshot de `app-settings` arranca vacío en los tests, así que estos casos
 * ejercitan el tramo **env > default** del resolver — que es exactamente el
 * comportamiento que la migración tenía que preservar.
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

test('el interruptor de despliegue sigue siendo opt-in explícito', () => {
  withEnv({ GIFT_CARD_EXPERIENCE_ENABLED: undefined }, () => {
    assert.equal(getGiftCardExperienceSettings().experienceEnabled, false);
  });
  withEnv({ GIFT_CARD_EXPERIENCE_ENABLED: 'false' }, () => {
    assert.equal(getGiftCardExperienceSettings().experienceEnabled, false);
  });
  withEnv({ GIFT_CARD_EXPERIENCE_ENABLED: 'true' }, () => {
    assert.equal(getGiftCardExperienceSettings().experienceEnabled, true);
  });
});

test('sin clave de SendGrid la firma no se puede verificar', () => {
  withEnv({ SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY: undefined }, () => {
    assert.equal(getGiftCardExperienceSettings().sendgridEventPublicKey, '');
  });
});

/**
 * El bug: SendGrid entrega la clave del Signed Event Webhook en base64 de una
 * sola línea, y `crypto.verify()` sólo acepta PEM. Con el valor tal cual lo da
 * SendGrid, `verify()` tiraba, el `try/catch` de la ruta lo tragaba y el webhook
 * respondía 401 para siempre.
 */
test('la clave de SendGrid se normaliza a un PEM que crypto.verify() acepta', () => {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const base64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  const data = Buffer.from('1700000000{"event":"delivered"}');
  const signature = sign('sha256', data, privateKey);

  // Lo que SendGrid te da: base64 crudo. Antes tiraba DECODER::unsupported.
  assert.throws(() => verify('sha256', data, base64, signature));
  assert.ok(verify('sha256', data, normalizeSendgridPublicKey(base64), signature));

  // Un panel de deploy que guarda el PEM con `\n` de dos caracteres.
  assert.ok(verify('sha256', data, normalizeSendgridPublicKey(pem.replace(/\n/g, '\\n')), signature));

  // Y el caso que ya andaba tiene que seguir andando: normalizar es aditivo.
  assert.ok(verify('sha256', data, normalizeSendgridPublicKey(pem), signature));
});

test('una clave vacía o en blanco no se convierte en un PEM basura', () => {
  assert.equal(normalizeSendgridPublicKey(''), '');
  assert.equal(normalizeSendgridPublicKey('   \n  '), '');
});
