import { attachSiteHint } from '../../../lib/multistore/request.ts';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Modules } from '@medusajs/framework/utils';
import { authorizeCheckoutAdmin, checkoutErrorResponse } from './http.ts';
import { CheckoutError, PersonSchema } from './assignments.ts';
const request = (metadata: any = {}, headers: any = {}) => {
  const req: any = {
    headers,
    auth_context: { actor_id: 'operator' },
    scope: {
      resolve: (key: string) =>
        key === Modules.USER
          ? { retrieveUser: async () => ({ metadata }) }
          : {
              listDemoStores: async (filter: any) =>
                filter.id === 'other' ? [{ id: 'other', slug: 'other', name: 'Other' }] : [],
            },
    },
  };
  attachSiteHint(req, {} as any, (() => {}) as any);
  return req;
};
describe('administrative privacy boundaries', () => {
  it('requires authentication', async () => {
    const req: any = request();
    delete req.auth_context;
    await assert.rejects(authorizeCheckoutAdmin(req, 'site'));
  });
  it('allows masked access for an authorized operator', async () =>
    assert.equal(
      await authorizeCheckoutAdmin(request({ checkout_site_ids: ['site'] }), 'site'),
      'operator'
    ));
  it('rejects an operator assigned to a different site', async () => {
    await assert.rejects(authorizeCheckoutAdmin(request({ checkout_site_ids: ['other'] }), 'site'));
  });
  it('an empty site grant does not mean every site', async () => {
    await assert.rejects(authorizeCheckoutAdmin(request({ checkout_site_ids: [] }), 'site'));
  });
  it('rejects selecting a foreign site even when the operator has both grants', async () => {
    await assert.rejects(
      authorizeCheckoutAdmin(
        request({ checkout_site_ids: ['site', 'other'] }, { 'x-site-id': 'other' }),
        'site'
      )
    );
  });
  it('masked access does not grant full documents', async () => {
    await assert.rejects(
      authorizeCheckoutAdmin(request({ checkout_site_ids: ['site'] }), 'site', true)
    );
  });
  it('explicit document grant permits full documents for the exact site', async () =>
    assert.equal(
      await authorizeCheckoutAdmin(
        request({ checkout_site_ids: ['site'], checkout_document_site_ids: ['site'] }),
        'site',
        true
      ),
      'operator'
    ));
  it('document grants do not bypass site access', async () => {
    await assert.rejects(
      authorizeCheckoutAdmin(
        request({ checkout_site_ids: ['other'], checkout_document_site_ids: ['site'] }),
        'site',
        true
      )
    );
  });
  it('malformed document grant strings cannot authorize by substring', async () => {
    await assert.rejects(
      authorizeCheckoutAdmin(
        request({ checkout_document_site_ids: 'different-site' }),
        'site',
        true
      )
    );
  });
});
describe('structured errors do not disclose private values', () => {
  const response = () => ({
    statusCode: 0,
    body: null as any,
    headers: {} as Record<string, string>,
    setHeader(key: string, value: string) {
      this.headers[key] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: any) {
      this.body = body;
      return this;
    },
  });
  it('concurrency returns a recoverable 409 with block and unit IDs', () => {
    const res = response();
    checkoutErrorResponse(
      res,
      new CheckoutError('CHECKOUT_REVISION_CONFLICT', 'Revisá la compra', 'recipients', ['unit'])
    );
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.block, 'recipients');
    assert.deepEqual(res.body.units, ['unit']);
    assert.match(res.headers['Cache-Control'], /no-store/);
  });
  it('database query bindings never reach the caller', () => {
    const res = response();
    checkoutErrorResponse(res, new Error('SQL bindings: document=30111222'));
    assert.equal(res.statusCode, 503);
    assert.ok(!JSON.stringify(res).includes('30111222'));
  });
  it('validation reports field paths without the submitted identity', () => {
    const parsed = PersonSchema.safeParse({
      id: 'invalid',
      document: 'private-document',
      first_name: 'Private',
      last_name: 'Name',
    });
    assert.equal(parsed.success, false);
    const res = response();
    if (!parsed.success) checkoutErrorResponse(res, parsed.error);
    assert.equal(res.statusCode, 400);
    assert.ok(res.body.errors.some((e: any) => e.field === 'document'));
    assert.ok(!JSON.stringify(res).includes('private-document'));
  });
});
