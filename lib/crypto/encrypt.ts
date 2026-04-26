import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// AES-256-GCM for servers.auth_config. CREDENTIALS_ENCRYPTION_KEY is a
// base64-encoded 32-byte key (openssl rand -base64 32). Output layout:
//   base64( iv[12] || ciphertext || authTag[16] )
// Any tamper, IV, ciphertext, or tag, fails decrypt with authentication error.

const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

const getKey = (): Buffer => {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY missing');
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== KEY_LENGTH) {
    throw new Error(`CREDENTIALS_ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes, got ${key.length}`);
  }
  return key;
};

export const encrypt = (plaintext: string): string => {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, ct, tag]).toString('base64');
};

export const decrypt = (payload: string): string => {
  const key = getKey();
  const buf = Buffer.from(payload, 'base64');
  if (buf.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error('ciphertext too short');
  }
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(buf.length - TAG_LENGTH);
  const ct = buf.subarray(IV_LENGTH, buf.length - TAG_LENGTH);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
};
