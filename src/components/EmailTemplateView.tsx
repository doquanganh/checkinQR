import React, { useEffect, useState } from 'react';
import { EventItem, EmailTemplate } from '../types/index.js';
import { api } from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.js';
import {
  Mail,
  Save,
  Send,
  Eye,
  Sparkles,
  Info,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Loader2,
  Server,
} from 'lucide-react';
import { SmtpConfig } from '../types/index.js';
import { formatQRPayload, generateQRCodeDataUrl } from '../utils/qr.js';

interface EmailTemplateViewProps {
  currentEvent: EventItem;
  onRefreshData?: () => void;
  onOpenSmtpModal?: () => void;
}

export const EmailTemplateView: React.FC<EmailTemplateViewProps> = ({
  currentEvent,
  onRefreshData,
  onOpenSmtpModal,
}) => {
  const { lang, t } = useLanguage();
  const [template, setTemplate] = useState<EmailTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingAll, setSendingAll] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [isConfirmSendAllOpen, setIsConfirmSendAllOpen] = useState(false);
  const [saveNotice, setSaveNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [smtpConfig, setSmtpConfig] = useState<SmtpConfig | null>(null);
  const [previewQr, setPreviewQr] = useState('');

  // The preview shows a real, scannable-looking QR (sample token) instead of a fake placeholder
  useEffect(() => {
    generateQRCodeDataUrl(formatQRPayload(currentEvent.event_code, 'SAMPLE_PREVIEW'), { width: 224 }).then(setPreviewQr);
  }, [currentEvent.event_code]);

  // Sample guest for live preview
  const sampleGuest = {
    full_name: lang === 'vi' ? 'Nguyễn Quang Anh' : 'Alexander Wright',
    organization: lang === 'vi' ? 'BIDV' : 'TechCorp Global',
    title: lang === 'vi' ? 'Trưởng ban Tổ chức' : 'Director of Technology',
    guest_code: 'G202600001',
    qr_token: 'tok_sample_bidv_001',
  };

  const loadTemplate = async () => {
    setLoading(true);
    try {
      const [data, smtp] = await Promise.all([
        api.getEmailTemplate(currentEvent.id),
        api.getSmtpConfig().catch(() => null),
      ]);
      setTemplate(data);
      if (smtp) setSmtpConfig(smtp);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplate();
  }, [currentEvent.id]);

  const handleSave = async () => {
    if (!template) return;
    setSaving(true);
    setSaveNotice(null);
    try {
      await api.updateEmailTemplate(currentEvent.id, template);
      setSaveNotice({ type: 'success', text: t.saveSuccess });
      setTimeout(() => setSaveNotice(null), 4000);
    } catch (err: any) {
      setSaveNotice({ type: 'error', text: (lang === 'vi' ? 'Lỗi lưu: ' : 'Save error: ') + err.message });
      setTimeout(() => setSaveNotice(null), 5000);
    } finally {
      setSaving(false);
    }
  };

  const handleSendAllPending = () => {
    setIsConfirmSendAllOpen(true);
  };

  const executeSendAllPending = async () => {
    setSendingAll(true);
    setSendResult(null);
    setIsConfirmSendAllOpen(false);
    try {
      const res = await api.sendAllPending(currentEvent.id);
      setSendResult(res.message);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      setSendResult((lang === 'vi' ? 'Lỗi: ' : 'Error: ') + err.message);
    } finally {
      setSendingAll(false);
    }
  };

  // Helper to insert variable tags
  const insertTag = (tag: string) => {
    if (!template) return;
    setTemplate({
      ...template,
      body: template.body + ` {{${tag}}}`,
    });
  };

  // Render preview with sample variables substituted
  const renderPreview = () => {
    if (!template) return '';
    return template.body
      .replace(/{{FULL_NAME}}/g, sampleGuest.full_name)
      .replace(/{{ORGANIZATION}}/g, sampleGuest.organization)
      .replace(/{{TITLE}}/g, sampleGuest.title)
      .replace(/{{EVENT_NAME}}/g, currentEvent.event_name)
      .replace(
        /{{EVENT_DATE}}/g,
        new Date(currentEvent.start_at).toLocaleDateString('vi-VN') +
          ' ' +
          new Date(currentEvent.start_at).toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
          })
      )
      .replace(/{{EVENT_LOCATION}}/g, currentEvent.location)
      .replace(/{{GUEST_CODE}}/g, sampleGuest.guest_code);
  };

  if (loading || !template) {
    return (
      <div className="flex items-center justify-center min-h-[350px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    );
  }

  const variables = [
    { tag: 'FULL_NAME', label: t.tagFullName },
    { tag: 'ORGANIZATION', label: t.tagOrg },
    { tag: 'TITLE', label: t.tagTitle },
    { tag: 'EVENT_NAME', label: t.tagEventName },
    { tag: 'EVENT_DATE', label: t.tagTime },
    { tag: 'EVENT_LOCATION', label: t.tagLocation },
    { tag: 'GUEST_CODE', label: t.tagGuestCode },
    { tag: 'QR_CODE', label: t.tagQrUrl },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface/90 p-5 rounded-2xl border border-line shadow-sm">
        <div>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <h2 className="text-lg font-black text-fg flex items-center gap-2">
              <Mail className="w-5 h-5 text-indigo-400 shrink-0" />
              <span>{t.invitationTitle}</span>
            </h2>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap shrink-0 max-w-full ${
                smtpConfig?.isConfigured
                  ? 'bg-emerald-500/10 border-emerald-400/40 text-emerald-400'
                  : 'bg-amber-500/10 border-amber-400/40 text-amber-400'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${smtpConfig?.isConfigured ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              {smtpConfig?.isConfigured
                ? lang === 'vi'
                  ? `SMTP: ${smtpConfig.user}`
                  : `SMTP: ${smtpConfig.user}`
                : lang === 'vi'
                ? 'Chưa kết nối SMTP'
                : 'No SMTP'}
            </span>
          </div>
          <p className="text-xs text-fg-muted mt-1">
            {t.invitationDesc}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenSmtpModal && (
            <button
              onClick={onOpenSmtpModal}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-surface-2 hover:bg-surface-3 border border-line text-amber-400 font-bold text-xs shadow-sm transition"
            >
              <Server className="w-3.5 h-3.5 text-amber-400" />
              <span>{lang === 'vi' ? 'Cài Đặt SMTP' : 'SMTP Settings'}</span>
            </button>
          )}

          <button
            onClick={handleSendAllPending}
            disabled={sendingAll}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition"
          >
            <Send className="w-4 h-4" />
            <span>{sendingAll ? (lang === 'vi' ? 'Đang gửi...' : 'Sending...') : t.btnSendAllPending}</span>
          </button>
        </div>
      </div>

      {sendResult && (
        <div className="p-4 rounded-xl bg-indigo-950/60 border border-indigo-400/40 text-xs text-indigo-400 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{sendResult}</span>
        </div>
      )}

      {/* Editor & Live Preview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Template Editor */}
        <div className="rounded-2xl bg-surface/90 border border-line p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-fg flex items-center gap-2">
            <span>{lang === 'vi' ? 'Trình Soạn Thảo Mẫu Email' : 'Email Template Editor'}</span>
          </h3>

          <div>
            <label className="block text-xs font-semibold text-fg mb-1">
              {lang === 'vi' ? 'Tiêu đề Email (Subject)' : 'Email Subject'}
            </label>
            <input
              type="text"
              value={template.subject}
              onChange={(e) => setTemplate({ ...template, subject: e.target.value })}
              className="w-full rounded-xl bg-surface border border-line px-3.5 py-2.5 text-xs text-fg focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-fg mb-1">
                {lang === 'vi' ? 'Tên Người gửi' : 'Sender Name'}
              </label>
              <input
                type="text"
                value={template.sender_name}
                onChange={(e) => setTemplate({ ...template, sender_name: e.target.value })}
                className="w-full rounded-xl bg-surface border border-line px-3.5 py-2 text-xs text-fg focus:outline-hidden focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-fg mb-1">
                {lang === 'vi' ? 'Email hiển thị (xem trước)' : 'Display email (preview only)'}
              </label>
              <input
                type="text"
                value={template.sender_email}
                onChange={(e) => setTemplate({ ...template, sender_email: e.target.value })}
                className="w-full rounded-xl bg-surface border border-line px-3.5 py-2 text-xs text-fg focus:outline-hidden focus:border-indigo-500"
              />
            </div>
          </div>
          <p className="-mt-2 text-xs leading-relaxed text-fg-muted">
            {lang === 'vi'
              ? `Ô email chỉ dùng để hiển thị trong khung xem trước. Thư thật luôn gửi từ tài khoản SMTP đã cài${
                  smtpConfig?.isConfigured && smtpConfig.fromEmail ? ` (${smtpConfig.fromEmail})` : ''
                }.`
              : `The email box is only shown in the preview. Real mail is always sent from the configured SMTP account${
                  smtpConfig?.isConfigured && smtpConfig.fromEmail ? ` (${smtpConfig.fromEmail})` : ''
                }.`}
          </p>

          {/* Quick Insert Variables */}
          <div>
            <label className="block text-xs font-semibold text-fg-muted mb-1.5 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>{lang === 'vi' ? 'Chèn biến tự động (Click để thêm vào thư):' : 'Dynamic Variables (Click to insert):'}</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {variables.map((v) => (
                <button
                  key={v.tag}
                  type="button"
                  onClick={() => insertTag(v.tag)}
                  className="px-2 py-1 rounded-lg bg-surface-2 hover:bg-surface-3 border border-line text-indigo-400 font-mono text-xs transition cursor-pointer"
                  title={v.label}
                >
                  +{`{{${v.tag}}}`}
                </button>
              ))}
            </div>
          </div>

          {/* Body Editor */}
          <div>
            <label className="block text-xs font-semibold text-fg mb-1">
              {lang === 'vi' ? 'Nội dung Thư mời (Body Text)' : 'Invitation Body Text'}
            </label>
            <textarea
              rows={12}
              value={template.body}
              onChange={(e) => setTemplate({ ...template, body: e.target.value })}
              className="w-full rounded-xl bg-surface border border-line p-3.5 text-xs text-fg font-mono focus:outline-hidden focus:border-indigo-500 leading-relaxed"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-sm transition cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>
              {saving
                ? lang === 'vi' ? 'Đang lưu...' : 'Saving...'
                : lang === 'vi' ? 'Lưu Cấu Hình Mẫu Email' : 'Save Email Template'}
            </span>
          </button>

          {saveNotice && (
            <div
              className={`p-3 rounded-xl border text-xs font-semibold text-center animate-in fade-in ${
                saveNotice.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-400/40 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-400/40 text-rose-400'
              }`}
            >
              {saveNotice.text}
            </div>
          )}
        </div>

        {/* Right: Live Interactive Preview */}
        <div className="rounded-2xl bg-surface/90 border border-line p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-fg flex items-center gap-2">
                <Eye className="w-4 h-4 text-indigo-400" /> {lang === 'vi' ? 'Xem Trước Thư Gửi Khách (Preview Live)' : 'Live Invitation Preview'}
              </h3>
              <span className="text-xs text-fg-muted">
                {lang === 'vi' ? 'Hiển thị với:' : 'Preview for:'} <strong>{sampleGuest.full_name}</strong>
              </span>
            </div>

            {/* Email Client Mockup Window */}
            <div className="rounded-2xl bg-white text-slate-900 overflow-hidden shadow-sm border border-slate-200">
              {/* Fake Email Header */}
              <div className="p-4 bg-slate-100 border-b border-slate-200 text-xs space-y-1.5 text-slate-500">
                <div>
                  <strong className="text-slate-800">{lang === 'vi' ? 'Từ:' : 'From:'}</strong> {template.sender_name} &lt;
                  {template.sender_email}&gt;
                </div>
                <div>
                  <strong className="text-slate-800">{lang === 'vi' ? 'Đến:' : 'To:'}</strong> {sampleGuest.full_name} &lt;
                  mr.anhdq@gmail.com&gt;
                </div>
                <div>
                  <strong className="text-slate-800">{lang === 'vi' ? 'Tiêu đề:' : 'Subject:'}</strong>{' '}
                  <span className="font-bold text-carbon">
                    {template.subject.replace(/{{EVENT_NAME}}/g, currentEvent.event_name)}
                  </span>
                </div>
              </div>

              {/* Email Content Body */}
              <div className="p-6 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed font-sans">
                {renderPreview()}

                {/* Rendered Mock QR in Email */}
                <div className="my-5 p-4 rounded-xl bg-slate-50 border border-slate-200 text-center max-w-xs mx-auto">
                  <div className="w-36 h-36 bg-white flex items-center justify-center rounded-lg mx-auto p-1.5 border border-slate-200">
                    {previewQr ? (
                      <img src={previewQr} alt="QR" className="w-full h-full" />
                    ) : (
                      <div className="w-full h-full bg-slate-100 animate-pulse rounded" />
                    )}
                  </div>
                  <div className="mt-2 font-mono font-bold text-xs text-carbon">
                    {sampleGuest.guest_code}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {lang === 'vi' ? 'Mã QR Check-in đính kèm' : 'Attached Check-in QR Code'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 rounded-xl bg-surface border border-line text-xs text-fg-muted flex items-center gap-2">
            <Info className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>
              {lang === 'vi'
                ? 'Hệ thống chống gửi trùng lặp: các khách đã ở trạng thái SENT sẽ không bị gửi lại trừ khi bạn chủ động chọn gửi lại ở danh sách khách mời.'
                : 'Anti-duplicate protection: Guests already in SENT status will not be re-sent unless explicitly re-triggered from the guest list.'}
            </span>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Send All Pending */}
      {isConfirmSendAllOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="bg-surface border border-line/80 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-400/40 flex items-center justify-center text-indigo-400 shrink-0 shadow-sm">
                <Send className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-fg">
                  {lang === 'vi' ? 'Gửi Thư Mời Cho Tất Cả Khách Chưa Gửi' : 'Send All Pending Invitations'}
                </h3>
                <p className="text-xs text-fg-muted mt-1">
                  {t.confirmSendAll}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setIsConfirmSendAllOpen(false)}
                disabled={sendingAll}
                className="px-4 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-fg text-xs font-semibold transition cursor-pointer"
              >
                {lang === 'vi' ? 'Hủy' : 'Cancel'}
              </button>
              <button
                onClick={executeSendAllPending}
                disabled={sendingAll}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition cursor-pointer"
              >
                {sendingAll ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{lang === 'vi' ? 'Đang gửi...' : 'Sending...'}</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>{lang === 'vi' ? 'Xác Nhận & Gửi' : 'Confirm & Send'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
