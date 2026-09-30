import { sign, verify } from 'hono/jwt';
import type { Bindings } from '../index';

const PBKDF2_ITERATIONS = 100000;
const SALT_BYTES = 16;
const KEY_LEN_BITS = 256;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    KEY_LEN_BITS
  );

  const hashHex = bytesToHex(new Uint8Array(derivedBits));
  const saltHex = bytesToHex(salt);
  return `pbkdf2:${PBKDF2_ITERATIONS}:${saltHex}:${hashHex}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const parts = storedHash.split(':');
    if (parts.length !== 4 || parts[0] !== 'pbkdf2') {
      return false;
    }
    const iterations = Number.parseInt(parts[1], 10);
    const salt = hexToBytes(parts[2]);
    const expectedHashHex = parts[3];

    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations,
        hash: 'SHA-256'
      },
      keyMaterial,
      KEY_LEN_BITS
    );

    const actualHashHex = bytesToHex(new Uint8Array(derivedBits));
    if (actualHashHex.length !== expectedHashHex.length) {
      return false;
    }

    // Constant-time string comparison
    let diff = 0;
    for (let i = 0; i < actualHashHex.length; i++) {
      diff |= actualHashHex.charCodeAt(i) ^ expectedHashHex.charCodeAt(i);
    }
    return diff === 0;
  } catch {
    return false;
  }
}

export function generateWebhookToken(): string {
  const randomBytes = crypto.getRandomValues(new Uint8Array(16));
  return `wh_${bytesToHex(randomBytes)}`;
}

export function getJwtSecret(env: Bindings): string {
  return env.JWT_SECRET || env.APP_PASSCODE || 'akuntan-multiuser-default-jwt-secret-2026';
}

export async function signAuthToken(
  payload: { sub: number; email: string; name: string },
  env: Bindings
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 60 * 60 * 24 * 30; // 30 days
  return await sign({ ...payload, iat: now, exp }, getJwtSecret(env), 'HS256');
}

export async function verifyAuthToken(
  token: string,
  env: Bindings
): Promise<{ sub: number; email: string; name: string } | null> {
  try {
    const payload = await verify(token, getJwtSecret(env), 'HS256');
    if (!payload || typeof payload.sub !== 'number') {
      return null;
    }
    return {
      sub: payload.sub,
      email: String(payload.email || ''),
      name: String(payload.name || '')
    };
  } catch {
    return null;
  }
}
