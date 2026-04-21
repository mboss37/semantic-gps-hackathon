import { randomBytes } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { decrypt, encrypt } from '@/lib/crypto/encrypt';

describe('crypto/encrypt', () => {
  beforeAll(() => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = randomBytes(32).toString('base64');
  });

  it('round-trips arbitrary utf-8 payloads', () => {
    const samples = [
      'sb_secret_abc.def-GHI',
      '{"bearer":"eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig"}',
      'ascii',
      'юникод ♥ 漢字',
      '',
    ];
    for (const s of samples) {
      expect(decrypt(encrypt(s))).toBe(s);
    }
  });

  it('produces fresh IVs (distinct ciphertexts for same plaintext)', () => {
    const a = encrypt('same-plaintext');
    const b = encrypt('same-plaintext');
    expect(a).not.toBe(b);
  });

  it('rejects tampered ciphertext with an authentication error', () => {
    const blob = encrypt('sensitive');
    const tampered = Buffer.from(blob, 'base64');
    tampered[tampered.length - 1] ^= 0x01;
    expect(() => decrypt(tampered.toString('base64'))).toThrow();
  });

  it('rejects wrong-length keys', () => {
    const prev = process.env.CREDENTIALS_ENCRYPTION_KEY;
    try {
      process.env.CREDENTIALS_ENCRYPTION_KEY = Buffer.from('too-short').toString('base64');
      expect(() => encrypt('x')).toThrow(/32 bytes/);
    } finally {
      process.env.CREDENTIALS_ENCRYPTION_KEY = prev;
    }
  });
});
