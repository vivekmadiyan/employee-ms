import crypto from 'node:crypto';
import { config } from './config.js';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const ENCRYPTION_KEY = crypto.createHmac('sha256', config.MFA_ENCRYPTION_KEY || config.JWT_SECRET)
  .update('EmployeeMS MFA secret encryption')
  .digest();

export function generateTotpSecret() {
  const bytes = crypto.randomBytes(20);
  let bits = '';
  for (const byte of bytes) bits += byte.toString(2).padStart(8, '0');
  let result = '';
  for (let index = 0; index < bits.length; index += 5) {
    result += BASE32_ALPHABET[parseInt(bits.slice(index, index + 5).padEnd(5, '0'), 2)];
  }
  return result;
}

function decodeBase32(value) {
  const normalized = value.toUpperCase().replace(/=+$/g, '').replace(/\s/g, '');
  let bits = '';
  for (const character of normalized) {
    const digit = BASE32_ALPHABET.indexOf(character);
    if (digit < 0) throw new Error('Invalid base32 secret');
    bits += digit.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

export function createTotpCode(secret, timestamp = Date.now()) {
  const counter = Math.floor(timestamp / 30_000);
  const counterBytes = Buffer.alloc(8);
  counterBytes.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac('sha1', decodeBase32(secret)).update(counterBytes).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

export function verifyTotpCode(secret, value, timestamp = Date.now()) {
  if (!/^\d{6}$/.test(value || '')) return false;
  const supplied = Buffer.from(value);
  for (const offset of [-30_000, 0, 30_000]) {
    const expected = Buffer.from(createTotpCode(secret, timestamp + offset));
    if (crypto.timingSafeEqual(supplied, expected)) return true;
  }
  return false;
}

export function encryptSecret(secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return `v1:${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${ciphertext.toString('base64url')}`;
}

export function decryptSecret(encrypted) {
  const [version, ivValue, tagValue, ciphertextValue] = encrypted.split(':');
  if (version !== 'v1' || !ivValue || !tagValue || !ciphertextValue) {
    throw new Error('Stored encrypted secret has an unsupported format');
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, Buffer.from(ivValue, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, 'base64url')),
    decipher.final()
  ]).toString('utf8');
}

export const encryptTotpSecret = encryptSecret;
export const decryptTotpSecret = decryptSecret;

export function createRecoveryCodes() {
  return Array.from({ length: 10 }, () => {
    const value = crypto.randomBytes(5).toString('hex').toUpperCase();
    return `${value.slice(0, 5)}-${value.slice(5)}`;
  });
}

export function hashRecoveryCode(value) {
  return crypto.createHash('sha256').update(value.replace(/-/g, '').toUpperCase()).digest('hex');
}

export function findRecoveryCodeHash(value, hashes) {
  if (!/^[\da-f]{5}-?[\da-f]{5}$/i.test(value || '')) return null;
  const candidate = Buffer.from(hashRecoveryCode(value), 'hex');
  for (const storedHash of hashes || []) {
    const stored = Buffer.from(storedHash, 'hex');
    if (stored.length === candidate.length && crypto.timingSafeEqual(stored, candidate)) return storedHash;
  }
  return null;
}
