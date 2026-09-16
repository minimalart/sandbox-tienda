import assert from 'node:assert/strict'
import test from 'node:test'
import { buildGoogleMapsEmbedUrl } from './contact-map'

test('builds an embeddable map URL without exposing an API key', () => {
  const url = buildGoogleMapsEmbedUrl(
    '  Gallo 149, Ciudad Autónoma de Buenos Aires  ',
  )

  assert.equal(
    url,
    'https://www.google.com/maps?q=Gallo%20149%2C%20Ciudad%20Aut%C3%B3noma%20de%20Buenos%20Aires&output=embed',
  )
  assert.equal(url.includes('key='), false)
})
