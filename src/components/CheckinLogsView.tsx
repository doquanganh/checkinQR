import React, { useEffect, useState } from 'react';
import { EventItem, CheckinLog, CheckinResult } from '../types/index.js';
import { api } from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.js';
import {
  FileText,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  RefreshCw,
  Clock,
  Shield,
  Smartphone,
} from 'lucide-react';

interface CheckinLogsViewProps {
  currentEvent: EventItem;
}

export const CheckinLogsView: React.FC<CheckinLogsViewProps> = ({ currentEvent }) => {
  const { lang, t } = useLanguage();
  const [logs, setLogs] = useState<CheckinLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [resultFilter, setResultFilter] = useState('');
  const [search, setSearch] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getLogs(currentEvent.id, {
        result: resultFilter,
        search,
        limit: 150,
      });
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [currentEvent.id, resultFilter, search]);

  const handleExportCSV = () => {
    const headers =
      lang === 'vi'
        ? [
            'Thời gian',
            'Kết quả',
            'Tên khách',
            'Cơ quan',
            'Nhân viên',
            'Thiết bị',
            'Địa chỉ IP',
            'Ghi chú / Thông điệp',
          ]
        : [
            'Timestamp',
            'Result',
            'Guest Name',
            'Organization',
            'Staff Name',
            'Device ID',
            'IP Address',
            'Message / Note',
          ];
    const rows = logs.map((l) => [
      new Date(l.created_at).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US'),
      l.result,
      l.guest_name || 'N/A',
      l.guest_org || 'N/A',
      l.staff_name,
      l.device_id,
      l.ip_address,
      l.message,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.map((x) => `"${(x || '').replace(/"/g, '""')}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Audit_Logs_${currentEvent.event_code}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 p-4 rounded-2xl border border-slate-800 shadow-lg">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-400" />
            <span>{t.auditLogsTitle}</span>
          </h2>
          <p className="text-xs text-slate-400">
            {t.auditLogsDesc}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{t.refresh}</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t.exportLogsCsv}</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-900/90 p-3 rounded-2xl border border-slate-800">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchLogsPlaceholder}
            className="w-full rounded-xl bg-slate-950 border border-slate-700 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
          />
        </div>

        <div>
          <select
            value={resultFilter}
            onChange={(e) => setResultFilter(e.target.value)}
            className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
          >
            <option value="">{t.allResults} ({logs.length})</option>
            <option value="SUCCESS">SUCCESS ({lang === 'vi' ? 'Thành công' : 'Success'})</option>
            <option value="ALREADY_CHECKED_IN">ALREADY_CHECKED_IN ({lang === 'vi' ? 'Quét trùng' : 'Duplicate'})</option>
            <option value="INVALID_QR">INVALID_QR ({lang === 'vi' ? 'Mã sai / Không tồn tại' : 'Invalid QR'})</option>
            <option value="WRONG_EVENT">WRONG_EVENT ({lang === 'vi' ? 'Vé sự kiện khác' : 'Wrong Event'})</option>
            <option value="GUEST_INACTIVE">GUEST_INACTIVE ({lang === 'vi' ? 'Khách bị khoá/thu hồi' : 'Locked / Revoked'})</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-bold uppercase tracking-wider">
                <th className="p-3 pl-4">{t.thTime}</th>
                <th className="p-3">{t.thResult}</th>
                <th className="p-3">{t.thGuest}</th>
                <th className="p-3">{t.thOrg}</th>
                <th className="p-3">{t.thStaff}</th>
                <th className="p-3">{t.thDeviceIp}</th>
                <th className="p-3 pr-4">{t.thNotes}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400 font-sans">
                    {lang === 'vi' ? 'Đang tải nhật ký...' : 'Loading audit logs...'}
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400 font-sans">
                    {t.noLogsFound}
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isSuccess = log.result === 'SUCCESS';
                  const isDuplicate = log.result === 'ALREADY_CHECKED_IN';
                  const isInvalid = log.result === 'INVALID_QR' || log.result === 'WRONG_EVENT';

                  return (
                    <tr key={log.id} className="hover:bg-slate-800/50 transition">
                      <td className="p-3 pl-4 text-slate-400 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleTimeString(lang === 'vi' ? 'vi-VN' : 'en-US')}
                        <span className="text-[10px] text-slate-500 block">
                          {new Date(log.created_at).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US')}
                        </span>
                      </td>

                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-black tracking-wider uppercase inline-flex items-center gap-1 ${
                            isSuccess
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : isDuplicate
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          }`}
                        >
                          {isSuccess ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : isDuplicate ? (
                            <AlertTriangle className="w-3 h-3" />
                          ) : (
                            <XCircle className="w-3 h-3" />
                          )}
                          <span>{log.result}</span>
                        </span>
                      </td>

                      <td className="p-3 font-sans font-bold text-white">
                        {log.guest_name || <span className="text-slate-500 font-mono">N/A</span>}
                      </td>

                      <td className="p-3 font-sans text-slate-300">
                        {log.guest_org || '—'}
                      </td>

                      <td className="p-3 font-sans text-slate-200">
                        {log.staff_name}
                      </td>

                      <td className="p-3 text-slate-400">
                        <div>{log.device_id}</div>
                        <div className="text-[10px] text-slate-500">{log.ip_address}</div>
                      </td>

                      <td className="p-3 pr-4 font-sans text-slate-400 max-w-xs truncate">
                        {log.message}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
