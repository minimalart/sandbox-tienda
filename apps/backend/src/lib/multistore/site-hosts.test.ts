import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSitesHubHost, normalizeSiteSuffix, publicSiteUrl, sitesHubOrigin } from './site-hosts';

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
