const crypto = require('node:crypto');
const hashSecret = (value) => crypto.createHash('sha256').update(value).digest('hex');
const safeEqual = (left, right) => {
  const a = Buffer.from(left || ''); const b = Buffer.from(right || '');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
const verifyWebhook = (body, signature) => {
  const expected = `sha256=${crypto.createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET || '').update(body).digest('hex')}`;
  return safeEqual(expected, signature);
};
module.exports = { hashSecret, safeEqual, verifyWebhook };

