import React from 'react';
import { EventItem, Role, User } from '../types/index.js';
import { PWAInstallButton } from './PWAInstallButton.js';
import { ThemeToggle } from './ThemeToggle.js';
import { useLanguage } from '../context/LanguageContext.js';
import {
  QrCode,
  LayoutDashboard,
  Users,
  Mail,
  FileText,
  Calendar,
  ChevronDown,
  UserCheck,
  Settings,
} from 'lucide-react';

interface HeaderProps {
  currentEvent: EventItem | null;
  events: EventItem[];
  onSelectEvent: (event: EventItem) => void;
  onCreateEvent: () => void;
  activeRole: Role;
  activeTab: string;
  onTabChange: (tab: string) => void;
  currentUser: User;
  onOpenEventModal: () => void;
  onOpenUserModal: () => void;
  onOpenSmtpModal?: () => void;
}

const initials = (name: string) =>
  name
    .replace(/\s*\(.*?\)\s*/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

export const Header: React.FC<HeaderProps> = ({
  currentEvent,
  activeRole,
  activeTab,
  onTabChange,
  currentUser,
  onOpenEventModal,
  onOpenUserModal,
  onOpenSmtpModal,
}) => {
  const { lang, toggleLang, t } = useLanguage();
  const isAdmin = activeRole === 'ADMIN';

  // Desktop tabs; phones use the bottom bar instead
  const tabs = isAdmin
    ? [
        { id: 'dashboard', label: t.tabDashboard, icon: LayoutDashboard },
        { id: 'scanner', label: t.tabScanner, icon: QrCode },
        { id: 'guests', label: t.tabGuests, icon: Users },
        { id: 'invitations', label: t.tabInvitations, icon: Mail },
        { id: 'logs', label: t.tabLogs, icon: FileText },
      ]
    : [
        { id: 'scanner', label: t.tabScanner, icon: QrCode },
        { id: 'guests', label: t.tabLookup, icon: UserCheck },
        { id: 'logs', label: t.tabMyLogs, icon: FileText },
      ];

  const eventPill = (
    <button
      onClick={onOpenEventModal}
      className="flex items-center gap-2 min-w-0 max-w-full px-3 h-10 rounded-xl bg-surface border border-line hover:bg-surface-2 transition cursor-pointer"
      title={t.changeEvent}
    >
      <Calendar className="w-4 h-4 text-indigo-400 shrink-0" />
      <span className="truncate text-sm font-semibold text-fg">
        {currentEvent ? currentEvent.event_name : t.selectEvent}
      </span>
      <ChevronDown className="w-4 h-4 text-fg-muted shrink-0" />
    </button>
  );

  return (
    <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur border-b border-line">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 h-16">
          {/* Brand */}
          <button
            onClick={() => onTabChange(isAdmin ? 'dashboard' : 'scanner')}
            className="flex items-center gap-2.5 shrink-0 cursor-pointer rounded-xl"
            title={isAdmin ? t.tabDashboard : t.tabScanner}
            aria-label={isAdmin ? t.tabDashboard : t.tabScanner}
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
              <QrCode className="w-5 h-5" />
            </div>
            <span className="hidden 2xl:block font-extrabold text-base tracking-tight text-fg">{t.brandName}</span>
          </button>

          {/* Desktop tabs */}
          <nav className="hidden md:flex items-center gap-1 ml-4 overflow-x-auto scrollbar-none">
            {tabs.map(({ id, label, icon: Icon }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => onTabChange(id)}
                  aria-current={active ? "page" : undefined}
                  title={label}
                  aria-label={label}
                  className={`flex items-center gap-2 px-3.5 h-10 rounded-xl text-sm font-semibold whitespace-nowrap transition cursor-pointer ${
                    active ? 'bg-mint text-carbon dark:bg-white/10 dark:text-mint' : 'text-fg-muted hover:text-fg hover:bg-surface-2'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden xl:inline">{label}</span>
                </button>
              );
            })}
          </nav>

          {/* Event (fills the space on phones) */}
          <div className="flex-1 min-w-0 flex justify-end md:flex-none md:ml-auto md:max-w-[280px]">{eventPill}</div>

          {/* Utilities */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden md:block">
              <PWAInstallButton />
            </div>
            {isAdmin && onOpenSmtpModal && (
              <button
                onClick={onOpenSmtpModal}
                className="hidden md:inline-flex items-center justify-center w-10 h-10 rounded-xl border border-line bg-surface text-fg-muted hover:text-fg hover:bg-surface-2 transition cursor-pointer"
                title={lang === 'vi' ? 'Cài đặt Email SMTP' : 'Email SMTP Settings'}
                aria-label={lang === 'vi' ? 'Cài đặt Email SMTP' : 'Email SMTP Settings'}
              >
                <Settings className="w-[18px] h-[18px]" />
              </button>
            )}
            <button
              onClick={toggleLang}
              className="hidden sm:inline-flex items-center justify-center w-10 h-10 rounded-xl border border-line bg-surface text-xs font-bold text-fg-muted hover:text-fg hover:bg-surface-2 transition cursor-pointer"
              title={lang === 'vi' ? 'Switch to English' : 'Chuyển sang Tiếng Việt'}
            >
              {lang.toUpperCase()}
            </button>
            <ThemeToggle />
            <button
              onClick={onOpenUserModal}
              className={`flex items-center gap-2 h-10 pl-1 pr-1 md:pr-3 rounded-full border transition cursor-pointer ${
                isAdmin
                  ? 'border-indigo-400/40 hover:bg-indigo-500/10'
                  : 'border-emerald-400/40 hover:bg-emerald-500/10'
              }`}
              title={`${currentUser.name} • ${isAdmin ? t.roleAdmin : t.roleStaff}`}
              aria-label={currentUser.name}
            >
              <span
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                  isAdmin ? 'bg-indigo-600' : 'bg-emerald-600'
                }`}
              >
                {initials(currentUser.name)}
              </span>
              <span className="hidden md:block text-left leading-tight max-w-[140px]">
                <span className="block text-xs font-bold text-fg truncate">{currentUser.name}</span>
                <span className="block text-xs text-fg-muted">{isAdmin ? t.roleAdmin : t.roleStaff}</span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
