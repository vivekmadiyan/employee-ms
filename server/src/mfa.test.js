import { describe, expect, it } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgres://localhost:5432/employee_ms_test';
process.env.JWT_SECRET = 'test-only-jwt-secret-that-is-at-least-32-characters';

const {
  createRecoveryCodes,
  createTotpCode,
  decryptTotpSecret,
  encryptTotpSecret,
  findRecoveryCodeHash,
  generateTotpSecret,
  hashRecoveryCode,
  verifyTotpCode
} = await import('./mfa.js');

describe('MFA helpers', () => {
  it('generates standards-compatible TOTP codes', () => {
    const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
    expect(createTotpCode(secret, 59_000)).toBe('287082');
    expect(verifyTotpCode(secret, '287082', 59_000)).toBe(true);
    expect(verifyTotpCode(secret, '287082', 120_000)).toBe(false);
  });

  it('generates a valid base32 secret and encrypts it at rest', () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    const encrypted = encryptTotpSecret(secret);
    expect(encrypted).not.toContain(secret);
    expect(decryptTotpSecret(encrypted)).toBe(secret);
    expect(() => decryptTotpSecret(`${encrypted.slice(0, -2)}aa`)).toThrow();
  });

  it('creates recovery codes that can be hashed and found once', () => {
    const [code] = createRecoveryCodes();
    const hash = hashRecoveryCode(code);
    expect(findRecoveryCodeHash(code.toLowerCase(), [hash])).toBe(hash);
    expect(findRecoveryCodeHash('12345-12345', [hash])).toBeNull();
  });
});
