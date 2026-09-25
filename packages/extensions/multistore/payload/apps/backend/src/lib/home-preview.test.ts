import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPreview, readPreview, previewOrigin, PreviewInput, PREVIEW_TTL } from './home-preview';
import { POST } from '../api/admin/sites/[id]/home-preview/route';

function fixture() {
  const values = new Map<string, any>();
  const cache = { async set(key: string, value: any, ttl: number) { assert.equal(ttl, PREVIEW_TTL); values.set(key, value); }, async get<T>(key: string) { return values.get(key) as T; } };
  const document = { content: [{ type: 'Hero', props: { id: 'hero-1', title: 'Unsaved title' } }], root: { props: {} } };
  const session = { home_id: 'home', site_id: 'main', site_slug: '', country_code: 'ar', parent_origin: 'http://localhost:9000', language: 'en' as const, mode: 'page' as const, puck_data: document as any };
  return { values, cache, document, session };
}

test('preview snapshots are immutable, expire and require an unguessable token', async () => {
  const { values, cache, session } = fixture();
  const first = await createPreview(cache, session);
  const second = await createPreview(cache, { ...session, puck_data: { ...session.puck_data, content: [] } });
  assert.match(first.token, /^[a-f0-9]{64}$/);
  assert.notEqual(first.token, second.token);
  assert.equal((await readPreview(cache, first.token))?.puck_data.content.length, 1);
  assert.equal((await readPreview(cache, second.token))?.puck_data.content.length, 0);
  assert.equal(await readPreview(cache, '../home'), null);
  assert.equal(await readPreview(cache, 'a'.repeat(64)), null);
  for (const value of values.values()) value.expires_at = Date.now() - 1;
  assert.equal(await readPreview(cache, first.token), null);
});

test('parent origins are exact origins, never wildcards, javascript or lookalike domains', () => {
  const allowed = ['https://admin.example.com'];
  assert.equal(previewOrigin('https://admin.example.com/editor', allowed), allowed[0]);
  for (const origin of ['https://admin.example.com.attacker.test', 'http://admin.example.com', 'https://user:pass@admin.example.com', 'javascript:alert(1)']) {
    assert.equal(previewOrigin(origin, allowed), null);
  }
});

test('preview rejects excessive documents before creating a snapshot', () => {
  const { document } = fixture();
  assert.equal(PreviewInput.safeParse({ site_id: 'main', country_code: 'ar', parent_origin: 'http://localhost:9000', puck_data: { content: Array(101).fill(document.content[0]) } }).success, false);
});

test('actual preview route uses submitted content, rejects another site and does not save the home', async () => {
  const { cache, document } = fixture();
  const scope = { resolve(key: string) {
    if (key === 'demo_store') return { retrieveDemoStore: async (id: string) => { assert.equal(id, 'home'); return { id: 'main', slug: 'campaign', template_code: 'campaign', region_id: 'region' }; } };
    if (key === 'cache') return cache;
    if (key === 'region') return { listRegions: async (filter: any) => { assert.deepEqual(filter, { id: 'region' }); return [{ countries: [{ iso_2: 'ar' }] }]; } };
    throw new Error(`Unexpected service ${key}`);
  } };
  const req = { scope, headers: {}, params: { id: 'home' }, protocol: 'http', get: () => 'localhost:9000', body: { site_id: 'main', country_code: 'ar', parent_origin: 'http://localhost:9000', puck_data: document } };
  const res = { code: 200, body: null as any, setHeader() {}, status(value: number) { this.code = value; return this; }, json(value: any) { this.body = value; return this; } };
  await POST(req as any, res as any);
  assert.equal(res.code, 201);
  const snapshot = await readPreview(cache, res.body.token);
  const hero = snapshot?.puck_data.content[0];
  assert.equal(hero?.type, 'Hero');
  assert.equal(hero?.type === 'Hero' && hero.props.title, 'Unsaved title');
  req.body.site_id = 'other-store';
  await POST(req as any, res as any);
  assert.equal(res.code, 403);
  req.body.site_id = 'main'; req.body.country_code = 'xx';
  await POST(req as any, res as any);
  assert.equal(res.code, 400);
  req.body.country_code = 'ar'; req.body.puck_data.content[0].type = 'NotAHomeBlock';
  await POST(req as any, res as any);
  assert.equal(res.code, 400);
});
