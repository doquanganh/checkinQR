import { Router, type Request, type Response } from 'express';
import { db, generateSecureToken } from './db.ts';
import type { CheckinRequest, Guest, EventGuest, CheckinLog } from '../src/types/index.ts';
import {
  getSmtpConfig,
  updateSmtpConfig,
  verifySmtpConnection,
  sendTestEmail,
  sendGuestInvitationEmail,
} from './email.ts';

export const apiRouter = Router();

// ==========================================
// 1. EVENTS API
// ==========================================
apiRouter.get('/events', (req: Request, res: Response) => {
  res.json({ success: true, data: db.events });
});

apiRouter.post('/events', (req: Request, res: Response) => {
  const { event_name, event_code, description, location, start_at, end_at } = req.body;
  if (!event_name || !event_code) {
    return res.status(400).json({ success: false, message: 'Thiếu tên hoặc mã sự kiện' });
  }

  const newEvent = {
    id: 'evt_' + Date.now().toString(36),
    event_code: event_code.toUpperCase(),
    event_name,
    description: description || '',
    location: location || '',
    start_at: start_at || new Date().toISOString(),
    end_at: end_at || new Date().toISOString(),
    status: 'ACTIVE' as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  db.events.unshift(newEvent);

  // default email template
  db.emailTemplates.push({
    id: 'tpl_' + newEvent.id,
    event_id: newEvent.id,
    subject: `Thư mời tham dự {{EVENT_NAME}}`,
    sender_name: 'Ban Tổ Chức',
    sender_email: 'event@organizer.com',
    body: `Kính gửi Anh/Chị {{FULL_NAME}},\n\nTrân trọng kính mời Anh/Chị tham dự {{EVENT_NAME}}.\nThời gian: {{EVENT_DATE}}\nĐịa điểm: {{EVENT_LOCATION}}\nMã khách: {{GUEST_CODE}}\n\nTrân trọng,`,
  });

  res.json({ success: true, data: newEvent });
});

apiRouter.get('/events/:id', (req: Request, res: Response) => {
  const event = db.events.find((e) => e.id === req.params.id);
  if (!event) return res.status(404).json({ success: false, message: 'Không tìm thấy sự kiện' });
  res.json({ success: true, data: event });
});

apiRouter.put('/events/:id', (req: Request, res: Response) => {
  const event = db.events.find((e) => e.id === req.params.id);
  if (!event) return res.status(404).json({ success: false, message: 'Không tìm thấy sự kiện' });

  Object.assign(event, req.body, { updated_at: new Date().toISOString() });
  res.json({ success: true, data: event });
});

apiRouter.delete('/events/:id', (req: Request, res: Response) => {
  const idx = db.events.findIndex((e) => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Không tìm thấy sự kiện' });

  db.events.splice(idx, 1);
  // remove associated event guests
  db.eventGuests = db.eventGuests.filter((eg) => eg.event_id !== req.params.id);
  res.json({ success: true, message: 'Đã xóa sự kiện thành công' });
});

// ==========================================
// 2. GUESTS & EVENT GUESTS API
// ==========================================
apiRouter.get('/events/:eventId/guests', (req: Request, res: Response) => {
  const { eventId } = req.params;
  const search = ((req.query.search as string) || '').trim().toLowerCase();
  const org = (req.query.org as string) || '';
  const invStatus = (req.query.invitation_status as string) || '';
  const checkStatus = (req.query.checkin_status as string) || '';
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;

  // Find all event_guests for this event
  let matched = db.eventGuests.filter((eg) => eg.event_id === eventId);

  // Map with guest profile
  const enriched = matched.map((eg) => {
    const g = db.guests.find((x) => x.id === eg.guest_id);
    return {
      ...eg,
      guest: g,
    };
  });

  // Filter
  const filtered = enriched.filter((item) => {
    const g = item.guest;
    if (!g) return false;

    if (search) {
      const matchSearch =
        g.full_name.toLowerCase().includes(search) ||
        g.email.toLowerCase().includes(search) ||
        g.phone.includes(search) ||
        g.organization.toLowerCase().includes(search) ||
        item.guest_code.toLowerCase().includes(search);
      if (!matchSearch) return false;
    }

    if (org && g.organization !== org) return false;
    if (invStatus && item.invitation_status !== invStatus) return false;
    if (checkStatus && item.checkin_status !== checkStatus) return false;

    return true;
  });

  const total = filtered.length;
  const startIndex = (page - 1) * limit;
  const paged = filtered.slice(startIndex, startIndex + limit);

  // unique orgs list for filtering
  const allEventGuests = db.eventGuests.filter((eg) => eg.event_id === eventId);
  const orgs = Array.from(
    new Set(
      allEventGuests
        .map((eg) => db.guests.find((x) => x.id === eg.guest_id)?.organization)
        .filter(Boolean)
    )
  );

  res.json({
    success: true,
    data: paged,
    pagination: {
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
    },
    filter_options: {
      organizations: orgs,
    },
  });
});

apiRouter.post('/events/:eventId/guests', (req: Request, res: Response) => {
  const { eventId } = req.params;
  const { full_name, email, phone, organization, title, notes, status } = req.body;

  if (!full_name) {
    return res.status(400).json({ success: false, message: 'Họ và tên là bắt buộc' });
  }

  // 1. Create Guest Profile
  const guestId = String(db.guests.length + 1).padStart(6, '0');
  const newGuest: Guest = {
    id: guestId,
    full_name,
    email: email || '',
    phone: phone || '',
    organization: organization || 'Tự do',
    title: title || 'Khách mời',
    notes: notes || '',
    status: status || 'ACTIVE',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  db.guests.push(newGuest);

  // 2. Link to EventGuest with unique code and secure QR token
  const guestCode = 'G2026' + String(db.eventGuests.length + 1).padStart(5, '0');
  const newEventGuest: EventGuest = {
    id: `eg_${guestId}_${eventId}`,
    event_id: eventId,
    guest_id: guestId,
    guest_code: guestCode,
    qr_token: generateSecureToken(`qr_${guestId}_`),
    invitation_status: 'PENDING',
    invited_at: null,
    checkin_status: 'NOT_CHECKED_IN',
    checked_in_at: null,
    checked_in_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    guest: newGuest,
  };

  db.eventGuests.unshift(newEventGuest);

  res.json({
    success: true,
    message: 'Thêm khách mời thành công',
    data: newEventGuest,
  });
});

apiRouter.put('/event-guests/:id', (req: Request, res: Response) => {
  const eg = db.eventGuests.find((x) => x.id === req.params.id);
  if (!eg) return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ vé' });

  const g = db.guests.find((x) => x.id === eg.guest_id);
  if (g && req.body.guest) {
    Object.assign(g, req.body.guest, { updated_at: new Date().toISOString() });
  }

  if (req.body.checkin_status) {
    eg.checkin_status = req.body.checkin_status;
    if (req.body.checkin_status === 'CHECKED_IN') {
      eg.checked_in_at = eg.checked_in_at || new Date().toISOString();
      eg.checked_in_by = req.body.checked_in_by || 'Admin Override';
    } else {
      eg.checked_in_at = null;
      eg.checked_in_by = null;
    }
  }

  if (req.body.invitation_status) {
    eg.invitation_status = req.body.invitation_status;
    if (eg.invitation_status === 'SENT') {
      eg.invited_at = new Date().toISOString();
    }
  }

  eg.updated_at = new Date().toISOString();

  res.json({
    success: true,
    data: {
      ...eg,
      guest: g,
    },
  });
});

apiRouter.delete('/event-guests/:id', (req: Request, res: Response) => {
  const idx = db.eventGuests.findIndex((x) => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Không tìm thấy khách' });

  db.eventGuests.splice(idx, 1);
  res.json({ success: true, message: 'Đã xóa khách khỏi sự kiện' });
});

// BULK GENERATION OF 1,000 GUESTS (Performance scale testing)
apiRouter.post('/events/:eventId/guests/bulk-generate', (req: Request, res: Response) => {
  const { eventId } = req.params;
  const count = parseInt(req.body.count) || 1000;
  const result = db.generateBulk1000Guests(eventId, count);
  res.json({
    success: true,
    message: `Đã sinh thành công ${result.added} khách mời kèm mã QR bảo mật cho sự kiện!`,
    total_guests: result.total,
  });
});

// IMPORT CSV / EXCEL DATA
apiRouter.post('/events/:eventId/guests/import', (req: Request, res: Response) => {
  const { eventId } = req.params;
  const rows: Array<{
    full_name?: string;
    phone?: string;
    email?: string;
    organization?: string;
    title?: string;
    notes?: string;
  }> = req.body.rows || [];

  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ success: false, message: 'Không có dữ liệu hợp lệ để import' });
  }

  let successCount = 0;
  let duplicateCount = 0;
  let invalidCount = 0;
  const errors: Array<{ row: number; reason: string; data: any }> = [];

  const existingEmails = new Set(
    db.guests.map((g) => g.email.toLowerCase()).filter(Boolean)
  );

  rows.forEach((row, i) => {
    const name = (row.full_name || '').trim();
    const email = (row.email || '').trim().toLowerCase();
    const phone = (row.phone || '').trim();

    if (!name) {
      invalidCount++;
      errors.push({ row: i + 1, reason: 'Thiếu họ và tên', data: row });
      return;
    }

    if (email && existingEmails.has(email)) {
      duplicateCount++;
      errors.push({ row: i + 1, reason: `Email ${email} đã tồn tại trong hệ thống`, data: row });
      return;
    }

    const guestId = String(db.guests.length + 1).padStart(6, '0');
    const newGuest: Guest = {
      id: guestId,
      full_name: name,
      phone,
      email,
      organization: row.organization || 'Chưa phân loại',
      title: row.title || 'Khách mời',
      notes: row.notes || '',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    db.guests.push(newGuest);
    if (email) existingEmails.add(email);

    const guestCode = 'G2026' + String(db.eventGuests.length + 1).padStart(5, '0');
    db.eventGuests.push({
      id: `eg_${guestId}_${eventId}`,
      event_id: eventId,
      guest_id: guestId,
      guest_code: guestCode,
      qr_token: generateSecureToken(`qr_${guestId}_`),
      invitation_status: 'PENDING',
      invited_at: null,
      checkin_status: 'NOT_CHECKED_IN',
      checked_in_at: null,
      checked_in_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    successCount++;
  });

  res.json({
    success: true,
    summary: {
      total_rows: rows.length,
      success: successCount,
      duplicate: duplicateCount,
      invalid: invalidCount,
    },
    errors,
  });
});

// ==========================================
// 3. INVITATIONS & EMAIL
// ==========================================
apiRouter.get('/events/:eventId/email-template', (req: Request, res: Response) => {
  const { eventId } = req.params;
  let tpl = db.emailTemplates.find((t) => t.event_id === eventId);
  if (!tpl) {
    tpl = {
      id: 'tpl_' + eventId,
      event_id: eventId,
      subject: 'Thư mời tham dự sự kiện {{EVENT_NAME}}',
      sender_name: 'Ban Tổ Chức',
      sender_email: 'event@domain.vn',
      body: 'Kính gửi {{FULL_NAME}},\n\nTrân trọng kính mời Anh/Chị tham dự {{EVENT_NAME}}.',
    };
    db.emailTemplates.push(tpl);
  }
  res.json({ success: true, data: tpl });
});

apiRouter.put('/events/:eventId/email-template', (req: Request, res: Response) => {
  const { eventId } = req.params;
  let tpl = db.emailTemplates.find((t) => t.event_id === eventId);
  if (!tpl) {
    tpl = {
      id: 'tpl_' + eventId,
      event_id: eventId,
      subject: req.body.subject,
      sender_name: req.body.sender_name,
      sender_email: req.body.sender_email,
      body: req.body.body,
    };
    db.emailTemplates.push(tpl);
  } else {
    Object.assign(tpl, req.body);
  }
  res.json({ success: true, data: tpl });
});

// ==========================================
// 3.1 SMTP CONFIGURATION & DIAGNOSTICS
// ==========================================
apiRouter.get('/smtp-config', (_req: Request, res: Response) => {
  res.json({ success: true, data: getSmtpConfig() });
});

apiRouter.post('/smtp-config', (req: Request, res: Response) => {
  const result = updateSmtpConfig(req.body);
  res.json({
    success: true,
    message: result.isConfigured
      ? 'Đã lưu cấu hình máy chủ SMTP thành công'
      : 'Đã lưu cấu hình SMTP (Cần đủ Host, Tài khoản và Mật khẩu)',
    data: getSmtpConfig(),
  });
});

apiRouter.post('/smtp-config/verify', async (_req: Request, res: Response) => {
  const result = await verifySmtpConnection();
  res.json(result);
});

apiRouter.post('/smtp-config/test-email', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, message: 'Vui lòng cung cấp địa chỉ email hợp lệ' });
  }
  const result = await sendTestEmail(email);
  res.json(result);
});

// Public ticket lookup for online pass
apiRouter.get('/ticket/:code', (req: Request, res: Response) => {
  const code = (req.params.code || '').trim();
  const eg = db.eventGuests.find(
    (x) => x.guest_code.toUpperCase() === code.toUpperCase() || x.qr_token === code
  );
  if (!eg) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy vé hợp lệ với mã này' });
  }
  const guest = db.guests.find((g) => g.id === eg.guest_id);
  const event = db.events.find((e) => e.id === eg.event_id);
  res.json({
    success: true,
    data: {
      eventGuest: { ...eg, guest },
      event,
    },
  });
});

// ==========================================
// 3.2 EMAIL INVITATION DISPATCH (REAL SMTP / PREVIEW)
// ==========================================

// Send single invitation
apiRouter.post('/event-guests/:id/send', async (req: Request, res: Response) => {
  const eg = db.eventGuests.find((x) => x.id === req.params.id);
  if (!eg) return res.status(404).json({ success: false, message: 'Không tìm thấy vé' });

  const guest = db.guests.find((x) => x.id === eg.guest_id);
  if (!guest || !guest.email) {
    eg.invitation_status = 'FAILED';
    eg.updated_at = new Date().toISOString();
    return res.status(400).json({ success: false, message: 'Khách mời không có email hợp lệ' });
  }

  const event = db.events.find((e) => e.id === eg.event_id);
  if (!event) return res.status(404).json({ success: false, message: 'Không tìm thấy sự kiện' });

  const template = db.emailTemplates.find((t) => t.event_id === eg.event_id) || null;
  const smtpState = getSmtpConfig();
  const enrichedEventGuest = { ...eg, guest };

  if (smtpState.isConfigured) {
    try {
      const hostUrl = req.get('origin') || `${req.protocol}://${req.get('host')}`;
      const sendResult = await sendGuestInvitationEmail(
        enrichedEventGuest,
        event,
        template,
        hostUrl
      );

      eg.invitation_status = 'SENT';
      eg.invited_at = new Date().toISOString();
      eg.updated_at = new Date().toISOString();

      return res.json({
        success: true,
        delivered: true,
        method: 'smtp',
        message: sendResult.message || `Đã gửi thư mời kèm mã QR thật đến ${guest.email} thành công!`,
        data: eg,
      });
    } catch (err: any) {
      eg.invitation_status = 'FAILED';
      eg.updated_at = new Date().toISOString();
      return res.status(500).json({
        success: false,
        delivered: false,
        error: err.message,
        message: `Lỗi gửi thư qua SMTP: ${err.message || 'Không thể gửi email'}`,
        data: eg,
      });
    }
  } else {
    // SMTP not configured on server
    // Mark as pending/sent in preview mode and notify user
    eg.invitation_status = 'SENT';
    eg.invited_at = new Date().toISOString();
    eg.updated_at = new Date().toISOString();

    return res.json({
      success: true,
      delivered: false,
      needsSmtpConfig: true,
      message: `Thư mời của ${guest.full_name} (${guest.email}) đã tạo xong! Do chưa cài đặt máy chủ SMTP, email thật chưa được phát đi vào hộp thư. Bạn có thể bấm "Cấu hình SMTP" để gửi thật hoặc bấm "Mở Gmail Web" để gửi ngay.`,
      data: eg,
    });
  }
});

// Bulk send invitations
apiRouter.post('/events/:eventId/send-bulk', async (req: Request, res: Response) => {
  const { guestIds } = req.body; // array of event_guest IDs
  const { eventId } = req.params;

  if (!Array.isArray(guestIds) || guestIds.length === 0) {
    return res.status(400).json({ success: false, message: 'Chưa chọn khách mời để gửi' });
  }

  const event = db.events.find((e) => e.id === eventId);
  if (!event) return res.status(404).json({ success: false, message: 'Không tìm thấy sự kiện' });

  const template = db.emailTemplates.find((t) => t.event_id === eventId) || null;
  const smtpState = getSmtpConfig();
  const hostUrl = req.get('origin') || `${req.protocol}://${req.get('host')}`;

  let sentCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  for (const id of guestIds) {
    const eg = db.eventGuests.find((x) => x.id === id && x.event_id === eventId);
    if (!eg) continue;

    const guest = db.guests.find((x) => x.id === eg.guest_id);
    if (!guest || !guest.email) {
      eg.invitation_status = 'FAILED';
      failedCount++;
      continue;
    }

    if (smtpState.isConfigured) {
      try {
        const enrichedEventGuest = { ...eg, guest };
        await sendGuestInvitationEmail(enrichedEventGuest, event, template, hostUrl);
        eg.invitation_status = 'SENT';
        eg.invited_at = new Date().toISOString();
        sentCount++;
      } catch (err: any) {
        eg.invitation_status = 'FAILED';
        failedCount++;
        errors.push(`${guest.email}: ${err.message}`);
      }
    } else {
      // Mock / preview mode
      eg.invitation_status = 'SENT';
      eg.invited_at = new Date().toISOString();
      sentCount++;
    }
    eg.updated_at = new Date().toISOString();
  }

  if (!smtpState.isConfigured) {
    return res.json({
      success: true,
      delivered: false,
      needsSmtpConfig: true,
      message: `Đã cập nhật trạng thái ${sentCount} khách mời! (Lưu ý: Chưa cài đặt SMTP nên email thật chưa được phát vào hộp thư)`,
      sent: sentCount,
      failed: failedCount,
    });
  }

  res.json({
    success: true,
    delivered: true,
    message: `Hoàn tất gửi qua SMTP: Thành công ${sentCount}, Thất bại ${failedCount}`,
    sent: sentCount,
    failed: failedCount,
    errors: errors.slice(0, 5),
  });
});

// Send all pending invitations
apiRouter.post('/events/:eventId/send-all-pending', async (req: Request, res: Response) => {
  const { eventId } = req.params;
  const event = db.events.find((e) => e.id === eventId);
  if (!event) return res.status(404).json({ success: false, message: 'Không tìm thấy sự kiện' });

  const pending = db.eventGuests.filter(
    (eg) => eg.event_id === eventId && eg.invitation_status !== 'SENT'
  );

  const template = db.emailTemplates.find((t) => t.event_id === eventId) || null;
  const smtpState = getSmtpConfig();
  const hostUrl = req.get('origin') || `${req.protocol}://${req.get('host')}`;

  let sentCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  for (const eg of pending) {
    const guest = db.guests.find((x) => x.id === eg.guest_id);
    if (!guest || !guest.email) {
      eg.invitation_status = 'FAILED';
      failedCount++;
      continue;
    }

    if (smtpState.isConfigured) {
      try {
        const enrichedEventGuest = { ...eg, guest };
        await sendGuestInvitationEmail(enrichedEventGuest, event, template, hostUrl);
        eg.invitation_status = 'SENT';
        eg.invited_at = new Date().toISOString();
        sentCount++;
      } catch (err: any) {
        eg.invitation_status = 'FAILED';
        failedCount++;
        errors.push(`${guest.email}: ${err.message}`);
      }
    } else {
      eg.invitation_status = 'SENT';
      eg.invited_at = new Date().toISOString();
      sentCount++;
    }
    eg.updated_at = new Date().toISOString();
  }

  if (!smtpState.isConfigured) {
    return res.json({
      success: true,
      delivered: false,
      needsSmtpConfig: true,
      message: `Đã xử lý ${pending.length} khách mời chưa gửi! (Lưu ý: Chưa cài SMTP nên email thật chưa được phát vào hộp thư)`,
      total_processed: pending.length,
      sent: sentCount,
      failed: failedCount,
    });
  }

  res.json({
    success: true,
    delivered: true,
    message: `Đã gửi qua SMTP cho ${pending.length} khách mời: Thành công ${sentCount}, Thất bại ${failedCount}`,
    total_processed: pending.length,
    sent: sentCount,
    failed: failedCount,
    errors: errors.slice(0, 5),
  });
});

// ==========================================
// 4. ATOMIC CHECK-IN ENGINE (Section 11, 12, 13)
// ==========================================
apiRouter.post('/checkin', async (req: Request, res: Response) => {
  const { event_id, qr_token, staff_id, staff_name, device_id } = req.body;

  if (!event_id || !qr_token) {
    return res.status(400).json({
      success: false,
      status: 'INVALID_QR',
      message: 'Thiếu thông tin event_id hoặc mã QR',
    });
  }

  const result = await db.processCheckin({
    eventId: event_id,
    tokenOrPayload: qr_token,
    staffId: staff_id || 'staff_gate_01',
    staffName: staff_name || 'Nhân viên Cửa 1',
    deviceId: device_id || 'mobile_device_1',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  // Return standard response format matching prompt
  res.json(result);
});

// Check-in Reset (Helper for testing/demo)
apiRouter.post('/checkin/reset', (req: Request, res: Response) => {
  const { eventGuestId, eventId } = req.body;
  if (eventGuestId) {
    const eg = db.eventGuests.find((x) => x.id === eventGuestId);
    if (eg) {
      eg.checkin_status = 'NOT_CHECKED_IN';
      eg.checked_in_at = null;
      eg.checked_in_by = null;
      eg.updated_at = new Date().toISOString();
    }
  } else if (eventId) {
    db.eventGuests.forEach((eg) => {
      if (eg.event_id === eventId) {
        eg.checkin_status = 'NOT_CHECKED_IN';
        eg.checked_in_at = null;
        eg.checked_in_by = null;
      }
    });
    // Clear logs for this event
    db.checkinLogs = db.checkinLogs.filter((l) => l.event_id !== eventId);
  }
  res.json({ success: true, message: 'Đã reset trạng thái check-in thành công' });
});

// SIMULATE CONCURRENT RACE-CONDITION (Section 13 Demonstration)
// Fires multiple parallel requests at the exact same millisecond
apiRouter.post('/checkin/test-race-condition', async (req: Request, res: Response) => {
  const { event_id, qr_token, concurrency = 2 } = req.body;

  if (!event_id || !qr_token) {
    return res.status(400).json({ success: false, message: 'Thiếu event_id hoặc qr_token' });
  }

  // First reset this guest if already checked in, to test from fresh state
  const eg = db.eventGuests.find(
    (x) => x.qr_token === qr_token || x.guest_code.toUpperCase() === qr_token.toUpperCase()
  );
  if (eg) {
    eg.checkin_status = 'NOT_CHECKED_IN';
    eg.checked_in_at = null;
    eg.checked_in_by = null;
  }

  // Fire concurrent promises simultaneously using Promise.all
  const promises = [];
  for (let i = 1; i <= concurrency; i++) {
    promises.push(
      db.processCheckin({
        eventId: event_id,
        tokenOrPayload: qr_token,
        staffId: `staff_${i}`,
        staffName: `Thiết bị Scanner ${i}`,
        deviceId: `device_concurrent_${i}`,
        ipAddress: `192.168.1.${100 + i}`,
        userAgent: `ConcurrentTester/${i}.0`,
      })
    );
  }

  const results = await Promise.all(promises);

  const successCount = results.filter((r) => r.status === 'SUCCESS').length;
  const duplicateCount = results.filter((r) => r.status === 'ALREADY_CHECKED_IN').length;

  res.json({
    success: true,
    total_concurrent_requests: concurrency,
    summary: {
      success: successCount, // Must be exactly 1!
      already_checked_in: duplicateCount, // Must be concurrency - 1!
      race_condition_passed: successCount === 1,
    },
    details: results,
  });
});

// ==========================================
// 5. DASHBOARD STATS & AUDIT LOGS
// ==========================================
apiRouter.get('/events/:eventId/stats', (req: Request, res: Response) => {
  const stats = db.getStats(req.params.eventId);
  res.json({ success: true, data: stats });
});

apiRouter.get('/events/:eventId/checkins', (req: Request, res: Response) => {
  const { eventId } = req.params;
  const resultFilter = (req.query.result as string) || '';
  const search = ((req.query.search as string) || '').trim().toLowerCase();
  const limit = parseInt(req.query.limit as string) || 100;

  let logs = db.checkinLogs.filter((l) => l.event_id === eventId);

  if (resultFilter) {
    logs = logs.filter((l) => l.result === resultFilter);
  }

  if (search) {
    logs = logs.filter(
      (l) =>
        (l.guest_name && l.guest_name.toLowerCase().includes(search)) ||
        (l.guest_org && l.guest_org.toLowerCase().includes(search)) ||
        (l.staff_name && l.staff_name.toLowerCase().includes(search)) ||
        l.qr_token.toLowerCase().includes(search)
    );
  }

  res.json({ success: true, data: logs.slice(0, limit) });
});

// SSE LIVE STREAM (Section 16: Real-time Dashboard)
apiRouter.get('/events/:eventId/stream', (req: Request, res: Response) => {
  const { eventId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (res.flushHeaders) res.flushHeaders();

  // Send initial connected ping
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', eventId })}\n\n`);

  // Keep-alive heartbeat ping every 15s to keep proxy connections alive
  const heartbeatTimer = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch {
      clearInterval(heartbeatTimer);
    }
  }, 15000);

  const unsubscribe = db.subscribeSSE(eventId, (data) => {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch {
      // client disconnected
    }
  });

  req.on('close', () => {
    clearInterval(heartbeatTimer);
    unsubscribe();
  });
});
