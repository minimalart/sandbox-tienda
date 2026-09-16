import assert from 'node:assert/strict'
import { test } from 'node:test'
import { forwardMarketplaceNotification, isMarketplaceIngress, redirectMarketplaceCallback } from './bridge'

const origin = 'https://shop.example.test'
const backend = 'https://api.example.test'
const prefix = '/marketplaces/mercadolibre'
const callback = (query = '') => new Request(`${origin}${prefix}/callback${query}`)
const notification = (body = '{"user_id":42,"topic":"items"}') => new Request(`${origin}${prefix}/notifications?site=another-store`, {
  method: 'POST', body,
  headers: { 'Content-Type': 'application/json', Cookie: 'session=private', Authorization: 'Bearer private', 'x-site-id': 'another-store' },
})

test('callback preserves opaque OAuth state and drops caller-selected destinations and stores', () => {
  const result = redirectMarketplaceCallback(callback('?code=a%2Bb&state=opaque%2Fstate&site=another&redirect_uri=https://evil.test'), backend)
  assert.equal(result.status, 302)
  assert.equal(result.headers.get('location'), `${backend}${prefix}/callback?code=a%2Bb&state=opaque%2Fstate`)
  assert.equal(result.headers.get('cache-control'), 'no-store')
  assert.equal(result.headers.get('referrer-policy'), 'no-referrer')
  assert.equal(redirectMarketplaceCallback(callback('?state=a&state=b'), backend).status, 400)
})

test('missing, invalid, insecure or self-referencing configuration never forwards codes', () => {
  for (const invalid of [undefined, '', 'bad', 'http://api.example.test', 'https://user:pass@api.example.test', origin]) {
    const result = redirectMarketplaceCallback(callback('?code=secret'), invalid)
    assert.equal(result.status, 503)
    assert.equal(result.headers.get('location'), null)
  }
  assert.equal(redirectMarketplaceCallback(callback(), 'http://localhost:9000').status, 302)
  assert.equal(redirectMarketplaceCallback(callback(), 'https://other-backend.test/base').headers.get('location'), `https://other-backend.test${prefix}/callback`)
})

test('only the two provider paths bypass storefront navigation', () => {
  for (const path of [`${prefix}/callback`, `${prefix}/notifications`]) assert.ok(isMarketplaceIngress(path))
  for (const path of ['/cart', '/marketplaces', `${prefix}/callback/extra`, `${prefix}/admin`]) assert.equal(isMarketplaceIngress(path), false)
})

test('notification forwards body once to configured backend without browser identity or query', async () => {
  let calls = 0
  const result = await forwardMarketplaceNotification(notification(), backend, (async (url, init) => {
    calls++
    assert.equal(String(url), `${backend}${prefix}/notifications`)
    assert.deepEqual(init?.headers, { 'Content-Type': 'application/json' })
    assert.equal(new TextDecoder().decode(init?.body as Uint8Array), '{"user_id":42,"topic":"items"}')
    assert.equal(init?.redirect, 'manual')
    assert.ok(init?.signal)
    return new Response('{"private":"backend details"}', { status: 200 })
  }) as typeof fetch)
  assert.equal(calls, 1)
  assert.equal(result.status, 200)
  assert.equal(await result.text(), '')
})

test('disabled or absent plugin and temporary failures remain retryable without exposing backend data', async () => {
  for (const status of [404, 409, 429, 500, 503]) {
    const result = await forwardMarketplaceNotification(notification(), backend, (async () => new Response('private', { status })) as typeof fetch)
    assert.equal(result.status, status)
    assert.equal(await result.text(), '')
  }
  const redirect = await forwardMarketplaceNotification(notification(), backend, (async () => new Response(null, { status: 302, headers: { Location: 'https://elsewhere.test' } })) as typeof fetch)
  assert.equal(redirect.status, 502)
  const timeout = await forwardMarketplaceNotification(notification(), backend, (async () => { throw new Error('timeout') }) as typeof fetch)
  assert.equal(timeout.status, 502)
})

test('unsupported and oversized notification bodies are rejected before forwarding', async () => {
  const neverSend = (async () => { assert.fail('must not forward') }) as typeof fetch
  const wrongType = new Request(`${origin}${prefix}/notifications`, { method: 'POST', body: 'plain' })
  assert.equal((await forwardMarketplaceNotification(wrongType, backend, neverSend)).status, 415)
  assert.equal((await forwardMarketplaceNotification(notification('x'.repeat(65 * 1024)), backend, neverSend)).status, 413)
  assert.equal((await forwardMarketplaceNotification(notification(), undefined, neverSend)).status, 503)
})
