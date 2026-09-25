import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { selectLinkableCustomer } from './_select-customer.ts';

describe('selectLinkableCustomer', () => {
  it('returns undefined when there are no candidates', () => {
    assert.equal(selectLinkableCustomer([]), undefined);
    assert.equal(selectLinkableCustomer(null), undefined);
    assert.equal(selectLinkableCustomer(undefined), undefined);
  });

  it('returns the only candidate when there is a single guest customer', () => {
    const guest = { id: 'cus_guest', email: 'a@b.com', has_account: false };
    assert.equal(selectLinkableCustomer([guest]), guest);
  });

  it('returns the only candidate when there is a single real account', () => {
    const account = { id: 'cus_account', email: 'a@b.com', has_account: true };
    assert.equal(selectLinkableCustomer([account]), account);
  });

  it('prefers the real account over a guest when both share the email', () => {
    const guest = { id: 'cus_guest', email: 'a@b.com', has_account: false };
    const account = { id: 'cus_account', email: 'a@b.com', has_account: true };
    // Orden invitado-primero: el bug original tomaba el primero (`take: 1`)
    // sin mirar has_account, así que este orden es el que reproduce el bug.
    assert.equal(selectLinkableCustomer([guest, account]), account);
  });

  it('prefers the real account regardless of list order', () => {
    const guest = { id: 'cus_guest', email: 'a@b.com', has_account: false };
    const account = { id: 'cus_account', email: 'a@b.com', has_account: true };
    assert.equal(selectLinkableCustomer([account, guest]), account);
  });

  it('falls back to the guest when no real account exists', () => {
    const guest = { id: 'cus_guest', email: 'a@b.com', has_account: false };
    assert.equal(selectLinkableCustomer([guest]), guest);
  });

  it('treats has_account undefined/null as not-an-account (falls back to first)', () => {
    const legacy = { id: 'cus_legacy', email: 'a@b.com' };
    assert.equal(selectLinkableCustomer([legacy]), legacy);
  });
});
