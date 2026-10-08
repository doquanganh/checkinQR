import React from 'react';
import { EventItem, Role, User } from '../types/index.js';
import { PWAInstallButton } from './PWAInstallButton.js';
import { useLanguage } from '../context/LanguageContext.js';
import {
  QrCode,
  LayoutDashboard,
  Users,
  Mail,
  FileText,
  Zap,
  Calendar,
  ChevronDown,
  UserCheck,
  Globe,
} from 'lucide-react';

interface HeaderProps {
  currentEvent: EventItem | null;
  events: EventItem[];
  onSelectEvent: (event: EventItem) => void;
  onCreateEvent: () => void;
  activeRole: Role;
  onRoleChange: (role: Role) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  currentUser: User;
  onUserChange: (user: User) => void;
  availableUsers: User[];
  onOpenEventModal: () => void;
  onOpenUserModal: () => void;
  onOpenSmtpModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentEvent,
  events,
  onSelectEvent,
  onCreateEvent,
  activeRole,
  onRoleChange,
  activeTab,
  onTabChange,
  currentUser,
  onUserChange,
  availableUsers,
  onOpenEventModal,
  onOpenUserModal,
  onOpenSmtpModal,
}) => {
  const { lang, setLang, toggleLang, t } = useLanguage();

  return (
    <header className="sticky top-0 z-40 bg-slate-950/98 backdrop-blur-xl border-b border-slate-800 shadow-xl shadow-black/40">
      {/* Top Banner Bar */}
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-1.5 sm:gap-3 min-w-0">
          {/* Logo & Brand */}
          <div className="flex items-center gap-2 sm:gap-3 shrink min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/25 text-white font-black shrink-0">
              <QrCode className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-sm sm:text-lg tracking-tight text-white truncate">
                  {t.brandName}
                </span>
                <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shrink-0 hidden xs:inline-block">
                  v2.0
                </span>
              </div>
              <p className="text-[10px] text-slate-400 hidden lg:block leading-none mt-0.5">
                {t.tagline}
              </p>
            </div>
          </div>

          {/* Desktop Controls (Event Selector + Language + Role/User Switcher + PWA) */}
          <div className="hidden md:flex items-center gap-2.5">
            {/* Desktop Event Selector Button */}
            <button
              onClick={onOpenEventModal}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-700/80 text-left transition shadow-sm max-w-[260px] lg:max-w-[300px] group cursor-pointer"
            >
              <div className="p-1 rounded-lg bg-indigo-500/20 text-indigo-400 shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div className="truncate min-w-0">
                <div className="text-xs font-bold text-white truncate group-hover:text-indigo-300 transition">
                  {currentEvent ? currentEvent.event_name : t.selectEvent}
                </div>
                <div className="text-[10px] text-slate-400 font-mono truncate">
                  {currentEvent?.event_code} • {currentEvent?.location}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1 group-hover:text-white" />
            </button>

            {/* Language Switcher Segmented Control (Desktop & Tablet) */}
            <div className="flex items-center bg-slate-900 border border-slate-700/80 rounded-xl p-0.5 shadow-sm">
              <button
                onClick={() => setLang('vi')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  lang === 'vi'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Tiếng Việt"
              >
                <span>🇻🇳</span>
                <span>VIE</span>
              </button>
              <button
                onClick={() => setLang('en')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  lang === 'en'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="English"
              >
                <span>🇬🇧</span>
                <span>ENG</span>
              </button>
            </div>

            {/* Desktop Role & User Switcher Button */}
            <button
              onClick={onOpenUserModal}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition shadow-sm cursor-pointer shrink-0 max-w-[210px] overflow-hidden ${
                activeRole === 'ADMIN'
                  ? 'bg-purple-950/50 hover:bg-purple-900/50 border-purple-500/50 text-purple-200'
                  : 'bg-emerald-950/50 hover:bg-emerald-900/50 border-emerald-500/50 text-emerald-200'
              }`}
            >
              <div
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  activeRole === 'ADMIN' ? 'bg-purple-400' : 'bg-emerald-400'
                }`}
              />
              <div className="text-left min-w-0 flex-1 overflow-hidden">
                <div className="font-bold text-xs truncate max-w-[130px] text-white">
                  {currentUser.name}
                </div>
                <div className="text-[10px] opacity-80 uppercase tracking-wider font-semibold truncate">
                  {activeRole === 'ADMIN' ? t.roleAdmin : t.roleStaff}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1 shrink-0" />
            </button>

            {/* Email Settings button */}
            {onOpenSmtpModal && (
              <button
                onClick={onOpenSmtpModal}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-amber-300 transition shadow-sm cursor-pointer"
                title={lang === 'vi' ? 'Cài đặt Email SMTP' : 'Email SMTP Settings'}
              >
                <Mail className="w-4 h-4 text-amber-400" />
              </button>
            )}

            <PWAInstallButton />
          </div>

          {/* Mobile Right Controls: Language + User/Role Button */}
          <div className="flex md:hidden items-center gap-1.5 shrink-0 min-w-0">
            {/* Mobile Language Switcher (Single-tap Quick Toggle) */}
            <button
              onClick={toggleLang}
              className="flex items-center gap-1 px-1.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-[11px] font-bold transition text-slate-200 shadow-sm cursor-pointer shrink-0"
              title={lang === 'vi' ? 'Switch to English' : 'Chuyển sang Tiếng Việt'}
            >
              <span>{lang === 'vi' ? '🇻🇳' : '🇬🇧'}</span>
              <span className="text-[10px] font-mono">{lang.toUpperCase()}</span>
            </button>

            {/* Mobile User / Role Button (Constrained to prevent overflow) */}
            <button
              onClick={onOpenUserModal}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-xl border text-xs font-bold transition shadow-sm cursor-pointer shrink min-w-0 max-w-[135px] sm:max-w-[165px] overflow-hidden ${
                activeRole === 'ADMIN'
                  ? 'bg-purple-950/60 border-purple-500/50 text-purple-200'
                  : 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  activeRole === 'ADMIN' ? 'bg-purple-400' : 'bg-emerald-400'
                }`}
              />
              <span className="truncate min-w-0 font-medium text-xs text-white">
                {currentUser.name.replace(/\s*\(.*?\)\s*/g, '')}
              </span>
              <span className="text-[9px] px-1 py-0.2 rounded bg-black/40 opacity-90 shrink-0 uppercase">
                {activeRole === 'ADMIN' ? t.roleAdmin : t.roleStaff}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
            </button>
          </div>
        </div>

        {/* Mobile Dedicated Event Bar */}
        <div className="md:hidden py-1.5 pb-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="p-1 rounded-lg bg-indigo-500/20 text-indigo-400 shrink-0">
              <Calendar className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-white truncate">
                {currentEvent ? currentEvent.event_name : t.noEventSelected}
              </div>
              <div className="text-[10px] text-slate-400 font-mono truncate">
                {currentEvent?.event_code} • {currentEvent?.location}
              </div>
            </div>
          </div>

          <button
            onClick={onOpenEventModal}
            className="shrink-0 px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-xs font-semibold flex items-center gap-1 transition"
          >
            <span>{t.changeEvent}</span>
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>

        {/* Desktop & Tablet Navigation Tabs Bar (Visible on md+ screens) */}
        <nav className="hidden md:flex space-x-1 lg:space-x-1.5 overflow-x-auto py-2 scrollbar-none border-t border-slate-800/80">
          {activeRole === 'ADMIN' ? (
            <>
              <button
                onClick={() => onTabChange('dashboard')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition shrink-0 whitespace-nowrap ${
                  activeTab === 'dashboard'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>{t.tabDashboard}</span>
              </button>

              <button
                onClick={() => onTabChange('scanner')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition shrink-0 whitespace-nowrap ${
                  activeTab === 'scanner'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-400/50'
                    : 'bg-emerald-950/30 text-emerald-300 hover:bg-emerald-900/40 border border-emerald-500/30'
                }`}
              >
                <QrCode className="w-4 h-4 animate-pulse text-emerald-300" />
                <span>{t.tabScanner}</span>
              </button>

              <button
                onClick={() => onTabChange('guests')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition shrink-0 whitespace-nowrap ${
                  activeTab === 'guests'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>{t.tabGuests}</span>
              </button>

              <button
                onClick={() => onTabChange('invitations')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition shrink-0 whitespace-nowrap ${
                  activeTab === 'invitations'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Mail className="w-4 h-4" />
                <span>{t.tabInvitations}</span>
              </button>

              <button
                onClick={() => onTabChange('logs')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition shrink-0 whitespace-nowrap ${
                  activeTab === 'logs'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>{t.tabLogs}</span>
              </button>

              <button
                onClick={() => onTabChange('race-test')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition shrink-0 whitespace-nowrap ${
                  activeTab === 'race-test'
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                    : 'text-amber-400 hover:text-amber-200 hover:bg-slate-800/60'
                }`}
              >
                <Zap className="w-4 h-4 text-amber-400" />
                <span>{t.tabRaceTest}</span>
              </button>
            </>
          ) : (
            <>
              {/* STAFF VIEW */}
              <button
                onClick={() => onTabChange('scanner')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition shrink-0 whitespace-nowrap ${
                  activeTab === 'scanner'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-400'
                    : 'bg-slate-800 text-emerald-400 hover:bg-slate-700'
                }`}
              >
                <QrCode className="w-5 h-5 text-emerald-300" />
                <span>{t.tabScanner}</span>
              </button>

              <button
                onClick={() => onTabChange('guests')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition shrink-0 whitespace-nowrap ${
                  activeTab === 'guests'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                <span>{t.tabLookup}</span>
              </button>

              <button
                onClick={() => onTabChange('logs')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition shrink-0 whitespace-nowrap ${
                  activeTab === 'logs'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>{t.tabMyLogs}</span>
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
};
