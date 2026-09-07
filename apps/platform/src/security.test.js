const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { hashSecret, safeEqual, verifyWebhook } = require('./security');

test('project secrets are compared as hashes', () => {
  assert.equal(safeEqual(hashSecret('secret'), hashSecret('secret')), true);
  assert.equal(safeEqual(hashSecret('secret'), hashSecret('different')), false);
});

test('GitHub webhook signatures are verified against the raw body', () => {
  process.env.GITHUB_WEBHOOK_SECRET = 'webhook-secret';
  const body = Buffer.from('{"ok":true}');
  const signature = `sha256=${crypto.createHmac('sha256', 'webhook-secret').update(body).digest('hex')}`;
  assert.equal(verifyWebhook(body, signature), true);
  assert.equal(verifyWebhook(body, `${signature}0`), false);
});
