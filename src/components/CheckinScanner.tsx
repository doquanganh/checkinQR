import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import confetti from 'canvas-confetti';
import { EventItem, CheckinResponse, User } from '../types/index.js';
import { api } from '../services/api.js';
import { feedback } from '../utils/feedback.js';
import { useLanguage } from '../context/LanguageContext.js';
import {
  Camera,
  CameraOff,
  SwitchCamera,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  Sparkles,
  Zap,
  Volume2,
  VolumeX,
  History,
  QrCode,
  Upload,
} from 'lucide-react';

interface CheckinScannerProps {
  currentEvent: EventItem;
  currentUser: User;
}

export const CheckinScanner: React.FC<CheckinScannerProps> = ({
  currentEvent,
  currentUser,
}) => {
  const { lang, t } = useLanguage();
  const [scannerActive, setScannerActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [manualCode, setManualCode] = useState('');
  const [processing, setProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<CheckinResponse | null>(null);
  const [scanHistory, setScanHistory] = useState<
    Array<{ result: CheckinResponse; scannedAt: string }>
  >([]);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'qr-reader-container';

  // Device ID for audit log
  const deviceIdRef = useRef(
    'gate_' + (localStorage.getItem('device_scan_id') || Math.random().toString(36).substring(2, 8))
  );

  // Initialize camera scanner
  const startCamera = async () => {
    try {
      setCameraError(null);
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
      }

      const qrScanner = new Html5Qrcode(scannerContainerId, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
      html5QrCodeRef.current = qrScanner;

      await qrScanner.start(
        { facingMode: facingMode },
        {
          fps: 15,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const qrboxEdge = Math.floor(minEdge * 0.72);
            return { width: Math.max(qrboxEdge, 200), height: Math.max(qrboxEdge, 200) };
          },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          handleScannedCode(decodedText);
        },
        () => {
          // parse errors are normal while seeking QR
        }
      );

      setScannerActive(true);
    } catch (err: any) {
      console.warn('Camera start error:', err);
      setCameraError(t.cameraDeniedMsg);
      setScannerActive(false);
    }
  };

  const stopCamera = async () => {
    try {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
      }
    } catch {}
    setScannerActive(false);
  };

  // Flip Front / Rear camera
  const toggleFacingMode = async () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    if (scannerActive) {
      await stopCamera();
      setTimeout(startCamera, 300);
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // Main check-in processor
  const handleScannedCode = async (code: string) => {
    if (processing || !code.trim()) return;
    setProcessing(true);

    try {
      const response = await api.checkin({
        event_id: currentEvent.id,
        qr_token: code.trim(),
        staff_id: currentUser.id,
        staff_name: currentUser.name,
        device_id: deviceIdRef.current,
      });

      setLastResult(response);
      setScanHistory((prev) => [
        { result: response, scannedAt: new Date().toLocaleTimeString('vi-VN') },
        ...prev.slice(0, 19),
      ]);

      // Sound & Haptic Feedback & Confetti
      if (response.status === 'SUCCESS') {
        if (soundEnabled) feedback.playSuccess();
        feedback.triggerHaptic('success');
        try {
          confetti({
            particleCount: 80,
            spread: 60,
            origin: { y: 0.6 },
            colors: ['#10b981', '#3b82f6', '#f59e0b', '#ec4899'],
          });
        } catch {}
      } else if (response.status === 'ALREADY_CHECKED_IN') {
        if (soundEnabled) feedback.playWarning();
        feedback.triggerHaptic('warning');
      } else {
        if (soundEnabled) feedback.playError();
        feedback.triggerHaptic('error');
      }
    } catch (err: any) {
      const errResp: CheckinResponse = {
        success: false,
        status: 'ERROR',
        message: err.message || 'Lỗi kết nối máy chủ',
      };
      setLastResult(errResp);
      if (soundEnabled) feedback.playError();
    } finally {
      // Pause slightly so user can read screen before scanning again
      setTimeout(() => {
        setProcessing(false);
      }, 1500);
    }
  };

  // Upload QR Image fallback (for desktop testing or photo)
  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const scanner = new Html5Qrcode('qr-temp-reader');
      const result = await scanner.scanFile(file, true);
      handleScannedCode(result);
      scanner.clear();
    } catch {
      setLastResult({
        success: false,
        status: 'INVALID_QR',
        message: t.noQrFoundInImage,
      });
      feedback.playError();
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4 sm:space-y-5">
      {/* Hidden container for file scan */}
      <div id="qr-temp-reader" className="hidden" />

      {/* Checkin Top Bar Controls */}
      <div className="w-full flex items-center justify-between bg-slate-900/90 border border-slate-800 rounded-2xl p-3 px-4 shadow-lg gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="text-xs sm:text-sm font-bold text-white truncate min-w-0">
            {t.gateLabel}: <strong className="text-emerald-400 font-bold">{currentUser.name}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-xl border text-xs font-medium transition cursor-pointer ${
              soundEnabled
                ? 'bg-slate-800 border-slate-700 text-slate-200'
                : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
            }`}
            title={soundEnabled ? t.soundOff : t.soundOn}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {scannerActive && (
            <button
              onClick={toggleFacingMode}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs transition cursor-pointer"
              title={t.flipCamera}
            >
              <SwitchCamera className="w-4 h-4 text-indigo-400" />
            </button>
          )}
        </div>
      </div>

      {/* Main Viewfinder / Scanner Area */}
      <div className="w-full rounded-2xl sm:rounded-3xl bg-slate-900 border-2 border-slate-800 overflow-hidden shadow-2xl relative">
        {/* Camera Video Viewfinder */}
        <div className="relative w-full min-h-[340px] xs:min-h-[380px] sm:min-h-[440px] flex items-center justify-center bg-black overflow-hidden">
          <div
            id={scannerContainerId}
            className={`w-full h-full min-h-[340px] xs:min-h-[380px] sm:min-h-[440px] flex items-center justify-center overflow-hidden ${
              scannerActive ? 'flex' : 'hidden'
            }`}
          />

          {/* Centered QR Viewfinder Reticle Overlay */}
          {scannerActive && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
              <div className="w-56 h-56 sm:w-64 sm:h-64 border-2 border-emerald-400/90 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                {/* 4 Corner brackets */}
                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />
                {/* Center scan beam */}
                <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse" />
                <div className="absolute bottom-3 left-0 right-0 text-center">
                  <span className="text-[11px] font-bold text-white bg-black/75 px-3 py-1 rounded-full border border-emerald-400/30 shadow-md">
                    {t.alignQrInstruction}
                  </span>
                </div>
              </div>
            </div>
          )}

          {!scannerActive && (
            <div className="w-full max-w-sm mx-auto flex flex-col items-center justify-center text-center p-4 sm:p-6 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mx-auto text-indigo-400 shadow-xl">
                <Camera className="w-8 h-8" />
              </div>
              <div className="text-center">
                <h3 className="text-base font-bold text-white">{t.cameraReady}</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  {t.cameraReadyDesc}
                </p>
              </div>

              {cameraError && (
                <div className="w-full p-3 rounded-xl bg-amber-950/50 border border-amber-500/40 text-amber-200 text-xs text-left">
                  {cameraError}
                </div>
              )}

              <button
                onClick={startCamera}
                className="w-full max-w-xs mx-auto flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-sm sm:text-base shadow-xl shadow-emerald-600/30 transition transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
              >
                <Camera className="w-5 h-5" />
                <span>{t.btnStartCamera}</span>
              </button>
            </div>
          )}

          {scannerActive && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
              <button
                onClick={stopCamera}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black/70 hover:bg-black/90 backdrop-blur-md border border-white/20 text-white text-xs font-semibold shadow-lg transition cursor-pointer"
              >
                <CameraOff className="w-4 h-4 text-rose-400" />
                <span>{t.btnStopCamera}</span>
              </button>
            </div>
          )}
        </div>

        {/* Processing Indicator Overlay */}
        {processing && (
          <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center text-white space-y-3">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-400 border-t-transparent shadow-xl" />
            <p className="text-sm font-bold tracking-wide animate-pulse">
              {t.verifyingTicket}
            </p>
          </div>
        )}
      </div>

      {/* SCAN RESULT BANNER (Sections 11 & 12) */}
      {lastResult && (
        <div
          className={`rounded-2xl p-5 shadow-2xl border transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${
            lastResult.status === 'SUCCESS'
              ? 'bg-gradient-to-br from-emerald-950/90 via-slate-900 to-emerald-950/40 border-emerald-500/50 text-emerald-100'
              : lastResult.status === 'ALREADY_CHECKED_IN'
              ? 'bg-gradient-to-br from-amber-950/90 via-slate-900 to-amber-950/40 border-amber-500/50 text-amber-100'
              : 'bg-gradient-to-br from-rose-950/90 via-slate-900 to-rose-950/40 border-rose-500/50 text-rose-100'
          }`}
        >
          <div className="flex items-start gap-4">
            <div className="shrink-0 mt-0.5">
              {lastResult.status === 'SUCCESS' ? (
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-lg">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
              ) : lastResult.status === 'ALREADY_CHECKED_IN' ? (
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-lg">
                  <AlertTriangle className="w-7 h-7" />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shadow-lg">
                  <XCircle className="w-7 h-7" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-black tracking-wider uppercase ${
                    lastResult.status === 'SUCCESS'
                      ? 'bg-emerald-500 text-slate-950'
                      : lastResult.status === 'ALREADY_CHECKED_IN'
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-rose-500 text-white'
                  }`}
                >
                  {lastResult.status}
                </span>
                {lastResult.duration_ms && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    {lastResult.duration_ms}ms
                  </span>
                )}
              </div>

              {/* Guest Profile Details */}
              {lastResult.guest ? (
                <div className="mt-2 space-y-1">
                  <h4 className="text-xl font-black text-white tracking-tight truncate">
                    {lastResult.guest.name}
                  </h4>
                  <div className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <span className="truncate">{lastResult.guest.organization}</span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-400 truncate">{lastResult.guest.title}</span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono">
                    {t.guestCodeLabel}: <strong className="text-white">{lastResult.guest.code}</strong>
                  </div>
                </div>
              ) : (
                <p className="text-sm font-bold text-white mt-2">{lastResult.message}</p>
              )}

              {/* Audit Time and Staff details */}
              <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between text-xs text-slate-300 gap-2">
                {lastResult.checked_in_at ? (
                  <span>
                    {t.timeLabel}:{' '}
                    <strong>{new Date(lastResult.checked_in_at).toLocaleTimeString(lang === 'vi' ? 'vi-VN' : 'en-US')}</strong> (
                    {new Date(lastResult.checked_in_at).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US')})
                  </span>
                ) : (
                  <span>{lastResult.message}</span>
                )}
                {lastResult.checked_in_by && (
                  <span className="text-slate-400">
                    {t.byStaffLabel}: <strong className="text-slate-200">{lastResult.checked_in_by}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Code Input & Quick Test Buttons */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 shadow-lg space-y-3">
        <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
          <Search className="w-3.5 h-3.5 text-indigo-400" /> {t.manualInputDesc}
        </h4>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleScannedCode(manualCode);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder={t.manualPlaceholder}
            className="flex-1 rounded-xl bg-slate-900 border border-slate-700 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={!manualCode.trim() || processing}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-sm shadow-md transition cursor-pointer"
          >
            {t.btnConfirm}
          </button>
        </form>

        {/* Quick Demo Test Buttons */}
        <div className="pt-2 border-t border-slate-800">
          <div className="text-[11px] font-semibold text-slate-400 mb-2 flex items-center justify-between">
            <span>{t.demoTestCases}</span>
            <label className="cursor-pointer text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
              <Upload className="w-3 h-3" />
              <span>{t.scanFromImage}</span>
              <input type="file" accept="image/*" onChange={handleFileScan} className="hidden" />
            </label>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <button
              onClick={() => handleScannedCode('G202600001')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-left text-[11px] transition"
            >
              <div className="font-bold text-emerald-400">{t.demoGuest1Valid}</div>
              <div className="text-slate-400 truncate">Nguyễn Quang Anh</div>
            </button>

            <button
              onClick={() => handleScannedCode('G202600002')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-left text-[11px] transition"
            >
              <div className="font-bold text-emerald-400">{t.demoGuest2Valid}</div>
              <div className="text-slate-400 truncate">Nguyễn Ngọc Anh</div>
            </button>

            <button
              onClick={() => handleScannedCode('G202600001')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-amber-500/40 text-left text-[11px] transition"
            >
              <div className="font-bold text-amber-400">{t.demoGuest1Duplicate}</div>
              <div className="text-slate-400 truncate">Test ALREADY CHECKED</div>
            </button>

            <button
              onClick={() => handleScannedCode('QR_INVALID_RANDOM_XYZ')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-rose-500/40 text-left text-[11px] transition"
            >
              <div className="font-bold text-rose-400">{t.demoInvalidQr}</div>
              <div className="text-slate-400 truncate">Test INVALID_QR</div>
            </button>

            <button
              onClick={() => handleScannedCode('GTECH00001')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-rose-500/40 text-left text-[11px] transition"
            >
              <div className="font-bold text-rose-400">{t.demoWrongEvent}</div>
              <div className="text-slate-400 truncate">Test WRONG_EVENT</div>
            </button>

            <button
              onClick={() => handleScannedCode('G202600007')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-rose-500/40 text-left text-[11px] transition"
            >
              <div className="font-bold text-rose-400">{t.demoLockedGuest}</div>
              <div className="text-slate-400 truncate">Test GUEST_INACTIVE</div>
            </button>
          </div>
        </div>
      </div>

      {/* Recent scans on this device */}
      {scanHistory.length > 0 && (
        <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 shadow-lg">
          <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider mb-3">
            <History className="w-3.5 h-3.5 text-indigo-400" /> {t.recentScansTitle}
          </h4>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {scanHistory.map((h, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-slate-500">{h.scannedAt}</span>
                  <span className="font-bold text-white">
                    {h.result.guest?.name || t.codePrefix + h.result.status}
                  </span>
                </div>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    h.result.status === 'SUCCESS'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : h.result.status === 'ALREADY_CHECKED_IN'
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-rose-500/20 text-rose-300'
                  }`}
                >
                  {h.result.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
