import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './app.ts';
import { bootstrapAdmin } from './auth.ts';
import { db } from './db.ts';

const app = createApp();

async function login(email: string, password: string) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password });
  return { agent, res };
}

let admin: request.Agent;
let staff: request.Agent;
let eventId: string;
let otherEventId: string;
let token: string; // QR token of the main test guest
let code: string;

beforeAll(async () => {
  await bootstrapAdmin();
  admin = (await login('admin@test.local', 'adminpass123')).agent;

  const created = await admin.post('/api/users').send({
    name: 'Staff Cổng 1',
    email: 'staff1@test.local',
    password: 'staffpass123',
    role: 'CHECKIN_STAFF',
  });
  expect(created.status).toBe(201);
  staff = (await login('staff1@test.local', 'staffpass123')).agent;

  eventId = (await admin.post('/api/events').send({ event_name: 'Event A', event_code: 'evt-a' })).body.data.id;
  otherEventId = (await admin.post('/api/events').send({ event_name: 'Event B', event_code: 'evt-b' })).body.data.id;

  const g = await admin.post(`/api/events/${eventId}/guests`).send({ full_name: 'Nguyễn Văn A', email: 'a@x.vn' });
  token = g.body.data.qr_token;
  code = g.body.data.guest_code;
});

describe('auth', () => {
  it('rejects anonymous API calls but serves health', async () => {
    expect((await request(app).get('/api/events')).status).toBe(401);
    expect((await request(app).get('/api/health')).body.status).toBe('ok');
  });

  it('rejects bad credentials and unknown users', async () => {
    expect((await login('admin@test.local', 'wrong-password')).res.status).toBe(401);
    expect((await login('nobody@test.local', 'whatever123')).res.status).toBe(401);
  });

  it('sets an HttpOnly session cookie and never returns the password hash', async () => {
    const { res } = await login('admin@test.local', 'adminpass123');
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie'][0]).toMatch(/HttpOnly/);
    expect(JSON.stringify(res.body)).not.toContain('password_hash');
    expect(JSON.stringify((await admin.get('/api/users')).body)).not.toContain('password_hash');
  });

  it('logout invalidates the session', async () => {
    const { agent } = await login('staff1@test.local', 'staffpass123');
    expect((await agent.get('/api/auth/me')).status).toBe(200);
    await agent.post('/api/auth/logout');
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  it('rejects cross-origin writes', async () => {
    const res = await admin.post('/api/events').set('Origin', 'https://evil.example').send({ event_name: 'x', event_code: 'x' });
    expect(res.status).toBe(403);
  });
});

describe('roles', () => {
  it('staff can read events but not change anything', async () => {
    expect((await staff.get('/api/events')).status).toBe(200);
    expect((await staff.post('/api/events').send({ event_name: 'X', event_code: 'X1' })).status).toBe(403);
    expect((await staff.get('/api/users')).status).toBe(403);
    expect((await staff.get('/api/smtp-config')).status).toBe(403);
    expect((await staff.post('/api/checkin/reset').send({ eventId })).status).toBe(403);
    expect((await staff.delete(`/api/events/${eventId}`)).status).toBe(403);
  });

  it('staff guest lookup hides QR tokens, admin sees them', async () => {
    const s = await staff.get(`/api/events/${eventId}/guests`);
    expect(s.body.data[0].qr_token).toBe('');
    const a = await admin.get(`/api/events/${eventId}/guests`);
    expect(a.body.data.map((x: any) => x.qr_token)).toContain(token);
  });

  it('keeps at least one active admin', async () => {
    const me = (await admin.get('/api/auth/me')).body.data;
    const res = await admin.patch(`/api/users/${me.id}`).send({ active: false });
    expect(res.status).toBe(400);
  });

  it('a disabled staff account is signed out and cannot log in', async () => {
    const u = (await admin.post('/api/users').send({ name: 'Tạm', email: 'tmp@test.local', password: 'temp-pass-123' })).body.data;
    const { agent } = await login('tmp@test.local', 'temp-pass-123');
    expect((await agent.get('/api/events')).status).toBe(200);
    await admin.patch(`/api/users/${u.id}`).send({ active: false });
    expect((await agent.get('/api/events')).status).toBe(401);
    expect((await login('tmp@test.local', 'temp-pass-123')).res.status).toBe(401);
  });
});

describe('check-in', () => {
  it('covers the five validation cases', async () => {
    const post = (body: object) => staff.post('/api/checkin').send({ event_id: eventId, ...body });

    // wrong event
    const wrong = await staff.post('/api/checkin').send({ event_id: otherEventId, qr_token: token });
    expect(wrong.body.status).toBe('WRONG_EVENT');

    // invalid
    expect((await post({ qr_token: 'does-not-exist' })).body.status).toBe('INVALID_QR');

    // disabled guest
    const dis = await admin.post(`/api/events/${eventId}/guests`).send({ full_name: 'Bị khóa', status: 'DISABLED' });
    expect((await post({ qr_token: dis.body.data.qr_token })).body.status).toBe('GUEST_INACTIVE');

    // success, using the JSON payload the QR image carries; staff name comes from the session
    const ok = await post({ qr_token: JSON.stringify({ type: 'EVENT_GUEST', event: 'EVT-A', token }), staff_name: 'Hacker' });
    expect(ok.body.status).toBe('SUCCESS');
    expect(ok.body.checked_in_by).toBe('Staff Cổng 1');

    // already checked in, via the guest code typed by hand
    const dup = await post({ qr_token: code });
    expect(dup.body.status).toBe('ALREADY_CHECKED_IN');
  });

  it('reads the QR format used in invitation emails', async () => {
    const g = await admin.post(`/api/events/${eventId}/guests`).send({ full_name: 'Email QR' });
    const res = await staff.post('/api/checkin').send({
      event_id: eventId,
      qr_token: `EVENT:EVT-A|TOKEN:${g.body.data.qr_token}`,
    });
    expect(res.body.status).toBe('SUCCESS');
  });

  it('lets exactly one of many parallel scans win', async () => {
    const g = await admin.post(`/api/events/${eventId}/guests`).send({ full_name: 'Race' });
    const results = await Promise.all(
      Array.from({ length: 50 }, () => staff.post('/api/checkin').send({ event_id: eventId, qr_token: g.body.data.qr_token }))
    );
    const statuses = results.map((r) => r.body.status);
    expect(statuses.filter((s) => s === 'SUCCESS')).toHaveLength(1);
    expect(statuses.filter((s) => s === 'ALREADY_CHECKED_IN')).toHaveLength(49);
  });

  it('race simulator reports a pass for admins', async () => {
    const g = await admin.post(`/api/events/${eventId}/guests`).send({ full_name: 'Sim' });
    const res = await admin.post('/api/checkin/test-race-condition').send({ event_id: eventId, qr_token: g.body.data.qr_token, concurrency: 5 });
    expect(res.body.summary.race_condition_passed).toBe(true);
  });

  it('keeps stats and audit log consistent', async () => {
    const stats = (await staff.get(`/api/events/${eventId}/stats`)).body.data;
    const logs = (await staff.get(`/api/events/${eventId}/checkins?result=SUCCESS&limit=1000`)).body.data;
    expect(stats.checked_in_count).toBe(logs.length);
    expect(stats.total_guests).toBeGreaterThan(stats.checked_in_count);
  });
});

describe('guests', () => {
  it('imports with duplicate and invalid reporting', async () => {
    const res = await admin.post(`/api/events/${eventId}/guests/import`).send({
      rows: [
        { full_name: 'Import Một', email: 'one@imp.vn' },
        { full_name: 'Trùng', email: 'ONE@imp.vn' },
        { full_name: '', email: 'empty@imp.vn' },
      ],
    });
    expect(res.body.summary).toMatchObject({ total_rows: 3, success: 1, duplicate: 1, invalid: 1 });
  });

  it('searches Vietnamese names case-insensitively and paginates', async () => {
    await admin.post(`/api/events/${eventId}/guests`).send({ full_name: 'Đỗ Hùng Dũng', organization: 'FPT' });
    const res = await staff.get(`/api/events/${eventId}/guests`).query({ search: 'đỗ hùng', limit: 5 });
    expect(res.body.data.map((x: any) => x.guest.full_name)).toContain('Đỗ Hùng Dũng');
    expect(res.body.pagination.limit).toBe(5);
  });

  it('handles 1,000 generated guests quickly', async () => {
    const ev = (await admin.post('/api/events').send({ event_name: 'Bulk', event_code: 'bulk' })).body.data.id;
    const t = Date.now();
    await admin.post(`/api/events/${ev}/guests/bulk-generate`).send({ count: 1000 });
    const list = await staff.get(`/api/events/${ev}/guests`).query({ search: 'nguyễn', limit: 50 });
    expect(list.body.pagination.total).toBeGreaterThan(0);
    expect(Date.now() - t).toBeLessThan(5000);
    const codes = (await admin.get(`/api/events/${ev}/guests?limit=500`)).body.data.map((x: any) => x.guest_code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('deleting an event removes its guests and logs', async () => {
    const ev = (await admin.post('/api/events').send({ event_name: 'Tmp', event_code: 'tmp' })).body.data.id;
    await admin.post(`/api/events/${ev}/guests`).send({ full_name: 'Gone' });
    expect((await admin.delete(`/api/events/${ev}`)).status).toBe(200);
    expect(db.countEventGuests(ev)).toBe(0);
  });

  it('rejects a duplicate event code', async () => {
    const res = await admin.post('/api/events').send({ event_name: 'Dup', event_code: 'EVT-A' });
    expect(res.status).toBe(409);
  });
});

describe('public ticket', () => {
  it('opens with the QR token and refuses the guessable guest code', async () => {
    expect((await request(app).get(`/api/ticket/${token}`)).body.data.eventGuest.guest.full_name).toBe('Nguyễn Văn A');
    expect((await request(app).get(`/api/ticket/${code}`)).status).toBe(404);
  });
});
