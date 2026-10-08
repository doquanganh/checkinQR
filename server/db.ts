import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import type {
  EventItem,
  Guest,
  EventGuest,
  CheckinLog,
  CheckinResult,
  CheckinResponse,
  CheckinStats,
  EmailTemplate,
  User,
  Role,
} from '../src/types/index.ts';
import { config } from './config.ts';
import { generateSecureToken, newId } from './crypto.ts';

const MIGRATIONS: string[] = [
  `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('ADMIN','CHECKIN_STAFF')),
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX idx_sessions_user ON sessions(user_id);

  CREATE TABLE events (
    id TEXT PRIMARY KEY,
    event_code TEXT NOT NULL UNIQUE,
    event_name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    start_at TEXT NOT NULL,
    end_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE guests (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    organization TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DISABLED')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX idx_guests_email ON guests(email);

  CREATE TABLE event_guests (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    guest_id TEXT NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    guest_code TEXT NOT NULL UNIQUE COLLATE NOCASE,
    qr_token TEXT NOT NULL UNIQUE,
    invitation_status TEXT NOT NULL DEFAULT 'PENDING',
    invited_at TEXT,
    checkin_status TEXT NOT NULL DEFAULT 'NOT_CHECKED_IN',
    checked_in_at TEXT,
    checked_in_by TEXT,
    checkin_device_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (event_id, guest_id)
  );
  CREATE INDEX idx_eg_event_checkin ON event_guests(event_id, checkin_status);
  CREATE INDEX idx_eg_event_invite ON event_guests(event_id, invitation_status);

  CREATE TABLE checkin_logs (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    event_guest_id TEXT,
    guest_id TEXT,
    guest_name TEXT,
    guest_org TEXT,
    qr_token TEXT NOT NULL,
    action TEXT NOT NULL,
    result TEXT NOT NULL,
    message TEXT NOT NULL,
    device_id TEXT NOT NULL,
    staff_id TEXT NOT NULL,
    staff_name TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    user_agent TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX idx_logs_event_time ON checkin_logs(event_id, created_at DESC);

  CREATE TABLE email_templates (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    sender_email TEXT NOT NULL,
    body TEXT NOT NULL
  );

  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
];

export function openDatabase(file: string): Database.Database {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('synchronous = NORMAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');
  // SQLite LOWER() is ASCII-only; Vietnamese search needs full Unicode lowercasing
  sqlite.function('ulower', { deterministic: true }, (s: unknown) =>
    s == null ? null : String(s).toLowerCase()
  );

  const current = sqlite.pragma('user_version', { simple: true }) as number;
  for (let v = current; v < MIGRATIONS.length; v++) {
    sqlite.transaction(() => {
      sqlite.exec(MIGRATIONS[v]);
      sqlite.pragma(`user_version = ${v + 1}`);
    })();
  }
  return sqlite;
}

const now = () => new Date().toISOString();
const like = (s: string) => `%${s.toLowerCase().replace(/[\\%_]/g, '\\$&')}%`;

export interface StoredUser extends User {
  password_hash: string;
  active: boolean;
  created_at: string;
}

export class AppDatabase {
  sqlite: Database.Database;
  private stmts = new Map<string, Database.Statement>();
  private sseClients = new Map<string, Set<(data: any) => void>>();

  constructor(file = config.dbPath) {
    this.sqlite = openDatabase(file);
  }

  private q(sql: string): Database.Statement {
    let s = this.stmts.get(sql);
    if (!s) {
      s = this.sqlite.prepare(sql);
      this.stmts.set(sql, s);
    }
    return s;
  }

  close() {
    this.sqlite.close();
  }

  // ---------------- settings ----------------
  getSetting(key: string): string | null {
    const r = this.q('SELECT value FROM settings WHERE key=?').get(key) as { value: string } | undefined;
    return r ? r.value : null;
  }

  setSetting(key: string, value: string) {
    this.q('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(
      key,
      value
    );
  }

  // ---------------- users & sessions ----------------
  private toUser(r: any): StoredUser {
    return {
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role,
      active: !!r.active,
      password_hash: r.password_hash,
      created_at: r.created_at,
    };
  }

  countUsers(): number {
    return (this.q('SELECT COUNT(*) c FROM users').get() as { c: number }).c;
  }

  countActiveAdmins(): number {
    return (this.q("SELECT COUNT(*) c FROM users WHERE role='ADMIN' AND active=1").get() as { c: number }).c;
  }

  listUsers(): StoredUser[] {
    return (this.q('SELECT * FROM users ORDER BY role, created_at').all() as any[]).map((r) => this.toUser(r));
  }

  getUserById(id: string): StoredUser | undefined {
    const r = this.q('SELECT * FROM users WHERE id=?').get(id);
    return r ? this.toUser(r) : undefined;
  }

  getUserByEmail(email: string): StoredUser | undefined {
    const r = this.q('SELECT * FROM users WHERE email=?').get(email.trim());
    return r ? this.toUser(r) : undefined;
  }

  createUser(u: { name: string; email: string; role: Role; password_hash: string }): StoredUser {
    const t = now();
    const id = newId('usr_');
    this.q(
      'INSERT INTO users(id,name,email,password_hash,role,active,created_at,updated_at) VALUES(?,?,?,?,?,1,?,?)'
    ).run(id, u.name, u.email.trim(), u.password_hash, u.role, t, t);
    return this.getUserById(id)!;
  }

  updateUser(
    id: string,
    patch: { name?: string; role?: Role; active?: boolean; password_hash?: string }
  ): StoredUser | undefined {
    const cur = this.getUserById(id);
    if (!cur) return undefined;
    this.q('UPDATE users SET name=?, role=?, active=?, password_hash=?, updated_at=? WHERE id=?').run(
      patch.name ?? cur.name,
      patch.role ?? cur.role,
      (patch.active ?? cur.active) ? 1 : 0,
      patch.password_hash ?? cur.password_hash,
      now(),
      id
    );
    return this.getUserById(id);
  }

  createSession(userId: string, tokenHash: string, expiresAt: number) {
    this.q('INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)').run(
      tokenHash,
      userId,
      expiresAt,
      now()
    );
  }

  // Resolves a session cookie hash to an active user; expired sessions are ignored
  getSessionUser(tokenHash: string): StoredUser | undefined {
    const r = this.q(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash=? AND s.expires_at > ? AND u.active=1`
    ).get(tokenHash, Date.now());
    return r ? this.toUser(r) : undefined;
  }

  deleteSession(tokenHash: string) {
    this.q('DELETE FROM sessions WHERE token_hash=?').run(tokenHash);
  }

  deleteUserSessions(userId: string) {
    this.q('DELETE FROM sessions WHERE user_id=?').run(userId);
  }

  purgeExpiredSessions() {
    this.q('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
  }

  // ---------------- events ----------------
  listEvents(): EventItem[] {
    return this.q('SELECT * FROM events ORDER BY created_at DESC, rowid ASC').all() as EventItem[];
  }

  getEvent(id: string): EventItem | undefined {
    return this.q('SELECT * FROM events WHERE id=?').get(id) as EventItem | undefined;
  }

  createEvent(d: {
    event_name: string;
    event_code: string;
    description?: string;
    location?: string;
    start_at?: string;
    end_at?: string;
    status?: EventItem['status'];
    id?: string;
    created_at?: string;
  }): EventItem {
    const id = d.id || newId('evt_');
    const t = d.created_at || now();
    this.sqlite.transaction(() => {
      this.q(
        'INSERT INTO events(id,event_code,event_name,description,location,start_at,end_at,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)'
      ).run(
        id,
        d.event_code.toUpperCase(),
        d.event_name,
        d.description || '',
        d.location || '',
        d.start_at || t,
        d.end_at || t,
        d.status || 'ACTIVE',
        t,
        t
      );
      this.q('INSERT INTO email_templates(id,event_id,subject,sender_name,sender_email,body) VALUES(?,?,?,?,?,?)').run(
        'tpl_' + id,
        id,
        'Thư mời tham dự {{EVENT_NAME}}',
        'Ban Tổ Chức',
        'event@organizer.com',
        'Kính gửi Anh/Chị {{FULL_NAME}},\n\nTrân trọng kính mời Anh/Chị tham dự {{EVENT_NAME}}.\nThời gian: {{EVENT_DATE}}\nĐịa điểm: {{EVENT_LOCATION}}\nMã khách: {{GUEST_CODE}}\n\nTrân trọng,'
      );
    })();
    return this.getEvent(id)!;
  }

  updateEvent(id: string, p: Partial<EventItem>): EventItem | undefined {
    const cur = this.getEvent(id);
    if (!cur) return undefined;
    this.q(
      'UPDATE events SET event_code=?, event_name=?, description=?, location=?, start_at=?, end_at=?, status=?, updated_at=? WHERE id=?'
    ).run(
      (p.event_code ?? cur.event_code).toUpperCase(),
      p.event_name ?? cur.event_name,
      p.description ?? cur.description,
      p.location ?? cur.location,
      p.start_at ?? cur.start_at,
      p.end_at ?? cur.end_at,
      p.status ?? cur.status,
      now(),
      id
    );
    return this.getEvent(id);
  }

  deleteEvent(id: string): boolean {
    return this.sqlite.transaction(() => {
      const info = this.q('DELETE FROM events WHERE id=?').run(id);
      this.deleteOrphanGuests();
      return info.changes > 0;
    })();
  }

  private deleteOrphanGuests() {
    this.q('DELETE FROM guests WHERE id NOT IN (SELECT guest_id FROM event_guests)').run();
  }

  // ---------------- guests ----------------
  private enrich(r: any): EventGuest {
    const {
      g_id, g_full_name, g_phone, g_email, g_organization, g_title, g_notes, g_status, g_created_at, g_updated_at,
      ...eg
    } = r;
    const guest: Guest = {
      id: g_id,
      full_name: g_full_name,
      phone: g_phone,
      email: g_email,
      organization: g_organization,
      title: g_title,
      notes: g_notes,
      status: g_status,
      created_at: g_created_at,
      updated_at: g_updated_at,
    };
    return { ...eg, guest } as EventGuest;
  }

  private static JOIN = `
    SELECT eg.*, g.id g_id, g.full_name g_full_name, g.phone g_phone, g.email g_email,
           g.organization g_organization, g.title g_title, g.notes g_notes, g.status g_status,
           g.created_at g_created_at, g.updated_at g_updated_at
    FROM event_guests eg JOIN guests g ON g.id = eg.guest_id`;

  getEventGuest(id: string): EventGuest | undefined {
    const r = this.q(`${AppDatabase.JOIN} WHERE eg.id=?`).get(id);
    return r ? this.enrich(r) : undefined;
  }

  getEventGuestByToken(token: string): EventGuest | undefined {
    const r = this.q(`${AppDatabase.JOIN} WHERE eg.qr_token=?`).get(token);
    return r ? this.enrich(r) : undefined;
  }

  listEventGuests(
    eventId: string,
    f: { search?: string; org?: string; invitation_status?: string; checkin_status?: string; page?: number; limit?: number }
  ) {
    const limit = Math.min(Math.max(f.limit || 50, 1), 500);
    const page = Math.max(f.page || 1, 1);
    const search = (f.search || '').trim();
    const params = {
      eventId,
      like: search ? like(search) : '',
      org: f.org || '',
      inv: f.invitation_status || '',
      chk: f.checkin_status || '',
    };
    const where = `WHERE eg.event_id=@eventId
      AND (@like='' OR ulower(g.full_name) LIKE @like ESCAPE '\\' OR ulower(g.email) LIKE @like ESCAPE '\\'
           OR g.phone LIKE @like ESCAPE '\\' OR ulower(g.organization) LIKE @like ESCAPE '\\'
           OR ulower(eg.guest_code) LIKE @like ESCAPE '\\')
      AND (@org='' OR g.organization=@org)
      AND (@inv='' OR eg.invitation_status=@inv)
      AND (@chk='' OR eg.checkin_status=@chk)`;
    const from = 'FROM event_guests eg JOIN guests g ON g.id = eg.guest_id';

    const total = (this.q(`SELECT COUNT(*) c ${from} ${where}`).get(params) as { c: number }).c;
    const rows = this.q(`${AppDatabase.JOIN} ${where} ORDER BY eg.rowid DESC LIMIT @limit OFFSET @offset`).all({
      ...params,
      limit,
      offset: (page - 1) * limit,
    });
    const orgs = (
      this.q(
        `SELECT DISTINCT g.organization o ${from} WHERE eg.event_id=? AND g.organization<>'' ORDER BY o`
      ).all(eventId) as { o: string }[]
    ).map((r) => r.o);

    return { data: rows.map((r) => this.enrich(r)), total, page, limit, organizations: orgs };
  }

  private nextGuestSeq(): number {
    return (this.q('SELECT COALESCE(MAX(CAST(id AS INTEGER)),0)+1 n FROM guests').get() as { n: number }).n;
  }

  private nextCodeNum(): number {
    return (
      this.q(
        "SELECT COALESCE(MAX(CAST(SUBSTR(guest_code,2) AS INTEGER)),202600000)+1 n FROM event_guests WHERE guest_code GLOB 'G[0-9]*'"
      ).get() as { n: number }
    ).n;
  }

  private insertGuestAndLink(
    eventId: string,
    guestSeq: number,
    codeNum: number,
    g: Partial<Guest>,
    link: Partial<EventGuest> = {}
  ): string {
    const id = String(guestSeq).padStart(6, '0');
    const t = now();
    this.q(
      'INSERT INTO guests(id,full_name,phone,email,organization,title,notes,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)'
    ).run(
      id,
      g.full_name,
      g.phone || '',
      g.email || '',
      g.organization || '',
      g.title || '',
      g.notes || '',
      g.status || 'ACTIVE',
      t,
      t
    );
    const egId = `eg_${id}_${eventId}`;
    this.q(
      `INSERT INTO event_guests(id,event_id,guest_id,guest_code,qr_token,invitation_status,invited_at,checkin_status,created_at,updated_at)
       VALUES(?,?,?,?,?,?,?,'NOT_CHECKED_IN',?,?)`
    ).run(
      egId,
      eventId,
      id,
      `G${codeNum}`,
      generateSecureToken(`qr_${id}_`),
      link.invitation_status || 'PENDING',
      link.invited_at || null,
      t,
      t
    );
    return egId;
  }

  addGuest(eventId: string, g: Partial<Guest>): EventGuest {
    const egId = this.sqlite.transaction(() =>
      this.insertGuestAndLink(eventId, this.nextGuestSeq(), this.nextCodeNum(), {
        ...g,
        organization: g.organization || 'Tự do',
        title: g.title || 'Khách mời',
      })
    )();
    return this.getEventGuest(egId)!;
  }

  // Link an existing guest profile to another event (used by seed)
  linkGuest(eventId: string, guestId: string, code: string, link: Partial<EventGuest> = {}) {
    const t = now();
    this.q(
      `INSERT INTO event_guests(id,event_id,guest_id,guest_code,qr_token,invitation_status,invited_at,checkin_status,created_at,updated_at)
       VALUES(?,?,?,?,?,?,?,'NOT_CHECKED_IN',?,?)`
    ).run(
      `eg_${guestId}_${eventId}`,
      eventId,
      guestId,
      code,
      generateSecureToken(`qr_${guestId}_`),
      link.invitation_status || 'PENDING',
      link.invited_at || null,
      t,
      t
    );
  }

  updateEventGuest(
    id: string,
    body: { guest?: Partial<Guest>; checkin_status?: string; checked_in_by?: string; invitation_status?: string }
  ): EventGuest | undefined {
    const eg = this.getEventGuest(id);
    if (!eg) return undefined;
    const t = now();
    this.sqlite.transaction(() => {
      const g = body.guest;
      if (g) {
        const cur = eg.guest!;
        this.q(
          'UPDATE guests SET full_name=?, phone=?, email=?, organization=?, title=?, notes=?, status=?, updated_at=? WHERE id=?'
        ).run(
          g.full_name ?? cur.full_name,
          g.phone ?? cur.phone,
          g.email ?? cur.email,
          g.organization ?? cur.organization,
          g.title ?? cur.title,
          g.notes ?? cur.notes,
          g.status === 'DISABLED' || g.status === 'ACTIVE' ? g.status : cur.status,
          t,
          cur.id
        );
      }
      if (body.checkin_status === 'CHECKED_IN') {
        this.q(
          "UPDATE event_guests SET checkin_status='CHECKED_IN', checked_in_at=COALESCE(checked_in_at,?), checked_in_by=COALESCE(checked_in_by,?), updated_at=? WHERE id=?"
        ).run(t, body.checked_in_by || 'Admin Override', t, id);
      } else if (body.checkin_status === 'NOT_CHECKED_IN') {
        this.q(
          "UPDATE event_guests SET checkin_status='NOT_CHECKED_IN', checked_in_at=NULL, checked_in_by=NULL, updated_at=? WHERE id=?"
        ).run(t, id);
      }
      if (body.invitation_status) {
        this.q(
          "UPDATE event_guests SET invitation_status=?, invited_at=CASE WHEN ?='SENT' THEN ? ELSE invited_at END, updated_at=? WHERE id=?"
        ).run(body.invitation_status, body.invitation_status, t, t, id);
      }
    })();
    return this.getEventGuest(id);
  }

  deleteEventGuest(id: string): boolean {
    return this.sqlite.transaction(() => {
      const info = this.q('DELETE FROM event_guests WHERE id=?').run(id);
      this.deleteOrphanGuests();
      return info.changes > 0;
    })();
  }

  setInvitation(id: string, status: 'SENT' | 'FAILED' | 'PENDING') {
    const t = now();
    this.q(
      "UPDATE event_guests SET invitation_status=?, invited_at=CASE WHEN ?='SENT' THEN ? ELSE invited_at END, updated_at=? WHERE id=?"
    ).run(status, status, t, t, id);
  }

  listPendingInvitations(eventId: string): EventGuest[] {
    return (
      this.q(`${AppDatabase.JOIN} WHERE eg.event_id=? AND eg.invitation_status<>'SENT' ORDER BY eg.rowid`).all(
        eventId
      ) as any[]
    ).map((r) => this.enrich(r));
  }

  importGuests(eventId: string, rows: Array<Partial<Guest>>) {
    const summary = { total_rows: rows.length, success: 0, duplicate: 0, invalid: 0 };
    const errors: Array<{ row: number; reason: string; data: any }> = [];

    this.sqlite.transaction(() => {
      const emails = new Set(
        (this.q("SELECT email FROM guests WHERE email<>''").all() as { email: string }[]).map((r) =>
          r.email.toLowerCase()
        )
      );
      let seq = this.nextGuestSeq();
      let code = this.nextCodeNum();

      rows.forEach((row, i) => {
        const name = String(row.full_name || '').trim();
        const email = String(row.email || '').trim().toLowerCase();
        if (!name) {
          summary.invalid++;
          errors.push({ row: i + 1, reason: 'Thiếu họ và tên', data: row });
          return;
        }
        if (email && emails.has(email)) {
          summary.duplicate++;
          errors.push({ row: i + 1, reason: `Email ${email} đã tồn tại trong hệ thống`, data: row });
          return;
        }
        this.insertGuestAndLink(eventId, seq++, code++, {
          full_name: name,
          phone: String(row.phone || '').trim(),
          email,
          organization: row.organization || 'Chưa phân loại',
          title: row.title || 'Khách mời',
          notes: row.notes || '',
        });
        if (email) emails.add(email);
        summary.success++;
      });
    })();

    return { summary, errors };
  }

  // 1,000+ realistic Vietnamese guests for load testing
  generateBulkGuests(eventId: string, count = 1000) {
    const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
    const ho = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý'];
    const dem = ['Văn', 'Thị', 'Đức', 'Quang', 'Hải', 'Thành', 'Minh', 'Ngọc', 'Thu', 'Anh', 'Hồng', 'Hữu', 'Phương', 'Bảo', 'Gia'];
    const ten = ['Anh', 'Bình', 'Cường', 'Dũng', 'Đạt', 'Giang', 'Hà', 'Hưng', 'Khánh', 'Linh', 'Long', 'Mai', 'Nam', 'Phong', 'Quân', 'Sơn', 'Tâm', 'Tuấn', 'Tùng', 'Vy', 'Yến'];
    const orgs = [
      'BIDV', 'BIDV Chi nhánh Hà Nội', 'BIDV Ba Đình', 'BIDV Hoàn Kiếm', 'Vietcombank', 'Techcombank', 'MBBank',
      'VPBank', 'Viettel', 'VNPT', 'FPT Telecom', 'VinGroup', 'Masan Group', 'Tập đoàn Điện lực Việt Nam',
      'Bộ Tài chính', 'Ngân hàng Nhà nước', 'Thời báo Ngân hàng', 'Tạp chí Tài chính',
    ];
    const titles = [
      'Tổng Giám Đốc', 'Phó Tổng Giám Đốc', 'Giám đốc Chi nhánh', 'Trưởng phòng Kế hoạch', 'Phó phòng QHKH',
      'Chuyên viên Cao cấp', 'Trưởng ban Kiểm soát', 'Khách mời VIP', 'Đối tác Chiến lược', 'Đại diện Báo chí',
    ];
    // ponytail: demo data only, so Math.random is fine here (tokens still use CSPRNG)
    this.sqlite.transaction(() => {
      let seq = this.nextGuestSeq();
      let code = this.nextCodeNum();
      for (let i = 1; i <= count; i++) {
        const t = pick(ten);
        const d = pick(dem);
        const sent = Math.random() > 0.3;
        this.insertGuestAndLink(
          eventId,
          seq,
          code++,
          {
            full_name: `${pick(ho)} ${d} ${t}`,
            phone: '09' + Math.floor(10000000 + Math.random() * 90000000),
            email: `${t.toLowerCase()}.${d.toLowerCase()}${seq}@example.com`,
            organization: pick(orgs),
            title: pick(titles),
            notes: i <= 10 ? 'VIP Đặc Biệt' : '',
            status: i % 100 === 0 ? 'DISABLED' : 'ACTIVE',
          },
          {
            invitation_status: sent ? 'SENT' : 'PENDING',
            invited_at: sent ? new Date(Date.now() - Math.random() * 86400000 * 3).toISOString() : null,
          }
        );
        seq++;
      }
    })();
    return { added: count, total: this.countEventGuests(eventId) };
  }

  countEventGuests(eventId: string): number {
    return (this.q('SELECT COUNT(*) c FROM event_guests WHERE event_id=?').get(eventId) as { c: number }).c;
  }

  // ---------------- email templates ----------------
  getTemplate(eventId: string): EmailTemplate | null {
    return (this.q('SELECT * FROM email_templates WHERE event_id=?').get(eventId) as EmailTemplate) || null;
  }

  saveTemplate(eventId: string, p: Partial<EmailTemplate>): EmailTemplate {
    const cur = this.getTemplate(eventId);
    const next = {
      subject: p.subject ?? cur?.subject ?? 'Thư mời tham dự sự kiện {{EVENT_NAME}}',
      sender_name: p.sender_name ?? cur?.sender_name ?? 'Ban Tổ Chức',
      sender_email: p.sender_email ?? cur?.sender_email ?? 'event@domain.vn',
      body: p.body ?? cur?.body ?? 'Kính gửi {{FULL_NAME}},\n\nTrân trọng kính mời Anh/Chị tham dự {{EVENT_NAME}}.',
    };
    this.q(
      `INSERT INTO email_templates(id,event_id,subject,sender_name,sender_email,body) VALUES(?,?,?,?,?,?)
       ON CONFLICT(event_id) DO UPDATE SET subject=excluded.subject, sender_name=excluded.sender_name,
       sender_email=excluded.sender_email, body=excluded.body`
    ).run('tpl_' + eventId, eventId, next.subject, next.sender_name, next.sender_email, next.body);
    return this.getTemplate(eventId)!;
  }

  // ---------------- realtime ----------------
  subscribeSSE(eventId: string, cb: (data: any) => void) {
    if (!this.sseClients.has(eventId)) this.sseClients.set(eventId, new Set());
    this.sseClients.get(eventId)!.add(cb);
    return () => {
      this.sseClients.get(eventId)?.delete(cb);
    };
  }

  broadcast(eventId: string, data: any) {
    this.sseClients.get(eventId)?.forEach((cb) => {
      try {
        cb(data);
      } catch (err) {
        console.error('SSE broadcast error', err);
      }
    });
  }

  closeAllSSE() {
    this.sseClients.clear();
  }

  // ---------------- stats & logs ----------------
  getStats(eventId: string): CheckinStats {
    const t = this.q(
      `SELECT COUNT(*) total,
              COALESCE(SUM(checkin_status='CHECKED_IN'),0) checked,
              COALESCE(SUM(invitation_status='SENT'),0) invited
       FROM event_guests WHERE event_id=?`
    ).get(eventId) as { total: number; checked: number; invited: number };
    const pct = (n: number) => (t.total > 0 ? Math.round((n / t.total) * 100) : 0);

    const orgs = this.q(
      `SELECT COALESCE(NULLIF(g.organization,''),'Khác') name, COUNT(*) total,
              COALESCE(SUM(eg.checkin_status='CHECKED_IN'),0) checked_in
       FROM event_guests eg JOIN guests g ON g.id=eg.guest_id
       WHERE eg.event_id=? GROUP BY name ORDER BY total DESC LIMIT 8`
    ).all(eventId) as CheckinStats['organization_breakdown'];

    // hour bucket uses the server timezone (set TZ, e.g. Asia/Ho_Chi_Minh)
    const hourly = this.q(
      `SELECT strftime('%H:00', created_at, 'localtime') hour, COUNT(*) count
       FROM checkin_logs WHERE event_id=? AND result='SUCCESS' GROUP BY hour ORDER BY hour`
    ).all(eventId) as CheckinStats['recent_checkins_hourly'];

    return {
      total_guests: t.total,
      checked_in_count: t.checked,
      not_checked_in_count: t.total - t.checked,
      checkin_percentage: pct(t.checked),
      invited_count: t.invited,
      pending_invitation_count: t.total - t.invited,
      invitation_percentage: pct(t.invited),
      organization_breakdown: orgs,
      recent_checkins_hourly: hourly,
    };
  }

  listLogs(eventId: string, f: { result?: string; search?: string; limit?: number }): CheckinLog[] {
    const limit = Math.min(Math.max(f.limit || 100, 1), 1000);
    return this.q(
      `SELECT * FROM checkin_logs WHERE event_id=@eventId
       AND (@result='' OR result=@result)
       AND (@like='' OR ulower(guest_name) LIKE @like ESCAPE '\\' OR ulower(guest_org) LIKE @like ESCAPE '\\'
            OR ulower(staff_name) LIKE @like ESCAPE '\\' OR ulower(qr_token) LIKE @like ESCAPE '\\')
       ORDER BY created_at DESC, rowid DESC LIMIT @limit`
    ).all({
      eventId,
      result: f.result || '',
      like: f.search?.trim() ? like(f.search.trim()) : '',
      limit,
    }) as CheckinLog[];
  }

  private insertLog(l: Omit<CheckinLog, 'id' | 'created_at'> & { created_at?: string }): CheckinLog {
    const log = { ...l, id: newId('log_'), created_at: l.created_at || now() } as CheckinLog;
    this.q(
      `INSERT INTO checkin_logs(id,event_id,event_guest_id,guest_id,guest_name,guest_org,qr_token,action,result,message,device_id,staff_id,staff_name,ip_address,user_agent,created_at)
       VALUES(@id,@event_id,@event_guest_id,@guest_id,@guest_name,@guest_org,@qr_token,@action,@result,@message,@device_id,@staff_id,@staff_name,@ip_address,@user_agent,@created_at)`
    ).run(log);
    return log;
  }

  resetCheckin(p: { eventGuestId?: string; eventId?: string }) {
    const t = now();
    if (p.eventGuestId) {
      this.q(
        "UPDATE event_guests SET checkin_status='NOT_CHECKED_IN', checked_in_at=NULL, checked_in_by=NULL, updated_at=? WHERE id=?"
      ).run(t, p.eventGuestId);
    } else if (p.eventId) {
      this.sqlite.transaction(() => {
        this.q(
          "UPDATE event_guests SET checkin_status='NOT_CHECKED_IN', checked_in_at=NULL, checked_in_by=NULL, updated_at=? WHERE event_id=?"
        ).run(t, p.eventId);
        this.q('DELETE FROM checkin_logs WHERE event_id=?').run(p.eventId);
      })();
    }
  }

  // ---------------- atomic check-in ----------------
  // better-sqlite3 is synchronous, so each call runs to completion; the guarded UPDATE
  // (WHERE checkin_status='NOT_CHECKED_IN') keeps it correct even across processes.
  processCheckin(params: {
    eventId: string;
    tokenOrPayload: string;
    staffId: string;
    staffName: string;
    deviceId: string;
    ipAddress?: string;
    userAgent?: string;
  }): CheckinResponse {
    const startTime = Date.now();
    const rawToken = parseQrPayload(params.tokenOrPayload);
    const meta = {
      event_id: params.eventId,
      qr_token: rawToken.slice(0, 200),
      action: 'CHECK_IN' as const,
      device_id: params.deviceId,
      staff_id: params.staffId,
      staff_name: params.staffName,
      ip_address: params.ipAddress || '127.0.0.1',
      user_agent: (params.userAgent || 'App').slice(0, 300),
    };
    const done = (r: Omit<CheckinResponse, 'duration_ms'>): CheckinResponse => ({
      ...r,
      duration_ms: Date.now() - startTime,
    });

    return this.sqlite.transaction((): CheckinResponse => {
      const row = this.q(`${AppDatabase.JOIN} WHERE eg.qr_token=@t OR eg.guest_code=@t LIMIT 1`).get({
        t: rawToken,
      });
      const fail = (result: CheckinResult, eg: EventGuest | null, message: string) => {
        const log = this.insertLog({
          ...meta,
          event_guest_id: eg?.id ?? null,
          guest_id: eg?.guest?.id ?? null,
          guest_name: eg?.guest?.full_name ?? null,
          guest_org: eg?.guest?.organization ?? null,
          result,
          message,
        });
        this.broadcast(params.eventId, { type: 'LOG_CREATED', log });
      };

      // Case 3 — invalid QR
      if (!row) {
        fail('INVALID_QR', null, 'Mã QR không tồn tại trong hệ thống hoặc đã bị thu hồi.');
        return done({
          success: false,
          status: 'INVALID_QR',
          message: '✕ INVALID QR: Mã QR không hợp lệ hoặc không tìm thấy khách mời.',
        });
      }

      const eg = this.enrich(row);
      const guest = eg.guest!;
      const info = {
        id: guest.id,
        code: eg.guest_code,
        name: guest.full_name,
        organization: guest.organization,
        title: guest.title,
        email: guest.email,
        phone: guest.phone,
      };

      // Case 4 — ticket belongs to another event
      if (eg.event_id !== params.eventId) {
        const other = this.getEvent(eg.event_id);
        fail('WRONG_EVENT', eg, `Mã QR này thuộc sự kiện khác: ${other?.event_name || eg.event_id}`);
        return done({
          success: false,
          status: 'WRONG_EVENT',
          message: `✕ WRONG EVENT: Vé của ${guest.full_name} thuộc sự kiện "${other?.event_name || 'Khác'}". Không thể check-in vào sự kiện này.`,
          guest: info,
        });
      }

      // Case 5 — guest disabled / revoked
      if (guest.status === 'DISABLED') {
        fail('GUEST_INACTIVE', eg, `Khách mời đã bị khóa hoặc thu hồi vé: ${guest.notes || 'Không rõ lý do'}`);
        return done({
          success: false,
          status: 'GUEST_INACTIVE',
          message: `✕ GUEST INACTIVE: Thẻ khách của ${guest.full_name} đã bị vô hiệu hoá (${guest.notes || 'Thẻ bị thu hồi'}).`,
          guest: { ...info, notes: guest.notes },
        });
      }

      // Case 1 — atomic claim; only one caller can flip NOT_CHECKED_IN -> CHECKED_IN
      const ts = now();
      const upd = this.q(
        `UPDATE event_guests SET checkin_status='CHECKED_IN', checked_in_at=?, checked_in_by=?, checkin_device_id=?, updated_at=?
         WHERE id=? AND checkin_status='NOT_CHECKED_IN'`
      ).run(ts, params.staffName, params.deviceId, ts, eg.id);

      // Case 2 — already checked in
      if (upd.changes === 0) {
        const cur = this.getEventGuest(eg.id)!;
        fail('ALREADY_CHECKED_IN', eg, `Đã check-in trước đó lúc ${cur.checked_in_at} bởi ${cur.checked_in_by || 'Nhân viên'}`);
        return done({
          success: false,
          status: 'ALREADY_CHECKED_IN',
          message: '⚠️ ALREADY CHECKED IN: Khách đã check-in trước đó!',
          guest: info,
          checked_in_at: cur.checked_in_at || undefined,
          checked_in_by: cur.checked_in_by || undefined,
        });
      }

      const log = this.insertLog({
        ...meta,
        event_guest_id: eg.id,
        guest_id: guest.id,
        guest_name: guest.full_name,
        guest_org: guest.organization,
        result: 'SUCCESS',
        message: 'Check-in thành công',
        created_at: ts,
      });
      this.broadcast(params.eventId, {
        type: 'CHECKIN_SUCCESS',
        eventGuestId: eg.id,
        checkedInAt: ts,
        checkedInBy: params.staffName,
        log,
      });
      return done({
        success: true,
        status: 'SUCCESS',
        message: `✓ CHECK-IN SUCCESSFUL: Chào mừng ${guest.full_name} (${guest.organization})`,
        guest: { ...info, notes: guest.notes },
        checked_in_at: ts,
        checked_in_by: params.staffName,
      });
    }).immediate();
  }
}

// Accepts: raw token / guest code, JSON {"token":..}, "GUEST:..:<token>", "EVENT:<code>|TOKEN:<token>"
export function parseQrPayload(input: string): string {
  const s = (input || '').trim();
  if (s.startsWith('{') && s.endsWith('}')) {
    try {
      const parsed = JSON.parse(s);
      if (typeof parsed.token === 'string') return parsed.token.trim();
    } catch {
      /* fall through */
    }
  }
  const pipe = s.match(/\|TOKEN:(.+)$/);
  if (pipe) return pipe[1].trim();
  if (s.startsWith('GUEST:')) return s.split(':').pop()!.trim();
  return s;
}

// Global instance (tests point DB_PATH at :memory: before importing)
export const db = new AppDatabase();
