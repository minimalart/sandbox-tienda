import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSitesHubHost, normalizeSiteSuffix, publicSiteUrl, sitesHubOrigin } from './site-hosts';
import { resolveSiteFromParts } from './resolve-site';

test('principal, school subdomain and legacy path use their own origins', () => {
  const options = { baseUrl: 'https://tiendas.educabot.com', hostSuffix: '.educabot.shop' };
  assert.equal(publicSiteUrl({ slug: 'principal', is_main: true }, options), options.baseUrl);
  assert.equal(publicSiteUrl({ slug: 'sanagustin' }, options), 'https://sanagustin.educabot.shop');
  assert.equal(publicSiteUrl({ slug: 'sanagustin', canonical_form: 'path' }, options), 'https://educabot.shop/tienda/sanagustin');
});
test('unconfigured installation and unrelated profile remain independent', () => {
  assert.equal(publicSiteUrl({ slug: 'norte' }, { baseUrl: 'https://example.com', hostSuffix: '' }), 'https://example.com/tienda/norte');
  assert.equal(publicSiteUrl({ slug: 'norte' }, { baseUrl: 'https://retail.example', hostSuffix: 'stores.example' }), 'https://norte.stores.example');
  assert.equal(sitesHubOrigin('', 'https://example.com'), null);
});
test('wildcard suffix validation and loopback ports', () => {
  for (const invalid of ['https://example.com', '../example.com', '*.example.com', 'evil.com:443', 'example.com/path', 'x..example.com']) assert.equal(normalizeSiteSuffix(invalid), '');
  assert.equal(normalizeSiteSuffix(' .EXAMPLE.COM. '), '.example.com');
  assert.equal(sitesHubOrigin('.localhost', 'http://localhost:3000'), 'http://localhost:3000');
  assert.equal(publicSiteUrl({ slug: 'north' }, { baseUrl: 'http://localhost:3000', hostSuffix: '.localhost' }), 'http://north.localhost:3000');
  assert.equal(isSitesHubHost('www.educabot.shop:443', '.educabot.shop'), true);
  assert.equal(isSitesHubHost('fakeeducabot.shop', '.educabot.shop'), false);
});
test('hub root rewrites to directory; primary and school retain their homes', () => {
  const previous = process.env.NEXT_PUBLIC_SITE_HOST_SUFFIX;
  process.env.NEXT_PUBLIC_SITE_HOST_SUFFIX = '.educabot.shop';
  try {
    assert.equal(resolveSiteFromParts({ host: 'educabot.shop', pathname: '/' }).rewritePath, '/tiendas');
    assert.equal(resolveSiteFromParts({ host: 'tiendas.educabot.com', pathname: '/' }).rewritePath, '/');
    assert.equal(resolveSiteFromParts({ host: 'north.educabot.shop', pathname: '/' }).slug, 'north');
    assert.equal(resolveSiteFromParts({ host: 'educabot.shop', pathname: '/tienda/north' }).slug, 'north');
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SITE_HOST_SUFFIX;
    else process.env.NEXT_PUBLIC_SITE_HOST_SUFFIX = previous;
  }
});
