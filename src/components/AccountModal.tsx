import React, { useEffect, useState } from 'react';
import { Globe, KeyRound, Loader2, LogOut, Shield, UserPlus, X } from 'lucide-react';
import { api } from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.js';
import type { Role, User } from '../types/index.js';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onLogout: () => void;
}

const input =
  'w-full px-3 py-2.5 rounded-xl bg-canvas border border-line focus:border-indigo-500 outline-none text-base sm:text-sm';
const btn = 'px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-60';

export const AccountModal: React.FC<Props> = ({ isOpen, onClose, currentUser, onLogout }) => {
  const { lang, setLang, t } = useLanguage();
  const vi = lang === 'vi';
  const isAdmin = currentUser.role === 'ADMIN';

  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // change own password
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');

  // admin: staff management
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'CHECKIN_STAFF' as Role });

  const loadUsers = () => api.listUsers().then(setUsers).catch((e) => setMsg({ ok: false, text: e.message }));

  useEffect(() => {
    if (isOpen && isAdmin) loadUsers();
    if (isOpen) setMsg(null);
  }, [isOpen, isAdmin]);

  if (!isOpen) return null;

  const run = async (fn: () => Promise<unknown>, okText: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: okText });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const changePassword = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      await api.changePassword(cur, next);
      setCur('');
      setNext('');
    }, vi ? 'Đã đổi mật khẩu' : 'Password changed');
  };

  const createUser = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      await api.createUser(form);
      setForm({ name: '', email: '', password: '', role: 'CHECKIN_STAFF' });
      await loadUsers();
    }, vi ? 'Đã tạo tài khoản' : 'Account created');
  };

  const toggleActive = (u: User) =>
    run(async () => {
      await api.updateUser(u.id, { active: !u.active });
      await loadUsers();
    }, u.active ? (vi ? 'Đã khóa tài khoản' : 'Account disabled') : vi ? 'Đã mở khóa' : 'Account enabled');

  const resetPassword = (u: User) => {
    const pw = window.prompt(
      vi ? `Mật khẩu mới cho ${u.email} (tối thiểu 8 ký tự):` : `New password for ${u.email} (min 8 chars):`
    );
    if (pw) run(() => api.updateUser(u.id, { password: pw }), vi ? 'Đã đặt lại mật khẩu' : 'Password reset');
  };

  const roleBadge = (r: Role) =>
    r === 'ADMIN'
      ? 'bg-mint/20 text-indigo-400 border border-indigo-400/30'
      : 'bg-surface-3 text-fg-muted border border-line';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md">
      <div className="fixed inset-0" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-surface border border-line/80 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 z-10 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-line shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-400/40 flex items-center justify-center text-indigo-400 shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-fg truncate">{currentUser.name}</h3>
              <p className="text-xs text-fg-muted truncate font-mono">
                {currentUser.email} • {isAdmin ? t.roleAdmin : t.roleStaff}
              </p>
            </div>
          </div>
          <button onClick={onClose} aria-label={t.close} className="p-1.5 rounded-xl text-fg-muted hover:text-fg hover:bg-surface-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-3 space-y-5 pr-1">
          {msg && (
            <div
              role="status"
              className={`text-xs rounded-xl px-3 py-2 border ${
                msg.ok ? 'text-emerald-400 bg-emerald-500/10 border-emerald-400/40' : 'text-rose-400 bg-rose-500/10 border-rose-400/40'
              }`}
            >
              {msg.text}
            </div>
          )}

          {/* Staff management (admin) */}
          {isAdmin && (
            <section className="space-y-3">
              <h4 className="text-xs font-bold text-fg-muted uppercase tracking-wider">
                {vi ? 'Tài khoản nhân viên' : 'Team accounts'}
              </h4>
              <ul className="space-y-2">
                {users.map((u) => (
                  <li key={u.id} className="p-3 rounded-2xl bg-canvas/60 border border-line flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <div className={`text-xs font-semibold truncate ${u.active ? 'text-fg' : 'text-fg-subtle line-through'}`}>
                        {u.name}
                      </div>
                      <div className="text-xs text-fg-muted truncate font-mono">{u.email}</div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded font-bold uppercase shrink-0 ${roleBadge(u.role)}`}>
                      {u.role === 'ADMIN' ? t.roleAdmin : t.roleStaff}
                    </span>
                    <button
                      disabled={busy}
                      onClick={() => resetPassword(u)}
                      title={vi ? 'Đặt lại mật khẩu' : 'Reset password'}
                      className={`${btn} bg-surface-2 hover:bg-surface-3 text-fg px-2`}
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                    </button>
                    {u.id !== currentUser.id && (
                      <button
                        disabled={busy}
                        onClick={() => toggleActive(u)}
                        className={`${btn} ${u.active ? 'border border-rose-400/40 text-rose-400 hover:bg-rose-500/10' : 'border border-emerald-400/40 text-emerald-400 hover:bg-emerald-500/10'}`}
                      >
                        {u.active ? (vi ? 'Khóa' : 'Disable') : vi ? 'Mở' : 'Enable'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>

              <form onSubmit={createUser} className="p-3 rounded-2xl bg-canvas/60 border border-line space-y-2">
                <div className="text-xs font-bold text-fg flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-indigo-400" />
                  {vi ? 'Thêm tài khoản' : 'Add account'}
                </div>
                <input required className={input} placeholder={vi ? 'Họ tên' : 'Full name'} value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <input required type="email" className={input} placeholder="Email" autoComplete="off" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                  <input required type="password" minLength={8} className={input} autoComplete="new-password"
                    placeholder={vi ? 'Mật khẩu (≥ 8 ký tự)' : 'Password (8+ chars)'} value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })} />
                  <select className={input} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                    <option value="CHECKIN_STAFF">{t.roleStaff}</option>
                    <option value="ADMIN">{t.roleAdmin}</option>
                  </select>
                </div>
                <button disabled={busy} className={`${btn} w-full bg-indigo-600 hover:bg-indigo-500 text-white`}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : vi ? 'Tạo tài khoản' : 'Create account'}
                </button>
              </form>
            </section>
          )}

          {/* Change own password */}
          <form onSubmit={changePassword} className="space-y-2">
            <h4 className="text-xs font-bold text-fg-muted uppercase tracking-wider">
              {vi ? 'Đổi mật khẩu' : 'Change password'}
            </h4>
            <input required type="password" autoComplete="current-password" className={input}
              placeholder={vi ? 'Mật khẩu hiện tại' : 'Current password'} value={cur} onChange={(e) => setCur(e.target.value)} />
            <input required type="password" minLength={8} autoComplete="new-password" className={input}
              placeholder={vi ? 'Mật khẩu mới (≥ 8 ký tự)' : 'New password (8+ chars)'} value={next} onChange={(e) => setNext(e.target.value)} />
            <button disabled={busy} className={`${btn} w-full bg-surface-2 hover:bg-surface-3 text-fg`}>
              {vi ? 'Cập nhật mật khẩu' : 'Update password'}
            </button>
          </form>

          {/* Language */}
          <div>
            <div className="text-xs font-bold text-fg flex items-center gap-1.5 mb-2">
              <Globe className="w-3.5 h-3.5 text-indigo-400" />
              {t.languageLabel}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(['vi', 'en'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                    lang === l
                      ? 'bg-indigo-500/10 border-indigo-500 text-fg ring-1 ring-indigo-500/50'
                      : 'bg-canvas/60 border-line text-fg-muted hover:text-fg'
                  }`}
                >
                  {l === 'vi' ? '🇻🇳 Tiếng Việt' : '🇬🇧 English'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-line shrink-0">
          <button
            onClick={onLogout}
            className={`${btn} w-full flex items-center justify-center gap-2 border border-line text-fg-muted hover:text-rose-400 hover:border-rose-400/50 hover:bg-rose-500/10 py-2.5`}
          >
            <LogOut className="w-4 h-4" />
            {vi ? 'Đăng xuất' : 'Sign out'}
          </button>
        </div>
      </div>
    </div>
  );
};
