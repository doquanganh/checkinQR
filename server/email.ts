import nodemailer, { type Transporter } from 'nodemailer';
import QRCode from 'qrcode';
import type { EventGuest, EventItem, EmailTemplate } from '../src/types/index.ts';
import { formatQRPayload } from '../src/utils/qr.ts';
import { config } from './config.ts';
import { decryptSecret, encryptSecret } from './crypto.ts';
import { db } from './db.ts';

export interface SmtpSettings {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
}

const SETTING_KEY = 'smtp';

function envDefaults(): SmtpSettings {
  const env = process.env;
  return {
    host: env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(env.SMTP_PORT || '465', 10),
    secure: env.SMTP_SECURE === 'false' ? false : true,
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
    fromName: env.SMTP_FROM_NAME || 'Ban Tổ Chức Sự Kiện',
    fromEmail: env.SMTP_FROM || env.SMTP_USER || '',
  };
}

// Settings saved in the DB (password encrypted with APP_SECRET) win over environment defaults
function loadSettings(): SmtpSettings {
  const base = envDefaults();
  const raw = db.getSetting(SETTING_KEY);
  if (!raw) return base;
  try {
    const s = JSON.parse(raw);
    return {
      host: s.host ?? base.host,
      port: Number(s.port ?? base.port),
      secure: s.secure ?? base.secure,
      user: s.user ?? base.user,
      pass: s.pass_enc ? decryptSecret(s.pass_enc) : base.pass,
      fromName: s.fromName ?? base.fromName,
      fromEmail: s.fromEmail ?? base.fromEmail,
    };
  } catch {
    return base;
  }
}

const isConfigured = (s: SmtpSettings) => !!(s.host && s.user && s.pass);

export function getSmtpConfig() {
  const s = loadSettings();
  return {
    host: s.host,
    port: s.port,
    secure: s.secure,
    user: s.user,
    fromName: s.fromName,
    fromEmail: s.fromEmail || s.user,
    isConfigured: isConfigured(s),
  };
}

export function updateSmtpConfig(next: Partial<SmtpSettings>): { isConfigured: boolean } {
  const cur = loadSettings();
  const merged: SmtpSettings = {
    host: next.host !== undefined ? String(next.host).trim() : cur.host,
    port: next.port !== undefined ? Number(next.port) : cur.port,
    secure: next.secure !== undefined ? Boolean(next.secure) : cur.secure,
    user: next.user !== undefined ? String(next.user).trim() : cur.user,
    // blank password keeps the stored one
    pass: next.pass !== undefined && String(next.pass).trim() !== '' ? String(next.pass).trim() : cur.pass,
    fromName: next.fromName !== undefined ? String(next.fromName).trim() : cur.fromName,
    fromEmail: next.fromEmail !== undefined ? String(next.fromEmail).trim() : cur.fromEmail,
  };
  db.setSetting(
    SETTING_KEY,
    JSON.stringify({ ...merged, pass: undefined, pass_enc: merged.pass ? encryptSecret(merged.pass) : '' })
  );
  transporter?.close();
  transporter = null;
  return { isConfigured: isConfigured(merged) };
}

// One pooled transporter so bulk sends reuse connections and respect a send rate
let transporter: Transporter | null = null;

function getTransporter(): { t: Transporter; s: SmtpSettings } {
  const s = loadSettings();
  if (!isConfigured(s)) {
    throw new Error('Chưa thiết lập máy chủ SMTP (Thiếu Host, Email hoặc Mật khẩu ứng dụng)');
  }
  transporter ??= nodemailer.createTransport({
    host: s.host,
    port: s.port,
    secure: s.secure, // true for 465, false for 587
    auth: { user: s.user, pass: s.pass },
    pool: true,
    maxConnections: 2,
    maxMessages: 100,
    rateDelta: 1000,
    rateLimit: 5, // <= 5 mails/second
  });
  return { t: transporter, s };
}

const fromAddress = (s: SmtpSettings) => {
  const addr = s.fromEmail || s.user;
  return s.fromName ? `"${s.fromName.replace(/["\r\n]/g, '')}" <${addr}>` : addr;
};

const esc = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export async function verifySmtpConnection(): Promise<{ success: boolean; message: string }> {
  try {
    const { t, s } = getTransporter();
    await t.verify();
    return { success: true, message: `Kết nối máy chủ SMTP ${s.host}:${s.port} thành công!` };
  } catch (err: any) {
    return { success: false, message: `Lỗi kết nối SMTP: ${err.message || String(err)}` };
  }
}

export async function sendTestEmail(targetEmail: string): Promise<{ success: boolean; message: string }> {
  try {
    const { t, s } = getTransporter();
    const info = await t.sendMail({
      from: fromAddress(s),
      to: targetEmail,
      subject: '[Test] Thử nghiệm cấu hình gửi email từ Hệ Thống Check-in Sự Kiện',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <h2 style="color: #4f46e5; margin-top: 0;">Kiểm tra kết nối Email thành công!</h2>
          <p style="color: #334155; line-height: 1.6;">
            Xin chào, đây là email kiểm tra được gửi tự động từ <strong>Hệ Thống Quản Lý Thư Mời & Check-in Sự Kiện</strong>.
          </p>
          <div style="background: #f8fafc; border-left: 4px solid #4f46e5; padding: 12px 16px; margin: 16px 0;">
            <p style="margin: 0; color: #475569; font-size: 14px;"><strong>Máy chủ:</strong> ${esc(s.host)}:${s.port}</p>
            <p style="margin: 4px 0 0 0; color: #475569; font-size: 14px;"><strong>Tài khoản gửi:</strong> ${esc(s.user)}</p>
            <p style="margin: 4px 0 0 0; color: #475569; font-size: 14px;"><strong>Thời gian:</strong> ${new Date().toLocaleString('vi-VN')}</p>
          </div>
          <p style="color: #10b981; font-weight: bold;">
            ✓ Máy chủ email đã sẵn sàng gửi thư mời thực tế kèm mã QR đến khách mời!
          </p>
        </div>
      `,
    });
    return { success: true, message: `Đã gửi email thử nghiệm thành công đến ${targetEmail} (ID: ${info.messageId})` };
  } catch (err: any) {
    return { success: false, message: `Gửi email thử nghiệm thất bại: ${err.message || String(err)}` };
  }
}

// {{FULL_NAME}} style (README / UI) and the older {{guest_name}} style both work, case-insensitive
function render(tpl: string, vars: Record<string, string>, escape: (s: string) => string): string {
  return tpl.replace(/{{\s*([A-Za-z_]+)\s*}}/g, (m, key: string) => {
    const v = vars[key.toUpperCase()];
    return v === undefined ? m : escape(v);
  });
}

export async function sendGuestInvitationEmail(
  eventGuest: EventGuest,
  event: EventItem,
  template?: EmailTemplate | null,
  appUrl?: string
): Promise<{ success: boolean; delivered: boolean; message: string }> {
  const guest = eventGuest.guest;
  if (!guest || !guest.email) throw new Error('Khách mời không có địa chỉ email hợp lệ');

  // same JSON payload the in-app QR uses, so the scanner reads emailed codes
  const qrBuffer = await QRCode.toBuffer(formatQRPayload(event.event_code, eventGuest.qr_token), {
    width: 320,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: { dark: '#1e1b4b', light: '#ffffff' },
  });

  const guestName = guest.full_name || 'Quý Khách';
  const org = guest.organization || 'Khách mời';
  const title = guest.title || '';
  const guestCode = eventGuest.guest_code;
  const eventName = event.event_name;
  const location = event.location || 'Địa điểm thông báo sau';
  const startTime = new Date(event.start_at).toLocaleString('vi-VN', { dateStyle: 'full', timeStyle: 'short' });
  const ticketUrl = `${config.appUrl || appUrl || ''}/?ticket=${encodeURIComponent(eventGuest.qr_token)}`;

  const vars: Record<string, string> = {
    FULL_NAME: guestName,
    GUEST_NAME: guestName,
    ORGANIZATION: org,
    TITLE: title,
    EVENT_NAME: eventName,
    EVENT_DATE: startTime,
    START_TIME: startTime,
    EVENT_LOCATION: location,
    LOCATION: location,
    GUEST_CODE: guestCode,
    QR_CODE: ticketUrl,
  };

  const subject = render(
    template?.subject || '[Thư mời] {{EVENT_NAME}} - Kính gửi {{FULL_NAME}}',
    vars,
    (s) => s.replace(/[\r\n]+/g, ' ')
  );
  // guest-controlled values are HTML-escaped before they enter the email markup
  const bodyHtml = template?.body
    ? render(template.body.replace(/\[QR_CODE_IMAGE\]/g, ''), vars, esc).trim()
    : '';
  const e = { eventName: esc(eventName), guestName: esc(guestName), org: esc(org), title: esc(title), location: esc(location), startTime: esc(startTime), guestCode: esc(guestCode) };

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${esc(subject)}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f1f5f9; padding: 24px 12px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.08);">
              <tr>
                <td style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 36px 30px; text-align: center; color: #ffffff;">
                  <span style="display: inline-block; padding: 4px 12px; background: rgba(255,255,255,0.2); border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">
                    THƯ MỜI THAM DỰ CHÍNH THỨC
                  </span>
                  <h1 style="margin: 0; font-size: 24px; font-weight: 800; line-height: 1.3; color: #ffffff;">${e.eventName}</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 32px 30px 20px 30px;">
                  <h2 style="margin: 0 0 12px 0; font-size: 18px; color: #1e293b;">
                    Kính gửi: <span style="color: #4f46e5;">${e.guestName}</span>
                  </h2>
                  <p style="margin: 0 0 16px 0; color: #64748b; font-size: 14px;">${title ? e.title + ' - ' : ''}<strong>${e.org}</strong></p>
                  ${
                    bodyHtml
                      ? `<div style="color: #334155; line-height: 1.6; font-size: 15px; margin-bottom: 24px; white-space: pre-line;">${bodyHtml}</div>`
                      : `<p style="color: #334155; line-height: 1.6; font-size: 15px; margin-bottom: 24px;">
                          Ban Tổ Chức trân trọng kính mời Quý Khách tới tham dự sự kiện <strong>${e.eventName}</strong>. Dưới đây là thông tin chi tiết và vé điện tử kèm mã QR định danh của Quý Khách.
                        </p>`
                  }
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #f8fafc; border-radius: 14px; border: 1px solid #e2e8f0; margin-bottom: 24px;">
                    <tr>
                      <td style="padding: 16px 20px;">
                        <div style="padding-bottom: 6px; color: #64748b; font-size: 13px; font-weight: 600;">THỜI GIAN</div>
                        <div style="padding-bottom: 14px; color: #0f172a; font-size: 15px; font-weight: bold;">📅 ${e.startTime}</div>
                        <div style="padding-bottom: 6px; color: #64748b; font-size: 13px; font-weight: 600;">ĐỊA ĐIỂM</div>
                        <div style="color: #0f172a; font-size: 15px; font-weight: bold;">📍 ${e.location}</div>
                      </td>
                    </tr>
                  </table>
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(to bottom, #f5f3ff, #ede9fe); border-radius: 16px; border: 2px dashed #8b5cf6; margin-bottom: 24px; text-align: center;">
                    <tr>
                      <td style="padding: 24px 20px;">
                        <span style="font-size: 12px; font-weight: 700; color: #6d28d9; letter-spacing: 1px; text-transform: uppercase;">VÉ CHECK-IN ĐIỆN TỬ</span>
                        <div style="font-size: 20px; font-weight: 900; color: #1e1b4b; margin: 6px 0 16px 0; letter-spacing: 2px;">MÃ: ${e.guestCode}</div>
                        <div style="background: #ffffff; display: inline-block; padding: 12px; border-radius: 12px;">
                          <img src="cid:qrcode_ticket" alt="QR Code Check-in" width="220" height="220" style="display: block; width: 220px; height: 220px; border-radius: 8px;" />
                        </div>
                        <p style="margin: 16px 0 0 0; color: #5b21b6; font-size: 13px; font-weight: 500;">
                          Vui lòng lưu lại hình ảnh hoặc xuất trình mã QR này tại cổng check-in
                        </p>
                        ${ticketUrl.startsWith('http') ? `<p style="margin: 8px 0 0 0; font-size: 12px;"><a href="${esc(ticketUrl)}" style="color: #4f46e5;">Mở vé điện tử trên web</a></p>` : ''}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="background-color: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px;">
                  <p style="margin: 0 0 6px 0;">Thư mời được gửi tự động từ <strong>Ban Tổ Chức ${e.eventName}</strong>.</p>
                  <p style="margin: 0; color: #94a3b8;">Mọi thắc mắc xin vui lòng liên hệ Ban Tổ Chức để được hỗ trợ.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const { t, s } = getTransporter();
  const info = await t.sendMail({
    from: fromAddress(s),
    to: guest.email,
    subject,
    html: htmlContent,
    attachments: [{ filename: `ve_checkin_${guestCode}.png`, content: qrBuffer, cid: 'qrcode_ticket' }],
  });

  return {
    success: true,
    delivered: true,
    message: `Đã gửi thư mời kèm mã QR thành công đến ${guest.email} (MessageID: ${info.messageId})`,
  };
}
