import type {
  EventItem,
  Guest,
  EventGuest,
  CheckinLog,
  EmailTemplate,
  CheckinResult,
  CheckinResponse,
  User,
} from '../src/types/index.ts';

// Thread-safe mutex lock map for race condition prevention
class Mutex {
  private mutex = Promise.resolve();

  lock(): Promise<() => void> {
    let unlock: () => void = () => {};
    const nextLock = new Promise<void>((resolve) => {
      unlock = resolve;
    });
    const currentLock = this.mutex;
    this.mutex = currentLock.then(() => nextLock);
    return currentLock.then(() => unlock);
  }
}

const guestLocks = new Map<string, Mutex>();

function getLock(key: string): Mutex {
  let lock = guestLocks.get(key);
  if (!lock) {
    lock = new Mutex();
    guestLocks.set(key, lock);
  }
  return lock;
}

// Generate secure random alphanumeric token (unpredictable, not sequential)
export function generateSecureToken(prefix = 'tok_'): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let token = prefix;
  for (let i = 0; i < 24; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export class EventDatabase {
  events: EventItem[] = [];
  guests: Guest[] = [];
  eventGuests: EventGuest[] = [];
  checkinLogs: CheckinLog[] = [];
  emailTemplates: EmailTemplate[] = [];
  users: User[] = [];
  sseClients: Map<string, Set<(data: any) => void>> = new Map();

  constructor() {
    this.seedInitialData();
  }

  seedInitialData() {
    // Users
    this.users = [
      {
        id: 'usr_admin',
        name: 'Nguyễn Quản Trị (Admin)',
        email: 'admin@eventhub.vn',
        role: 'ADMIN',
      },
      {
        id: 'usr_staff_01',
        name: 'Trần Nhân Viên (Staff Gate 01)',
        email: 'staff01@eventhub.vn',
        role: 'CHECKIN_STAFF',
      },
      {
        id: 'usr_staff_02',
        name: 'Lê Soát Vé (Staff Gate 02)',
        email: 'staff02@eventhub.vn',
        role: 'CHECKIN_STAFF',
      },
    ];

    // Events
    this.events = [
      {
        id: 'evt_bidv_2026',
        event_code: 'EVT202610',
        event_name: 'BIDV Annual Event 2026',
        description: 'Hội nghị Tri ân Khách hàng & Tổng kết Hoạt động Thường niên BIDV 2026',
        location: 'Trung tâm Hội nghị Quốc gia, Đại lộ Thăng Long, Hà Nội',
        start_at: '2026-10-06T08:00:00+07:00',
        end_at: '2026-10-06T18:00:00+07:00',
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'evt_tech_summit',
        event_code: 'EVT202611',
        event_name: 'Vietnam Tech Innovation Summit 2026',
        description: 'Diễn đàn Đổi mới Sáng tạo & Công nghệ Trí tuệ Nhân tạo',
        location: 'Saigon Exhibition and Convention Center (SECC), Q.7, TP.HCM',
        start_at: '2026-11-15T09:00:00+07:00',
        end_at: '2026-11-15T17:30:00+07:00',
        status: 'UPCOMING',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    // Initial Sample Guests requested by user:
    // Guest 1: ID: 000001, Nguyễn Quang Anh, mr.anhdq@gmail.com, BIDV
    // Guest 2: ID: 000002, Nguyễn Ngọc Anh, ngoc.anh.btc@gmail.com, BTC
    const initialGuests: Guest[] = [
      {
        id: '000001',
        full_name: 'Nguyễn Quang Anh',
        phone: '0901234567',
        email: 'mr.anhdq@gmail.com',
        organization: 'BIDV',
        title: 'Trưởng ban Tổ chức',
        notes: 'Khách VIP - Đại biểu danh dự',
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: '000002',
        full_name: 'Nguyễn Ngọc Anh',
        phone: '0912345678',
        email: 'ngoc.anh.btc@gmail.com',
        organization: 'BTC',
        title: 'Khách mời VIP',
        notes: 'Ban Thư ký sự kiện',
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: '000003',
        full_name: 'Trần Văn Hoàng',
        phone: '0988776655',
        email: 'hoang.tv@vietcombank.com.vn',
        organization: 'Vietcombank',
        title: 'Phó Tổng Giám Đốc',
        notes: 'Khu vực VIP A1',
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: '000004',
        full_name: 'Phạm Thị Mai',
        phone: '0933221100',
        email: 'mai.pham@techcombank.com.vn',
        organization: 'Techcombank',
        title: 'Giám đốc Khối Khách hàng Doanh nghiệp',
        notes: 'Bàn số 04',
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: '000005',
        full_name: 'Đỗ Hùng Dũng',
        phone: '0977112233',
        email: 'dung.do@fpt.com.vn',
        organization: 'FPT Software',
        title: 'Trưởng đoàn Đối tác Chiến lược',
        notes: '',
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: '000006',
        full_name: 'Vũ Minh Tuấn',
        phone: '0966554433',
        email: 'tuan.vm@vnexpress.net',
        organization: 'VnExpress',
        title: 'Phóng viên Ban Kinh tế',
        notes: 'Khu vực Báo chí & Truyền thông',
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: '000007',
        full_name: 'Lê Thùy Trang (Tài khoản bị khoá)',
        phone: '0911889900',
        email: 'trang.le@inactive-corp.vn',
        organization: 'BIDV Chi nhánh Hà Thành',
        title: 'Chuyên viên QHKH',
        notes: 'Vé đã bị thu hồi do chuyển công tác',
        status: 'DISABLED', // Test Case 5: GUEST_INACTIVE
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    this.guests = initialGuests;

    // Attach Guests to Event 1 (EVT202610)
    let codeIndex = 1;
    this.guests.forEach((g) => {
      const codeStr = 'G2026' + String(codeIndex).padStart(5, '0');
      this.eventGuests.push({
        id: `eg_${g.id}_evt1`,
        event_id: 'evt_bidv_2026',
        guest_id: g.id,
        guest_code: codeStr,
        qr_token: generateSecureToken(`qr_${g.id}_`),
        invitation_status: g.id === '000001' || g.id === '000003' ? 'SENT' : 'PENDING',
        invited_at: g.id === '000001' || g.id === '000003' ? new Date(Date.now() - 3600000).toISOString() : null,
        checkin_status: 'NOT_CHECKED_IN',
        checked_in_at: null,
        checked_in_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      codeIndex++;
    });

    // Also attach Guest 1 & 2 to Event 2 to demonstrate multi-event QR isolation!
    this.eventGuests.push({
      id: `eg_000001_evt2`,
      event_id: 'evt_tech_summit',
      guest_id: '000001',
      guest_code: 'GTECH00001',
      qr_token: generateSecureToken('qr_tech_01_'),
      invitation_status: 'SENT',
      invited_at: new Date().toISOString(),
      checkin_status: 'NOT_CHECKED_IN',
      checked_in_at: null,
      checked_in_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Seed email template
    this.emailTemplates = [
      {
        id: 'tpl_bidv_2026',
        event_id: 'evt_bidv_2026',
        subject: 'Thư mời tham dự sự kiện {{EVENT_NAME}}',
        sender_name: 'Ban Tổ Chức BIDV',
        sender_email: 'event@bidv.com.vn',
        body: `Kính gửi Anh/Chị {{FULL_NAME}},

Ban Tổ chức trân trọng kính mời Anh/Chị {{FULL_NAME}} ({{ORGANIZATION}} - {{TITLE}}) tham dự sự kiện trọng thể:

{{EVENT_NAME}}

• Thời gian: {{EVENT_DATE}}
• Địa điểm: {{EVENT_LOCATION}}
• Mã số khách mời: {{GUEST_CODE}}

MÃ QR CHECK-IN CỦA QUÝ KHÁCH:
Vui lòng xuất trình mã QR đính kèm hoặc mở liên kết bên dưới tại bàn đón tiếp để hoàn tất thủ tục check-in nhanh chóng.

[QR_CODE_IMAGE]

Trân trọng,
Ban Tổ Chức BIDV`,
      },
    ];

    // Seed initial checkin log
    this.checkinLogs = [];
  }

  // SSE broadcast for real-time dashboard
  subscribeSSE(eventId: string, cb: (data: any) => void) {
    if (!this.sseClients.has(eventId)) {
      this.sseClients.set(eventId, new Set());
    }
    this.sseClients.get(eventId)!.add(cb);
    return () => {
      this.sseClients.get(eventId)?.delete(cb);
    };
  }

  broadcast(eventId: string, data: any) {
    const clients = this.sseClients.get(eventId);
    if (clients) {
      clients.forEach((cb) => {
        try {
          cb(data);
        } catch (err) {
          console.error('SSE broadcast error', err);
        }
      });
    }
  }

  // Real-time Event Stats Calculation
  getStats(eventId: string) {
    const list = this.eventGuests.filter((eg) => eg.event_id === eventId);
    const total = list.length;
    const checkedIn = list.filter((eg) => eg.checkin_status === 'CHECKED_IN').length;
    const notCheckedIn = total - checkedIn;
    const checkinPercentage = total > 0 ? Math.round((checkedIn / total) * 100) : 0;
    const invited = list.filter((eg) => eg.invitation_status === 'SENT').length;
    const pendingInvitation = total - invited;
    const invitationPercentage = total > 0 ? Math.round((invited / total) * 100) : 0;

    // Org breakdown
    const orgMap = new Map<string, { total: number; checked_in: number }>();
    list.forEach((eg) => {
      const g = this.guests.find((x) => x.id === eg.guest_id);
      const org = g?.organization || 'Khác';
      const cur = orgMap.get(org) || { total: 0, checked_in: 0 };
      cur.total++;
      if (eg.checkin_status === 'CHECKED_IN') cur.checked_in++;
      orgMap.set(org, cur);
    });

    const orgBreakdown = Array.from(orgMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    // Hourly checkin timeline
    const recentLogs = this.checkinLogs.filter(
      (l) => l.event_id === eventId && l.result === 'SUCCESS'
    );
    const hourlyMap = new Map<string, number>();
    recentLogs.forEach((l) => {
      const d = new Date(l.created_at);
      const hStr = `${String(d.getHours()).padStart(2, '0')}:00`;
      hourlyMap.set(hStr, (hourlyMap.get(hStr) || 0) + 1);
    });
    const recent_checkins_hourly = Array.from(hourlyMap.entries()).map(([hour, count]) => ({
      hour,
      count,
    }));

    return {
      total_guests: total,
      checked_in_count: checkedIn,
      not_checked_in_count: notCheckedIn,
      checkin_percentage: checkinPercentage,
      invited_count: invited,
      pending_invitation_count: pendingInvitation,
      invitation_percentage: invitationPercentage,
      organization_breakdown: orgBreakdown,
      recent_checkins_hourly,
    };
  }

  // ATOMIC CHECK-IN WITH CONCURRENCY MUTEX & RACE-CONDITION PREVENTION (Section 12 & 13)
  async processCheckin(params: {
    eventId: string;
    tokenOrPayload: string;
    staffId: string;
    staffName: string;
    deviceId: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<CheckinResponse> {
    const startTime = Date.now();
    let rawToken = params.tokenOrPayload.trim();

    // Extract token if QR payload is JSON or prefixed
    if (rawToken.startsWith('{') && rawToken.endsWith('}')) {
      try {
        const parsed = JSON.parse(rawToken);
        if (parsed.token) rawToken = parsed.token;
      } catch {
        // keep rawToken
      }
    } else if (rawToken.startsWith('GUEST:')) {
      const parts = rawToken.split(':');
      rawToken = parts[parts.length - 1];
    }

    // Acquire atomic mutex lock on the specific token to guarantee serialization
    const lock = getLock(rawToken);
    const unlock = await lock.lock();

    try {
      // Find event guest across DB by qr_token or guest_code
      const eg = this.eventGuests.find(
        (x) => x.qr_token === rawToken || x.guest_code.toUpperCase() === rawToken.toUpperCase()
      );

      // Case 3 — QR invalid
      if (!eg) {
        const log: CheckinLog = {
          id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          event_id: params.eventId,
          event_guest_id: null,
          guest_id: null,
          guest_name: null,
          guest_org: null,
          qr_token: rawToken,
          action: 'CHECK_IN',
          result: 'INVALID_QR',
          message: 'Mã QR không tồn tại trong hệ thống hoặc đã bị thu hồi.',
          device_id: params.deviceId,
          staff_id: params.staffId,
          staff_name: params.staffName,
          ip_address: params.ipAddress || '127.0.0.1',
          user_agent: params.userAgent || 'App',
          created_at: new Date().toISOString(),
        };
        this.checkinLogs.unshift(log);
        this.broadcast(params.eventId, { type: 'LOG_CREATED', log });

        return {
          success: false,
          status: 'INVALID_QR',
          message: '✕ INVALID QR: Mã QR không hợp lệ hoặc không tìm thấy khách mời.',
          duration_ms: Date.now() - startTime,
        };
      }

      // Guest details
      const guest = this.guests.find((g) => g.id === eg.guest_id);
      if (!guest) {
        return {
          success: false,
          status: 'INVALID_QR',
          message: 'Không tìm thấy hồ sơ khách mời.',
          duration_ms: Date.now() - startTime,
        };
      }

      // Case 4 — QR belongs to another event
      if (eg.event_id !== params.eventId) {
        const registeredEvent = this.events.find((e) => e.id === eg.event_id);
        const log: CheckinLog = {
          id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          event_id: params.eventId,
          event_guest_id: eg.id,
          guest_id: guest.id,
          guest_name: guest.full_name,
          guest_org: guest.organization,
          qr_token: rawToken,
          action: 'CHECK_IN',
          result: 'WRONG_EVENT',
          message: `Mã QR này thuộc sự kiện khác: ${registeredEvent?.event_name || eg.event_id}`,
          device_id: params.deviceId,
          staff_id: params.staffId,
          staff_name: params.staffName,
          ip_address: params.ipAddress || '127.0.0.1',
          user_agent: params.userAgent || 'App',
          created_at: new Date().toISOString(),
        };
        this.checkinLogs.unshift(log);
        this.broadcast(params.eventId, { type: 'LOG_CREATED', log });

        return {
          success: false,
          status: 'WRONG_EVENT',
          message: `✕ WRONG EVENT: Vé của ${guest.full_name} thuộc sự kiện "${registeredEvent?.event_name || 'Khác'}". Không thể check-in vào sự kiện này.`,
          guest: {
            id: guest.id,
            code: eg.guest_code,
            name: guest.full_name,
            organization: guest.organization,
            title: guest.title,
            email: guest.email,
            phone: guest.phone,
          },
          duration_ms: Date.now() - startTime,
        };
      }

      // Case 5 — Guest disabled / revoked
      if (guest.status === 'DISABLED') {
        const log: CheckinLog = {
          id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          event_id: params.eventId,
          event_guest_id: eg.id,
          guest_id: guest.id,
          guest_name: guest.full_name,
          guest_org: guest.organization,
          qr_token: rawToken,
          action: 'CHECK_IN',
          result: 'GUEST_INACTIVE',
          message: `Khách mời đã bị khóa hoặc thu hồi vé: ${guest.notes || 'Không rõ lý do'}`,
          device_id: params.deviceId,
          staff_id: params.staffId,
          staff_name: params.staffName,
          ip_address: params.ipAddress || '127.0.0.1',
          user_agent: params.userAgent || 'App',
          created_at: new Date().toISOString(),
        };
        this.checkinLogs.unshift(log);
        this.broadcast(params.eventId, { type: 'LOG_CREATED', log });

        return {
          success: false,
          status: 'GUEST_INACTIVE',
          message: `✕ GUEST INACTIVE: Thẻ khách của ${guest.full_name} đã bị vô hiệu hoá (${guest.notes || 'Thẻ bị thu hồi'}).`,
          guest: {
            id: guest.id,
            code: eg.guest_code,
            name: guest.full_name,
            organization: guest.organization,
            title: guest.title,
            email: guest.email,
            phone: guest.phone,
            notes: guest.notes,
          },
          duration_ms: Date.now() - startTime,
        };
      }

      // Case 2 — QR already checked in (ANTI-DUPLICATE RACE CONDITION GUARD)
      if (eg.checkin_status === 'CHECKED_IN') {
        const log: CheckinLog = {
          id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          event_id: params.eventId,
          event_guest_id: eg.id,
          guest_id: guest.id,
          guest_name: guest.full_name,
          guest_org: guest.organization,
          qr_token: rawToken,
          action: 'CHECK_IN',
          result: 'ALREADY_CHECKED_IN',
          message: `Đã check-in trước đó lúc ${eg.checked_in_at} bởi ${eg.checked_in_by || 'Nhân viên'}`,
          device_id: params.deviceId,
          staff_id: params.staffId,
          staff_name: params.staffName,
          ip_address: params.ipAddress || '127.0.0.1',
          user_agent: params.userAgent || 'App',
          created_at: new Date().toISOString(),
        };
        this.checkinLogs.unshift(log);
        this.broadcast(params.eventId, { type: 'LOG_CREATED', log });

        return {
          success: false,
          status: 'ALREADY_CHECKED_IN',
          message: `⚠️ ALREADY CHECKED IN: Khách đã check-in trước đó!`,
          guest: {
            id: guest.id,
            code: eg.guest_code,
            name: guest.full_name,
            organization: guest.organization,
            title: guest.title,
            email: guest.email,
            phone: guest.phone,
          },
          checked_in_at: eg.checked_in_at || undefined,
          checked_in_by: eg.checked_in_by || undefined,
          duration_ms: Date.now() - startTime,
        };
      }

      // Case 1 — QR valid, atomic update!
      const checkinTimestamp = new Date().toISOString();
      eg.checkin_status = 'CHECKED_IN';
      eg.checked_in_at = checkinTimestamp;
      eg.checked_in_by = params.staffName;
      eg.checkin_device_id = params.deviceId;
      eg.updated_at = checkinTimestamp;

      const log: CheckinLog = {
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        event_id: params.eventId,
        event_guest_id: eg.id,
        guest_id: guest.id,
        guest_name: guest.full_name,
        guest_org: guest.organization,
        qr_token: rawToken,
        action: 'CHECK_IN',
        result: 'SUCCESS',
        message: 'Check-in thành công',
        device_id: params.deviceId,
        staff_id: params.staffId,
        staff_name: params.staffName,
        ip_address: params.ipAddress || '127.0.0.1',
        user_agent: params.userAgent || 'App',
        created_at: checkinTimestamp,
      };
      this.checkinLogs.unshift(log);

      // Broadcast real-time update
      this.broadcast(params.eventId, {
        type: 'CHECKIN_SUCCESS',
        eventGuestId: eg.id,
        checkedInAt: checkinTimestamp,
        checkedInBy: params.staffName,
        log,
      });

      return {
        success: true,
        status: 'SUCCESS',
        message: `✓ CHECK-IN SUCCESSFUL: Chào mừng ${guest.full_name} (${guest.organization})`,
        guest: {
          id: guest.id,
          code: eg.guest_code,
          name: guest.full_name,
          organization: guest.organization,
          title: guest.title,
          email: guest.email,
          phone: guest.phone,
          notes: guest.notes,
        },
        checked_in_at: checkinTimestamp,
        checked_in_by: params.staffName,
        duration_ms: Date.now() - startTime,
      };
    } finally {
      unlock();
    }
  }

  // BULK GENERATION OF 1,000+ REALISTIC GUESTS (Performance stress-testing requirement)
  generateBulk1000Guests(eventId: string, count = 1000) {
    const ho = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý'];
    const dem = ['Văn', 'Thị', 'Đức', 'Quang', 'Hải', 'Thành', 'Minh', 'Ngọc', 'Thu', 'Anh', 'Hồng', 'Hữu', 'Phương', 'Bảo', 'Gia'];
    const ten = ['Anh', 'Bình', 'Cường', 'Dũng', 'Đạt', 'Giang', 'Hà', 'Hưng', 'Khánh', 'Linh', 'Long', 'Mai', 'Nam', 'Phong', 'Quân', 'Sơn', 'Tâm', 'Tuấn', 'Tùng', 'Vy', 'Yến'];
    const orgs = [
      'BIDV', 'BIDV Chi nhánh Hà Nội', 'BIDV Ba Đình', 'BIDV Hoàn Kiếm',
      'Vietcombank', 'Techcombank', 'MBBank', 'VPBank', 'Viettel',
      'VNPT', 'FPT Telecom', 'VinGroup', 'Masan Group', 'Tập đoàn Điện lực Việt Nam',
      'Bộ Tài chính', 'Ngân hàng Nhà nước', 'Thời báo Ngân hàng', 'Tạp chí Tài chính'
    ];
    const titles = [
      'Tổng Giám Đốc', 'Phó Tổng Giám Đốc', 'Giám đốc Chi nhánh', 'Trưởng phòng Kế hoạch',
      'Phó phòng QHKH', 'Chuyên viên Cao cấp', 'Trưởng ban Kiểm soát', 'Khách mời VIP',
      'Đối tác Chiến lược', 'Đại diện Báo chí'
    ];

    const currentMaxCode = this.eventGuests.reduce((max, eg) => {
      const num = parseInt(eg.guest_code.replace(/\D/g, ''), 10);
      return !isNaN(num) && num > max ? num : max;
    }, 202600000);

    const newGuests: Guest[] = [];
    const newEventGuests: EventGuest[] = [];

    for (let i = 1; i <= count; i++) {
      const h = ho[Math.floor(Math.random() * ho.length)];
      const d = dem[Math.floor(Math.random() * dem.length)];
      const t = ten[Math.floor(Math.random() * ten.length)];
      const fullName = `${h} ${d} ${t}`;
      const org = orgs[Math.floor(Math.random() * orgs.length)];
      const title = titles[Math.floor(Math.random() * titles.length)];
      const id = String(this.guests.length + i).padStart(6, '0');
      const phone = '09' + Math.floor(10000000 + Math.random() * 90000000);
      const email = `${t.toLowerCase()}.${d.toLowerCase()}${Math.floor(Math.random() * 999)}@gmail.com`;
      const code = `G${currentMaxCode + i}`;

      const guest: Guest = {
        id,
        full_name: fullName,
        phone,
        email,
        organization: org,
        title,
        notes: i <= 10 ? 'VIP Đặc Biệt' : '',
        status: i % 100 === 0 ? 'DISABLED' : 'ACTIVE', // 1% disabled for test cases
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const eventGuest: EventGuest = {
        id: `eg_${id}_${eventId}`,
        event_id: eventId,
        guest_id: id,
        guest_code: code,
        qr_token: generateSecureToken(`qr_${id}_`),
        invitation_status: Math.random() > 0.3 ? 'SENT' : 'PENDING',
        invited_at: Math.random() > 0.3 ? new Date(Date.now() - Math.random() * 86400000 * 3).toISOString() : null,
        checkin_status: 'NOT_CHECKED_IN',
        checked_in_at: null,
        checked_in_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      newGuests.push(guest);
      newEventGuests.push(eventGuest);
    }

    this.guests.push(...newGuests);
    this.eventGuests.push(...newEventGuests);

    return { added: count, total: this.eventGuests.filter((e) => e.event_id === eventId).length };
  }
}

// Global Singleton Database Instance
export const db = new EventDatabase();
