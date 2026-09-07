import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildResetLink, resolveStorefrontBase } from './reset-link';

/**
 * `web_url` lo elige el BROWSER que pide el reseteo, no nosotros: sale del header
 * `Origin`. Este archivo protege el allowlist, que es lo único que separa "el link
 * apunta a la tienda correcta" de "le mandamos a la víctima un link de phishing
 * firmado por la tienda, con el token adentro".
 */

function withEnv<T>(env: Record<string, string | undefined>, fn: () => T): T {
  const previous = { ...process.env };
  Object.assign(process.env, env);
  try {
    return fn();
  } finally {
    process.env = previous;
  }
}

const ENV = {
  STOREFRONT_URL: 'https://tienda.com',
  STORE_CORS: 'https://tienda.com,https://otra-tienda.com',
};

test('un origen del allowlist gana sobre la env var', () => {
  const base = withEnv(ENV, () => resolveStorefrontBase('https://otra-tienda.com'));
  assert.equal(base, 'https://otra-tienda.com');
});

test('un origen AJENO se descarta y cae a la env var', () => {
  const rejected: string[] = [];
  const base = withEnv(ENV, () =>
    resolveStorefrontBase('https://phishing.example', (m) => rejected.push(m)),
  );
  assert.equal(base, 'https://tienda.com');
  assert.equal(rejected.length, 1, 'el descarte tiene que quedar en el log');
});

test('un dominio que EMPIEZA con uno permitido no pasa', () => {
  // El caso que un `startsWith` dejaría entrar: `https://tienda.com.evil.io`.
  const base = withEnv(ENV, () => resolveStorefrontBase('https://tienda.com.evil.io'));
  assert.equal(base, 'https://tienda.com');
});

test('un subdominio de uno permitido tampoco pasa por sí solo', () => {
  const base = withEnv(ENV, () => resolveStorefrontBase('https://evil.tienda.com'));
  assert.equal(base, 'https://tienda.com');
});

test('el path del origen se descarta: sólo cuenta el origin', () => {
  const base = withEnv(ENV, () => resolveStorefrontBase('https://tienda.com/algo/'));
  assert.equal(base, 'https://tienda.com');
});

test('un esquema que no es http(s) se descarta', () => {
  for (const value of ['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd']) {
    const base = withEnv(ENV, () => resolveStorefrontBase(value));
    assert.equal(base, 'https://tienda.com', `pasó ${value}`);
  }
});

test('sin `web_url` se usa la env var, y sin ruido en el log', () => {
  const rejected: string[] = [];
  for (const value of [undefined, null, '', 42, {}]) {
    const base = withEnv(ENV, () => resolveStorefrontBase(value, (m) => rejected.push(m)));
    assert.equal(base, 'https://tienda.com');
  }
  assert.equal(rejected.length, 0, 'no mandar origen no es un descarte que avisar');
});

test('el link lleva token y email escapados', () => {
  const link = buildResetLink('https://tienda.com', 'a+b/c=', 'juan perez@mail.com');
  assert.equal(
    link,
    'https://tienda.com/reset-password?token=a%2Bb%2Fc%3D&email=juan%20perez%40mail.com',
  );
});
