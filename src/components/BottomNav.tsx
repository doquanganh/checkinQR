import React, { useState } from 'react';
import { Role, EventItem, User } from '../types/index.js';
import { useLanguage } from '../context/LanguageContext.js';
import {
  LayoutDashboard,
  QrCode,
  Users,
  Mail,
  FileText,
  Zap,
  MoreHorizontal,
  X,
  Calendar,
  Shield,
  Smartphone,
  CheckCircle2,
  Globe,
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton.js';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  activeRole: Role;
  currentEvent: EventItem | null;
  currentUser: User;
  onOpenEventModal: () => void;
  onOpenUserModal: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  activeRole,
  currentUser,
  currentEvent,
  onOpenEventModal,
  onOpenUserModal,
}) => {
  const { lang, setLang, t } = useLanguage();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  return (
    <>
      {/* Fixed Bottom Tab Bar (Visible on mobile screens < 768px) */}
      {/* High contrast, deep slate-950, distinct glowing top border, safe padding */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur border-t border-line shadow-[0_-4px_16px_rgba(0,0,0,0.08)] pb-[calc(env(safe-area-inset-bottom,0px)+6px)]">
        <div className="grid grid-cols-5 h-15 items-center px-1">
          {/* Tab 1: Tổng quan (Dashboard) */}
          <button
            onClick={() => onTabChange('dashboard')}
            className={`flex flex-col items-center justify-center h-full py-1 transition ${
              activeTab === 'dashboard'
                ? 'text-indigo-400 font-bold'
                : 'text-fg-muted hover:text-fg'
            }`}
          >
            <div
              className={`p-1 rounded-xl transition ${
                activeTab === 'dashboard' ? 'bg-indigo-500/10 text-indigo-400' : ''
              }`}
            >
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <span className="text-xs mt-0.5 tracking-tight">{t.tabDashboard}</span>
          </button>

          {/* Tab 2: Khách mời / Tra cứu */}
          <button
            onClick={() => onTabChange('guests')}
            className={`flex flex-col items-center justify-center h-full py-1 transition ${
              activeTab === 'guests'
                ? 'text-indigo-400 font-bold'
                : 'text-fg-muted hover:text-fg'
            }`}
          >
            <div
              className={`p-1 rounded-xl transition ${
                activeTab === 'guests' ? 'bg-indigo-500/10 text-indigo-400' : ''
              }`}
            >
              <Users className="w-5 h-5" />
            </div>
            <span className="text-xs mt-0.5 tracking-tight">
              {activeRole === 'ADMIN' ? t.tabGuests : t.tabLookup}
            </span>
          </button>

          {/* Tab 3: Center Elevated QR SCANNER BUTTON (ALWAYS CENTERED FOR BOTH ADMIN & STAFF) */}
          <button
            onClick={() => onTabChange('scanner')}
            className="flex flex-col items-center justify-center -mt-5 relative z-10"
          >
            <div
              className={`w-13 h-13 rounded-2xl flex items-center justify-center shadow-sm transition transform active:scale-95 ${
                activeTab === 'scanner'
                  ? 'bg-emerald-500 text-white shadow-emerald-500/40 ring-4 ring-surface'
                  : 'bg-emerald-600 text-white shadow-emerald-600/30 ring-4 ring-surface'
              }`}
            >
              <QrCode className="w-6.5 h-6.5" />
            </div>
            <span
              className={`text-xs font-bold mt-1 tracking-tight ${
                activeTab === 'scanner' ? 'text-emerald-400' : 'text-fg'
              }`}
            >
              {lang === "vi" ? "Quét QR" : "Scan"}
            </span>
          </button>

          {/* Tab 4: Thư mời (Admin) hoặc Lịch sử soát vé (Staff) */}
          {activeRole === 'ADMIN' ? (
            <button
              onClick={() => onTabChange('invitations')}
              className={`flex flex-col items-center justify-center h-full py-1 transition ${
                activeTab === 'invitations'
                  ? 'text-indigo-400 font-bold'
                  : 'text-fg-muted hover:text-fg'
              }`}
            >
              <div
                className={`p-1 rounded-xl transition ${
                  activeTab === 'invitations' ? 'bg-indigo-500/10 text-indigo-400' : ''
                }`}
              >
                <Mail className="w-5 h-5" />
              </div>
              <span className="text-xs mt-0.5 tracking-tight">{t.tabInvitations}</span>
            </button>
          ) : (
            <button
              onClick={() => onTabChange('logs')}
              className={`flex flex-col items-center justify-center h-full py-1 transition ${
                activeTab === 'logs'
                  ? 'text-indigo-400 font-bold'
                  : 'text-fg-muted hover:text-fg'
              }`}
            >
              <div
                className={`p-1 rounded-xl transition ${
                  activeTab === 'logs' ? 'bg-indigo-500/10 text-indigo-400' : ''
                }`}
              >
                <FileText className="w-5 h-5" />
              </div>
              <span className="text-xs mt-0.5 tracking-tight">{t.tabMyLogs}</span>
            </button>
          )}

          {/* Tab 5: More Options Menu */}
          <button
            onClick={() => setShowMoreMenu(true)}
            className={`flex flex-col items-center justify-center h-full py-1 transition ${
              activeRole === 'ADMIN' && activeTab === 'logs'
                ? 'text-indigo-400 font-bold'
                : 'text-fg-muted hover:text-fg'
            }`}
          >
            <div
              className={`p-1 rounded-xl transition ${
                activeRole === 'ADMIN' && activeTab === 'logs' ? 'bg-indigo-500/10 text-indigo-400' : ''
              }`}
            >
              <MoreHorizontal className="w-5 h-5" />
            </div>
            <span className="text-xs mt-0.5 tracking-tight">{t.tabMore}</span>
          </button>
        </div>
      </nav>

      {/* MORE OPTIONS BOTTOM SHEET MODAL */}
      {showMoreMenu && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="flex-1" onClick={() => setShowMoreMenu(false)} />
          <div className="bg-surface border-t border-line/80 rounded-t-3xl p-5 shadow-2xl space-y-4 animate-in slide-in-from-bottom duration-200 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-400/40 flex items-center justify-center text-indigo-400 font-bold shrink-0">
                  ⚡
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-fg truncate">{t.actionsAndManagement}</h3>
                  <p className="text-xs text-fg-muted truncate">
                    {currentUser.name} • {activeRole === 'ADMIN' ? t.roleAdmin : t.roleStaff}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowMoreMenu(false)}
                className="p-1.5 rounded-xl text-fg-muted hover:text-fg hover:bg-surface-2 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Action Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => {
                  onTabChange('logs');
                  setShowMoreMenu(false);
                }}
                className={`p-3 rounded-2xl border text-left flex items-start gap-3 transition ${
                  activeTab === 'logs'
                    ? 'bg-indigo-500/10 border-indigo-400/40 text-fg'
                    : 'bg-canvas/70 border-line text-fg'
                }`}
              >
                <FileText className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-fg truncate">{t.auditLogTitle}</div>
                  <div className="text-xs text-fg-muted mt-0.5 truncate">{t.auditLogDesc}</div>
                </div>
              </button>

              {/* Đổi sự kiện */}
              <button
                onClick={() => {
                  setShowMoreMenu(false);
                  onOpenEventModal();
                }}
                className="p-3 rounded-2xl bg-canvas/70 border border-line text-left flex items-start gap-3 text-fg hover:bg-surface-2 transition"
              >
                <Calendar className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-fg truncate max-w-[120px]">
                    {t.changeEvent}
                  </div>
                  <div className="text-xs text-fg-muted truncate max-w-[120px]">
                    {currentEvent?.event_code}
                  </div>
                </div>
              </button>

              {/* Tài khoản */}
              <button
                onClick={() => {
                  setShowMoreMenu(false);
                  onOpenUserModal();
                }}
                className="p-3 rounded-2xl bg-canvas/70 border border-line text-left flex items-start gap-3 text-fg hover:bg-surface-2 transition"
              >
                <Shield className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-fg truncate">{lang === 'vi' ? 'Tài khoản' : 'Account'}</div>
                  <div className="text-xs text-fg-muted truncate">
                    {activeRole === 'ADMIN' ? t.roleAdmin : t.roleStaff}
                  </div>
                </div>
              </button>
            </div>

            {/* Language Selection Card in Bottom Nav */}
            <div className="bg-canvas/70 border border-line rounded-2xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-fg flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{t.languageLabel}</span>
                </span>
                <span className="text-xs font-mono text-indigo-400 font-semibold uppercase">
                  {lang === 'vi' ? '🇻🇳 Tiếng Việt' : '🇬🇧 English'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setLang('vi')}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                    lang === 'vi'
                      ? 'bg-indigo-500/10 border-indigo-500 text-fg shadow-xs ring-1 ring-indigo-500/50'
                      : 'bg-surface border-line text-fg-muted hover:text-fg'
                  }`}
                >
                  <span className="text-base">🇻🇳</span>
                  <span>Tiếng Việt</span>
                </button>
                <button
                  onClick={() => setLang('en')}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                    lang === 'en'
                      ? 'bg-indigo-500/10 border-indigo-500 text-fg shadow-xs ring-1 ring-indigo-500/50'
                      : 'bg-surface border-line text-fg-muted hover:text-fg'
                  }`}
                >
                  <span className="text-base">🇬🇧</span>
                  <span>English</span>
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-line flex items-center justify-between">
              <PWAInstallButton />
              <button
                onClick={() => setShowMoreMenu(false)}
                className="text-xs text-fg-muted hover:text-fg py-1"
              >
                {t.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
