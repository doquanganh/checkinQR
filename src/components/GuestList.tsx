import React, { useEffect, useState } from 'react';
import { EventItem, EventGuest, Role } from '../types/index.js';
import { api } from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.js';
import {
  Search,
  Filter,
  Plus,
  Sparkles,
  Download,
  Upload,
  Mail,
  QrCode,
  CheckCircle2,
  Clock,
  MoreHorizontal,
  Trash2,
  Edit2,
  ChevronLeft,
  ChevronRight,
  Send,
  Building2,
  CheckSquare,
  Square,
  FileSpreadsheet,
  AlertCircle,
  X,
  Loader2,
  RotateCw,
} from 'lucide-react';

interface GuestListProps {
  currentEvent: EventItem;
  userRole: Role;
  refreshKey?: number;
  onOpenAddModal: () => void;
  onOpenEditModal: (guest: EventGuest) => void;
  onOpenInvitationModal: (guest: EventGuest) => void;
  onOpenImportModal: () => void;
  onOpenBulkGenerate: () => void;
  onOpenSmtpModal?: () => void;
}

export const GuestList: React.FC<GuestListProps> = ({
  currentEvent,
  userRole,
  refreshKey,
  onOpenAddModal,
  onOpenEditModal,
  onOpenInvitationModal,
  onOpenImportModal,
  onOpenBulkGenerate,
  onOpenSmtpModal,
}) => {
  const { lang, t } = useLanguage();
  const [guests, setGuests] = useState<EventGuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedOrg, setSelectedOrg] = useState('');
  const [selectedInvStatus, setSelectedInvStatus] = useState('');
  const [selectedCheckStatus, setSelectedCheckStatus] = useState('');
  const [organizations, setOrganizations] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalGuests, setTotalGuests] = useState(0);

  // Bulk action loading
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [isConfirmBulkSendOpen, setIsConfirmBulkSendOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [guestToDelete, setGuestToDelete] = useState<{ id: string; name: string } | null>(null);

  const fetchGuests = async () => {
    setLoading(true);
    try {
      const res = await api.getEventGuests(currentEvent.id, {
        search,
        org: selectedOrg,
        invitation_status: selectedInvStatus,
        checkin_status: selectedCheckStatus,
        page,
        limit,
      });
      setGuests(res.data);
      setTotalPages(res.pagination.total_pages);
      setTotalGuests(res.pagination.total);
      if (res.filter_options?.organizations) {
        setOrganizations(res.filter_options.organizations);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuests();
  }, [currentEvent.id, search, selectedOrg, selectedInvStatus, selectedCheckStatus, page, limit, refreshKey]);

  // Toggle select individual
  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // Toggle select all on current page
  const toggleSelectAll = () => {
    if (selectedIds.size === guests.length && guests.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(guests.map((g) => g.id)));
    }
  };

  // Bulk Send Invitations - Open Confirm Modal
  const handleBulkSend = () => {
    if (selectedIds.size === 0) return;
    setIsConfirmBulkSendOpen(true);
  };

  const executeBulkSend = async () => {
    if (selectedIds.size === 0) return;
    setBulkActionLoading(true);
    try {
      const res = await api.sendBulkInvitations(currentEvent.id, Array.from(selectedIds));
      setIsConfirmBulkSendOpen(false);
      setSelectedIds(new Set());
      setToastMessage({
        type: 'success',
        text: res.message || (lang === 'vi' ? 'Đã gửi thư mời thành công!' : 'Invitations sent successfully!'),
      });
      setTimeout(() => setToastMessage(null), 5000);
      await fetchGuests();
    } catch (err: any) {
      setIsConfirmBulkSendOpen(false);
      setToastMessage({
        type: 'error',
        text: (lang === 'vi' ? 'Lỗi gửi thư mời: ' : 'Error sending invitations: ') + err.message,
      });
      setTimeout(() => setToastMessage(null), 5000);
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Export CSV
  const handleExportCSV = (type: 'guests' | 'checkin' | 'invitations') => {
    // Generate CSV content
    let headers: string[] = [];
    let rows: string[][] = [];

    if (type === 'guests') {
      headers =
        lang === 'vi'
          ? ['Mã khách', 'Họ và tên', 'Email', 'Số điện thoại', 'Cơ quan', 'Chức vụ', 'Trạng thái vé', 'Check-in']
          : ['Guest Code', 'Full Name', 'Email', 'Phone', 'Organization', 'Title', 'Ticket Status', 'Check-in'];
      rows = guests.map((eg) => [
        eg.guest_code,
        eg.guest?.full_name || '',
        eg.guest?.email || '',
        eg.guest?.phone || '',
        eg.guest?.organization || '',
        eg.guest?.title || '',
        eg.invitation_status,
        eg.checkin_status,
      ]);
    } else if (type === 'checkin') {
      headers =
        lang === 'vi'
          ? ['Mã khách', 'Họ và tên', 'Cơ quan', 'Trạng thái', 'Thời gian Check-in', 'Nhân viên đón']
          : ['Guest Code', 'Full Name', 'Organization', 'Status', 'Check-in Time', 'Staff Name'];
      rows = guests.map((eg) => [
        eg.guest_code,
        eg.guest?.full_name || '',
        eg.guest?.organization || '',
        eg.checkin_status,
        eg.checked_in_at
          ? new Date(eg.checked_in_at).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US')
          : lang === 'vi' ? 'Chưa đến' : 'Not Arrived',
        eg.checked_in_by || '',
      ]);
    }

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.map((x) => `"${(x || '').replace(/"/g, '""')}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Bao_cao_${type}_${currentEvent.event_code}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Toggle Checkin status manually (Admin override)
  const handleToggleCheckin = async (eg: EventGuest) => {
    const nextStatus = eg.checkin_status === 'CHECKED_IN' ? 'NOT_CHECKED_IN' : 'CHECKED_IN';
    await api.updateGuest(eg.id, {
      checkin_status: nextStatus,
      checked_in_by: nextStatus === 'CHECKED_IN' ? 'Admin Manual' : null,
    });
    fetchGuests();
  };

  // Delete guest
  const handleDeleteGuest = (id: string, name?: string) => {
    setGuestToDelete({ id, name: name || '' });
  };

  const executeDeleteGuest = async () => {
    if (!guestToDelete) return;
    try {
      await api.deleteGuest(guestToDelete.id);
      setToastMessage({
        type: 'success',
        text: lang === 'vi' ? `Đã xoá khách mời "${guestToDelete.name}" thành công` : `Successfully deleted guest "${guestToDelete.name}"`,
      });
      setTimeout(() => setToastMessage(null), 4000);
      setGuestToDelete(null);
      await fetchGuests();
    } catch (err: any) {
      setGuestToDelete(null);
      setToastMessage({
        type: 'error',
        text: (lang === 'vi' ? 'Lỗi xoá: ' : 'Delete error: ') + err.message,
      });
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  return (
    <div className="space-y-4">
      {/* Action Toolbar Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 bg-slate-900/90 p-4 rounded-2xl border border-slate-800 shadow-lg">
        <div className="shrink-0 min-w-fit">
          <div className="inline-flex items-center gap-2.5 sm:gap-3 flex-nowrap whitespace-nowrap shrink-0">
            <h2 className="text-base sm:text-lg font-black text-white whitespace-nowrap shrink-0 tracking-tight">
              {t.guestListTitle}
            </h2>
            <span className="inline-flex items-center text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 whitespace-nowrap shrink-0">
              {totalGuests.toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US')} {t.guestsCountLabel}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 hidden sm:block">
            {t.guestListDesc}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => fetchGuests()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition whitespace-nowrap"
            title={lang === 'vi' ? 'Làm mới danh sách khách mời' : 'Refresh guest list'}
          >
            <RotateCw className={`w-3.5 h-3.5 text-indigo-400 ${loading ? 'animate-spin' : ''}`} />
            <span>{lang === 'vi' ? 'Làm mới' : 'Refresh'}</span>
          </button>

          {onOpenSmtpModal && (
            <button
              onClick={onOpenSmtpModal}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 text-xs font-medium transition whitespace-nowrap"
              title={lang === 'vi' ? 'Cấu hình SMTP gửi thư thật' : 'Configure SMTP Email'}
            >
              <Mail className="w-3.5 h-3.5 text-amber-400" />
              <span>{lang === 'vi' ? 'Cài đặt Email' : 'Email Setup'}</span>
            </button>
          )}

          {userRole === 'ADMIN' && (
            <>
              <button
                onClick={onOpenAddModal}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>{t.addNewGuest}</span>
              </button>

              <button
                onClick={onOpenBulkGenerate}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 text-xs font-semibold transition whitespace-nowrap"
                title={t.sampleTooltip}
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>{t.create1000Sample}</span>
              </button>

              <button
                onClick={onOpenImportModal}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition whitespace-nowrap"
              >
                <Upload className="w-3.5 h-3.5 text-indigo-400" />
                <span>{t.importExcelCsv}</span>
              </button>

              <div className="relative group">
                <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition whitespace-nowrap">
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t.exportReportCsv}</span>
                </button>
                <div className="absolute right-0 mt-1 w-48 rounded-xl bg-slate-900 p-1 shadow-2xl border border-slate-700 hidden group-hover:block z-30">
                  <button
                    onClick={() => handleExportCSV('guests')}
                    className="w-full text-left px-3 py-1.5 rounded-lg text-xs hover:bg-slate-800 text-slate-300"
                  >
                    {t.exportGuests}
                  </button>
                  <button
                    onClick={() => handleExportCSV('checkin')}
                    className="w-full text-left px-3 py-1.5 rounded-lg text-xs hover:bg-slate-800 text-emerald-300 font-medium"
                  >
                    {t.exportCheckin}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* In-App Toast Notification Banner */}
      {toastMessage && (
        <div
          className={`p-3.5 px-4 rounded-xl border flex items-center justify-between gap-3 text-xs font-semibold shadow-xl transition animate-in fade-in slide-in-from-top-2 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950/90 border-rose-500/50 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filters & Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 bg-slate-900/90 p-3 rounded-2xl border border-slate-800 shadow-md">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t.searchPlaceholder}
            className="w-full rounded-xl bg-slate-950 border border-slate-700 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
          />
        </div>

        {/* Organization Filter */}
        <div>
          <select
            value={selectedOrg}
            onChange={(e) => {
              setSelectedOrg(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
          >
            <option value="">{t.filterOrgAll} ({organizations.length})</option>
            {organizations.map((org) => (
              <option key={org} value={org}>
                {org}
              </option>
            ))}
          </select>
        </div>

        {/* Invitation Status Filter */}
        <div>
          <select
            value={selectedInvStatus}
            onChange={(e) => {
              setSelectedInvStatus(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
          >
            <option value="">{t.filterInvAll}</option>
            <option value="SENT">{t.filterInvSent} (SENT)</option>
            <option value="PENDING">{t.filterInvPending} (PENDING)</option>
            <option value="FAILED">{t.filterInvFailed} (FAILED)</option>
          </select>
        </div>

        {/* Check-in Status Filter */}
        <div>
          <select
            value={selectedCheckStatus}
            onChange={(e) => {
              setSelectedCheckStatus(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
          >
            <option value="">{t.filterCheckAll}</option>
            <option value="CHECKED_IN">{t.filterCheckYes}</option>
            <option value="NOT_CHECKED_IN">{t.filterCheckNo}</option>
          </select>
        </div>
      </div>

      {/* Bulk Action Bar (when rows are checked) */}
      {selectedIds.size > 0 && userRole === 'ADMIN' && (
        <div className="flex items-center justify-between bg-indigo-950/70 border border-indigo-500/40 p-3 px-4 rounded-xl text-xs text-indigo-200 shadow-lg animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">
              {t.selectedCount}: {selectedIds.size} {t.guestsCountLabel}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkSend}
              disabled={bulkActionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-bold transition shadow-md cursor-pointer"
            >
              {bulkActionLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>
                {bulkActionLoading
                  ? lang === 'vi' ? 'Đang gửi...' : 'Sending...'
                  : t.sendInviteToSelected}
              </span>
            </button>

            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
            >
              {t.deselectAll}
            </button>
          </div>
        </div>
      )}

      {/* Mobile Card List View (Visible on screens < 640px) */}
      <div className="sm:hidden space-y-2.5">
        {loading ? (
          <div className="p-8 text-center text-slate-400 bg-slate-900/90 rounded-2xl border border-slate-800">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto mb-2" />
            {t.loadingGuests}
          </div>
        ) : guests.length === 0 ? (
          <div className="p-8 text-center text-slate-400 bg-slate-900/90 rounded-2xl border border-slate-800 text-xs">
            {t.noMatchingGuests}
          </div>
        ) : (
          guests.map((eg) => {
            const g = eg.guest;
            const isChecked = selectedIds.has(eg.id);
            const isCheckedIn = eg.checkin_status === 'CHECKED_IN';
            const isSent = eg.invitation_status === 'SENT';

            return (
              <div
                key={eg.id}
                className={`rounded-2xl p-4 border transition ${
                  isCheckedIn
                    ? 'bg-slate-900/95 border-emerald-500/40 shadow-lg'
                    : isChecked
                    ? 'bg-indigo-950/40 border-indigo-500/50'
                    : 'bg-slate-900/90 border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    {userRole === 'ADMIN' && (
                      <button
                        onClick={() => toggleSelect(eg.id)}
                        className="mt-0.5 text-slate-400 hover:text-white shrink-0"
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-indigo-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    )}
                    <div className="min-w-0">
                      <div className="font-bold text-white text-sm flex items-center gap-1.5 flex-wrap">
                        <span className="truncate">{g?.full_name}</span>
                        {g?.status === 'DISABLED' && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold shrink-0">
                            {t.badgeLocked}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-indigo-300 font-mono mt-0.5">
                        {eg.guest_code}
                      </div>
                    </div>
                  </div>

                  {/* Checkin Status Badge */}
                  <div className="shrink-0 text-right">
                    {isCheckedIn ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{t.badgeArrived}</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700 inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{t.badgeNotArrived}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Org & Contact Info */}
                <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 text-xs text-slate-300 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 truncate max-w-[200px]">
                      {g?.organization || (lang === 'vi' ? 'Tự do' : 'Independent')}
                    </span>
                    <span className="text-slate-400">{g?.title || (lang === 'vi' ? 'Khách mời' : 'Guest')}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-2">
                    {g?.phone && <span>{g.phone}</span>}
                    {g?.email && (
                      <>
                        <span>•</span>
                        <span className="truncate max-w-[160px]">{g.email}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Bottom Action Toolbar */}
                <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <button
                    onClick={() => onOpenInvitationModal(eg)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 font-bold text-xs transition whitespace-nowrap"
                  >
                    <QrCode className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{t.btnViewQrInvite}</span>
                  </button>

                  {/* Check-in Quick Button for both Admin and Staff */}
                  <button
                    onClick={() => handleToggleCheckin(eg)}
                    className={`flex items-center gap-1 py-2 px-2.5 rounded-xl border text-xs font-bold transition whitespace-nowrap ${
                      isCheckedIn
                        ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30'
                    }`}
                    title={isCheckedIn ? 'Huỷ check-in' : 'Xác nhận check-in'}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{isCheckedIn ? t.btnCheckedIn : t.btnCheckin}</span>
                  </button>

                  {userRole === 'ADMIN' && (
                    <>
                      <button
                        onClick={() => onOpenEditModal(eg)}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs transition"
                        title={t.btnEdit}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDeleteGuest(eg.id, g?.full_name)}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950/50 text-slate-400 hover:text-rose-400 border border-slate-700 text-xs transition"
                        title={t.btnDelete}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Guests Table (Hidden on small mobile screens, visible on sm+) */}
      <div className="hidden sm:block rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-bold uppercase tracking-wider">
                {userRole === 'ADMIN' && (
                  <th className="p-3 pl-4 w-10">
                    <button onClick={toggleSelectAll} className="text-slate-400 hover:text-white">
                      {selectedIds.size === guests.length && guests.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-indigo-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                )}
                <th className="p-3 whitespace-nowrap">{t.thGuestCode}</th>
                <th className="p-3 whitespace-nowrap">{t.thNameContact}</th>
                <th className="p-3 whitespace-nowrap">{t.thOrgTitle}</th>
                <th className="p-3 whitespace-nowrap">{t.thInvitation}</th>
                <th className="p-3 whitespace-nowrap">{t.thCheckinStatus}</th>
                <th className="p-3 pr-4 text-right whitespace-nowrap">{t.thActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto mb-2" />
                    {t.loadingGuests}
                  </td>
                </tr>
              ) : guests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    {t.noMatchingGuests}
                  </td>
                </tr>
              ) : (
                guests.map((eg) => {
                  const g = eg.guest;
                  const isChecked = selectedIds.has(eg.id);
                  const isCheckedIn = eg.checkin_status === 'CHECKED_IN';
                  const isSent = eg.invitation_status === 'SENT';

                  return (
                    <tr
                      key={eg.id}
                      className={`hover:bg-slate-800/50 transition ${
                        isChecked ? 'bg-indigo-950/20' : ''
                      }`}
                    >
                      {userRole === 'ADMIN' && (
                        <td className="p-3 pl-4">
                          <button
                            onClick={() => toggleSelect(eg.id)}
                            className="text-slate-400 hover:text-white"
                          >
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 text-indigo-400" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                      )}

                      {/* Code */}
                      <td className="p-3 font-mono font-bold text-indigo-300">
                        {eg.guest_code}
                      </td>

                      {/* Full Name & Contacts */}
                      <td className="p-3">
                        <div className="font-bold text-white text-sm flex items-center gap-1.5">
                          <span>{g?.full_name}</span>
                          {g?.status === 'DISABLED' && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">
                              Bị khoá
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>{g?.email}</span>
                          {g?.phone && (
                            <>
                              <span>•</span>
                              <span>{g?.phone}</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Org & Title */}
                      <td className="p-3">
                        <div className="font-medium text-slate-200">{g?.organization}</div>
                        <div className="text-[11px] text-slate-400">{g?.title}</div>
                      </td>

                      {/* Invitation Status */}
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 ${
                            isSent
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                              : eg.invitation_status === 'FAILED'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          <Mail className="w-3 h-3" />
                          <span>{isSent ? (lang === 'vi' ? 'Đã gửi' : 'Sent') : eg.invitation_status}</span>
                        </span>
                      </td>

                      {/* Check-in Status */}
                      <td className="p-3">
                        {isCheckedIn ? (
                          <div className="inline-flex flex-col">
                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>{t.badgeArrived}</span>
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {eg.checked_in_at
                                ? new Date(eg.checked_in_at).toLocaleTimeString(lang === 'vi' ? 'vi-VN' : 'en-US')
                                : ''}
                            </span>
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700 inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{t.badgeNotArrived}</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3 pr-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Xem QR & Thư mời */}
                          <button
                            onClick={() => onOpenInvitationModal(eg)}
                            className="p-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 transition"
                            title="Xem Thư mời & Mã QR riêng của khách"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>

                          {/* Check-in Quick Toggle (for Admin and Staff) */}
                          <button
                            onClick={() => handleToggleCheckin(eg)}
                            className={`p-1.5 rounded-lg border transition ${
                              isCheckedIn
                                ? 'bg-amber-950/30 border-amber-500/30 text-amber-300 hover:bg-amber-900/40'
                                : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300 hover:bg-emerald-900/40'
                            }`}
                            title={isCheckedIn ? 'Huỷ trạng thái check-in' : 'Check-in thủ công'}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>

                          {/* Edit / Delete (for Admin) */}
                          {userRole === 'ADMIN' && (
                            <>
                              <button
                                onClick={() => onOpenEditModal(eg)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                                title="Sửa thông tin khách"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => handleDeleteGuest(eg.id, g?.full_name)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/50 text-slate-400 hover:text-rose-400 transition"
                                title="Xóa khách"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-3 px-4 border-t border-slate-800 bg-slate-900/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="whitespace-nowrap">
            {t.showing}{' '}
            <strong className="text-white">
              {guests.length > 0 ? (page - 1) * limit + 1 : 0} -{' '}
              {Math.min(page * limit, totalGuests)}
            </strong>{' '}
            {t.ofGuests} <strong className="text-white">{totalGuests.toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US')}</strong> {t.guestsCountLabel}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={limit}
              onChange={(e) => {
                setLimit(parseInt(e.target.value));
                setPage(1);
              }}
              className="rounded-lg bg-slate-900 border border-slate-700 px-2 py-1 text-xs text-slate-300"
            >
              <option value="15">15 {t.perPage}</option>
              <option value="25">25 {t.perPage}</option>
              <option value="50">50 {t.perPage}</option>
              <option value="100">100 {t.perPage}</option>
            </select>

            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="font-medium text-white px-1 whitespace-nowrap">
              {t.pageOf} {page} / {totalPages || 1}
            </span>

            <button
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 1. Modal Xác nhận Gửi Thư Mời Hàng Loạt */}
      {isConfirmBulkSendOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 shadow-lg">
                <Mail className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-white">
                  {lang === 'vi' ? 'Gửi Thư Mời Cho Khách Đã Chọn' : 'Send Invitations to Selected Guests'}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {lang === 'vi'
                    ? `Bạn có chắc muốn gửi thư mời kèm mã QR token cá nhân hoá đến ${selectedIds.size} khách mời đã chọn?`
                    : `Are you sure you want to send personalized invitation emails with secure QR codes to the ${selectedIds.size} selected guests?`}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 text-xs space-y-2">
              <div className="flex justify-between items-center text-slate-300">
                <span>{lang === 'vi' ? 'Số lượng khách nhận thư:' : 'Number of recipients:'}</span>
                <strong className="text-indigo-400 font-mono text-sm">
                  {selectedIds.size} {t.guestsCountLabel}
                </strong>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>{lang === 'vi' ? 'Trạng thái sau khi gửi:' : 'Status after sending:'}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {lang === 'vi' ? 'ĐÃ GỬI (SENT)' : 'SENT'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setIsConfirmBulkSendOpen(false)}
                disabled={bulkActionLoading}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                {lang === 'vi' ? 'Hủy' : 'Cancel'}
              </button>
              <button
                onClick={executeBulkSend}
                disabled={bulkActionLoading}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition cursor-pointer"
              >
                {bulkActionLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{lang === 'vi' ? 'Đang gửi...' : 'Sending...'}</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>{lang === 'vi' ? 'Xác Nhận & Gửi Ngay' : 'Confirm & Send Now'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal Xác nhận Xoá Khách Mời */}
      {guestToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="bg-slate-900 border border-rose-500/30 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0 shadow-lg">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-white">
                  {lang === 'vi' ? 'Xoá Khách Mời' : 'Delete Guest'}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {lang === 'vi'
                    ? `Bạn có chắc muốn xoá khách mời "${guestToDelete.name}" khỏi sự kiện này? Thao tác này không thể hoàn tác.`
                    : `Are you sure you want to remove "${guestToDelete.name}" from this event? This action cannot be undone.`}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setGuestToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                {lang === 'vi' ? 'Hủy' : 'Cancel'}
              </button>
              <button
                onClick={executeDeleteGuest}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/30 transition cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{lang === 'vi' ? 'Xoá Khách' : 'Delete Guest'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
