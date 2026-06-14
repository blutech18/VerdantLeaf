/**
 * FreshTrack — Token encryption at rest (AES-256-GCM)
 *
 * Shopify OAuth access tokens are secrets. We never store them in plaintext.
 * Tokens are encrypted with AES-256-GCM before being written to the `stores`
 * table and decrypted only when a Shopify Admin API call is made.
 *
 * Stored format:  enc:v1:<ivHex>:<authTagHex>:<cipherHex>
 *
 * The key is derived (SHA-256) from TOKEN_ENCRYPTION_KEY, falling back to
 * SHOPIFY_API_SECRET so the app keeps working in local dev. Set a dedicated
 * TOKEN_ENCRYPTION_KEY in production (see .env.example).
 */

import crypto from 'crypto';

const ENC_PREFIX = 'enc:v1:';
const ALGORITHM = 'aes-256-gcm';

function getKey() {
  const secret = process.env.TOKEN_ENCRYPTION_KEY || process.env.SHOPIFY_API_SECRET || '';
  if (!secret) {
    throw new Error('TOKEN_ENCRYPTION_KEY (or SHOPIFY_API_SECRET) must be set to encrypt access tokens.');
  }
  // Derive a stable 32-byte key from whatever secret length is provided.
  return crypto.createHash('sha256').update(secret).digest();
}

export function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(ENC_PREFIX);
}

/**
 * Encrypts a plaintext token. Returns the `enc:v1:...` envelope string.
 */
export function encryptToken(plain) {
  if (!plain) return plain;
  if (isEncrypted(plain)) return plain; // already encrypted — idempotent

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${ENC_PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

/**
 * Decrypts an `enc:v1:...` token. Plaintext/legacy values (e.g. demo seed
 * tokens) are returned unchanged so existing data keeps working.
 */
export function decryptToken(stored) {
  if (!isEncrypted(stored)) return stored;

  const [, , ivHex, tagHex, dataHex] = stored.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex');
  const ciphertext = Buffer.from(dataHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
