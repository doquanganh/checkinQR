import React, { useState } from 'react';
import { Loader2, LogIn, QrCode } from 'lucide-react';
import { api } from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.js';
import { ThemeToggle } from './ThemeToggle.js';
import type { User } from '../types/index.js';

export const LoginView: React.FC<{ onLoggedIn: (user: User) => void }> = ({ onLoggedIn }) => {
  const { lang, setLang } = useLanguage();
  const vi = lang === 'vi';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onLoggedIn(await api.login(email, password));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-fg flex items-center justify-center p-4 relative">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setLang(vi ? 'en' : 'vi')}
          className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-line bg-surface text-xs font-bold text-fg-muted hover:text-fg hover:bg-surface-2 transition cursor-pointer"
          aria-label={vi ? 'Switch to English' : 'Chuyển sang Tiếng Việt'}
        >
          {lang.toUpperCase()}
        </button>
        <ThemeToggle />
      </div>
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-surface border border-line rounded-3xl p-6 sm:p-8 shadow-xl shadow-black/5 space-y-5"
      >
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-500/10 border border-indigo-400/40 flex items-center justify-center text-indigo-400">
            <QrCode className="w-7 h-7" />
          </div>
          <h1 className="text-lg font-bold text-fg">
            {vi ? 'Hệ thống Check-in Sự kiện' : 'Event Check-in System'}
          </h1>
          <p className="text-xs text-fg-muted">{vi ? 'Đăng nhập để tiếp tục' : 'Sign in to continue'}</p>
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-fg">Email</span>
          <input
            type="email"
            required
            autoFocus
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-canvas border border-line focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none text-base sm:text-sm"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-fg">{vi ? 'Mật khẩu' : 'Password'}</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-canvas border border-line focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none text-base sm:text-sm"
          />
        </label>

        {error && (
          <div role="alert" className="text-xs text-rose-400 bg-rose-500/10 border border-rose-400/40 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-bold transition cursor-pointer"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
          <span>{vi ? 'Đăng nhập' : 'Sign in'}</span>
        </button>

      </form>
    </div>
  );
};
