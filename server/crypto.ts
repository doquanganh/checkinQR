import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { config } from './config.ts';

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

// Unpredictable token (CSPRNG, ~139 bits of entropy), not sequential
export function generateSecureToken(prefix = 'tok_'): string {
  let token = prefix;
  for (let i = 0; i < 24; i++) token += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return token;
}

export const newId = (prefix: string) => prefix + crypto.randomBytes(8).toString('hex');

export const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, saltHex, hashHex] = stored.split('$');
  if (alg !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

const key = () => crypto.createHash('sha256').update(config.appSecret).digest();

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), ct.toString('base64')].join(':');
}

// Returns '' when the value is missing or APP_SECRET changed (caller treats as "not configured")
export function decryptSecret(stored: string): string {
  try {
    const [v, iv, tag, ct] = stored.split(':');
    if (v !== 'v1') return '';
    const d = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
    d.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([d.update(Buffer.from(ct, 'base64')), d.final()]).toString('utf8');
  } catch {
    return '';
  }
}
