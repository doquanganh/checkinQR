import React, { useEffect, useState } from 'react';
import { EventItem, CheckinStats, CheckinLog } from '../types/index.js';
import { api } from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.js';
import {
  Users,
  UserCheck,
  Mail,
  Clock,
  TrendingUp,
  Building2,
  QrCode,
  Zap,
  RotateCcw,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';

interface DashboardProps {
  currentEvent: EventItem;
  onNavigateTab: (tab: string) => void;
  onOpenBulkGenerate: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  currentEvent,
  onNavigateTab,
  onOpenBulkGenerate,
}) => {
  const { lang, t } = useLanguage();
  const [stats, setStats] = useState<CheckinStats | null>(null);
  const [recentLogs, setRecentLogs] = useState<CheckinLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [isConfirmResetOpen, setIsConfirmResetOpen] = useState(false);

  const loadData = async () => {
    if (!currentEvent?.id) return;
    try {
      const [statsData, logsData] = await Promise.all([
        api.getStats(currentEvent.id),
        api.getLogs(currentEvent.id, { limit: 8 }),
      ]);
      if (statsData) setStats(statsData);
      if (logsData) setRecentLogs(logsData);
    } catch {
      // Safe fallback - keep existing state on transient connection blips
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentEvent?.id) return;
    loadData();

    // SSE Real-time auto update
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`/api/events/${currentEvent.id}/stream`);
      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'CHECKIN_SUCCESS' || payload.type === 'LOG_CREATED') {
            loadData();
          }
        } catch {}
      };
      eventSource.onerror = () => {
        // Close on error to prevent browser socket exhaustion in iframes
        eventSource?.close();
        eventSource = null;
      };
    } catch {
      eventSource = null;
    }

    // Fallback polling every 10s
    const timer = setInterval(loadData, 10000);
    return () => {
      clearInterval(timer);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [currentEvent.id]);

  const handleReset = () => {
    setIsConfirmResetOpen(true);
  };

  const executeReset = async () => {
    setIsConfirmResetOpen(false);
    setResetting(true);
    await api.resetCheckin({ eventId: currentEvent.id });
    await loadData();
    setResetting(false);
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500" />
      </div>
    );
  }

  const s = stats || {
    total_guests: 0,
    checked_in_count: 0,
    not_checked_in_count: 0,
    checkin_percentage: 0,
    invited_count: 0,
    pending_invitation_count: 0,
    invitation_percentage: 0,
    organization_breakdown: [],
    recent_checkins_hourly: [],
  };

  return (
    <div className="space-y-6">
      {/* Top Welcome & Event Status Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-indigo-900/60 via-slate-800 to-slate-900 border border-indigo-500/30 p-4 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3.5 sm:gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                {t.liveRealtime}
              </span>
              <span className="text-[11px] sm:text-xs text-slate-400 font-mono">
                {t.eventCode}: {currentEvent.event_code}
              </span>
            </div>
            <h1 className="text-lg sm:text-2xl font-black text-white tracking-tight leading-snug">
              {currentEvent.event_name}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 flex items-center gap-2">
              <span className="line-clamp-1">{currentEvent.location}</span>
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 pt-2 md:pt-0">
            <button
              onClick={() => onNavigateTab('scanner')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-600/25 transition transform hover:-translate-y-0.5 active:translate-y-0 whitespace-nowrap shrink-0"
            >
              <QrCode className="w-4 h-4 shrink-0" />
              <span>{t.scanQrNow}</span>
            </button>

            <button
              onClick={onOpenBulkGenerate}
              className="inline-flex items-center justify-center gap-1.5 h-10 px-3.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-200 text-xs font-semibold transition whitespace-nowrap cursor-pointer"
              title={t.sampleGenTooltip}
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-300 shrink-0" />
              <span>{t.gen1000Guests}</span>
            </button>

            <button
              onClick={handleReset}
              disabled={resetting}
              className="inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium transition whitespace-nowrap cursor-pointer"
              title={t.resetTooltip}
            >
              <RotateCcw className={`w-3.5 h-3.5 shrink-0 ${resetting ? 'animate-spin' : ''}`} />
              <span>{t.resetCheckin}</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Guests */}
        <div className="rounded-2xl bg-slate-800/80 border border-slate-800 p-4 shadow-lg hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>{t.kpiTotalGuests}</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-white">
              {s.total_guests.toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US')}
            </span>
            <span className="text-xs text-slate-400">{t.unitPeople}</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            {t.capacityReady}
          </div>
        </div>

        {/* Checked-In */}
        <div className="rounded-2xl bg-slate-800/80 border border-emerald-500/30 p-4 shadow-lg hover:border-emerald-500/50 transition">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span className="text-emerald-400 font-semibold">{t.kpiCheckedIn}</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-emerald-400">
              {s.checked_in_count.toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US')}
            </span>
            <span className="text-xs text-slate-400">/ {s.total_guests}</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-300 font-semibold">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{s.checkin_percentage}% {t.arrivalRate}</span>
          </div>
        </div>

        {/* Chưa Check-in */}
        <div className="rounded-2xl bg-slate-800/80 border border-slate-800 p-4 shadow-lg hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>{t.kpiNotCheckedIn}</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-amber-400">
              {s.not_checked_in_count.toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US')}
            </span>
            <span className="text-xs text-slate-400">{t.unitPeople}</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            {100 - s.checkin_percentage}% {t.notArrivedYet}
          </div>
        </div>

        {/* Đã gửi thư mời */}
        <div className="rounded-2xl bg-slate-800/80 border border-slate-800 p-4 shadow-lg hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>{t.kpiInvited}</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
              <Mail className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-cyan-400">
              {s.invited_count.toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US')}
            </span>
            <span className="text-xs text-slate-400">/ {s.total_guests}</span>
          </div>
          <div className="mt-2 text-[11px] text-cyan-300 font-semibold">
            <span>{s.invitation_percentage}% {t.invitationRate}</span>
          </div>
        </div>
      </div>

      {/* Progress Bars (Section 15 requirements) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Check-in Progress Bar Card */}
        <div className="rounded-2xl bg-slate-800/80 border border-slate-800 p-5 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-400" /> {t.progressCheckinTitle}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {t.progressCheckinDesc}
              </p>
            </div>
            <span className="text-lg font-black text-emerald-400">
              {s.checkin_percentage}%
            </span>
          </div>

          {/* Graphical Progress Bar */}
          <div className="w-full bg-slate-800 rounded-full h-4 overflow-hidden p-0.5 border border-slate-700">
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-700 shadow-sm"
              style={{ width: `${s.checkin_percentage}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-xs mt-3 text-slate-300">
            <span>
              {t.checkedInLabel}: <strong className="text-emerald-400">{s.checked_in_count}</strong>
            </span>
            <span>
              {t.totalGuestsLabel}: <strong className="text-white">{s.total_guests}</strong>
            </span>
          </div>
        </div>

        {/* Invitation Progress Bar Card */}
        <div className="rounded-2xl bg-slate-800/80 border border-slate-800 p-5 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Mail className="w-4 h-4 text-cyan-400" /> {t.progressInviteTitle}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {t.progressInviteDesc}
              </p>
            </div>
            <span className="text-lg font-black text-cyan-400">
              {s.invitation_percentage}%
            </span>
          </div>

          {/* Graphical Progress Bar */}
          <div className="w-full bg-slate-800 rounded-full h-4 overflow-hidden p-0.5 border border-slate-700">
            <div
              className="bg-gradient-to-r from-cyan-500 to-indigo-500 h-full rounded-full transition-all duration-700 shadow-sm"
              style={{ width: `${s.invitation_percentage}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-xs mt-3 text-slate-300">
            <span>
              {t.invitedCountLabel}: <strong className="text-cyan-400">{s.invited_count}</strong>
            </span>
            <span>
              {t.pendingCountLabel}: <strong className="text-amber-400">{s.pending_invitation_count}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Middle Grid: Top Organizations & Real-time Live Log Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Organizations Breakdown */}
        <div className="lg:col-span-1 rounded-2xl bg-slate-800/80 border border-slate-800 p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-400" /> {t.statsByOrgTitle}
            </h3>
            <span className="text-xs text-slate-400 font-semibold">Top 8</span>
          </div>

          <div className="space-y-3">
            {s.organization_breakdown.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">{t.noData}</p>
            ) : (
              s.organization_breakdown.map((item, idx) => {
                const pct = item.total > 0 ? Math.round((item.checked_in / item.total) * 100) : 0;
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-200 truncate max-w-[160px]">
                        {item.name}
                      </span>
                      <span className="text-slate-400 font-mono text-[11px]">
                        <strong className="text-emerald-400">{item.checked_in}</strong> / {item.total} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-indigo-500 h-full rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Real-time Check-in Feed (Section 17) */}
        <div className="lg:col-span-2 rounded-2xl bg-slate-800/80 border border-slate-800 p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" /> {t.liveMonitoringTitle}
                </h3>
                <p className="text-xs text-slate-400">
                  {lang === 'vi'
                    ? 'Ghi nhận tất cả lượt quét thành công, quét trùng, hoặc vé sai'
                    : 'Recording all successful scans, duplicates, or invalid tickets'}
                </p>
              </div>
              <button
                onClick={() => onNavigateTab('logs')}
                className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
              >
                <span>{lang === 'vi' ? 'Xem tất cả' : 'View all'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2">
              {recentLogs.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  {lang === 'vi'
                    ? 'Chưa có lượt quét nào gần đây. Hãy mở màn hình quét để bắt đầu đón khách!'
                    : 'No recent scans yet. Open the scanner to start welcoming guests!'}
                </div>
              ) : (
                recentLogs.map((log) => {
                  const isSuccess = log.result === 'SUCCESS';
                  const isDuplicate = log.result === 'ALREADY_CHECKED_IN';
                  const isInvalid = log.result === 'INVALID_QR' || log.result === 'WRONG_EVENT';
                  const timeStr = new Date(log.created_at).toLocaleTimeString(lang === 'vi' ? 'vi-VN' : 'en-US');

                  return (
                    <div
                      key={log.id}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition ${
                        isSuccess
                          ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                          : isDuplicate
                          ? 'bg-amber-950/20 border-amber-500/30 text-amber-200'
                          : 'bg-rose-950/20 border-rose-500/30 text-rose-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                        <span className="font-mono text-[11px] text-slate-400 shrink-0">{timeStr}</span>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-white truncate max-w-[200px] sm:max-w-[260px]">
                            {log.guest_name || (lang === 'vi' ? 'Khách không xác định' : 'Unknown Guest')}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {log.guest_org || (lang === 'vi' ? 'Hệ thống' : 'System')} • {log.staff_name}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                            isSuccess
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : isDuplicate
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          }`}
                        >
                          {log.result}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              {lang === 'vi' ? 'Đang đồng bộ tự động với các bàn soát vé' : 'Auto-syncing live with check-in gates'}
            </span>
            <button
              onClick={() => onNavigateTab('race-test')}
              className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              {lang === 'vi' ? 'Kiểm thử Race-Condition' : 'Race-Condition Test'}
            </button>
          </div>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {isConfirmResetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="bg-slate-900 border border-amber-500/30 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-600/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-lg">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-white">
                  {lang === 'vi' ? 'Đặt Lại Trạng Thái Check-in' : 'Reset Check-in Status'}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {t.resetConfirm}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setIsConfirmResetOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                {lang === 'vi' ? 'Hủy' : 'Cancel'}
              </button>
              <button
                onClick={executeReset}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs font-bold shadow-lg shadow-amber-600/30 transition cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{lang === 'vi' ? 'Xác Nhận Reset' : 'Confirm Reset'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
