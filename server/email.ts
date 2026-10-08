import nodemailer from 'nodemailer';
import QRCode from 'qrcode';
import type { EventGuest, EventItem, EmailTemplate } from '../src/types/index.ts';

export interface SmtpSettings {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
}

// In-memory SMTP configuration (initialized with env vars if available)
let currentConfig: SmtpSettings = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '465', 10),
  secure: process.env.SMTP_SECURE === 'false' ? false : true,
  user: process.env.SMTP_USER || '',
  pass: process.env.SMTP_PASS || '',
  fromName: process.env.SMTP_FROM_NAME || 'Ban Tổ Chức Sự Kiện',
  fromEmail: process.env.SMTP_FROM || process.env.SMTP_USER || '',
};

export function getSmtpConfig(): {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  fromName: string;
  fromEmail: string;
  isConfigured: boolean;
} {
  const isConfigured = !!(currentConfig.host && currentConfig.user && currentConfig.pass);
  return {
    host: currentConfig.host,
    port: currentConfig.port,
    secure: currentConfig.secure,
    user: currentConfig.user,
    fromName: currentConfig.fromName,
    fromEmail: currentConfig.fromEmail || currentConfig.user,
    isConfigured,
  };
}

export function updateSmtpConfig(newSettings: Partial<SmtpSettings>): { isConfigured: boolean } {
  if (newSettings.host !== undefined) currentConfig.host = newSettings.host.trim();
  if (newSettings.port !== undefined) currentConfig.port = Number(newSettings.port);
  if (newSettings.secure !== undefined) currentConfig.secure = Boolean(newSettings.secure);
  if (newSettings.user !== undefined) currentConfig.user = newSettings.user.trim();
  if (newSettings.pass !== undefined && newSettings.pass.trim() !== '') {
    currentConfig.pass = newSettings.pass.trim();
  }
  if (newSettings.fromName !== undefined) currentConfig.fromName = newSettings.fromName.trim();
  if (newSettings.fromEmail !== undefined) currentConfig.fromEmail = newSettings.fromEmail.trim();

  const isConfigured = !!(currentConfig.host && currentConfig.user && currentConfig.pass);
  return { isConfigured };
}

function createTransporter() {
  if (!currentConfig.host || !currentConfig.user || !currentConfig.pass) {
    throw new Error('Chưa thiết lập máy chủ SMTP (Thiếu Host, Email hoặc Mật khẩu ứng dụng)');
  }

  return nodemailer.createTransport({
    host: currentConfig.host,
    port: currentConfig.port,
    secure: currentConfig.secure, // true for 465, false for 587
    auth: {
      user: currentConfig.user,
      pass: currentConfig.pass,
    },
    // Useful for local testing/self-signed certs
    tls: {
      rejectUnauthorized: false,
    },
  });
}

export async function verifySmtpConnection(): Promise<{ success: boolean; message: string }> {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    return {
      success: true,
      message: `Kết nối máy chủ SMTP ${currentConfig.host}:${currentConfig.port} thành công!`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Lỗi kết nối SMTP: ${err.message || String(err)}`,
    };
  }
}

export async function sendTestEmail(targetEmail: string): Promise<{ success: boolean; message: string }> {
  try {
    const transporter = createTransporter();
    const fromAddr = currentConfig.fromName
      ? `"${currentConfig.fromName}" <${currentConfig.fromEmail || currentConfig.user}>`
      : currentConfig.fromEmail || currentConfig.user;

    const info = await transporter.sendMail({
      from: fromAddr,
      to: targetEmail,
      subject: '[Test] Thử nghiệm cấu hình gửi email từ Hệ Thống Check-in Sự Kiện',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <h2 style="color: #4f46e5; margin-top: 0;">Kiểm tra kết nối Email thành công!</h2>
          <p style="color: #334155; line-height: 1.6;">
            Xin chào, đây là email kiểm tra được gửi tự động từ <strong>Hệ Thống Quản Lý Thư Mời & Check-in Sự Kiện</strong>.
          </p>
          <div style="background: #f8fafc; border-left: 4px solid #4f46e5; padding: 12px 16px; margin: 16px 0;">
            <p style="margin: 0; color: #475569; font-size: 14px;"><strong>Máy chủ:</strong> ${currentConfig.host}:${currentConfig.port}</p>
            <p style="margin: 4px 0 0 0; color: #475569; font-size: 14px;"><strong>Tài khoản gửi:</strong> ${currentConfig.user}</p>
            <p style="margin: 4px 0 0 0; color: #475569; font-size: 14px;"><strong>Thời gian:</strong> ${new Date().toLocaleString('vi-VN')}</p>
          </div>
          <p style="color: #10b981; font-weight: bold;">
            ✓ Máy chủ email đã sẵn sàng gửi thư mời thực tế kèm mã QR đến khách mời!
          </p>
        </div>
      `,
    });

    return {
      success: true,
      message: `Đã gửi email thử nghiệm thành công đến ${targetEmail} (ID: ${info.messageId})`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Gửi email thử nghiệm thất bại: ${err.message || String(err)}`,
    };
  }
}

export async function sendGuestInvitationEmail(
  eventGuest: EventGuest,
  event: EventItem,
  template?: EmailTemplate | null,
  appUrl?: string
): Promise<{ success: boolean; delivered: boolean; message: string }> {
  const guest = eventGuest.guest;
  if (!guest || !guest.email) {
    throw new Error('Khách mời không có địa chỉ email hợp lệ');
  }

  // Generate QR Code Buffer
  const qrPayload = `EVENT:${event.event_code}|TOKEN:${eventGuest.qr_token}`;
  const qrBuffer = await QRCode.toBuffer(qrPayload, {
    width: 320,
    margin: 2,
    color: {
      dark: '#1e1b4b',
      light: '#ffffff',
    },
  });

  // Base64 fallback for clients not rendering cid
  const qrDataUrl = `data:image/png;base64,${qrBuffer.toString('base64')}`;

  const guestName = guest.full_name || 'Quý Khách';
  const org = guest.organization || 'Khách mời';
  const title = guest.title || '';
  const guestCode = eventGuest.guest_code;
  const eventName = event.event_name;
  const location = event.location || 'Địa điểm thông báo sau';
  const startTime = new Date(event.start_at).toLocaleString('vi-VN', {
    dateStyle: 'full',
    timeStyle: 'short',
  });

  // Replace variables in subject & body template
  let subject = template?.subject || `[Thư mời] {{event_name}} - Kính gửi {{guest_name}}`;
  subject = subject
    .replace(/{{guest_name}}/g, guestName)
    .replace(/{{event_name}}/g, eventName)
    .replace(/{{guest_code}}/g, guestCode)
    .replace(/{{organization}}/g, org)
    .replace(/{{location}}/g, location)
    .replace(/{{start_time}}/g, startTime);

  let bodyText = template?.body || '';
  if (bodyText) {
    bodyText = bodyText
      .replace(/{{guest_name}}/g, guestName)
      .replace(/{{event_name}}/g, eventName)
      .replace(/{{guest_code}}/g, guestCode)
      .replace(/{{organization}}/g, org)
      .replace(/{{title}}/g, title)
      .replace(/{{location}}/g, location)
      .replace(/{{start_time}}/g, startTime);
  }

  const ticketUrl = `${appUrl || ''}/?ticket=${guestCode}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f1f5f9; padding: 24px 12px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.08);">
              <!-- Header Banner -->
              <tr>
                <td style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 36px 30px; text-align: center; color: #ffffff;">
                  <span style="display: inline-block; padding: 4px 12px; background: rgba(255,255,255,0.2); border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">
                    THƯ MỜI THAM DỰ CHÍNH THỨC
                  </span>
                  <h1 style="margin: 0; font-size: 24px; font-weight: 800; line-height: 1.3; color: #ffffff;">
                    ${eventName}
                  </h1>
                </td>
              </tr>

              <!-- Greeting & Content -->
              <tr>
                <td style="padding: 32px 30px 20px 30px;">
                  <h2 style="margin: 0 0 12px 0; font-size: 18px; color: #1e293b;">
                    Kính gửi: <span style="color: #4f46e5;">${guestName}</span>
                  </h2>
                  ${
                    org
                      ? `<p style="margin: 0 0 16px 0; color: #64748b; font-size: 14px;">${title ? title + ' - ' : ''}<strong>${org}</strong></p>`
                      : ''
                  }
                  
                  ${
                    bodyText
                      ? `<div style="color: #334155; line-height: 1.6; font-size: 15px; margin-bottom: 24px; white-space: pre-line;">${bodyText}</div>`
                      : `<p style="color: #334155; line-height: 1.6; font-size: 15px; margin-bottom: 24px;">
                          Ban Tổ Chức trân trọng kính mời Quý Khách tới tham dự sự kiện <strong>${eventName}</strong>. Dưới đây là thông tin chi tiết và vé điện tử kèm mã QR định danh của Quý Khách.
                        </p>`
                  }

                  <!-- Event Details Box -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #f8fafc; border-radius: 14px; border: 1px solid #e2e8f0; margin-bottom: 24px;">
                    <tr>
                      <td style="padding: 16px 20px;">
                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td style="padding-bottom: 10px; color: #64748b; font-size: 13px; font-weight: 600;">
                              THỜI GIAN
                            </td>
                          </tr>
                          <tr>
                            <td style="padding-bottom: 14px; color: #0f172a; font-size: 15px; font-weight: bold;">
                              📅 ${startTime}
                            </td>
                          </tr>
                          <tr>
                            <td style="padding-bottom: 10px; color: #64748b; font-size: 13px; font-weight: 600;">
                              ĐỊA ĐIỂM
                            </td>
                          </tr>
                          <tr>
                            <td style="color: #0f172a; font-size: 15px; font-weight: bold;">
                              📍 ${location}
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>

                  <!-- QR Ticket Section -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(to bottom, #f5f3ff, #ede9fe); border-radius: 16px; border: 2px dashed #8b5cf6; margin-bottom: 24px; text-align: center;">
                    <tr>
                      <td style="padding: 24px 20px;">
                        <span style="font-size: 12px; font-weight: 700; color: #6d28d9; letter-spacing: 1px; text-transform: uppercase;">
                          VÉ CHECK-IN ĐIỆN TỬ
                        </span>
                        <div style="font-size: 20px; font-weight: 900; color: #1e1b4b; margin: 6px 0 16px 0; letter-spacing: 2px;">
                          MÃ: ${guestCode}
                        </div>
                        <div style="background: #ffffff; display: inline-block; padding: 12px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.06);">
                          <img src="cid:qrcode_ticket" alt="QR Code Check-in" width="220" height="220" style="display: block; width: 220px; height: 220px; border-radius: 8px;" />
                        </div>
                        <p style="margin: 16px 0 0 0; color: #5b21b6; font-size: 13px; font-weight: 500;">
                          Vui lòng lưu lại hình ảnh hoặc xuất trình mã QR này tại cổng check-in
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px;">
                  <p style="margin: 0 0 6px 0;">
                    Thư mời được gửi tự động từ <strong>Ban Tổ Chức ${eventName}</strong>.
                  </p>
                  <p style="margin: 0; color: #94a3b8;">
                    Mọi thắc mắc xin vui lòng liên hệ Ban Tổ Chức để được hỗ trợ.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const transporter = createTransporter();
  const fromAddr = currentConfig.fromName
    ? `"${currentConfig.fromName}" <${currentConfig.fromEmail || currentConfig.user}>`
    : currentConfig.fromEmail || currentConfig.user;

  const info = await transporter.sendMail({
    from: fromAddr,
    to: guest.email,
    subject: subject,
    html: htmlContent,
    attachments: [
      {
        filename: `ve_checkin_${guestCode}.png`,
        content: qrBuffer,
        cid: 'qrcode_ticket',
      },
    ],
  });

  return {
    success: true,
    delivered: true,
    message: `Đã gửi thư mời kèm mã QR thành công đến ${guest.email} (MessageID: ${info.messageId})`,
  };
}
