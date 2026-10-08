import { Router, type Request, type Response } from 'express';
import type { EventGuest } from '../src/types/index.ts';
import { config } from './config.ts';
import { db } from './db.ts';
import { requireAdmin, requireAuth } from './auth.ts';
import {
  getSmtpConfig,
  updateSmtpConfig,
  verifySmtpConnection,
  sendTestEmail,
  sendGuestInvitationEmail,
} from './email.ts';

export const apiRouter = Router();

const str = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v: unknown, fallback: number) => {
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : fallback;
};
const notFound = (res: Response, what: string) =>
  res.status(404).json({ success: false, message: `Không tìm thấy ${what}` });

// Staff can look guests up but never receive the QR secrets of other guests
const forRole = (req: Request, eg: EventGuest): EventGuest =>
  req.user?.role === 'ADMIN' ? eg : { ...eg, qr_token: '' };

const hostUrl = (req: Request) => req.get('origin') || `${req.protocol}://${req.get('host')}`;

// ==========================================
// Public: online ticket (needs the unguessable QR token, never the sequential guest code)
// ==========================================
apiRouter.get('/ticket/:token', (req: Request, res: Response) => {
  const token = str(req.params.token, 100);
  const eg = token.length >= 20 ? db.getEventGuestByToken(token) : undefined;
  if (!eg) return notFound(res, 'vé hợp lệ với mã này');
  res.json({ success: true, data: { eventGuest: eg, event: db.getEvent(eg.event_id) } });
});

// Everything below needs a signed-in user
apiRouter.use(requireAuth);

// ==========================================
// 1. EVENTS
// ==========================================
apiRouter.get('/events', (_req, res) => {
  res.json({ success: true, data: db.listEvents() });
});

apiRouter.post('/events', requireAdmin, (req: Request, res: Response) => {
  const event_name = str(req.body.event_name, 200);
  const event_code = str(req.body.event_code, 40);
  if (!event_name || !event_code) {
    return res.status(400).json({ success: false, message: 'Thiếu tên hoặc mã sự kiện' });
  }
  const event = db.createEvent({
    event_name,
    event_code,
    description: str(req.body.description, 2000),
    location: str(req.body.location, 500),
    start_at: str(req.body.start_at, 40) || undefined,
    end_at: str(req.body.end_at, 40) || undefined,
  });
  res.json({ success: true, data: event });
});

apiRouter.get('/events/:id', (req, res) => {
  const event = db.getEvent(req.params.id);
  if (!event) return notFound(res, 'sự kiện');
  res.json({ success: true, data: event });
});

apiRouter.put('/events/:id', requireAdmin, (req: Request, res: Response) => {
  const b = req.body || {};
  const event = db.updateEvent(req.params.id, {
    event_name: b.event_name !== undefined ? str(b.event_name, 200) : undefined,
    event_code: b.event_code !== undefined ? str(b.event_code, 40) : undefined,
    description: b.description !== undefined ? str(b.description, 2000) : undefined,
    location: b.location !== undefined ? str(b.location, 500) : undefined,
    start_at: b.start_at !== undefined ? str(b.start_at, 40) : undefined,
    end_at: b.end_at !== undefined ? str(b.end_at, 40) : undefined,
    status: ['ACTIVE', 'UPCOMING', 'COMPLETED', 'CANCELLED'].includes(b.status) ? b.status : undefined,
  });
  if (!event) return notFound(res, 'sự kiện');
  res.json({ success: true, data: event });
});

apiRouter.delete('/events/:id', requireAdmin, (req, res) => {
  if (!db.deleteEvent(req.params.id)) return notFound(res, 'sự kiện');
  res.json({ success: true, message: 'Đã xóa sự kiện thành công' });
});

// ==========================================
// 2. GUESTS & EVENT GUESTS
// ==========================================
apiRouter.get('/events/:eventId/guests', (req: Request, res: Response) => {
  const r = db.listEventGuests(req.params.eventId, {
    search: str(req.query.search, 100),
    org: str(req.query.org, 200),
    invitation_status: str(req.query.invitation_status, 20),
    checkin_status: str(req.query.checkin_status, 20),
    page: num(req.query.page, 1),
    limit: num(req.query.limit, 50),
  });
  res.json({
    success: true,
    data: r.data.map((eg) => forRole(req, eg)),
    pagination: { total: r.total, page: r.page, limit: r.limit, total_pages: Math.ceil(r.total / r.limit) },
    filter_options: { organizations: r.organizations },
  });
});

apiRouter.post('/events/:eventId/guests', requireAdmin, (req: Request, res: Response) => {
  if (!db.getEvent(req.params.eventId)) return notFound(res, 'sự kiện');
  const b = req.body || {};
  const full_name = str(b.full_name, 200);
  if (!full_name) return res.status(400).json({ success: false, message: 'Họ và tên là bắt buộc' });

  const eg = db.addGuest(req.params.eventId, {
    full_name,
    email: str(b.email, 200),
    phone: str(b.phone, 40),
    organization: str(b.organization, 200),
    title: str(b.title, 200),
    notes: str(b.notes, 1000),
    status: b.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE',
  });
  res.json({ success: true, message: 'Thêm khách mời thành công', data: eg });
});

apiRouter.put('/event-guests/:id', requireAdmin, (req: Request, res: Response) => {
  const b = req.body || {};
  const g = b.guest || {};
  const eg = db.updateEventGuest(req.params.id, {
    guest: b.guest
      ? {
          full_name: g.full_name !== undefined ? str(g.full_name, 200) || undefined : undefined,
          phone: g.phone !== undefined ? str(g.phone, 40) : undefined,
          email: g.email !== undefined ? str(g.email, 200) : undefined,
          organization: g.organization !== undefined ? str(g.organization, 200) : undefined,
          title: g.title !== undefined ? str(g.title, 200) : undefined,
          notes: g.notes !== undefined ? str(g.notes, 1000) : undefined,
          status: g.status === 'DISABLED' || g.status === 'ACTIVE' ? g.status : undefined,
        }
      : undefined,
    checkin_status: b.checkin_status,
    checked_in_by: req.user!.name,
    invitation_status: ['PENDING', 'SENT', 'FAILED'].includes(b.invitation_status) ? b.invitation_status : undefined,
  });
  if (!eg) return notFound(res, 'hồ sơ vé');
  res.json({ success: true, data: eg });
});

apiRouter.delete('/event-guests/:id', requireAdmin, (req, res) => {
  if (!db.deleteEventGuest(req.params.id)) return notFound(res, 'khách');
  res.json({ success: true, message: 'Đã xóa khách khỏi sự kiện' });
});

// 1,000 sample guests for load testing (disabled in production unless ENABLE_DEMO_TOOLS=true)
apiRouter.post('/events/:eventId/guests/bulk-generate', requireAdmin, (req: Request, res: Response) => {
  if (!config.enableDemoTools) {
    return res.status(403).json({ success: false, message: 'Tính năng tạo khách mẫu đã tắt trên production' });
  }
  if (!db.getEvent(req.params.eventId)) return notFound(res, 'sự kiện');
  const count = Math.min(Math.max(num(req.body?.count, 1000), 1), 5000);
  const result = db.generateBulkGuests(req.params.eventId, count);
  res.json({
    success: true,
    message: `Đã sinh thành công ${result.added} khách mời kèm mã QR bảo mật cho sự kiện!`,
    added: result.added,
    total: result.total,
    total_guests: result.total,
  });
});

apiRouter.post('/events/:eventId/guests/import', requireAdmin, (req: Request, res: Response) => {
  if (!db.getEvent(req.params.eventId)) return notFound(res, 'sự kiện');
  const rows = req.body?.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ success: false, message: 'Không có dữ liệu hợp lệ để import' });
  }
  if (rows.length > 20000) {
    return res.status(400).json({ success: false, message: 'Tối đa 20.000 dòng mỗi lần import' });
  }
  const { summary, errors } = db.importGuests(
    req.params.eventId,
    rows.map((r: any) => ({
      full_name: str(r?.full_name, 200),
      phone: str(r?.phone, 40),
      email: str(r?.email, 200),
      organization: str(r?.organization, 200),
      title: str(r?.title, 200),
      notes: str(r?.notes, 1000),
    }))
  );
  res.json({ success: true, summary, errors });
});

// ==========================================
// 3. EMAIL TEMPLATE & SMTP (admin)
// ==========================================
apiRouter.get('/events/:eventId/email-template', requireAdmin, (req: Request, res: Response) => {
  if (!db.getEvent(req.params.eventId)) return notFound(res, 'sự kiện');
  res.json({ success: true, data: db.getTemplate(req.params.eventId) ?? db.saveTemplate(req.params.eventId, {}) });
});

apiRouter.put('/events/:eventId/email-template', requireAdmin, (req: Request, res: Response) => {
  if (!db.getEvent(req.params.eventId)) return notFound(res, 'sự kiện');
  const b = req.body || {};
  const tpl = db.saveTemplate(req.params.eventId, {
    subject: b.subject !== undefined ? str(b.subject, 300) : undefined,
    sender_name: b.sender_name !== undefined ? str(b.sender_name, 200) : undefined,
    sender_email: b.sender_email !== undefined ? str(b.sender_email, 200) : undefined,
    body: b.body !== undefined ? str(b.body, 20000) : undefined,
  });
  res.json({ success: true, data: tpl });
});

apiRouter.get('/smtp-config', requireAdmin, (_req, res) => {
  res.json({ success: true, data: getSmtpConfig() });
});

apiRouter.post('/smtp-config', requireAdmin, (req: Request, res: Response) => {
  const result = updateSmtpConfig(req.body || {});
  res.json({
    success: true,
    message: result.isConfigured
      ? 'Đã lưu cấu hình máy chủ SMTP thành công'
      : 'Đã lưu cấu hình SMTP (Cần đủ Host, Tài khoản và Mật khẩu)',
    data: getSmtpConfig(),
  });
});

apiRouter.post('/smtp-config/verify', requireAdmin, async (_req, res) => {
  res.json(await verifySmtpConnection());
});

apiRouter.post('/smtp-config/test-email', requireAdmin, async (req: Request, res: Response) => {
  const email = str(req.body?.email, 200);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: 'Vui lòng cung cấp địa chỉ email hợp lệ' });
  }
  res.json(await sendTestEmail(email));
});

// ==========================================
// 3.2 INVITATION DISPATCH (admin)
// ==========================================
const NO_SMTP_NOTE =
  'Chưa cài đặt máy chủ SMTP nên chưa có email nào được gửi và trạng thái thư mời giữ nguyên. Bấm "Cấu hình SMTP" để gửi thật.';

// Sends one mail and records the outcome on the ticket
async function deliver(eg: EventGuest, req: Request): Promise<{ ok: boolean; message: string }> {
  const event = db.getEvent(eg.event_id)!;
  try {
    const r = await sendGuestInvitationEmail(eg, event, db.getTemplate(eg.event_id), hostUrl(req));
    db.setInvitation(eg.id, 'SENT');
    return { ok: true, message: r.message };
  } catch (err: any) {
    db.setInvitation(eg.id, 'FAILED');
    return { ok: false, message: err.message || 'Không thể gửi email' };
  }
}

apiRouter.post('/event-guests/:id/send', requireAdmin, async (req: Request, res: Response) => {
  const eg = db.getEventGuest(req.params.id);
  if (!eg) return notFound(res, 'vé');

  if (!eg.guest?.email) {
    db.setInvitation(eg.id, 'FAILED');
    return res.status(400).json({ success: false, message: 'Khách mời không có email hợp lệ' });
  }
  if (!getSmtpConfig().isConfigured) {
    return res.json({ success: true, delivered: false, needsSmtpConfig: true, message: NO_SMTP_NOTE, data: eg });
  }

  const r = await deliver(eg, req);
  const data = db.getEventGuest(eg.id);
  if (!r.ok) {
    return res.status(500).json({
      success: false,
      delivered: false,
      error: r.message,
      message: `Lỗi gửi thư qua SMTP: ${r.message}`,
      data,
    });
  }
  res.json({ success: true, delivered: true, method: 'smtp', message: r.message, data });
});

async function sendMany(targets: EventGuest[], req: Request) {
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  for (const eg of targets) {
    if (!eg.guest?.email) {
      db.setInvitation(eg.id, 'FAILED');
      failed++;
      continue;
    }
    const r = await deliver(eg, req);
    if (r.ok) sent++;
    else {
      failed++;
      errors.push(`${eg.guest.email}: ${r.message}`);
    }
  }
  return { sent, failed, errors: errors.slice(0, 5) };
}

apiRouter.post('/events/:eventId/send-bulk', requireAdmin, async (req: Request, res: Response) => {
  const ids = req.body?.guestIds;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ success: false, message: 'Chưa chọn khách mời để gửi' });
  }
  if (!db.getEvent(req.params.eventId)) return notFound(res, 'sự kiện');
  if (!getSmtpConfig().isConfigured) {
    return res.json({ success: true, delivered: false, needsSmtpConfig: true, message: NO_SMTP_NOTE, sent: 0, failed: 0 });
  }

  const targets = ids
    .slice(0, 5000)
    .map((id: unknown) => db.getEventGuest(String(id)))
    .filter((eg): eg is EventGuest => !!eg && eg.event_id === req.params.eventId);
  const r = await sendMany(targets, req);
  res.json({
    success: true,
    delivered: true,
    message: `Hoàn tất gửi qua SMTP: Thành công ${r.sent}, Thất bại ${r.failed}`,
    ...r,
  });
});

apiRouter.post('/events/:eventId/send-all-pending', requireAdmin, async (req: Request, res: Response) => {
  if (!db.getEvent(req.params.eventId)) return notFound(res, 'sự kiện');
  if (!getSmtpConfig().isConfigured) {
    return res.json({ success: true, delivered: false, needsSmtpConfig: true, message: NO_SMTP_NOTE, sent: 0, failed: 0 });
  }

  const pending = db.listPendingInvitations(req.params.eventId);
  const r = await sendMany(pending, req);
  res.json({
    success: true,
    delivered: true,
    message: `Đã gửi qua SMTP cho ${pending.length} khách mời: Thành công ${r.sent}, Thất bại ${r.failed}`,
    total_processed: pending.length,
    ...r,
  });
});

// ==========================================
// 4. CHECK-IN
// ==========================================
apiRouter.post('/checkin', (req: Request, res: Response) => {
  const event_id = str(req.body?.event_id, 100);
  const qr_token = str(req.body?.qr_token, 1000);
  if (!event_id || !qr_token) {
    return res.status(400).json({
      success: false,
      status: 'INVALID_QR',
      message: 'Thiếu thông tin event_id hoặc mã QR',
    });
  }
  // a queued offline scan may refer to an event deleted since: answer cleanly instead of a DB error
  if (!db.getEvent(event_id)) {
    return res.status(404).json({ success: false, status: 'ERROR', message: 'Sự kiện không tồn tại' });
  }
  // the gate staff identity always comes from the session, never from the request body
  res.json(
    db.processCheckin({
      eventId: event_id,
      tokenOrPayload: qr_token,
      staffId: req.user!.id,
      staffName: req.user!.name,
      deviceId: str(req.body?.device_id, 64) || 'unknown_device',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    })
  );
});

// Demo helpers: admin only, and off in production
const demoOnly = (_req: Request, res: Response, next: () => void) => {
  if (!config.enableDemoTools) {
    return res.status(403).json({ success: false, message: 'Công cụ demo đã tắt trên production' });
  }
  next();
};

apiRouter.post('/checkin/reset', requireAdmin, demoOnly, (req: Request, res: Response) => {
  db.resetCheckin({ eventGuestId: str(req.body?.eventGuestId, 100), eventId: str(req.body?.eventId, 100) });
  res.json({ success: true, message: 'Đã reset trạng thái check-in thành công' });
});

// Fires N parallel check-ins for one QR and reports that exactly one wins
apiRouter.post('/checkin/test-race-condition', requireAdmin, demoOnly, async (req: Request, res: Response) => {
  const event_id = str(req.body?.event_id, 100);
  const qr_token = str(req.body?.qr_token, 1000);
  const concurrency = Math.min(Math.max(num(req.body?.concurrency, 2), 2), 50);
  if (!event_id || !qr_token) {
    return res.status(400).json({ success: false, message: 'Thiếu event_id hoặc qr_token' });
  }

  const eg = db.getEventGuestByToken(qr_token);
  if (eg) db.resetCheckin({ eventGuestId: eg.id });

  const results = await Promise.all(
    Array.from({ length: concurrency }, async (_, i) =>
      db.processCheckin({
        eventId: event_id,
        tokenOrPayload: qr_token,
        staffId: `staff_${i + 1}`,
        staffName: `Thiết bị Scanner ${i + 1}`,
        deviceId: `device_concurrent_${i + 1}`,
        ipAddress: `192.168.1.${101 + i}`,
        userAgent: `ConcurrentTester/${i + 1}.0`,
      })
    )
  );
  const success = results.filter((r) => r.status === 'SUCCESS').length;
  res.json({
    success: true,
    total_concurrent_requests: concurrency,
    summary: {
      success,
      already_checked_in: results.filter((r) => r.status === 'ALREADY_CHECKED_IN').length,
      race_condition_passed: success === 1,
    },
    details: results,
  });
});

// ==========================================
// 5. STATS, LOGS, LIVE STREAM
// ==========================================
apiRouter.get('/events/:eventId/stats', (req, res) => {
  res.json({ success: true, data: db.getStats(req.params.eventId) });
});

apiRouter.get('/events/:eventId/checkins', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: db.listLogs(req.params.eventId, {
      result: str(req.query.result, 30),
      search: str(req.query.search, 100),
      limit: num(req.query.limit, 100),
    }),
  });
});

apiRouter.get('/events/:eventId/stream', (req: Request, res: Response) => {
  const { eventId } = req.params;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', eventId })}\n\n`);

  // heartbeat keeps proxies from closing idle connections
  const heartbeat = setInterval(() => res.write(': keepalive\n\n'), 15000);
  const unsubscribe = db.subscribeSSE(eventId, (data) => res.write(`data: ${JSON.stringify(data)}\n\n`));

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});
