import React, { useState } from 'react';
import { EventItem, Role, User } from '../types/index.js';
import { useLanguage } from '../context/LanguageContext.js';
import {
  Calendar,
  MapPin,
  PlusCircle,
  X,
  Search,
  Check,
  Shield,
  ShieldAlert,
  UserCheck,
  Building2,
  Clock,
  Globe,
} from 'lucide-react';

interface EventSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: EventItem[];
  currentEvent: EventItem | null;
  onSelectEvent: (event: EventItem) => void;
  onCreateEvent: () => void;
  isAdmin: boolean;
}

export const EventSelectModal: React.FC<EventSelectModalProps> = ({
  isOpen,
  onClose,
  events,
  currentEvent,
  onSelectEvent,
  onCreateEvent,
  isAdmin,
}) => {
  const { lang, t } = useLanguage();
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const filteredEvents = events.filter(
    (e) =>
      e.event_name.toLowerCase().includes(search.toLowerCase()) ||
      e.event_code.toLowerCase().includes(search.toLowerCase()) ||
      e.location.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 z-10 max-h-[85vh] flex flex-col animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">{t.eventList}</h3>
              <p className="text-[11px] text-slate-400">
                {t.selectEvent}
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

        {/* Search */}
        <div className="pt-3 pb-2 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full rounded-xl bg-slate-950 border border-slate-800 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Event List */}
        <div className="flex-1 overflow-y-auto py-2 space-y-2 pr-1">
          {filteredEvents.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              {t.noEventFound}
            </div>
          ) : (
            filteredEvents.map((evt) => {
              const isSelected = currentEvent?.id === evt.id;
              return (
                <button
                  key={evt.id}
                  onClick={() => {
                    onSelectEvent(evt);
                    onClose();
                  }}
                  className={`w-full text-left p-3.5 rounded-2xl transition border flex flex-col gap-1.5 relative cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600/20 border-indigo-500/60 text-white shadow-lg shadow-indigo-600/10'
                      : 'bg-slate-950/60 hover:bg-slate-800 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-bold text-xs sm:text-sm text-white truncate">
                        {evt.event_name}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 border border-slate-700 shrink-0">
                        {evt.event_code}
                      </span>
                    </div>
                    {isSelected && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold flex items-center gap-1 shrink-0">
                        <Check className="w-3 h-3" /> {t.selectedStatus}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                    <div className="flex items-center gap-1 truncate max-w-[240px]">
                      <MapPin className="w-3 h-3 shrink-0 text-slate-500" />
                      <span className="truncate">{evt.location}</span>
                    </div>
                    {evt.start_at && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 shrink-0 text-slate-500" />
                        <span>{new Date(evt.start_at).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US')}</span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer / Create button */}
        {isAdmin && (
          <div className="pt-3 border-t border-slate-800 shrink-0">
            <button
              onClick={() => {
                onClose();
                onCreateEvent();
              }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-bold shadow-lg transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{t.createNewEvent}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

interface UserSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onUserChange: (user: User) => void;
  activeRole: Role;
  onRoleChange: (role: Role) => void;
  availableUsers: User[];
}

export const UserSelectModal: React.FC<UserSelectModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserChange,
  activeRole,
  onRoleChange,
  availableUsers,
}) => {
  const { lang, setLang, t } = useLanguage();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 z-10 max-h-[85vh] flex flex-col animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">
                {t.roleSwitcher}
              </h3>
              <p className="text-[11px] text-slate-400">
                {t.staffDesc}
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

        {/* Quick Role Description Cards */}
        <div className="grid grid-cols-2 gap-2.5 py-3 shrink-0">
          <div
            className={`p-3 rounded-2xl border text-left flex flex-col justify-between ${
              activeRole === 'ADMIN'
                ? 'bg-purple-950/40 border-purple-500/60 text-purple-200 shadow-md ring-1 ring-purple-500/40'
                : 'bg-slate-950/60 border-slate-800 text-slate-400'
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold text-xs text-white">
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              <span>ADMIN ({t.roleAdmin.toUpperCase()})</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
              {t.adminDesc}
            </p>
          </div>

          <div
            className={`p-3 rounded-2xl border text-left flex flex-col justify-between ${
              activeRole === 'CHECKIN_STAFF'
                ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-200 shadow-md ring-1 ring-emerald-500/40'
                : 'bg-slate-950/60 border-slate-800 text-slate-400'
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold text-xs text-white">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>STAFF ({t.roleStaff.toUpperCase()})</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
              {t.staffDesc}
            </p>
          </div>
        </div>

        {/* Account List */}
        <div className="flex-1 overflow-y-auto py-2 space-y-2 pr-1">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            {t.selectWorkingAccount}
          </div>
          {availableUsers.map((u) => {
            const isCurrent = currentUser.id === u.id;
            return (
              <button
                key={u.id}
                onClick={() => {
                  onUserChange(u);
                  onRoleChange(u.role);
                  onClose();
                }}
                className={`w-full text-left p-3.5 rounded-2xl transition border flex items-center justify-between gap-3 cursor-pointer ${
                  isCurrent
                    ? 'bg-indigo-600 text-white font-bold border-indigo-400 shadow-lg'
                    : 'bg-slate-950/60 hover:bg-slate-800 border-slate-800 text-slate-300'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs sm:text-sm font-semibold text-white truncate">{u.name}</div>
                  <div className="text-[10px] text-slate-400 truncate font-mono">{u.email}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                      u.role === 'ADMIN'
                        ? 'bg-purple-500/30 text-purple-200 border border-purple-500/40'
                        : 'bg-emerald-500/30 text-emerald-200 border border-emerald-500/40'
                    }`}
                  >
                    {u.role === 'ADMIN' ? t.roleAdmin : t.roleStaff}
                  </span>
                  {isCurrent && <Check className="w-4 h-4 text-white shrink-0" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Language Selection Section */}
        <div className="pt-3 border-t border-slate-800 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-indigo-400" />
              <span>{t.languageLabel}</span>
            </span>
            <span className="text-[10px] font-mono text-indigo-400 font-semibold uppercase">
              {lang === 'vi' ? '🇻🇳 Tiếng Việt' : '🇬🇧 English'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setLang('vi')}
              className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                lang === 'vi'
                  ? 'bg-indigo-600/30 border-indigo-500 text-white shadow-xs ring-1 ring-indigo-500/50'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <span className="text-base">🇻🇳</span>
              <span>Tiếng Việt</span>
            </button>
            <button
              onClick={() => setLang('en')}
              className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                lang === 'en'
                  ? 'bg-indigo-600/30 border-indigo-500 text-white shadow-xs ring-1 ring-indigo-500/50'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <span className="text-base">🇬🇧</span>
              <span>English</span>
            </button>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-800 shrink-0 text-center">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
};
