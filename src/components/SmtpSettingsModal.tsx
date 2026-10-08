import React, { useState, useEffect } from 'react';
import { SmtpConfig } from '../types/index.js';
import { api } from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.js';
import {
  X,
  Mail,
  Server,
  Key,
  ShieldCheck,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  HelpCircle,
  Sparkles,
} from 'lucide-react';

interface SmtpSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigUpdated?: () => void;
}

export const SmtpSettingsModal: React.FC<SmtpSettingsModalProps> = ({
  isOpen,
  onClose,
  onConfigUpdated,
}) => {
  const { lang } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  const [host, setHost] = useState('smtp.gmail.com');
  const [port, setPort] = useState(465);
  const [secure, setSecure] = useState(true);
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [fromName, setFromName] = useState('Ban Tổ Chức Sự Kiện');
  const [fromEmail, setFromEmail] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);

  const [testEmailTarget, setTestEmailTarget] = useState('');
  const [verifyNotice, setVerifyNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testNotice, setTestNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    loadConfig();
  }, [isOpen]);

  const loadConfig = async () => {
    setLoading(true);
    setVerifyNotice(null);
    setTestNotice(null);
    try {
      const cfg = await api.getSmtpConfig();
      if (cfg) {
        setHost(cfg.host || 'smtp.gmail.com');
        setPort(cfg.port || 465);
        setSecure(cfg.secure !== false);
        setUser(cfg.user || '');
        setFromName(cfg.fromName || 'Ban Tổ Chức Sự Kiện');
        setFromEmail(cfg.fromEmail || cfg.user || '');
        setIsConfigured(cfg.isConfigured);
        if (cfg.user) setTestEmailTarget(cfg.user);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleApplyPreset = (preset: 'gmail' | 'brevo' | 'sendgrid') => {
    if (preset === 'gmail') {
      setHost('smtp.gmail.com');
      setPort(465);
      setSecure(true);
      setShowGuide(true);
    } else if (preset === 'brevo') {
      setHost('smtp-relay.brevo.com');
      setPort(587);
      setSecure(false);
    } else if (preset === 'sendgrid') {
      setHost('smtp.sendgrid.net');
      setPort(587);
      setSecure(false);
      setUser('apikey');
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setVerifyNotice(null);
    try {
      const res = await api.updateSmtpConfig({
        host,
        port: Number(port),
        secure,
        user,
        pass,
        fromName,
        fromEmail: fromEmail || user,
      });
      setIsConfigured(res.data.isConfigured);
      setVerifyNotice({
        type: 'success',
        text: lang === 'vi' ? 'Đã lưu cấu hình máy chủ SMTP!' : 'SMTP settings saved!',
      });
      if (onConfigUpdated) onConfigUpdated();
    } catch (err: any) {
      setVerifyNotice({
        type: 'error',
        text: (lang === 'vi' ? 'Lỗi lưu: ' : 'Save error: ') + err.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async () => {
    // Save first to apply current inputs
    await handleSave();
    setVerifying(true);
    setVerifyNotice(null);
    try {
      const res = await api.verifySmtp();
      setVerifyNotice({
        type: res.success ? 'success' : 'error',
        text: res.message,
      });
    } catch (err: any) {
      setVerifyNotice({
        type: 'error',
        text: err.message || 'Lỗi kiểm tra kết nối',
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleSendTest = async () => {
    if (!testEmailTarget) {
      setTestNotice({
        type: 'error',
        text: lang === 'vi' ? 'Vui lòng nhập địa chỉ email nhận thư thử nghiệm' : 'Please enter test recipient email',
      });
      return;
    }
    setSendingTest(true);
    setTestNotice(null);
    try {
      const res = await api.sendTestEmail(testEmailTarget);
      setTestNotice({
        type: res.success ? 'success' : 'error',
        text: res.message,
      });
    } catch (err: any) {
      setTestNotice({
        type: 'error',
        text: err.message || 'Lỗi gửi email thử nghiệm',
      });
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-2xl rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden my-6">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 px-6 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                {lang === 'vi' ? 'Cấu Hình Máy Chủ Email (SMTP)' : 'Email Server Settings (SMTP)'}
              </h3>
              <p className="text-xs text-slate-400">
                {lang === 'vi'
                  ? 'Gửi thư mời kèm mã QR thật vào hộp thư khách mời'
                  : 'Dispatch real invitation emails with QR code tickets'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[78vh] overflow-y-auto">
          {/* Status Indicator Banner */}
          <div
            className={`p-4 rounded-2xl border flex items-start gap-3 ${
              isConfigured
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                : 'bg-amber-950/40 border-amber-500/30 text-amber-300'
            }`}
          >
            {isConfigured ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />
            )}
            <div className="text-xs sm:text-sm">
              <span className="font-bold">
                {isConfigured
                  ? lang === 'vi'
                    ? 'Máy chủ SMTP đã được cấu hình sẵn sàng!'
                    : 'SMTP Server is configured & ready!'
                  : lang === 'vi'
                  ? 'Chưa cấu hình máy chủ SMTP gửi thư thật'
                  : 'SMTP Server is not yet configured for live email'}
              </span>
              <p className="text-xs opacity-90 mt-1">
                {isConfigured
                  ? lang === 'vi'
                    ? `Email người gửi: ${user}. Mọi thư mời khi bấm gửi sẽ được chuyển trực tiếp vào hòm thư khách mời.`
                    : `Sender email: ${user}. All invitations will be delivered directly to real guest inboxes.`
                  : lang === 'vi'
                  ? 'Để gửi thư mời thật đến Gmail/Yahoo/Outlook của khách, vui lòng điền thông tin SMTP bên dưới (Hỗ trợ tốt nhất qua Gmail Mật khẩu ứng dụng).'
                  : 'To dispatch real emails with QR codes, please configure your SMTP credentials below.'}
              </p>
            </div>
          </div>

          {/* Quick Presets */}
          <div>
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
              {lang === 'vi' ? 'Chọn nhanh nhà cung cấp:' : 'Quick Provider Presets:'}
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => handleApplyPreset('gmail')}
                className="p-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-indigo-600/20 hover:border-indigo-500/50 text-xs font-medium text-slate-200 hover:text-white transition flex items-center justify-center gap-1.5"
              >
                <span className="text-red-400 font-bold">G</span> Gmail / Google
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('brevo')}
                className="p-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-indigo-600/20 hover:border-indigo-500/50 text-xs font-medium text-slate-200 hover:text-white transition flex items-center justify-center gap-1.5"
              >
                <span className="text-blue-400 font-bold">B</span> Brevo (Sendinblue)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('sendgrid')}
                className="p-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-indigo-600/20 hover:border-indigo-500/50 text-xs font-medium text-slate-200 hover:text-white transition flex items-center justify-center gap-1.5"
              >
                <span className="text-teal-400 font-bold">S</span> SendGrid
              </button>
            </div>
          </div>

          {/* Gmail App Password Instruction Guide */}
          <div className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-4 text-xs text-slate-300">
            <button
              type="button"
              onClick={() => setShowGuide(!showGuide)}
              className="w-full flex items-center justify-between text-indigo-400 font-semibold hover:text-indigo-300"
            >
              <span className="flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4" />
                {lang === 'vi'
                  ? 'Hướng dẫn tạo Mật khẩu ứng dụng Gmail (1 phút)'
                  : 'How to create a Gmail App Password (1 minute)'}
              </span>
              <span>{showGuide ? '▲ Đóng' : '▼ Xem chi tiết'}</span>
            </button>
            {showGuide && (
              <div className="mt-3 pt-3 border-t border-slate-700 space-y-2 text-slate-300 leading-relaxed">
                <p>
                  1. Đăng nhập tài khoản Google của bạn tại{' '}
                  <a
                    href="https://myaccount.google.com/security"
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-400 underline inline-flex items-center gap-0.5"
                  >
                    Bảo mật Google <ExternalLink className="w-3 h-3" />
                  </a>
                  .
                </p>
                <p>2. Đảm bảo đã bật <strong>Xác minh 2 bước</strong> (2-Step Verification).</p>
                <p>
                  3. Vào trang{' '}
                  <a
                    href="https://myaccount.google.com/apppasswords"
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-400 underline inline-flex items-center gap-0.5"
                  >
                    Mật khẩu ứng dụng <ExternalLink className="w-3 h-3" />
                  </a>
                  .
                </p>
                <p>
                  4. Đặt tên ứng dụng (ví dụ: <code>Checkin Event</code>) và bấm <strong>Tạo</strong>.
                </p>
                <p>
                  5. Google sẽ cấp mã 16 ký tự (ví dụ: <code>abcd efgh ijkl mnop</code>). Hãy sao chép và dán vào ô <strong>Mật khẩu ứng dụng</strong> bên dưới.
                </p>
              </div>
            )}
          </div>

          {/* Form Fields */}
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {lang === 'vi' ? 'Máy chủ SMTP (Host):' : 'SMTP Host:'}
                </label>
                <input
                  type="text"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="smtp.gmail.com"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {lang === 'vi' ? 'Cổng (Port):' : 'Port:'}
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    value={port}
                    onChange={(e) => setPort(Number(e.target.value))}
                    placeholder="465"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    required
                  />
                  <label className="flex items-center gap-1.5 text-xs text-slate-300 shrink-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={secure}
                      onChange={(e) => setSecure(e.target.checked)}
                      className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                    />
                    SSL/TLS
                  </label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {lang === 'vi' ? 'Tài khoản / Email đăng nhập:' : 'Username / Email:'}
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={user}
                    onChange={(e) => {
                      setUser(e.target.value);
                      if (!fromEmail) setFromEmail(e.target.value);
                    }}
                    placeholder="ban_to_chuc@gmail.com"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    required
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {lang === 'vi' ? 'Mật khẩu ứng dụng (App Password):' : 'App Password:'}
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                    placeholder={isConfigured ? '•••••••••••••••• (Đã lưu)' : '16 ký tự mã ứng dụng'}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                  <Key className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {lang === 'vi' ? 'Tên hiển thị người gửi:' : 'Sender Display Name:'}
                </label>
                <input
                  type="text"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  placeholder="Ban Tổ Chức Sự Kiện"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {lang === 'vi' ? 'Email người gửi (From Email):' : 'From Email Address:'}
                </label>
                <input
                  type="email"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  placeholder={user || 'noreply@domain.com'}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Verification Notice */}
            {verifyNotice && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  verifyNotice.type === 'success'
                    ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/60 border border-rose-500/40 text-rose-300'
                }`}
              >
                {verifyNotice.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                )}
                <span>{verifyNotice.text}</span>
              </div>
            )}

            {/* Action Buttons for Saving & Verification */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 px-4 rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-50"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {lang === 'vi' ? 'Lưu Cấu Hình SMTP' : 'Save SMTP Settings'}
              </button>

              <button
                type="button"
                onClick={handleVerify}
                disabled={verifying || saving}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium py-2.5 px-4 rounded-xl text-sm border border-slate-700 transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4 text-emerald-400" />}
                {lang === 'vi' ? 'Kiểm Tra Kết Nối' : 'Test Connection'}
              </button>
            </div>
          </form>

          {/* Test Email Dispatch Section */}
          <div className="pt-4 border-t border-slate-800">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-indigo-400" />
              {lang === 'vi' ? 'Gửi Email Thử Nghiệm Ngay Đến Hộp Thư:' : 'Send Live Test Email:'}
            </h4>
            <div className="flex gap-2">
              <input
                type="email"
                value={testEmailTarget}
                onChange={(e) => setTestEmailTarget(e.target.value)}
                placeholder="nhap_email_cua_ban@gmail.com"
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={handleSendTest}
                disabled={sendingTest || !testEmailTarget}
                className="bg-purple-600 hover:bg-purple-500 text-white font-medium py-2 px-4 rounded-xl text-xs sm:text-sm transition flex items-center gap-1.5 disabled:opacity-50 shrink-0"
              >
                {sendingTest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {lang === 'vi' ? 'Gửi Thử' : 'Send Test'}
              </button>
            </div>

            {testNotice && (
              <div
                className={`mt-2.5 p-3 rounded-xl text-xs flex items-center gap-2 ${
                  testNotice.type === 'success'
                    ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/60 border border-rose-500/40 text-rose-300'
                }`}
              >
                {testNotice.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                )}
                <span>{testNotice.text}</span>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 px-6 border-t border-slate-800 bg-slate-900/90 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition"
          >
            {lang === 'vi' ? 'Đóng' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
