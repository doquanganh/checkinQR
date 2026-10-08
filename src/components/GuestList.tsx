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
  SlidersHorizontal,
} from 'lucide-react';

interface GuestListProps {
  currentEvent: EventItem;
  userRole: Role;
  refreshKey?: number;
  onOpenAddModal: () => void;
  onOpenEditModal: (guest: EventGuest) => void;
  onOpenInvitationModal: (guest: EventGuest) => void;
  onOpenImportModal: () => void;
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
  const [exportOpen, setExportOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

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

  const toolBtn =
    'inline-flex shrink-0 items-center justify-center gap-1.5 h-10 w-10 xl:w-auto xl:px-3 rounded-xl border border-line bg-surface hover:bg-surface-2 text-fg-muted hover:text-fg text-sm font-medium transition cursor-pointer disabled:opacity-60';
  const selectCls =
    'w-full h-10 rounded-xl bg-canvas border border-line px-3 text-base sm:text-sm text-fg focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20';
  const activeFilters = [selectedOrg, selectedInvStatus, selectedCheckStatus].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Header: title, count, actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface p-4 rounded-2xl border border-line">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-extrabold text-fg tracking-tight">{t.guestListTitle}</h2>
            <span className="inline-flex items-center text-xs font-bold px-2.5 py-0.5 rounded-full bg-mint/60 text-carbon dark:bg-mint/15 dark:text-mint whitespace-nowrap">
              {totalGuests.toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US')} {t.guestsCountLabel}
            </span>
          </div>
          <p className="text-xs text-fg-muted mt-1 hidden md:block">{t.guestListDesc}</p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
          {userRole === 'ADMIN' && (
            <button
              onClick={onOpenAddModal}
              className="flex-1 min-w-0 sm:flex-none inline-flex items-center justify-center gap-1.5 h-10 px-2.5 sm:px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span className="hidden min-[440px]:inline sm:inline">{t.addNewGuest}</span>
              <span className="min-[440px]:hidden sm:hidden">{lang === 'vi' ? 'Thêm' : 'Add'}</span>
            </button>
          )}

          <button
            onClick={() => fetchGuests()}
            disabled={loading}
            className={toolBtn}
            title={lang === 'vi' ? 'Làm mới danh sách' : 'Refresh list'}
            aria-label={lang === 'vi' ? 'Làm mới danh sách' : 'Refresh list'}
          >
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden xl:inline">{lang === 'vi' ? 'Làm mới' : 'Refresh'}</span>
          </button>

          {userRole === 'ADMIN' && (
            <>
              <button
                onClick={onOpenImportModal}
                className={toolBtn}
                title={t.importExcelCsv}
                aria-label={t.importExcelCsv}
              >
                <Upload className="w-4 h-4" />
                <span className="hidden xl:inline">{t.importExcelCsv}</span>
              </button>

              <div className="relative">
                <button
                  onClick={() => setExportOpen((v) => !v)}
                  className={toolBtn}
                  title={t.exportReportCsv}
                  aria-label={t.exportReportCsv}
                  aria-expanded={exportOpen}
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden xl:inline">{t.exportReportCsv}</span>
                </button>
                {exportOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setExportOpen(false)} />
                    <div className="absolute right-0 mt-1 w-52 rounded-xl bg-surface p-1 shadow-sm border border-line z-30">
                      <button
                        onClick={() => {
                          setExportOpen(false);
                          handleExportCSV('guests');
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-surface-2 text-fg cursor-pointer"
                      >
                        {t.exportGuests}
                      </button>
                      <button
                        onClick={() => {
                          setExportOpen(false);
                          handleExportCSV('checkin');
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-surface-2 text-fg cursor-pointer"
                      >
                        {t.exportCheckin}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {onOpenSmtpModal && userRole === 'ADMIN' && (
            <button
              onClick={onOpenSmtpModal}
              className={toolBtn}
              title={lang === 'vi' ? 'Cài đặt Email SMTP' : 'Email SMTP settings'}
              aria-label={lang === 'vi' ? 'Cài đặt Email SMTP' : 'Email SMTP settings'}
            >
              <Mail className="w-4 h-4" />
              <span className="hidden xl:inline">{lang === 'vi' ? 'Cài đặt Email' : 'Email Setup'}</span>
            </button>
          )}
        </div>
      </div>

      {/* In-App Toast Notification Banner */}
      {toastMessage && (
        <div
          className={`p-3.5 px-4 rounded-xl border flex items-center justify-between gap-3 text-xs font-semibold shadow-sm transition animate-in fade-in slide-in-from-top-2 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-400/40 text-emerald-400'
              : 'bg-rose-500/10 border-rose-400/40 text-rose-400'
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
            className="text-fg-muted hover:text-fg p-1 rounded-lg hover:bg-surface-2 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search + filters (filters collapse behind a button on phones) */}
      <div className="bg-surface p-3 rounded-2xl border border-line space-y-2.5">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-fg-muted absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={t.searchPlaceholder}
              className="w-full h-10 rounded-xl bg-canvas border border-line pl-10 pr-3 text-base sm:text-sm text-fg placeholder:text-fg-subtle focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`${toolBtn} md:hidden relative`}
            aria-expanded={showFilters}
            aria-label={lang === 'vi' ? 'Bộ lọc' : 'Filters'}
          >
            <SlidersHorizontal className="w-4 h-4" />
            {activeFilters > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-indigo-600 text-white text-xs leading-4 text-center">
                {activeFilters}
              </span>
            )}
          </button>
        </div>

        <div className={`${showFilters ? 'grid' : 'hidden'} md:grid grid-cols-1 md:grid-cols-3 gap-2.5`}>
          <select
            value={selectedOrg}
            onChange={(e) => {
              setSelectedOrg(e.target.value);
              setPage(1);
            }}
            className={selectCls}
          >
            <option value="">{t.filterOrgAll} ({organizations.length})</option>
            {organizations.map((org) => (
              <option key={org} value={org}>
                {org}
              </option>
            ))}
          </select>

          <select
            value={selectedInvStatus}
            onChange={(e) => {
              setSelectedInvStatus(e.target.value);
              setPage(1);
            }}
            className={selectCls}
          >
            <option value="">{t.filterInvAll}</option>
            <option value="SENT">{t.filterInvSent}</option>
            <option value="PENDING">{t.filterInvPending}</option>
            <option value="FAILED">{t.filterInvFailed}</option>
          </select>

          <select
            value={selectedCheckStatus}
            onChange={(e) => {
              setSelectedCheckStatus(e.target.value);
              setPage(1);
            }}
            className={selectCls}
          >
            <option value="">{t.filterCheckAll}</option>
            <option value="CHECKED_IN">{t.filterCheckYes}</option>
            <option value="NOT_CHECKED_IN">{t.filterCheckNo}</option>
          </select>
        </div>
      </div>

      {/* Bulk Action Bar (when rows are checked) */}
      {selectedIds.size > 0 && userRole === 'ADMIN' && (
        <div className="flex items-center justify-between bg-indigo-950/70 border border-indigo-400/40 p-3 px-4 rounded-xl text-xs text-indigo-400 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="font-bold text-fg">
              {t.selectedCount}: {selectedIds.size} {t.guestsCountLabel}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkSend}
              disabled={bulkActionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-bold transition shadow-sm cursor-pointer"
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
              className="px-2.5 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-fg transition cursor-pointer"
            >
              {t.deselectAll}
            </button>
          </div>
        </div>
      )}

      {/* Mobile Card List View (Visible on screens < 640px) */}
      <div className="sm:hidden space-y-2.5">
        {loading ? (
          <div className="p-8 text-center text-fg-muted bg-surface/90 rounded-2xl border border-line">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto mb-2" />
            {t.loadingGuests}
          </div>
        ) : guests.length === 0 ? (
          <div className="p-8 text-center text-fg-muted bg-surface/90 rounded-2xl border border-line text-xs">
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
                    ? 'bg-surface/95 border-emerald-400/40 shadow-sm'
                    : isChecked
                    ? 'bg-indigo-950/40 border-indigo-400/40'
                    : 'bg-surface/90 border-line'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    {userRole === 'ADMIN' && (
                      <button
                        onClick={() => toggleSelect(eg.id)}
                        className="mt-0.5 text-fg-muted hover:text-fg shrink-0"
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-indigo-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    )}
                    <div className="min-w-0">
                      <div className="font-bold text-fg text-sm flex items-center gap-1.5 flex-wrap">
                        <span className="truncate">{g?.full_name}</span>
                        {g?.status === 'DISABLED' && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-400 border border-rose-400/40 font-bold shrink-0">
                            {t.badgeLocked}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-indigo-400 font-mono mt-0.5">
                        {eg.guest_code}
                      </div>
                    </div>
                  </div>

                  {/* Checkin Status Badge */}
                  <div className="shrink-0 text-right">
                    {isCheckedIn ? (
                      <span className="px-2 py-0.5 rounded text-xs font-black bg-emerald-500/10 text-emerald-400 border border-emerald-400/40 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{t.badgeArrived}</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-surface-2 text-fg-muted border border-line inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{t.badgeNotArrived}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Org & Contact Info */}
                <div className="mt-2.5 pt-2.5 border-t border-line/80 text-xs text-fg space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-fg-muted truncate max-w-[200px]">
                      {g?.organization || (lang === 'vi' ? 'Tự do' : 'Independent')}
                    </span>
                    <span className="text-fg-muted">{g?.title || (lang === 'vi' ? 'Khách mời' : 'Guest')}</span>
                  </div>
                  <div className="text-xs text-fg-muted flex items-center gap-2">
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
                <div className="mt-3 pt-2.5 border-t border-line/80 flex flex-wrap items-center justify-between gap-2">
                  <button
                    onClick={() => onOpenInvitationModal(eg)}
                    className="flex-1 min-w-[7.5rem] flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-400/40 font-bold text-xs transition whitespace-nowrap"
                  >
                    <QrCode className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{t.btnViewQrInvite}</span>
                  </button>

                  {/* Check-in Quick Button for both Admin and Staff */}
                  <button
                    onClick={() => handleToggleCheckin(eg)}
                    className={`flex items-center gap-1 py-2 px-2.5 rounded-xl border text-xs font-bold transition whitespace-nowrap ${
                      isCheckedIn
                        ? 'bg-emerald-500/10 border-emerald-400/40 text-emerald-400'
                        : 'bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border-indigo-400/40'
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
                        className="p-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-fg border border-line text-xs transition"
                        title={t.btnEdit}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDeleteGuest(eg.id, g?.full_name)}
                        className="p-2 rounded-xl bg-surface-2 hover:bg-rose-500/10 text-fg-muted hover:text-rose-400 border border-line text-xs transition"
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
      <div className="hidden sm:block rounded-2xl bg-surface/90 border border-line overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-line bg-surface/80 text-fg-muted font-bold uppercase tracking-wider">
                {userRole === 'ADMIN' && (
                  <th className="p-3 pl-4 w-10">
                    <button onClick={toggleSelectAll} className="text-fg-muted hover:text-fg">
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
            <tbody className="divide-y divide-line/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-fg-muted">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto mb-2" />
                    {t.loadingGuests}
                  </td>
                </tr>
              ) : guests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-fg-muted">
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
                      className={`hover:bg-surface-2/50 transition ${
                        isChecked ? 'bg-indigo-950/20' : ''
                      }`}
                    >
                      {userRole === 'ADMIN' && (
                        <td className="p-3 pl-4">
                          <button
                            onClick={() => toggleSelect(eg.id)}
                            className="text-fg-muted hover:text-fg"
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
                      <td className="p-3 font-mono font-bold text-indigo-400">
                        {eg.guest_code}
                      </td>

                      {/* Full Name & Contacts */}
                      <td className="p-3">
                        <div className="font-bold text-fg text-sm flex items-center gap-1.5">
                          <span>{g?.full_name}</span>
                          {g?.status === 'DISABLED' && (
                            <span className="text-xs px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-400 border border-rose-400/40 font-bold">
                              Bị khoá
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-fg-muted flex items-center gap-2 mt-0.5">
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
                        <div className="font-medium text-fg">{g?.organization}</div>
                        <div className="text-xs text-fg-muted">{g?.title}</div>
                      </td>

                      {/* Invitation Status */}
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-bold inline-flex items-center gap-1 ${
                            isSent
                              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-400/40'
                              : eg.invitation_status === 'FAILED'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-400/40'
                              : 'bg-surface-2 text-fg-muted border border-line'
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
                            <span className="px-2 py-0.5 rounded text-xs font-black bg-emerald-500/10 text-emerald-400 border border-emerald-400/40 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>{t.badgeArrived}</span>
                            </span>
                            <span className="text-xs text-fg-muted font-mono mt-0.5">
                              {eg.checked_in_at
                                ? new Date(eg.checked_in_at).toLocaleTimeString(lang === 'vi' ? 'vi-VN' : 'en-US')
                                : ''}
                            </span>
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-surface-2 text-fg-muted border border-line inline-flex items-center gap-1">
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
                            className="p-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-400/40 transition"
                            title="Xem Thư mời & Mã QR riêng của khách"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>

                          {/* Check-in Quick Toggle (for Admin and Staff) */}
                          <button
                            onClick={() => handleToggleCheckin(eg)}
                            className={`p-1.5 rounded-lg border transition ${
                              isCheckedIn
                                ? 'bg-emerald-500/10 border-emerald-400/40 text-emerald-400 hover:bg-emerald-500/20'
                                : 'bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border-indigo-400/40'
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
                                className="p-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-fg transition"
                                title="Sửa thông tin khách"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => handleDeleteGuest(eg.id, g?.full_name)}
                                className="p-1.5 rounded-lg bg-surface-2 hover:bg-rose-500/10 text-fg-muted hover:text-rose-400 transition"
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
        <div className="p-3 px-4 border-t border-line bg-surface/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-fg-muted">
          <div className="whitespace-nowrap">
            {t.showing}{' '}
            <strong className="text-fg">
              {guests.length > 0 ? (page - 1) * limit + 1 : 0} -{' '}
              {Math.min(page * limit, totalGuests)}
            </strong>{' '}
            {t.ofGuests} <strong className="text-fg">{totalGuests.toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US')}</strong> {t.guestsCountLabel}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={limit}
              onChange={(e) => {
                setLimit(parseInt(e.target.value));
                setPage(1);
              }}
              className="rounded-lg bg-surface border border-line px-2 py-1 text-xs text-fg"
            >
              <option value="15">15 {t.perPage}</option>
              <option value="25">25 {t.perPage}</option>
              <option value="50">50 {t.perPage}</option>
              <option value="100">100 {t.perPage}</option>
            </select>

            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 disabled:opacity-40 text-fg"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="font-medium text-fg px-1 whitespace-nowrap">
              {t.pageOf} {page} / {totalPages || 1}
            </span>

            <button
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 disabled:opacity-40 text-fg"
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
            className="bg-surface border border-line/80 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-400/40 flex items-center justify-center text-indigo-400 shrink-0 shadow-sm">
                <Mail className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-fg">
                  {lang === 'vi' ? 'Gửi Thư Mời Cho Khách Đã Chọn' : 'Send Invitations to Selected Guests'}
                </h3>
                <p className="text-xs text-fg-muted mt-1">
                  {lang === 'vi'
                    ? `Bạn có chắc muốn gửi thư mời kèm mã QR token cá nhân hoá đến ${selectedIds.size} khách mời đã chọn?`
                    : `Are you sure you want to send personalized invitation emails with secure QR codes to the ${selectedIds.size} selected guests?`}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-canvas/70 border border-line text-xs space-y-2">
              <div className="flex justify-between items-center text-fg">
                <span>{lang === 'vi' ? 'Số lượng khách nhận thư:' : 'Number of recipients:'}</span>
                <strong className="text-indigo-400 font-mono text-sm">
                  {selectedIds.size} {t.guestsCountLabel}
                </strong>
              </div>
              <div className="flex justify-between items-center text-fg">
                <span>{lang === 'vi' ? 'Trạng thái sau khi gửi:' : 'Status after sending:'}</span>
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-400/40">
                  {lang === 'vi' ? 'ĐÃ GỬI (SENT)' : 'SENT'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setIsConfirmBulkSendOpen(false)}
                disabled={bulkActionLoading}
                className="px-4 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-fg text-xs font-semibold transition cursor-pointer"
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
            className="bg-surface border border-rose-400/40 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-600/20 border border-rose-400/40 flex items-center justify-center text-rose-400 shrink-0 shadow-sm">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-fg">
                  {lang === 'vi' ? 'Xoá Khách Mời' : 'Delete Guest'}
                </h3>
                <p className="text-xs text-fg-muted mt-1">
                  {lang === 'vi'
                    ? `Bạn có chắc muốn xoá khách mời "${guestToDelete.name}" khỏi sự kiện này? Thao tác này không thể hoàn tác.`
                    : `Are you sure you want to remove "${guestToDelete.name}" from this event? This action cannot be undone.`}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setGuestToDelete(null)}
                className="px-4 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-fg text-xs font-semibold transition cursor-pointer"
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
