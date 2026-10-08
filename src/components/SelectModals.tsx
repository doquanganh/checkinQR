import React, { useState } from 'react';
import { EventItem } from '../types/index.js';
import { useLanguage } from '../context/LanguageContext.js';
import {
  Calendar,
  MapPin,
  PlusCircle,
  X,
  Search,
  Check,
  Building2,
  Clock,
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
      <div className="relative w-full max-w-lg bg-surface border border-line/80 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 z-10 max-h-[85vh] flex flex-col animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-line shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-400/40 flex items-center justify-center text-indigo-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-fg">{t.eventList}</h3>
              <p className="text-xs text-fg-muted">
                {t.selectEvent}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-fg-muted hover:text-fg hover:bg-surface-2 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="pt-3 pb-2 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-fg-muted absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full rounded-xl bg-canvas border border-line pl-9 pr-3 py-2 text-xs text-fg placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Event List */}
        <div className="flex-1 overflow-y-auto py-2 space-y-2 pr-1">
          {filteredEvents.length === 0 ? (
            <div className="text-center py-8 text-xs text-fg-muted">
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
                      ? 'bg-indigo-500/10 border-indigo-400/40 text-fg shadow-lg shadow-indigo-600/10'
                      : 'bg-canvas/60 hover:bg-surface-2 border-line text-fg'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-bold text-xs sm:text-sm text-fg truncate">
                        {evt.event_name}
                      </span>
                      <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-surface-2 text-indigo-400 border border-line shrink-0">
                        {evt.event_code}
                      </span>
                    </div>
                    {isSelected && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-400/40 font-bold flex items-center gap-1 shrink-0">
                        <Check className="w-3 h-3" /> {t.selectedStatus}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-fg-muted flex-wrap">
                    <div className="flex items-center gap-1 truncate max-w-[240px]">
                      <MapPin className="w-3 h-3 shrink-0 text-fg-subtle" />
                      <span className="truncate">{evt.location}</span>
                    </div>
                    {evt.start_at && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 shrink-0 text-fg-subtle" />
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
          <div className="pt-3 border-t border-line shrink-0">
            <button
              onClick={() => {
                onClose();
                onCreateEvent();
              }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-bold shadow-sm transition"
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
