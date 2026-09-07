import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'node:crypto';

const TOKEN_VERSION = 'v1';
const KEY_SALT = 'mercatto:gift-card-experience:v1';

function getSecret(): string {
  const secret = process.env.GIFT_CARD_TOKEN_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('GIFT_CARD_TOKEN_SECRET must contain at least 32 characters.');
  }
  return secret;
}

function getKey(): Buffer {
  return scryptSync(getSecret(), KEY_SALT, 32);
}

export function hashGiftCardToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function encryptGiftCardToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [TOKEN_VERSION, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join(':');
}

export function decryptGiftCardToken(value: string): string {
  const [version, ivEncoded, tagEncoded, ciphertextEncoded] = value.split(':');
  if (version !== TOKEN_VERSION || !ivEncoded || !tagEncoded || !ciphertextEncoded) {
    throw new Error('Invalid gift card token envelope.');
  }
  const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivEncoded, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextEncoded, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function createGiftCardToken(): { token: string; hash: string; encrypted: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashGiftCardToken(token), encrypted: encryptGiftCardToken(token) };
}
