import React, { useState } from 'react';
import { EventItem } from '../types/index.js';
import { api } from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.js';
import { X, CalendarPlus, MapPin, Calendar, FileText } from 'lucide-react';

interface CreateEventModalProps {
  onClose: () => void;
  onEventCreated: (event: EventItem) => void;
}

export const CreateEventModal: React.FC<CreateEventModalProps> = ({ onClose, onEventCreated }) => {
  const { lang, t } = useLanguage();
  const [eventName, setEventName] = useState('');
  const [eventCode, setEventCode] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startAt, setStartAt] = useState(
    new Date(Date.now() + 86400000).toISOString().slice(0, 16)
  );
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventName.trim() || !eventCode.trim()) {
      setErrorMsg(lang === 'vi' ? 'Vui lòng nhập tên sự kiện và mã sự kiện' : 'Please provide event name and code');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    try {
      const created = await api.createEvent({
        event_name: eventName,
        event_code: eventCode.toUpperCase(),
        description,
        location,
        start_at: new Date(startAt).toISOString(),
        end_at: new Date(startAt).toISOString(),
      });
      onEventCreated(created);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error creating event');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-lg rounded-3xl bg-surface border border-line shadow-2xl overflow-hidden my-6">
        <div className="flex items-center justify-between p-4 px-6 border-b border-line bg-surface">
          <div className="flex items-center gap-2">
            <CalendarPlus className="w-5 h-5 text-indigo-400" />
            <span className="font-bold text-sm text-fg">
              {lang === 'vi' ? 'Thêm Sự Kiện Mới (Multi-Event)' : 'Create New Event (Multi-Event)'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-fg-muted hover:text-fg hover:bg-surface-2 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-400/40 text-rose-400 text-xs font-semibold">
              {errorMsg}
            </div>
          )}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-fg mb-1">
                {lang === 'vi' ? 'Tên sự kiện' : 'Event Name'} <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder={lang === 'vi' ? 'Ví dụ: BIDV Gala Dinner 2026' : 'E.g. Annual Tech Summit 2026'}
                className="w-full rounded-xl bg-canvas border border-line px-3.5 py-2.5 text-xs text-fg focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-fg mb-1">
                {lang === 'vi' ? 'Mã Code' : 'Event Code'} <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={eventCode}
                onChange={(e) => setEventCode(e.target.value.toUpperCase())}
                placeholder="EVT2026"
                className="w-full rounded-xl bg-canvas border border-line px-3.5 py-2.5 text-xs text-fg font-mono uppercase focus:outline-hidden focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-fg mb-1">
              {lang === 'vi' ? 'Địa điểm tổ chức' : 'Location / Venue'}
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-fg-muted absolute left-3 top-2.5" />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={lang === 'vi' ? 'Trung tâm Hội nghị Quốc gia, Hà Nội' : 'Convention Center, Hall A'}
                className="w-full rounded-xl bg-canvas border border-line pl-9 pr-3.5 py-2.5 text-xs text-fg focus:outline-hidden focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-fg mb-1">
              {lang === 'vi' ? 'Thời gian bắt đầu' : 'Start Date & Time'}
            </label>
            <input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="w-full rounded-xl bg-canvas border border-line px-3.5 py-2.5 text-xs text-fg focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-fg mb-1">
              {lang === 'vi' ? 'Mô tả tóm tắt sự kiện' : 'Description'}
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={lang === 'vi' ? 'Chương trình gặp gỡ và tri ân các đối tác tiêu biểu...' : 'VIP reception and awards ceremony...'}
              className="w-full rounded-xl bg-canvas border border-line p-3 text-xs text-fg focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-fg text-xs font-semibold transition"
            >
              {lang === 'vi' ? 'Hủy' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-sm transition"
            >
              {saving ? (lang === 'vi' ? 'Đang tạo...' : 'Creating...') : (lang === 'vi' ? 'Tạo Sự Kiện' : 'Create Event')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
