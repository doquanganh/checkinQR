import React, { useState } from 'react';
import { EventItem, EventGuest } from '../types/index.js';
import { api } from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.js';
import {
  Zap,
  ShieldCheck,
  AlertTriangle,
  Play,
  RotateCcw,
  CheckCircle2,
  Clock,
  Cpu,
} from 'lucide-react';

interface RaceConditionSimulatorProps {
  currentEvent: EventItem;
}

export const RaceConditionSimulator: React.FC<RaceConditionSimulatorProps> = ({ currentEvent }) => {
  const { lang, t } = useLanguage();
  const [concurrency, setConcurrency] = useState(3);
  const [testGuestCode, setTestGuestCode] = useState('G202600001');
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runTest = async () => {
    setTesting(true);
    setTestResults(null);
    setError(null);
    try {
      const data = await api.testRaceCondition(currentEvent.id, testGuestCode, concurrency);
      setTestResults(data);
    } catch (err: any) {
      setError(err.message || 'Error running race test');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Intro Header */}
      <div className="rounded-2xl bg-gradient-to-r from-amber-950/60 via-slate-900 to-slate-900 border border-amber-500/40 p-6 shadow-xl">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
            SECTION 13 VALIDATION
          </span>
          <span className="text-xs text-slate-400">Atomic Lock & Mutex Engine</span>
        </div>
        <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-400" />
          <span>{t.raceTitle}</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
          {lang === 'vi'
            ? 'Mô phỏng trường hợp 2 hoặc nhiều nhân viên tại các cửa soát vé khác nhau cùng quét một mã QR của khách tại cùng một microsecond. Hệ thống kích hoạt cơ chế khóa nguyên tử (Atomic CAS & Mutex Serialization) để chỉ duy nhất 1 request đầu tiên được SUCCESS, toàn bộ các request còn lại nhận về ngay ALREADY CHECKED IN!'
            : 'Simulates the scenario where 2 or more gate attendants scan the exact same QR code simultaneously. The atomic mutex lock guarantees that exactly 1 request succeeds, while all concurrent attempts immediately receive ALREADY CHECKED IN.'}
        </p>
      </div>

      {/* Simulator Control Panel */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-6 shadow-xl space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              {t.guestCodeOrToken}
            </label>
            <input
              type="text"
              value={testGuestCode}
              onChange={(e) => setTestGuestCode(e.target.value)}
              placeholder="Ví dụ: G202600001"
              className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3.5 py-2.5 text-xs text-white font-mono focus:outline-hidden focus:border-amber-500"
            />
            <div className="mt-1 text-[11px] text-slate-400">
              {lang === 'vi' ? 'Mặc định:' : 'Default:'} <strong className="text-white">G202600001</strong> ({lang === 'vi' ? 'Nguyễn Quang Anh - BIDV' : 'Sample Guest'})
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              {t.concurrencyLabel}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[2, 3, 5].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setConcurrency(num)}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                    concurrency === num
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Cpu className="w-3.5 h-3.5" />
                  <span>{num} {t.threadsUnit}</span>
                </button>
              ))}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              {lang === 'vi'
                ? `Bắn ${concurrency} HTTP request đồng thời qua Promise.all`
                : `Fires ${concurrency} parallel HTTP requests simultaneously via Promise.all`}
            </div>
          </div>
        </div>

        <button
          onClick={runTest}
          disabled={testing}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 text-white font-black text-sm shadow-xl shadow-amber-600/30 transition transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 cursor-pointer"
        >
          <Play className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
          <span>
            {testing
              ? t.btnFiring
              : lang === 'vi'
              ? `BẮT ĐẦU TEST BẮN ${concurrency} REQUEST CÙNG LÚC`
              : `START TEST FIRING ${concurrency} REQUESTS CONCURRENTLY`}
          </span>
        </button>

        {error && (
          <div className="mt-3 p-3 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-200 text-xs font-semibold">
            {error}
          </div>
        )}
      </div>

      {/* Results Display */}
      {testResults && (
        <div className="space-y-4 animate-in fade-in">
          {/* Summary Banner */}
          <div
            className={`p-5 rounded-2xl border shadow-xl flex items-center justify-between ${
              testResults.summary?.race_condition_passed
                ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                : 'bg-rose-950/40 border-rose-500/50 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-8 h-8 text-emerald-400 shrink-0" />
              <div>
                <h3 className="text-base font-bold text-white">
                  {testResults.summary?.race_condition_passed
                    ? (lang === 'vi' ? '✓ PASS: BẢO VỆ CHỐNG TRÙNG THÀNH CÔNG TUYỆT ĐỐI' : '✓ PASS: DUPLICATE PREVENTION FULLY VERIFIED')
                    : (lang === 'vi' ? '✕ FAIL: Phát hiện race condition!' : '✕ FAIL: Race condition detected!')}
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  {lang === 'vi' ? (
                    <>
                      Đã bắn {testResults.total_concurrent_requests} requests song song: Chỉ duy nhất{' '}
                      <strong className="text-emerald-400">
                        {testResults.summary?.success} request
                      </strong>{' '}
                      thành công,{' '}
                      <strong className="text-amber-400">
                        {testResults.summary?.already_checked_in} requests
                      </strong>{' '}
                      bị chặn với ALREADY_CHECKED_IN!
                    </>
                  ) : (
                    <>
                      Fired {testResults.total_concurrent_requests} parallel requests: Exactly{' '}
                      <strong className="text-emerald-400">
                        {testResults.summary?.success} request
                      </strong>{' '}
                      succeeded, and{' '}
                      <strong className="text-amber-400">
                        {testResults.summary?.already_checked_in} requests
                      </strong>{' '}
                      were safely blocked with ALREADY_CHECKED_IN!
                    </>
                  )}
                </p>
              </div>
            </div>

            <span className="px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 font-black text-xs border border-emerald-500/40 shrink-0">
              100% ATOMIC
            </span>
          </div>

          {/* Details breakdown per concurrent thread */}
          <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 shadow-lg space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              {lang === 'vi' ? 'Chi tiết phản hồi của từng thiết bị quét đồng thời:' : 'Response details per concurrent scanning device:'}
            </h4>

            <div className="space-y-2">
              {testResults.details?.map((res: any, idx: number) => {
                const isWinner = res.status === 'SUCCESS';
                return (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-3 rounded-xl border text-xs font-mono transition ${
                      isWinner
                        ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                        : 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-slate-400">#Thread {idx + 1}</span>
                      <span className="font-sans font-bold text-white">
                        {isWinner
                          ? (lang === 'vi' ? 'Thiết bị thắng lock đầu tiên' : 'Device winning atomic lock')
                          : (lang === 'vi' ? `Thiết bị gửi cùng lúc (${idx + 1})` : `Concurrent device (${idx + 1})`)}
                      </span>
                      {res.duration_ms && (
                        <span className="text-[10px] text-slate-400">
                          {res.duration_ms}ms {lang === 'vi' ? 'phản hồi' : 'latency'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          isWinner
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-amber-500 text-slate-950'
                        }`}
                      >
                        {res.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
