import 'dotenv/config';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const env = process.env;

export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

const appUrl = (env.APP_URL || '').replace(/\/+$/, '');

function resolveSecret(): string {
  const s = env.APP_SECRET || '';
  if (s.length >= 32) return s;
  if (isProd) {
    throw new Error('APP_SECRET phải có ít nhất 32 ký tự khi chạy production (openssl rand -hex 32)');
  }
  return 'dev-only-secret-do-not-use-in-production-0000';
}

// What is deployed: version from package.json, commit/time injected at build (see Dockerfile, deploy/auto-update.sh)
const pkgVersion: string = JSON.parse(
  readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8')
).version;

export const buildInfo = {
  version: pkgVersion,
  commit: env.GIT_SHA || 'unknown',
  builtAt: env.BUILT_AT || '',
};

export const config = {
  port: env.PORT ? parseInt(env.PORT, 10) : 3000,
  appUrl,
  dbPath: env.DB_PATH || path.resolve(process.cwd(), 'data', 'checkin.db'),
  appSecret: resolveSecret(),
  cookieSecure: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : appUrl.startsWith('https://'),
  trustProxy: env.TRUST_PROXY ? parseInt(env.TRUST_PROXY, 10) : isProd ? 1 : 0,
  seedSampleData: env.SEED_SAMPLE_DATA ? env.SEED_SAMPLE_DATA === 'true' : !isProd && !isTest,
  adminEmail: (env.ADMIN_EMAIL || '').trim().toLowerCase(),
  adminPassword: env.ADMIN_PASSWORD || '',
  sessionDays: 7,
  // ponytail: demo tools (reset check-in, race simulator) are off in production unless opted in
  enableDemoTools: env.ENABLE_DEMO_TOOLS ? env.ENABLE_DEMO_TOOLS === 'true' : !isProd,
};
