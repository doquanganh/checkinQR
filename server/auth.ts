import { Router, type NextFunction, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import type { Role, User } from '../src/types/index.ts';
import { config, isProd } from './config.ts';
import { hashPassword, sha256, verifyPassword } from './crypto.ts';
import { db, type StoredUser } from './db.ts';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

const COOKIE = 'sid';
const ROLES: Role[] = ['ADMIN', 'CHECKIN_STAFF'];
const MIN_PASSWORD = 8;

export const toPublicUser = (u: StoredUser): User => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  active: u.active,
  created_at: u.created_at,
});

function readCookie(req: Request, name: string): string | undefined {
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) {
      try {
        return decodeURIComponent(part.slice(i + 1).trim());
      } catch {
        return undefined; // malformed cookie must not turn into a 500
      }
    }
  }
  return undefined;
}

function setSessionCookie(res: Response, token: string, maxAgeSec: number) {
  const parts = [`${COOKIE}=${token}`, 'HttpOnly', 'SameSite=Lax', 'Path=/', `Max-Age=${maxAgeSec}`];
  if (config.cookieSecure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

// Resolves the session cookie to req.user on every request (public routes simply ignore it)
export function attachUser(req: Request, _res: Response, next: NextFunction) {
  const token = readCookie(req, COOKIE);
  if (token) {
    const u = db.getSessionUser(sha256(token));
    if (u) req.user = toPublicUser(u);
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập' });
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập' });
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Chỉ quản trị viên mới có quyền thực hiện thao tác này' });
  }
  next();
}

// ponytail: in-memory per-IP limiter, enough for one server process. Use a shared store if scaled out.
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 20;

function tooManyAttempts(ip: string): boolean {
  const t = Date.now();
  if (attempts.size > 5000) for (const [k, v] of attempts) if (v.resetAt < t) attempts.delete(k); // bound memory
  const rec = attempts.get(ip);
  if (!rec || rec.resetAt < t) {
    attempts.set(ip, { count: 1, resetAt: t + WINDOW_MS });
    return false;
  }
  rec.count++;
  return rec.count > MAX_ATTEMPTS;
}

let dummyHash: Promise<string> | null = null;

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export const authRouter = Router();

authRouter.post('/auth/login', async (req: Request, res: Response) => {
  const ip = req.ip || 'unknown';
  if (tooManyAttempts(ip)) {
    return res.status(429).json({ success: false, message: 'Quá nhiều lần thử. Vui lòng đợi 15 phút rồi thử lại.' });
  }
  const email = clean(req.body?.email, 200).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  const user = email ? db.getUserByEmail(email) : undefined;
  // verify against a dummy hash for unknown users so response time does not reveal which emails exist
  dummyHash ??= hashPassword('dummy-password');
  const ok = await verifyPassword(password, user ? user.password_hash : await dummyHash);
  if (!user || !user.active || !ok) {
    return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không đúng' });
  }

  const token = crypto.randomBytes(32).toString('base64url');
  const maxAge = config.sessionDays * 86400;
  db.createSession(user.id, sha256(token), Date.now() + maxAge * 1000);
  setSessionCookie(res, token, maxAge);
  attempts.delete(ip);
  res.json({ success: true, data: toPublicUser(user) });
});

authRouter.post('/auth/logout', (req: Request, res: Response) => {
  const token = readCookie(req, COOKIE);
  if (token) db.deleteSession(sha256(token));
  setSessionCookie(res, '', 0);
  res.json({ success: true });
});

authRouter.get('/auth/me', requireAuth, (req: Request, res: Response) => {
  res.json({ success: true, data: req.user });
});

authRouter.post('/auth/change-password', requireAuth, async (req: Request, res: Response) => {
  const current = typeof req.body?.current_password === 'string' ? req.body.current_password : '';
  const next = typeof req.body?.new_password === 'string' ? req.body.new_password : '';
  const user = db.getUserById(req.user!.id)!;
  if (!(await verifyPassword(current, user.password_hash))) {
    return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không đúng' });
  }
  if (next.length < MIN_PASSWORD) {
    return res.status(400).json({ success: false, message: `Mật khẩu mới tối thiểu ${MIN_PASSWORD} ký tự` });
  }
  db.updateUser(user.id, { password_hash: await hashPassword(next) });
  // sign out other devices, keep this one
  const keep = readCookie(req, COOKIE);
  db.deleteUserSessions(user.id);
  if (keep) db.createSession(user.id, sha256(keep), Date.now() + config.sessionDays * 86400 * 1000);
  res.json({ success: true, message: 'Đã đổi mật khẩu' });
});

// ---------------- admin: user management ----------------
authRouter.get('/users', requireAdmin, (_req: Request, res: Response) => {
  res.json({ success: true, data: db.listUsers().map(toPublicUser) });
});

authRouter.post('/users', requireAdmin, async (req: Request, res: Response) => {
  const name = clean(req.body?.name, 120);
  const email = clean(req.body?.email, 200).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const role: Role = ROLES.includes(req.body?.role) ? req.body.role : 'CHECKIN_STAFF';

  if (!name || !validEmail(email)) {
    return res.status(400).json({ success: false, message: 'Cần họ tên và email hợp lệ' });
  }
  if (password.length < MIN_PASSWORD) {
    return res.status(400).json({ success: false, message: `Mật khẩu tối thiểu ${MIN_PASSWORD} ký tự` });
  }
  if (db.getUserByEmail(email)) {
    return res.status(409).json({ success: false, message: 'Email này đã có tài khoản' });
  }
  const user = db.createUser({ name, email, role, password_hash: await hashPassword(password) });
  res.status(201).json({ success: true, data: toPublicUser(user) });
});

authRouter.patch('/users/:id', requireAdmin, async (req: Request, res: Response) => {
  const target = db.getUserById(req.params.id);
  if (!target) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });

  const patch: { name?: string; role?: Role; active?: boolean; password_hash?: string } = {};
  if (req.body?.name !== undefined) {
    patch.name = clean(req.body.name, 120);
    if (!patch.name) return res.status(400).json({ success: false, message: 'Họ tên không được để trống' });
  }
  if (req.body?.role !== undefined) {
    if (!ROLES.includes(req.body.role)) return res.status(400).json({ success: false, message: 'Vai trò không hợp lệ' });
    patch.role = req.body.role;
  }
  if (req.body?.active !== undefined) patch.active = !!req.body.active;
  if (req.body?.password !== undefined) {
    if (typeof req.body.password !== 'string' || req.body.password.length < MIN_PASSWORD) {
      return res.status(400).json({ success: false, message: `Mật khẩu tối thiểu ${MIN_PASSWORD} ký tự` });
    }
    patch.password_hash = await hashPassword(req.body.password);
  }

  // never lock the system out: no self-lockout and always keep one active admin
  const losesAdmin =
    target.role === 'ADMIN' && target.active && (patch.role === 'CHECKIN_STAFF' || patch.active === false);
  if (losesAdmin && (target.id === req.user!.id || db.countActiveAdmins() <= 1)) {
    return res.status(400).json({
      success: false,
      message: 'Không thể khóa hoặc hạ quyền quản trị viên cuối cùng hoặc chính bạn',
    });
  }

  const updated = db.updateUser(target.id, patch)!;
  if (patch.active === false || patch.password_hash || patch.role) db.deleteUserSessions(target.id);
  res.json({ success: true, data: toPublicUser(updated) });
});

// First start: create the initial admin so the UI can be reached
export async function bootstrapAdmin() {
  if (db.countUsers() > 0) return;
  let email = config.adminEmail;
  let password = config.adminPassword;
  let generated = false;

  if (!email || !password) {
    if (isProd) {
      throw new Error('Chưa có tài khoản nào. Đặt ADMIN_EMAIL và ADMIN_PASSWORD (>= 8 ký tự) rồi khởi động lại.');
    }
    email = 'admin@eventhub.vn';
    password = crypto.randomBytes(9).toString('base64url');
    generated = true;
  }
  if (password.length < MIN_PASSWORD) throw new Error(`ADMIN_PASSWORD phải có ít nhất ${MIN_PASSWORD} ký tự`);

  db.createUser({ name: 'Quản trị viên', email, role: 'ADMIN', password_hash: await hashPassword(password) });
  console.log(`✓ Đã tạo tài khoản quản trị: ${email}`);
  if (generated) console.log(`  Mật khẩu dev (chỉ hiện một lần): ${password}`);
}
