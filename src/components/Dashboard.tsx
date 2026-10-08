import React, { useEffect, useState } from 'react';
import { EventItem, CheckinStats, CheckinLog } from '../types/index.js';
import { api } from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.js';
import { resultLabel } from '../utils/resultLabel.js';
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
}

export const Dashboard: React.FC<DashboardProps> = ({
  currentEvent,
  onNavigateTab,
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

  const nf = (n: number) => n.toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US');

  return (
    <div className="space-y-5">
      {/* Event header */}
      <section className="rounded-2xl bg-mint text-carbon border border-carbon/10 dark:bg-carbon dark:text-white dark:border-white/10 p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-carbon/10 text-carbon dark:bg-mint/15 dark:text-mint">
              <span className="w-1.5 h-1.5 rounded-full bg-carbon dark:bg-mint animate-pulse" />
              {t.liveRealtime}
            </span>
            <span className="text-xs text-carbon/60 dark:text-white/60 font-mono">{currentEvent.event_code}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-carbon dark:text-white tracking-tight">{currentEvent.event_name}</h1>
          <p className="text-sm text-carbon/70 dark:text-white/70 mt-1 truncate">{currentEvent.location}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onNavigateTab('scanner')}
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-carbon hover:bg-carbon/90 text-white dark:bg-mint dark:hover:bg-white dark:text-carbon font-bold text-sm transition cursor-pointer"
          >
            <QrCode className="w-4 h-4" />
            <span>{t.scanQrNow}</span>
          </button>
          <button
            onClick={handleReset}
            disabled={resetting}
            className="inline-flex items-center justify-center gap-1.5 h-11 px-3.5 rounded-xl border border-carbon/20 bg-white/40 hover:bg-white/70 text-carbon/80 hover:text-carbon dark:border-white/20 dark:bg-white/5 dark:hover:bg-white/10 dark:text-white/80 dark:hover:text-white text-sm font-medium transition cursor-pointer"
            title={t.resetTooltip}
          >
            <RotateCcw className={`w-4 h-4 ${resetting ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{t.resetCheckin}</span>
          </button>
        </div>
      </section>

      {/* Progress: the two numbers that matter on event day */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <section className="lg:col-span-2 rounded-2xl bg-surface border border-line p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-fg-muted">{t.progressCheckinTitle}</h2>
              <div className="mt-2 flex items-baseline gap-2 flex-wrap">
                <span className="text-4xl sm:text-5xl font-extrabold text-fg tabular-nums">{nf(s.checked_in_count)}</span>
                <span className="text-base sm:text-lg text-fg-muted">
                  / {nf(s.total_guests)} {t.unitPeople}
                </span>
              </div>
            </div>
            <span className="text-3xl sm:text-4xl font-extrabold text-emerald-500 tabular-nums">{s.checkin_percentage}%</span>
          </div>
          <div
            className="mt-5 h-3 rounded-full bg-surface-2 overflow-hidden"
            role="progressbar"
            aria-valuenow={s.checkin_percentage}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${s.checkin_percentage}%` }} />
          </div>
          <p className="mt-3 text-sm text-fg-muted">
            {nf(s.not_checked_in_count)} {t.unitPeople} · {t.kpiNotCheckedIn}
          </p>
        </section>

        <section className="rounded-2xl bg-surface border border-line p-5 sm:p-6 flex flex-col">
          <h2 className="text-sm font-semibold text-fg-muted">{t.progressInviteTitle}</h2>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold text-fg tabular-nums">{nf(s.invited_count)}</span>
            <span className="text-fg-muted">/ {nf(s.total_guests)}</span>
          </div>
          <div
            className="mt-4 h-2.5 rounded-full bg-surface-2 overflow-hidden"
            role="progressbar"
            aria-valuenow={s.invitation_percentage}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-full rounded-full bg-indigo-500 transition-all duration-700" style={{ width: `${s.invitation_percentage}%` }} />
          </div>
          <p className="mt-3 text-sm text-fg-muted">
            {t.pendingCountLabel}: <strong className="text-amber-400">{nf(s.pending_invitation_count)}</strong>
          </p>
          <button
            onClick={() => onNavigateTab('invitations')}
            className="mt-auto pt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-400 hover:text-indigo-400 cursor-pointer self-start"
          >
            <span>{lang === 'vi' ? 'Gửi thư mời' : 'Send invitations'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </section>
      </div>

      {/* Middle Grid: Top Organizations & Real-time Live Log Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Organizations Breakdown */}
        <div className="lg:col-span-1 rounded-2xl bg-surface border border-line p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-fg flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-400" /> {t.statsByOrgTitle}
            </h3>
            <span className="text-xs text-fg-muted font-semibold">Top 8</span>
          </div>

          <div className="space-y-3">
            {s.organization_breakdown.length === 0 ? (
              <p className="text-xs text-fg-muted text-center py-6">{t.noData}</p>
            ) : (
              s.organization_breakdown.map((item, idx) => {
                const pct = item.total > 0 ? Math.round((item.checked_in / item.total) * 100) : 0;
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-fg truncate max-w-[160px]">
                        {item.name}
                      </span>
                      <span className="text-fg-muted font-mono text-xs">
                        <strong className="text-emerald-400">{item.checked_in}</strong> / {item.total} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-surface rounded-full h-1.5 overflow-hidden">
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
        <div className="lg:col-span-2 rounded-2xl bg-surface border border-line p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-fg flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" /> {t.liveMonitoringTitle}
                </h3>
                <p className="text-xs text-fg-muted">
                  {lang === 'vi'
                    ? 'Ghi nhận tất cả lượt quét thành công, quét trùng, hoặc vé sai'
                    : 'Recording all successful scans, duplicates, or invalid tickets'}
                </p>
              </div>
              <button
                onClick={() => onNavigateTab('logs')}
                className="text-xs font-semibold text-indigo-400 hover:text-indigo-400 flex items-center gap-1 cursor-pointer"
              >
                <span>{lang === 'vi' ? 'Xem tất cả' : 'View all'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2">
              {recentLogs.length === 0 ? (
                <div className="text-center py-8 text-fg-muted text-xs">
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
                          ? 'bg-emerald-500/10 border-emerald-400/40 text-emerald-400'
                          : isDuplicate
                          ? 'bg-amber-500/10 border-amber-400/40 text-amber-400'
                          : 'bg-rose-500/10 border-rose-400/40 text-rose-400'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                        <span className="font-mono text-xs text-fg-muted shrink-0">{timeStr}</span>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-fg truncate max-w-[200px] sm:max-w-[260px]">
                            {log.guest_name || (lang === 'vi' ? 'Khách không xác định' : 'Unknown Guest')}
                          </div>
                          <div className="text-xs text-fg-muted truncate">
                            {log.guest_org || (lang === 'vi' ? 'Hệ thống' : 'System')} • {log.staff_name}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${
                            isSuccess
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-400/40'
                              : isDuplicate
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-400/40'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-400/40'
                          }`}
                        >
                          {resultLabel(log.result, lang)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-xs text-fg-muted">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              {lang === 'vi' ? 'Đang đồng bộ tự động với các bàn soát vé' : 'Auto-syncing live with check-in gates'}
            </span>
          </div>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {isConfirmResetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="bg-surface border border-amber-400/40 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-600/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shrink-0 shadow-sm">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-fg">
                  {lang === 'vi' ? 'Đặt Lại Trạng Thái Check-in' : 'Reset Check-in Status'}
                </h3>
                <p className="text-xs text-fg-muted mt-1">
                  {t.resetConfirm}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setIsConfirmResetOpen(false)}
                className="px-4 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-fg text-xs font-semibold transition cursor-pointer"
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
