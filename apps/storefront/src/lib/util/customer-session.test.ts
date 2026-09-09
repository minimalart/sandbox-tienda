import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSiteFromParts } from '../site-config/resolve-site';
import {
  applyCustomerSessionHeaders,
  resolveCustomerSession,
  sessionCookieName,
  sessionForPath,
} from './customer-session';

test('public, wholesale, legacy and country-prefixed paths choose independent sessions', () => {
  for (const path of [
    '/b2b',
    '/b2b/login',
    '/tienda/alpha/b2b',
    '/demo/alpha/b2b',
    '/ar/tienda/alpha/b2b',
  ])
    assert.equal(sessionForPath(path, 'alpha').mode, 'b2b');
  for (const path of ['/', '/account', '/tienda/alpha', '/tienda/b2b/store', '/b2b-products'])
    assert.equal(sessionForPath(path, 'alpha').mode, 'b2c');
});

test('site, mode, main site and a site named main cannot share cookie keys', () => {
  const names = [null, 'main', 'alpha', 'beta'].flatMap((site) =>
    (['b2c', 'b2b'] as const).flatMap((mode) =>
      ['jwt', 'cart', 'present'].map((kind) => sessionCookieName({ site, mode }, kind))
    )
  );
  assert.equal(new Set(names).size, 24);
});

test('navigation cannot inherit a B2B context from a referrer', () => {
  const url = 'https://store.example/tienda/alpha';
  const site = resolveSiteFromParts({ host: 'store.example', pathname: '/tienda/alpha' });
  assert.deepEqual(resolveCustomerSession(url, `${url}/b2b`, 'store.example', site).session, {
    site: 'alpha',
    mode: 'b2c',
  });
});

test('API requests follow their own tab even after another tab changes the site cookie', () => {
  const fallback = resolveSiteFromParts({
    host: 'store.example',
    pathname: '/api/store/customer',
    cookieSlug: 'beta',
  });
  for (const [path, mode, site] of [
    ['/tienda/alpha/b2b', 'b2b', 'alpha'],
    ['/tienda/alpha/account', 'b2c', 'alpha'],
    ['/', 'b2c', null],
  ]) {
    const result = resolveCustomerSession(
      'https://store.example/api/store/customer',
      `https://store.example${path}`,
      'store.example',
      fallback
    );
    assert.deepEqual(result.session, { mode, site });
    assert.equal(result.site.slug, site);
  }
});

test('dedicated B2B API uses B2B even from a public page; external referrers cannot select a site', () => {
  const fallback = resolveSiteFromParts({
    host: 'store.example',
    pathname: '/api/b2b/cart',
    cookieSlug: 'alpha',
  });
  assert.equal(
    resolveCustomerSession(
      'https://store.example/api/b2b/cart',
      'https://store.example/tienda/alpha',
      'store.example',
      fallback
    ).session.mode,
    'b2b'
  );
  assert.deepEqual(
    resolveCustomerSession(
      'https://store.example/api/b2b/cart',
      'https://evil.example/tienda/beta',
      'store.example',
      fallback
    ).session,
    { site: 'alpha', mode: 'b2b' }
  );
});

test('auth API can restore its tab context after OAuth without changing the registered callback URL', () => {
  const fallback = resolveSiteFromParts({
    host: 'store.example',
    pathname: '/api/store/auth',
    cookieSlug: 'beta',
  });
  const result = resolveCustomerSession(
    'https://store.example/api/store/auth',
    'https://store.example/google-callback',
    'store.example',
    fallback,
    '/tienda/alpha/account'
  );
  assert.deepEqual(result.session, { site: 'alpha', mode: 'b2c' });
  const external = resolveCustomerSession(
    'https://store.example/api/store/auth',
    'https://store.example/tienda/beta/b2b',
    'store.example',
    fallback,
    '//evil.example/tienda/alpha'
  );
  assert.deepEqual(external.session, { site: 'beta', mode: 'b2b' });
});

test('legacy and forged headers never authenticate the public store using wholesale credentials', () => {
  const cookies = new Map([
    ['_medusa_jwt', 'legacy'],
    [sessionCookieName({ site: 'alpha', mode: 'b2b' }), 'wholesale'],
  ]);
  const original = new Headers({
    'x-medusa-jwt': 'forged',
    'x-storefront-session': '{"mode":"b2b"}',
  });
  const publicHeaders = applyCustomerSessionHeaders(
    original,
    { site: 'alpha', mode: 'b2c' },
    (key) => cookies.get(key)
  );
  assert.equal(publicHeaders.has('x-medusa-jwt'), false);
  const wholesaleHeaders = applyCustomerSessionHeaders(
    original,
    { site: 'alpha', mode: 'b2b' },
    (key) => cookies.get(key)
  );
  assert.equal(wholesaleHeaders.get('x-medusa-jwt'), 'wholesale');
  assert.equal(
    applyCustomerSessionHeaders(original, { site: 'beta', mode: 'b2b' }, (key) =>
      cookies.get(key)
    ).has('x-medusa-jwt'),
    false
  );
});

test('logout deletes only the selected session; the other mode remains authenticated', () => {
  const publicSession = { site: 'alpha', mode: 'b2c' as const };
  const wholesaleSession = { site: 'alpha', mode: 'b2b' as const };
  const cookies = new Map([
    [sessionCookieName(publicSession), 'retail'],
    [sessionCookieName(wholesaleSession), 'wholesale'],
  ]);
  cookies.delete(sessionCookieName(wholesaleSession));
  assert.equal(
    applyCustomerSessionHeaders(new Headers(), publicSession, (key) => cookies.get(key)).get(
      'x-medusa-jwt'
    ),
    'retail'
  );
  assert.equal(
    applyCustomerSessionHeaders(new Headers(), wholesaleSession, (key) => cookies.get(key)).has(
      'x-medusa-jwt'
    ),
    false
  );
});
