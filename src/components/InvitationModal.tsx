import React, { useEffect, useState } from 'react';
import { EventItem, EventGuest, SmtpConfig } from '../types/index.js';
import { formatQRPayload, generateQRCodeDataUrl, downloadQRCodePNG } from '../utils/qr.js';
import { api } from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.js';
import {
  X,
  Download,
  Printer,
  Send,
  Mail,
  Copy,
  Check,
  QrCode,
  Calendar,
  MapPin,
  Building,
  User,
  ExternalLink,
  Server,
  AlertCircle,
  CheckCircle2,
  Share2,
} from 'lucide-react';

interface InvitationModalProps {
  currentEvent: EventItem;
  eventGuest: EventGuest | null;
  onClose: () => void;
  onInvitationSent?: () => void;
  onOpenSmtpModal?: () => void;
}

export const InvitationModal: React.FC<InvitationModalProps> = ({
  currentEvent,
  eventGuest,
  onClose,
  onInvitationSent,
  onOpenSmtpModal,
}) => {
  const { lang, t } = useLanguage();
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResultMsg, setSendResultMsg] = useState<{
    type: 'success' | 'error' | 'warning';
    text: string;
    needsSmtp?: boolean;
  } | null>(null);
  const [smtpConfig, setSmtpConfig] = useState<SmtpConfig | null>(null);

  useEffect(() => {
    if (!eventGuest) return;
    const payload = formatQRPayload(currentEvent.event_code, eventGuest.qr_token);
    generateQRCodeDataUrl(payload, { width: 320 }).then(setQrDataUrl);

    // Check SMTP config status
    api.getSmtpConfig().then(setSmtpConfig).catch(() => {});
  }, [eventGuest, currentEvent.event_code]);

  if (!eventGuest) return null;

  const guest = eventGuest.guest;
  const qrPayload = formatQRPayload(currentEvent.event_code, eventGuest.qr_token);
  const ticketUrl = `${window.location.origin}/?ticket=${encodeURIComponent(eventGuest.qr_token)}`;

  // Download high-resolution PNG with official card banner
  const handleDownloadQR = () => {
    downloadQRCodePNG(
      qrPayload,
      `QR_${currentEvent.event_code}_${eventGuest.guest_code}_${guest?.full_name || 'Guest'}`,
      `${guest?.full_name} (${eventGuest.guest_code})`,
      lang
    );
  };

  // Print Invitation
  const handlePrint = () => {
    window.print();
  };

  // Send / Resend email via SMTP
  const handleSendEmail = async () => {
    setSending(true);
    setSendResultMsg(null);
    try {
      const res = await api.sendInvitation(eventGuest.id);
      if (res.delivered) {
        setSendResultMsg({
          type: 'success',
          text: res.message || (lang === 'vi' ? 'Đã gửi thư mời qua SMTP thành công!' : 'Invitation sent via SMTP!'),
        });
      } else if (res.needsSmtpConfig) {
        setSendResultMsg({
          type: 'warning',
          text: res.message,
          needsSmtp: true,
        });
      } else {
        setSendResultMsg({
          type: res.success ? 'success' : 'error',
          text: res.message || 'Lỗi gửi email',
        });
      }
      if (onInvitationSent) onInvitationSent();
    } catch (err: any) {
      setSendResultMsg({
        type: 'error',
        text: (lang === 'vi' ? 'Lỗi gửi email: ' : 'Error: ') + err.message,
      });
    } finally {
      setSending(false);
    }
  };

  // Open Gmail web compose in a new tab with prefilled fields
  const handleOpenGmailWeb = () => {
    const toEmail = guest?.email || '';
    const subject = `[Thư mời tham dự] ${currentEvent.event_name} - Kính gửi ${guest?.full_name || 'Quý Khách'}`;
    const body = `Kính gửi ${guest?.full_name || 'Quý Khách'},

Ban Tổ Chức trân trọng kính mời Quý Khách tới tham dự sự kiện "${currentEvent.event_name}".

THÔNG TIN SỰ KIỆN:
- Thời gian: ${new Date(currentEvent.start_at).toLocaleString('vi-VN')}
- Địa điểm: ${currentEvent.location}
- Mã khách mời: ${eventGuest.guest_code}

VÉ ĐIỆN TỬ & MÃ QR CHECK-IN:
Quý Khách vui lòng mở đường link bên dưới để xem vé điện tử và mã QR chính thức:
${ticketUrl}

Trân trọng kính mời,
Ban Tổ Chức ${currentEvent.event_name}`;

    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(toEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, '_blank');
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(eventGuest.guest_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyTicketLink = () => {
    navigator.clipboard.writeText(ticketUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 overflow-y-auto backdrop-blur-xs">
      <div className="w-full max-w-xl rounded-3xl bg-surface border border-line shadow-2xl overflow-hidden my-6">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between p-4 px-6 border-b border-line bg-surface">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-indigo-400" />
            <span className="font-bold text-sm text-fg">
              {lang === 'vi' ? 'Thư Mời & Thẻ Khách VIP:' : 'VIP Guest Invitation & Card:'} {eventGuest.guest_code}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-fg-muted hover:text-fg hover:bg-surface-2 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Official Invitation Letter Paper */}
        <div className="p-6 overflow-y-auto max-h-[75vh]">
          <div
            id="invitation-print-area"
            className="bg-white text-slate-900 rounded-2xl p-6 sm:p-8 shadow-2xl border-4 border-carbon/10 relative overflow-hidden"
          >
            {/* Top Ornamental Ribbon */}
            <div className="absolute top-0 left-0 right-0 h-3 bg-gradient-to-r from-indigo-700 via-indigo-600 to-indigo-500" />

            {/* Header */}
            <div className="text-center pb-6 border-b border-slate-200">
              <span className="text-xs font-bold tracking-widest text-carbon uppercase bg-[#f1fcee] px-3 py-1 rounded-full border border-[#cfeccb]">
                {t.officialInvitation}
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-3 tracking-tight">
                {currentEvent.event_name}
              </h1>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                {currentEvent.description}
              </p>
            </div>

            {/* Salutation & Guest Identity */}
            <div className="my-6 space-y-4 text-sm leading-relaxed">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  {t.dearGuest}
                </div>
                <div className="text-lg font-black text-carbon truncate">
                  {guest?.full_name}
                </div>
                <div className="text-xs font-semibold text-slate-700 mt-1 flex items-center gap-2 flex-wrap">
                  <span className="truncate">{guest?.organization}</span>
                  <span>•</span>
                  <span className="truncate">{guest?.title}</span>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-slate-700">
                {t.invitationGreeting}
              </p>

              {/* Event Time & Venue Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-[#f1fcee] border border-[#cfeccb] flex items-start gap-2.5">
                  <Calendar className="w-4 h-4 text-[#0b5f5e] shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-slate-800">{t.eventTimeLabel}</div>
                    <div className="text-slate-500 mt-0.5">
                      {new Date(currentEvent.start_at).toLocaleTimeString(lang === 'vi' ? 'vi-VN' : 'en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      — {new Date(currentEvent.start_at).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US')}
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#f1fcee] border border-[#cfeccb] flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-[#0b5f5e] shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-slate-800">{t.eventLocationLabel}</div>
                    <div className="text-slate-500 mt-0.5">{currentEvent.location}</div>
                  </div>
                </div>
              </div>

              {/* QR CHECK-IN SECTION (Section 7 & 8) */}
              <div className="mt-6 pt-6 border-t-2 border-dashed border-slate-300 text-center">
                <div className="inline-block p-4 rounded-2xl bg-white border-2 border-slate-300 shadow-sm">
                  <div className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">
                    {t.personalQrLabel}
                  </div>
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="Guest QR Code"
                      className="w-48 h-48 mx-auto rounded-lg shadow-xs"
                    />
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center text-slate-500">
                      {t.generatingQr}
                    </div>
                  )}
                  <div className="mt-2 font-mono font-bold text-sm text-carbon">
                    {eventGuest.guest_code}
                  </div>
                </div>

                <p className="text-xs text-slate-500 mt-3 max-w-sm mx-auto">
                  * {t.showAtGate}
                </p>
              </div>
            </div>

            {/* Footer Sign-off */}
            <div className="mt-6 pt-4 border-t border-slate-200 flex justify-between items-end text-xs text-slate-500">
              <div>
                <div>{lang === 'vi' ? 'Mã bảo mật' : 'Security Token'}: {eventGuest.qr_token.substring(0, 10)}...</div>
                <div className="text-xs text-slate-500">{lang === 'vi' ? 'Hệ thống EventCheckin Pro' : 'EventCheckin Pro System'}</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-carbon uppercase">{lang === 'vi' ? 'TRƯỞNG BAN TỔ CHỨC' : 'ORGANIZING COMMITTEE'}</div>
                <div className="text-xs text-slate-500 italic mt-6">({lang === 'vi' ? 'Đã ký duyệt' : 'Authorized'})</div>
              </div>
            </div>
          </div>

          {/* Status feedback banner */}
          {sendResultMsg && (
            <div
              className={`mt-4 p-3.5 rounded-xl border text-xs font-semibold flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-sm animate-in fade-in ${
                sendResultMsg.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-400/40 text-emerald-400'
                  : sendResultMsg.type === 'warning'
                  ? 'bg-amber-500/10 border-amber-400/40 text-amber-400'
                  : 'bg-rose-500/10 border-rose-400/40 text-rose-400'
              }`}
            >
              <div className="flex items-start sm:items-center gap-2">
                {sendResultMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5 sm:mt-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5 sm:mt-0" />
                )}
                <span>{sendResultMsg.text}</span>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                {sendResultMsg.needsSmtp && (
                  <>
                    {onOpenSmtpModal && (
                      <button
                        onClick={onOpenSmtpModal}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        <Server className="w-3 h-3" />
                        <span>{lang === 'vi' ? 'Cấu hình SMTP' : 'Setup SMTP'}</span>
                      </button>
                    )}
                    <button
                      onClick={handleOpenGmailWeb}
                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>{lang === 'vi' ? 'Mở Gmail Web' : 'Open Gmail Web'}</span>
                    </button>
                  </>
                )}
                <button
                  onClick={() => setSendResultMsg(null)}
                  className="text-fg-muted hover:text-fg p-0.5 rounded cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Action Toolbar */}
          <div className="mt-5 space-y-3">
            {/* Top row: Utilities (Print, Copy code, Copy Link, Web Gmail) */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-line">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleDownloadQR}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-sm transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{lang === 'vi' ? 'Tải ảnh QR' : 'Download QR'}</span>
                </button>

                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-fg font-semibold text-xs border border-line transition"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{lang === 'vi' ? 'In thư mời' : 'Print Letter'}</span>
                </button>

                <button
                  onClick={handleCopyTicketLink}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-fg font-semibold text-xs border border-line transition"
                  title={ticketUrl}
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-indigo-400" />}
                  <span>{copiedLink ? (lang === 'vi' ? 'Đã copy link vé!' : 'Link copied!') : (lang === 'vi' ? 'Copy link vé web' : 'Copy Ticket Link')}</span>
                </button>

                <button
                  onClick={handleCopyCode}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-fg text-xs border border-line transition"
                  title={lang === 'vi' ? 'Sao chép mã khách' : 'Copy guest code'}
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? (lang === 'vi' ? 'Đã copy!' : 'Copied!') : (lang === 'vi' ? 'Copy mã' : 'Copy code')}</span>
                </button>
              </div>

              {/* Email dispatch actions */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleOpenGmailWeb}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white font-bold text-xs shadow-sm transition"
                  title={lang === 'vi' ? 'Mở cửa sổ soạn thư Gmail cá nhân với mẫu sẵn' : 'Open personal Gmail Web compose'}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{lang === 'vi' ? 'Gửi qua Gmail Web' : 'Open Gmail Web'}</span>
                </button>

                <button
                  onClick={handleSendEmail}
                  disabled={sending}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs shadow-sm transition"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>
                    {sending
                      ? lang === 'vi' ? 'Đang gửi qua SMTP...' : 'Sending via SMTP...'
                      : lang === 'vi' ? 'Gửi Email Thật (SMTP)' : 'Send Email (SMTP)'}
                  </span>
                </button>
              </div>
            </div>

            {/* SMTP Status helper link */}
            <div className="flex items-center justify-between text-xs text-fg-muted pt-1">
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${smtpConfig?.isConfigured ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                {smtpConfig?.isConfigured
                  ? lang === 'vi'
                    ? `Máy chủ SMTP sẵn sàng (${smtpConfig.user})`
                    : `SMTP Ready (${smtpConfig.user})`
                  : lang === 'vi'
                  ? 'Chưa kết nối SMTP gửi thư tự động'
                  : 'SMTP not configured'}
              </span>
              {onOpenSmtpModal && (
                <button
                  onClick={onOpenSmtpModal}
                  className="text-indigo-400 hover:text-indigo-400 underline font-medium cursor-pointer"
                >
                  {lang === 'vi' ? '⚙ Cấu hình máy chủ SMTP' : '⚙ SMTP Settings'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
