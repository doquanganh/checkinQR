import React, { useState } from 'react';
import { EventItem, EventGuest } from '../types/index.js';
import { api } from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.js';
import { X, Save, UserPlus, Edit } from 'lucide-react';

interface GuestModalProps {
  currentEvent: EventItem;
  editingGuest: EventGuest | null;
  onClose: () => void;
  onSaved: (guest?: EventGuest) => void;
}

export const GuestModal: React.FC<GuestModalProps> = ({
  currentEvent,
  editingGuest,
  onClose,
  onSaved,
}) => {
  const { lang, t } = useLanguage();
  const isEditing = !!editingGuest;
  const initialGuest = editingGuest?.guest;

  const [fullName, setFullName] = useState(initialGuest?.full_name || '');
  const [email, setEmail] = useState(initialGuest?.email || '');
  const [phone, setPhone] = useState(initialGuest?.phone || '');
  const [organization, setOrganization] = useState(initialGuest?.organization || '');
  const [title, setTitle] = useState(initialGuest?.title || '');
  const [notes, setNotes] = useState(initialGuest?.notes || '');
  const [status, setStatus] = useState<'ACTIVE' | 'DISABLED'>(initialGuest?.status || 'ACTIVE');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setErrorMsg(lang === 'vi' ? 'Vui lòng nhập họ và tên khách mời' : 'Please enter guest full name');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    try {
      let saved: EventGuest | undefined;
      if (isEditing) {
        saved = await api.updateGuest(editingGuest.id, {
          guest: {
            full_name: fullName,
            email,
            phone,
            organization,
            title,
            notes,
            status,
          },
        });
      } else {
        saved = await api.createGuest(currentEvent.id, {
          full_name: fullName,
          email,
          phone,
          organization,
          title,
          notes,
          status,
        });
      }
      onSaved(saved);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error saving guest');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-lg rounded-3xl bg-surface border border-line shadow-2xl overflow-hidden my-6">
        <div className="flex items-center justify-between p-4 px-6 border-b border-line bg-surface">
          <div className="flex items-center gap-2">
            {isEditing ? (
              <Edit className="w-5 h-5 text-indigo-400" />
            ) : (
              <UserPlus className="w-5 h-5 text-indigo-400" />
            )}
            <span className="font-bold text-sm text-fg">
              {isEditing
                ? lang === 'vi'
                  ? `Sửa Khách Mời: ${editingGuest.guest_code}`
                  : `Edit Guest: ${editingGuest.guest_code}`
                : lang === 'vi'
                ? 'Thêm Khách Mời Mới'
                : 'Add New Guest'}
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
          <div>
            <label className="block text-xs font-bold text-fg mb-1">
              {lang === 'vi' ? 'Họ và tên' : 'Full Name'} <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={lang === 'vi' ? 'Ví dụ: Nguyễn Quang Anh' : 'E.g. Alexander Wright'}
              className="w-full rounded-xl bg-canvas border border-line px-3.5 py-2.5 text-xs text-fg focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-fg mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="w-full rounded-xl bg-canvas border border-line px-3.5 py-2 text-xs text-fg focus:outline-hidden focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-fg mb-1">
                {lang === 'vi' ? 'Số điện thoại' : 'Phone Number'}
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+84 901234567"
                className="w-full rounded-xl bg-canvas border border-line px-3.5 py-2 text-xs text-fg focus:outline-hidden focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-fg mb-1">
                {lang === 'vi' ? 'Cơ quan / Đơn vị' : 'Organization'}
              </label>
              <input
                type="text"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="BIDV, TechCorp, Global Bank..."
                className="w-full rounded-xl bg-canvas border border-line px-3.5 py-2 text-xs text-fg focus:outline-hidden focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-fg mb-1">
                {lang === 'vi' ? 'Chức vụ / Danh xưng' : 'Title / Designation'}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="CEO, Director, VIP Guest..."
                className="w-full rounded-xl bg-canvas border border-line px-3.5 py-2 text-xs text-fg focus:outline-hidden focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-fg mb-1">
              {lang === 'vi' ? 'Trạng thái thẻ vé' : 'Ticket Status'}
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full rounded-xl bg-canvas border border-line px-3.5 py-2 text-xs text-fg focus:outline-hidden focus:border-indigo-500"
            >
              <option value="ACTIVE">
                {lang === 'vi'
                  ? 'Hoạt động (ACTIVE) — Cho phép check-in'
                  : 'Active (ACTIVE) — Eligible for check-in'}
              </option>
              <option value="DISABLED">
                {lang === 'vi'
                  ? 'Vô hiệu hoá (DISABLED) — Thu hồi vé / Bị khoá'
                  : 'Disabled (DISABLED) — Revoked / Locked ticket'}
              </option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-fg mb-1">
              {lang === 'vi' ? 'Ghi chú đặc biệt' : 'Special Notes'}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={lang === 'vi' ? 'Chỗ ngồi bàn số 1, yêu cầu đón tiếp đặc biệt...' : 'VIP seating, dietary requirements...'}
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
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-sm transition"
            >
              <Save className="w-3.5 h-3.5" />
              <span>
                {saving
                  ? lang === 'vi' ? 'Đang lưu...' : 'Saving...'
                  : isEditing
                  ? lang === 'vi' ? 'Lưu Thay Đổi' : 'Save Changes'
                  : lang === 'vi' ? 'Tạo Khách Mời' : 'Create Guest'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
