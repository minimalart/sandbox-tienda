import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GOOGLE_AUTH_ENV_VARS,
  googleAuthEnvWarning,
  resolveGoogleAuthEnv,
} from './google-auth-env.ts';

/**
 * El caso que motivó esto es el segundo test: `GOOGLE_CLIENT_ID` presente y
 * `GOOGLE_CALLBACK_URL` vacío tumbó el backend de producción entero, porque el
 * gate viejo miraba SÓLO el clientId. Todos los sets se pasan explícitos: un test
 * de configuración que lea `process.env` valdría lo mismo que el entorno de quien
 * lo corre, o sea nada.
 */

const complete = {
  GOOGLE_CLIENT_ID: 'client-id',
  GOOGLE_CLIENT_SECRET: 'client-secret',
  GOOGLE_CALLBACK_URL: 'https://tienda.example.com/google-callback',
};

test('con las tres variables el provider se registra', () => {
  const state = resolveGoogleAuthEnv(complete);

  assert.equal(state.enabled, true);
  assert.deepEqual(state.missing, []);
  assert.equal(state.partial, false);
  assert.equal(googleAuthEnvWarning(state), undefined);
});

test('clientId sin callbackUrl NO registra el provider y avisa', () => {
  const state = resolveGoogleAuthEnv({ ...complete, GOOGLE_CALLBACK_URL: '' });

  assert.equal(state.enabled, false);
  assert.deepEqual(state.missing, ['GOOGLE_CALLBACK_URL']);
  assert.equal(state.partial, true);
  assert.match(String(googleAuthEnvWarning(state)), /GOOGLE_CALLBACK_URL/);
});

test('clientId sin secret tampoco registra', () => {
  const state = resolveGoogleAuthEnv({ ...complete, GOOGLE_CLIENT_SECRET: undefined });

  assert.equal(state.enabled, false);
  assert.deepEqual(state.missing, ['GOOGLE_CLIENT_SECRET']);
  assert.equal(state.partial, true);
});

test('una variable en blanco cuenta como ausente', () => {
  const state = resolveGoogleAuthEnv({ ...complete, GOOGLE_CLIENT_ID: '   ' });

  assert.equal(state.enabled, false);
  assert.deepEqual(state.missing, ['GOOGLE_CLIENT_ID']);
});

test('sin ninguna de las tres no hay aviso: la tienda no usa Google login', () => {
  const state = resolveGoogleAuthEnv({});

  assert.equal(state.enabled, false);
  assert.deepEqual(state.missing, [...GOOGLE_AUTH_ENV_VARS]);
  assert.equal(state.partial, false);
  assert.equal(googleAuthEnvWarning(state), undefined);
});

test('el aviso nombra TODAS las que faltan, no la primera', () => {
  const state = resolveGoogleAuthEnv({ GOOGLE_CLIENT_ID: 'client-id' });
  const warning = String(googleAuthEnvWarning(state));

  assert.deepEqual(state.missing, ['GOOGLE_CLIENT_SECRET', 'GOOGLE_CALLBACK_URL']);
  assert.match(warning, /GOOGLE_CLIENT_SECRET/);
  assert.match(warning, /GOOGLE_CALLBACK_URL/);
});
