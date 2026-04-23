#!/usr/bin/env node
// One-shot helper for J.3-ext: reads CREDENTIALS_ENCRYPTION_KEY from .env.local,
// takes JSON payload via env var INPUT_JSON, emits base64 ciphertext envelope.
// Used to hand encrypted auth_config blobs to the Supabase MCP without ever
// writing the plaintext creds to git.
//
// Same AES-256-GCM shape as lib/crypto/encrypt.ts:
//   12-byte IV || ciphertext || 16-byte GCM tag, base64-encoded.

import { readFileSync } from 'node:fs';
import { createCipheriv, randomBytes } from 'node:crypto';

const parseDotenv = (path) => {
  const env = {};
  const raw = readFileSync(path, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
};

const localEnv = parseDotenv('.env.local');
const keyB64 = localEnv.CREDENTIALS_ENCRYPTION_KEY ?? process.env.CREDENTIALS_ENCRYPTION_KEY;
if (!keyB64) {
  console.error('CREDENTIALS_ENCRYPTION_KEY not found');
  process.exit(1);
}
const key = Buffer.from(keyB64, 'base64');
if (key.length !== 32) {
  console.error(`Key must be 32 bytes; got ${key.length}`);
  process.exit(1);
}

const plaintext = process.env.INPUT_JSON;
if (!plaintext) {
  console.error('INPUT_JSON env var required (plaintext JSON string)');
  process.exit(1);
}

const iv = randomBytes(12);
const cipher = createCipheriv('aes-256-gcm', key, iv);
const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
const tag = cipher.getAuthTag();
const envelope = Buffer.concat([iv, enc, tag]).toString('base64');

console.log(envelope);
